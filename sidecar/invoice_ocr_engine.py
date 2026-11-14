"""Loopback OCR sidecar. Policy endpoints validate proposals; they never post money."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import threading
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts/p2p-lineage-contract.json"
MAX_BODY = 65536
SCALE = 2


class Refusal(Exception):
    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code = status, code


def _number(value, code="INVALID_REQUEST", status=400) -> Decimal:
    try:
        number = Decimal(str(value))
        if not number.is_finite() or number <= 0:
            raise InvalidOperation
        return number
    except (InvalidOperation, ValueError):
        raise Refusal(status, code, "A positive finite decimal is required") from None


class InvoiceOCREngine:
    def __init__(self, docs_dir, *, fast_smoke=False, contract_path=CONTRACT_PATH):
        self.docs_dir = Path(docs_dir)
        self.fast_smoke = fast_smoke
        self.item = json.loads(Path(contract_path).read_text())["primaryItem"]
        self.quantity = _number(self.item["quantityFt"])
        self.rate = _number(self.item["unitPriceUsd"])
        self.total = _number(self.item["totalUsd"])
        if self.quantity * self.rate != self.total:
            raise ValueError("Contract quantity, rate and total disagree")
        self.names = [self.item["tradeDocuments"][key] for key in (
            "purchaseOrder", "orderAcknowledgement", "billOfLading",
            "packingSlipAndMillCert", "vendorInvoice")]
        if any(Path(name).name != name for name in self.names):
            raise ValueError("Contract document names must be basenames")
        self.lock = threading.RLock()
        self.ocr = None
        if not fast_smoke:
            try:
                from rapidocr_onnxruntime import RapidOCR
                self.ocr = RapidOCR(intra_op_num_threads=1, inter_op_num_threads=1)
            except Exception as exc:
                raise Refusal(503, "OCR_UNAVAILABLE", "RapidOCR model initialization failed") from exc

    def _rows(self, name):
        item = self.item
        return [
            f"TRADE DOCUMENT: {name.removesuffix('.pdf')}",
            f"VENDOR: {item['vendorName']}",
            f"PURCHASE ORDER: {item['dealId']}",
            f"VENDOR OA: {item['tradeDocuments']['orderAcknowledgementNumber']}",
            f"ITEM SKU: {item['sku']}",
            "DESCRIPTION: 2/0 AWG Bare Stranded Copper Wire",
            "SPECIFICATION: ASTM B8 / 19-Strand",
            f"QUANTITY FT: {self.quantity:f}",
            f"UNIT PRICE USD: {self.rate:.2f}",
            f"TOTAL DUE USD: {self.total:.2f}",
            f"UOM: {item['uom']}",
            f"SUPPLIER ID: {item['wmsSupplierId']}",
            f"PART ID: {item['wmsPartId']}",
            f"SUPPLIER PART ID: {item['wmsSupplierPartId']}",
            "SHIP TO: WH-TX-NORTH",
            f"LOCATION ID: {item['wmsLocationId']}",
            f"REEL COUNT: {item['lowStockTrigger']['reelCount']}",
            f"FEET PER REEL: {item['lowStockTrigger']['ftPerReel']}",
            *[f"REEL BARCODE: {code}" for code in item['lowStockTrigger']['reelBarcodes']],
            f"NET COPPER WEIGHT LBS: {item['lowStockTrigger']['copperWeightLbs']}",
            f"COPPER LB PER FT: {item['lowStockTrigger']['copperLbPerFt']}",
            f"BILL OF LADING: {item['tradeDocuments']['billOfLading']}",
            f"PACKING SLIP: {item['tradeDocuments']['packingSlipAndMillCert']}",
            f"INVOICE: {item['tradeDocuments']['vendorInvoice']}",
            f"FY2026 STANDARD COST USD PER FT: {item['lowStockTrigger']['catalogUnitPriceUsd']:.2f}",
            f"STANDARD INVENTORY VALUE USD: {item['lowStockTrigger']['catalogEstimateUsd']:.2f}",
            "GRNI ACCOUNT: 201200",
            "TRADE PAYABLES ACCOUNT: 201100",
            "OPERATING BANK ACCOUNT: 101100 / 8801",
            f"SETTLEMENT REFERENCE: {item['settlement']['checkNumber']}",
            f"ACH REFERENCE: {item['settlement']['achTrace']}",
            "DOCUMENT STATUS: Generated trade evidence; not a payment authorization",
        ]

    def _pdf_bytes(self, name):
        from reportlab.pdfgen.canvas import Canvas
        stream = io.BytesIO()
        canvas = Canvas(stream, pagesize=(612, 792), invariant=1, pageCompression=0)
        canvas.setTitle(name.removesuffix(".pdf"))
        canvas.setAuthor(self.item["vendorName"])
        canvas.setFont("Helvetica", 11)
        for index, text in enumerate(self._rows(name)):
            canvas.drawString(36, 750 - index * 19, text)
        canvas.showPage()
        canvas.save()
        return stream.getvalue()

    def generate_documents(self):
        with self.lock:
            self.docs_dir.mkdir(parents=True, exist_ok=True)
            documents = []
            for name in self.names:
                data = self._pdf_bytes(name)
                # Serialize generation and replace each complete file atomically.
                temporary = self.docs_dir / (name + ".tmp")
                try:
                    temporary.write_bytes(data)
                    temporary.replace(self.docs_dir / name)
                finally:
                    temporary.unlink(missing_ok=True)
                documents.append({"name": name, "sha256": hashlib.sha256(data).hexdigest()})
            return {"documents": documents, "quantityFt": int(self.quantity),
                    "unitPriceUsd": f"{self.rate:.2f}", "totalUsd": f"{self.total:.2f}"}

    def extract_invoice(self):
        import pypdfium2 as pdfium
        with self.lock:
            name = self.item["tradeDocuments"]["vendorInvoice"]
            try:
                data = (self.docs_dir / name).read_bytes()
            except FileNotFoundError:
                raise Refusal(409, "DOCUMENT_INTEGRITY_HOLD", "Generate invoice before OCR") from None
            digest = hashlib.sha256(data).hexdigest()
            # A known source is mandatory in smoke mode: never label foreign bytes with fabricated fields.
            if self.fast_smoke and data != self._pdf_bytes(name):
                raise Refusal(409, "DOCUMENT_INTEGRITY_HOLD", "Smoke invoice differs from generated evidence")
            try:
                document = pdfium.PdfDocument(data)
                try:
                    if len(document) != 1:
                        raise ValueError("Expected the single-page trade invoice")
                    page = document[0]
                    try:
                        bitmap = page.render(scale=SCALE)
                        try:
                            image = bitmap.to_pil().convert("RGB")
                        finally:
                            bitmap.close()
                    finally:
                        page.close()
                finally:
                    document.close()
            except Exception as exc:
                raise Refusal(409, "DOCUMENT_INTEGRITY_HOLD", "Invoice PDF cannot be rendered") from exc
            try:
                width, height = image.size
                # The rendered page OCR read, so the desk can overlay the boxes on the same pixels.
                image_name = name.removesuffix(".pdf") + ".png"
                temporary = self.docs_dir / (image_name + ".tmp")
                try:
                    image.save(temporary, format="PNG")
                    temporary.replace(self.docs_dir / image_name)
                finally:
                    temporary.unlink(missing_ok=True)
                if self.fast_smoke:
                    from reportlab.pdfbase.pdfmetrics import stringWidth
                    boxes = []
                    for index, text in enumerate(self._rows(name)):
                        x, baseline = 36 * SCALE, (750 - index * 19) * SCALE
                        top, bottom = height - baseline - 11 * SCALE, height - baseline + 3 * SCALE
                        right = x + stringWidth(text, "Helvetica", 11) * SCALE
                        boxes.append({"text": text, "confidence": 1.0, "page": 1,
                                      "box": [[x, top], [right, top], [right, bottom], [x, bottom]]})
                else:
                    try:
                        import numpy as np
                        results, _ = self.ocr(np.asarray(image))
                    except Exception as exc:
                        raise Refusal(503, "OCR_UNAVAILABLE", "Invoice OCR failed") from exc
                    boxes = [{"box": [[float(x), float(y)] for x, y in polygon],
                              "text": str(text), "confidence": float(score), "page": 1}
                             for polygon, text, score in (results or [])]
                text = "\n".join(box["text"] for box in boxes)
                fields = {}
                for field, label in (("quantityFt", "QUANTITY FT"),
                                     ("unitPriceUsd", "UNIT PRICE USD"), ("totalUsd", "TOTAL DUE USD")):
                    values = re.findall(r"^[ \t]*" + r"[ \t]*".join(label.split())
                                        + r"[ \t]*[:：]?[ \t]*(.*)$", text, re.I | re.M)
                    if len(values) != 1 or not re.fullmatch(
                        r"(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)(?:\.[0-9]+)?", values[0].strip()
                    ):
                        raise Refusal(503, "OCR_UNAVAILABLE", "Invoice amount fields are unreadable or ambiguous")
                    value = _number(values[0].strip().replace(",", ""))
                    fields[field] = int(value) if field == "quantityFt" and value == value.to_integral_value() else format(value, "f")
                return {"engine": "deterministic-smoke" if self.fast_smoke else "rapidocr-onnxruntime",
                        "boxes": boxes, "width": width, "height": height, "sha256": digest, "fields": fields,
                        "image": image_name}
            finally:
                image.close()

    def match_invoice(self, invoice):
        if not isinstance(invoice, dict):
            raise Refusal(409, "MATCH_VARIANCE_HOLD", "Invoice fields are required")
        for field, locked in (("quantityFt", self.quantity), ("unitPriceUsd", self.rate), ("totalUsd", self.total)):
            actual = _number(invoice.get(field), "MATCH_VARIANCE_HOLD", 409)
            if actual != locked:
                raise Refusal(409, "MATCH_VARIANCE_HOLD", "Ordered, received and invoiced amounts must agree")
        return {"varianceUsd": "0.00", "amountUsd": f"{self.total:.2f}",
                "debitAccount": "201200", "creditAccount": "201100", "posted": False}

    def check_payment(self, payment):
        if not isinstance(payment, dict):
            raise Refusal(400, "INVALID_REQUEST", "Payment object is required")
        if payment.get("empId") == "EMP-AI-KAL":
            raise Refusal(403, "AI_STEWARD_ZERO_AUTHORITY", "KAL has zero signing authority")
        amount = _number(payment.get("amountUsd"))
        if amount.as_tuple().exponent < -2:
            raise Refusal(400, "INVALID_REQUEST", "Payment must use whole cents")
        if payment.get("empId") != "EMP-0007" or amount > Decimal("500000"):
            raise Refusal(403, "CFO_AUTHORITY_REQUIRED", "CFO EMP-0007 and 500000 USD limit required")
        if payment.get("accountCode") != "101100" or payment.get("accountNumber") != "8801":
            raise Refusal(403, "BANK_POLICY_VIOLATION", "Operating Checking 101100 / 8801 required")
        if amount != self.total:
            raise Refusal(409, "MATCH_VARIANCE_HOLD", "Payment must equal the matched invoice total")
        return {"amountUsd": f"{amount:.2f}", "debitAccount": "201100", "creditAccount": "101100",
                **self.item["settlement"], "posted": False}


def make_server(engine: InvoiceOCREngine, port=3591):
    class Handler(BaseHTTPRequestHandler):
        def setup(self):
            super().setup()
            self.connection.settimeout(10)

        def log_message(self, *_args):
            pass

        def _respond(self, status, data):
            encoded = json.dumps(data, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(encoded)
            self.close_connection = True

        def do_GET(self):
            if self.path == "/health":
                self._respond(200, {"ok": True, "engine": "deterministic-smoke" if engine.fast_smoke else "rapidocr-onnxruntime"})
            else:
                self._respond(404, {"error": "NOT_FOUND"})

        def do_POST(self):
            try:
                if self.path not in {"/generate", "/ocr", "/match", "/payment-check"}:
                    raise Refusal(404, "NOT_FOUND", "Unknown sidecar route")
                if self.headers.get("Transfer-Encoding"):
                    raise Refusal(400, "INVALID_REQUEST", "Content-Length is required")
                lengths = self.headers.get_all("Content-Length", [])
                if len(lengths) != 1 or not lengths[0].isdigit():
                    raise Refusal(400, "INVALID_REQUEST", "One valid Content-Length is required")
                length = int(lengths[0])
                if length > MAX_BODY:
                    raise Refusal(413, "REQUEST_TOO_LARGE", "JSON body limit is 64 KiB")
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise Refusal(400, "INVALID_REQUEST", "Incomplete request body")
                body = json.loads(raw or b"{}")
                if not isinstance(body, dict):
                    raise Refusal(400, "INVALID_REQUEST", "Expected a JSON object")
                if self.path in {"/generate", "/ocr"}:
                    if body:
                        raise Refusal(400, "INVALID_REQUEST", "This route accepts only an empty object")
                    result = engine.generate_documents() if self.path == "/generate" else engine.extract_invoice()
                elif self.path == "/match":
                    result = engine.match_invoice(body)
                else:
                    result = engine.check_payment(body)
                self._respond(200, result)
            except Refusal as exc:
                self._respond(exc.status, {"error": exc.code, "message": str(exc)})
            except (ValueError, UnicodeError, TimeoutError):
                self._respond(400, {"error": "INVALID_REQUEST", "message": "Invalid JSON request"})
            except OSError:
                self._respond(503, {"error": "OCR_UNAVAILABLE", "message": "Document storage unavailable"})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-dir", default="sor-sandbox/docs")
    parser.add_argument("--fast-smoke", action="store_true", help="Explicit deterministic layout boxes; no OCR model")
    parser.add_argument("--port", type=int, default=int(os.environ.get("OCR_PORT", "3591")))
    parser.add_argument("command", choices=("generate", "ocr", "serve"))
    args = parser.parse_args(argv)
    try:
        engine = InvoiceOCREngine(args.docs_dir, fast_smoke=args.fast_smoke)
        if args.command == "serve":
            with make_server(engine, args.port) as server:
                # Ready line: the model is loaded and the socket is bound (--port 0 picks a free port).
                print(json.dumps({"ok": True, "url": "http://127.0.0.1:%d" % server.server_address[1],
                                  "docsDir": str(engine.docs_dir.resolve())}), flush=True)
                server.serve_forever()
        else:
            result = engine.generate_documents() if args.command == "generate" else engine.extract_invoice()
            print(json.dumps(result, allow_nan=False))
        return 0
    except Refusal as exc:
        print(json.dumps({"error": exc.code, "message": str(exc)}))
        return 1
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
