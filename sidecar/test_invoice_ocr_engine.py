"""Behavioral checks use real PDFs, renderers and HTTP with temporary roots."""
import hashlib
import http.client
import json
import subprocess
import sys
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from sidecar.invoice_ocr_engine import InvoiceOCREngine, Refusal, make_server


@pytest.fixture
def engine(tmp_path):
    return InvoiceOCREngine(tmp_path / "docs", fast_smoke=True)


def invoice(**updates):
    return {"quantityFt": 8000, "unitPriceUsd": "2.70", "totalUsd": "21600.00", **updates}


def payment(**updates):
    return {"empId": "EMP-0007", "accountCode": "101100", "accountNumber": "8801",
            "amountUsd": "21600.00", **updates}


def test_five_trade_pdfs_and_deterministic_pixel_boxes(engine):
    docs = engine.generate_documents()["documents"]
    assert {d["name"] for d in docs} == {
        "PO-25800.pdf", "ENC-OA-2026-884192.pdf", "BOL-25800.pdf", "PS-25800.pdf", "INV-25800.pdf"}
    for doc in docs:
        data = (engine.docs_dir / doc["name"]).read_bytes()
        assert data.startswith(b"%PDF-")
        assert doc["sha256"] == hashlib.sha256(data).hexdigest()
    result = engine.extract_invoice()
    assert result["engine"] == "deterministic-smoke"
    assert result == engine.extract_invoice()
    assert len(result["boxes"]) >= 28
    for box in result["boxes"]:
        points = box["box"]
        assert len(points) == 4
        assert 0 <= points[0][0] < points[1][0] <= result["width"]
        assert 0 <= points[0][1] < points[2][1] <= result["height"]
        assert box["page"] == 1 and box["text"]
    assert result["fields"] == invoice()
    from PIL import Image
    assert result["image"] == "INV-25800.png"
    with Image.open(engine.docs_dir / result["image"]) as page:
        assert (page.format, page.size) == ("PNG", (result["width"], result["height"]))
    assert not list(engine.docs_dir.glob("*.tmp"))


def test_generation_is_reproducible_and_new_instance_can_read(engine):
    first = engine.generate_documents()
    assert first == engine.generate_documents()
    other = InvoiceOCREngine(engine.docs_dir, fast_smoke=True)
    assert other.extract_invoice()["fields"] == invoice()


def test_missing_invoice_is_explicit(engine):
    with pytest.raises(Refusal) as error:
        engine.extract_invoice()
    assert error.value.code == "DOCUMENT_INTEGRITY_HOLD"


def test_smoke_never_fabricates_boxes_for_mutated_invoice(engine):
    engine.generate_documents()
    path = engine.docs_dir / "INV-25800.pdf"
    path.write_bytes(path.read_bytes() + b"tampered")
    with pytest.raises(Refusal) as error:
        engine.extract_invoice()
    assert (error.value.status, error.value.code) == (409, "DOCUMENT_INTEGRITY_HOLD")


def test_match_proposes_exact_grni_transfer_without_posting(engine):
    result = engine.match_invoice(invoice())
    assert result["varianceUsd"] == "0.00"
    assert result["debitAccount"] == "201200"
    assert result["creditAccount"] == "201100"
    assert result["amountUsd"] == "21600.00"
    assert result["posted"] is False
    assert not engine.docs_dir.exists()


@pytest.mark.parametrize("updates", [
    {"unitPriceUsd": "2.89", "totalUsd": "23120.00"}, {"totalUsd": "22100.00"},
    {"quantityFt": 7999}, {"totalUsd": "21599.99"}, {"totalUsd": "21600.001"},
    {"quantityFt": True}, {"unitPriceUsd": "NaN"}, {"totalUsd": "Infinity"},
    {"unitPriceUsd": None}, {"unitPriceUsd": "2.70000000000000000001"},
])
def test_any_match_variance_or_invalid_number_is_held(engine, updates):
    with pytest.raises(Refusal) as error:
        engine.match_invoice(invoice(**updates))
    assert (error.value.status, error.value.code) == (409, "MATCH_VARIANCE_HOLD")


def test_match_requires_all_invoice_fields(engine):
    with pytest.raises(Refusal) as error:
        engine.match_invoice({"quantityFt": 8000})
    assert error.value.code == "MATCH_VARIANCE_HOLD"


def test_cfo_operating_payment_proposal(engine):
    result = engine.check_payment(payment())
    assert result["checkNumber"] == "Check #10045"
    assert result["achTrace"] == "ACH-000582"
    assert result["debitAccount"] == "201100" and result["creditAccount"] == "101100"
    assert result["posted"] is False


@pytest.mark.parametrize("updates,code", [
    ({"accountCode": "101200", "accountNumber": "4409"}, "BANK_POLICY_VIOLATION"),
    ({"accountNumber": "4409"}, "BANK_POLICY_VIOLATION"),
    ({"empId": "EMP-0002"}, "CFO_AUTHORITY_REQUIRED"),
    ({"empId": "EMP-AI-KAL"}, "AI_STEWARD_ZERO_AUTHORITY"),
    ({"amountUsd": "500000.01"}, "CFO_AUTHORITY_REQUIRED"),
    ({"amountUsd": "-1"}, "INVALID_REQUEST"),
    ({"amountUsd": "21600.001"}, "INVALID_REQUEST"),
    ({"amountUsd": "500.00"}, "MATCH_VARIANCE_HOLD"),
])
def test_payment_refusals(engine, updates, code):
    with pytest.raises(Refusal) as error:
        engine.check_payment(payment(**updates))
    assert error.value.code == code


def test_parallel_generation_returns_complete_identical_pdfs(engine):
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: engine.generate_documents(), range(4)))
    assert all(r == results[0] for r in results)
    assert engine.extract_invoice()["fields"] == invoice()


@pytest.fixture
def server(engine):
    server = make_server(engine, port=0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()
    server.server_close()
    thread.join(timeout=3)


def request(server, method, path, body=None):
    conn = http.client.HTTPConnection(*server.server_address, timeout=10)
    headers = {"Content-Type": "application/json"}
    conn.request(method, path, body=body, headers=headers)
    response = conn.getresponse()
    result = response.status, json.loads(response.read())
    conn.close()
    return result


def test_live_http_generation_ocr_match_and_payment(server):
    assert server.server_address[0] == "127.0.0.1"
    assert request(server, "GET", "/health")[0] == 200
    assert request(server, "POST", "/generate", "{}")[0] == 200
    assert len(request(server, "POST", "/ocr", "{}")[1]["boxes"]) >= 28
    assert request(server, "POST", "/match", json.dumps(invoice()))[0] == 200
    status, body = request(server, "POST", "/match", json.dumps(invoice(totalUsd="22100")))
    assert (status, body["error"]) == (409, "MATCH_VARIANCE_HOLD")
    assert request(server, "POST", "/payment-check", json.dumps(payment()))[0] == 200
    status, body = request(server, "POST", "/payment-check", json.dumps(payment(accountCode="101200")))
    assert (status, body["error"]) == (403, "BANK_POLICY_VIOLATION")


@pytest.mark.parametrize("path,body,status,code", [
    ("/bad", "{}", 404, "NOT_FOUND"), ("/ocr", "[]", 400, "INVALID_REQUEST"),
    ("/ocr", "{", 400, "INVALID_REQUEST"), ("/generate", '{"docs_dir":"/tmp/escape"}', 400, "INVALID_REQUEST"),
    ("/ocr", '{"fast_smoke":true}', 400, "INVALID_REQUEST"),
    ("/ocr", " " * 65537, 413, "REQUEST_TOO_LARGE"),
], ids=["not-found", "array-body", "malformed-json", "unexpected-docs-dir", "unexpected-fast-smoke", "oversized-body-413"])
def test_http_refuses_bad_requests(server, path, body, status, code):
    actual, result = request(server, "POST", path, body)
    assert (actual, result["error"]) == (status, code)


def test_cli_smoke_uses_requested_temporary_root(tmp_path):
    script = Path(__file__).with_name("invoice_ocr_engine.py")
    command = [sys.executable, str(script), "--docs-dir", str(tmp_path / "docs"), "--fast-smoke"]
    generated = subprocess.run(command + ["generate"], capture_output=True, text=True, timeout=20)
    assert generated.returncode == 0, generated.stderr
    assert len(json.loads(generated.stdout)["documents"]) == 5
    extracted = subprocess.run(command + ["ocr"], capture_output=True, text=True, timeout=20)
    assert extracted.returncode == 0, extracted.stderr
    assert len(json.loads(extracted.stdout)["boxes"]) >= 28


def test_cli_serve_prints_ready_line_with_bound_port(tmp_path):
    script = Path(__file__).with_name("invoice_ocr_engine.py")
    command = [sys.executable, str(script), "--docs-dir", str(tmp_path / "docs"), "--fast-smoke", "--port", "0", "serve"]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, text=True)
    try:
        ready = json.loads(process.stdout.readline())
        assert ready["ok"] is True and ready["docsDir"] == str((tmp_path / "docs").resolve())
        host, port = ready["url"].removeprefix("http://").split(":")
        assert host == "127.0.0.1" and int(port) > 0
        conn = http.client.HTTPConnection(host, int(port), timeout=10)
        conn.request("GET", "/health")
        assert conn.getresponse().status == 200
        conn.close()
    finally:
        process.terminate()
        process.wait(timeout=10)
        process.stdout.close()


def test_real_rapidocr_extracts_rendered_invoice_and_reuses_model(tmp_path):
    engine = InvoiceOCREngine(tmp_path / "docs")
    engine.generate_documents()
    model = engine.ocr
    first = engine.extract_invoice()
    second = engine.extract_invoice()
    assert engine.ocr is model
    assert first["engine"] == second["engine"] == "rapidocr-onnxruntime"
    assert len(first["boxes"]) >= 28
    text = " ".join(b["text"] for b in first["boxes"])
    assert "Encore" in text and "25800" in text
    assert first["fields"] == invoice()


def test_http_deep_json_returns_structured_refusal(server):
    status, body = request(server, "POST", "/match", "[" * 30000 + "0" + "]" * 30000)
    assert (status, body["error"]) == (400, "INVALID_REQUEST")


@pytest.mark.parametrize("extra_line", ["UNIT PRICE USD: 2.70e9", "UNIT PRICE USD: 2.70"])
def test_real_ocr_refuses_numeric_suffix_and_duplicate_amount_fields(tmp_path, extra_line):
    from reportlab.pdfgen.canvas import Canvas
    engine = InvoiceOCREngine(tmp_path / "docs")
    engine.docs_dir.mkdir()
    path = engine.docs_dir / "INV-25800.pdf"
    canvas = Canvas(str(path), pagesize=(612, 792))
    canvas.setFont("Helvetica", 14)
    lines = ["QUANTITY FT: 8000", extra_line, "TOTAL DUE USD: 21600.00"]
    if extra_line == "UNIT PRICE USD: 2.70":
        lines.append("UNIT PRICE USD: 2.89")
    for index, line in enumerate(lines):
        canvas.drawString(36, 750 - index * 40, line)
    canvas.save()
    with pytest.raises(Refusal) as error:
        engine.extract_invoice()
    assert error.value.code == "OCR_UNAVAILABLE"


def test_real_ocr_refuses_unexamined_extra_invoice_pages(tmp_path):
    from reportlab.pdfgen.canvas import Canvas
    engine = InvoiceOCREngine(tmp_path / "docs")
    engine.docs_dir.mkdir()
    canvas = Canvas(str(engine.docs_dir / "INV-25800.pdf"), pagesize=(612, 792))
    canvas.setFont("Helvetica", 14)
    for index, line in enumerate(["QUANTITY FT: 8000", "UNIT PRICE USD: 2.70", "TOTAL DUE USD: 21600.00"]):
        canvas.drawString(36, 750 - index * 40, line)
    canvas.showPage()
    canvas.drawString(36, 750, "ADDITIONAL INVOICE CHARGE USD: 500.00")
    canvas.save()
    with pytest.raises(Refusal) as error:
        engine.extract_invoice()
    assert (error.value.status, error.value.code) == (409, "DOCUMENT_INTEGRITY_HOLD")
