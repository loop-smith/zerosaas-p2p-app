"""Loopback OCR sidecar. Policy endpoints validate proposals; they never post money."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import re
import threading
import time
from decimal import Decimal, InvalidOperation
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
from pathlib import Path

CONTRACT_PATH = Path(__file__).resolve().parents[1] / "contracts/p2p-lineage-contract.json"
MAX_BODY = 65536
SCALE = 2
WARM_OCR_ENGINE = None
WARM_OCR_LOCK = threading.RLock()


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


class _Rect:
    def __init__(self, x0, y0, x1, y1):
        self.x0, self.y0, self.x1, self.y1 = x0, y0, x1, y1


class _TopDownPdfDoc:
    """Permissive BSD/Apache-2.0 drop-in replacement for top-down PDF drawing & rasterization."""

    FONT_MAP = {
        "helv": "Helvetica",
        "hebo": "Helvetica-Bold",
    }

    def __init__(self):
        self._buf = BytesIO()
        self._canvas = None
        self._height = 520

    def new_page(self, width=612, height=520):
        from reportlab.pdfgen import canvas as rl_canvas
        self._height = height
        self._canvas = rl_canvas.Canvas(self._buf, pagesize=(width, height))
        return self

    def draw_rect(self, rect, color=None, fill=None, width=1.0):
        c = self._canvas
        c.saveState()
        c.setLineWidth(width)
        if color is not None:
            c.setStrokeColorRGB(*color)
        if fill is not None:
            c.setFillColorRGB(*fill)
        c.rect(
            rect.x0,
            self._height - rect.y1,
            rect.x1 - rect.x0,
            rect.y1 - rect.y0,
            stroke=1 if color is not None else 0,
            fill=1 if fill is not None else 0,
        )
        c.restoreState()

    def insert_text(self, pt, text, fontsize=10, fontname="helv", color=(0, 0, 0)):
        c = self._canvas
        c.saveState()
        c.setFont(self.FONT_MAP.get(fontname, "Helvetica"), fontsize)
        c.setFillColorRGB(*color)
        c.drawString(pt[0], self._height - pt[1], str(text))
        c.restoreState()

    def to_bytes(self):
        if self._canvas is not None:
            self._canvas.showPage()
            self._canvas.save()
            self._canvas = None
        return self._buf.getvalue()

    def save(self, out_path):
        data = self.to_bytes()
        with open(out_path, "wb") as f:
            f.write(data)

    def render_png(self, png_path, dpi=135):
        import pypdfium2
        data = self.to_bytes()
        pdf = pypdfium2.PdfDocument(data)
        try:
            page = pdf[0]
            try:
                bitmap = page.render(scale=float(dpi) / 72.0)
                try:
                    img = bitmap.to_pil().convert("RGB")
                    try:
                        img.save(png_path, "PNG")
                    finally:
                        img.close()
                finally:
                    bitmap.close()
            finally:
                page.close()
        finally:
            pdf.close()

    def close(self):
        self._buf.close()


def _create_warm_rapidocr():
    from rapidocr_onnxruntime import RapidOCR
    import numpy as np
    from PIL import Image, ImageDraw

    threads = min(4, max(1, os.cpu_count() or 4))
    ocr = RapidOCR(intra_op_num_threads=threads, inter_op_num_threads=1)
    # Pre-warm ONNX Runtime JIT kernels (det + rec) at startup so the first live /scan runs in <1s.
    warm_img = Image.new("RGB", (200, 48), (255, 255, 255))
    try:
        draw = ImageDraw.Draw(warm_img)
        draw.text((10, 14), "INV-25800 8000", fill=(0, 0, 0))
        ocr(np.asarray(warm_img), use_cls=False)
    finally:
        warm_img.close()
    return ocr


def get_ocr_engine():
    global WARM_OCR_ENGINE
    with WARM_OCR_LOCK:
        if WARM_OCR_ENGINE is None:
            WARM_OCR_ENGINE = _create_warm_rapidocr()
        return WARM_OCR_ENGINE


FIXTURE_SPECS = [
    {
        "deal_id": "PO-25800",
        "invoice_id": "INV-25800",
        "po_file": "PO-25800.pdf",
        "oa_id": "ENC-OA-2026-884192",
        "bol_id": "BOL-25800",
        "ps_id": "PS-25800",
        "oa_file": "ENC-OA-2026-884192.pdf",
        "bol_file": "BOL-25800.pdf",
        "ps_file": "PS-25800.pdf",
        "eml_file": "EMAIL-INV-25800.eml",
        "pdf_file": "INV-25800.pdf",
        "png_file": "INV-25800.png",
        "from_addr": "ar-billing@encorewire.com",
        "to_addr": "ap@company-8090.com",
        "subject": "Encore Wire Invoice INV-25800 for Purchase Order PO-25800 ($21,600.00)",
        "email_body": (
            "Attached please find Encore Wire Commercial Invoice INV-25800 covering your spot-locked delivery "
            "of 8,000 FT (4 x 2,000-FT Master Reels, 3,288 lbs Cu) 2/0 AWG Bare Stranded Copper Wire "
            "(ITM-CU-20-BARE) @ $2.70/FT (Live COMEX HG $6.26/lb spot lock) under PO-25800 / ENC-OA-2026-884192 / BOL-25800."
        ),
        "vendor_header": "ENCORE WIRE CORPORATION",
        "vendor_sub": "1329 Millwood Rd, McKinney, TX 75069 - Industrial Copper Conductor Mill",
        "order_date": "2026-11-12",
        "delivery_date": "2026-11-13",
        "invoice_date": "2026-11-13",
        "po_ref": "PO-25800",
        "ship_to": "WH-TX-NORTH - DFW Central Receiving Dock 01 (Irving, TX)",
        "sku": "ITM-CU-20-BARE",
        "description": "2/0 AWG Bare Stranded Copper Wire (4x2000FT Reels)",
        "qty_int": 8000,
        "reels_count": 4,
        "qty_str": "8,000",
        "uom_str": "FT",
        "weight_str": "3,288 LBS Net Copper (4 Master Reels · 0.411 lb/FT)",
        "spot_cu_lb_str": "$6.26/lb",
        "spot_basis_str": "Live COMEX HG $6.26/lb + $0.32 Mill Adder ($2.70/FT vs $2.89/FT Std)",
        "unit_price_str": "$2.70",
        "line_total_str": "$21,600.00",
        "total_due_str": "$21,600.00",
        "terms": "Net 30 Days - Approved 3-Way Match Settlement (Check / ACH)",
    },
]


def build_dynamic_copper_spec(overrides=None):
    base = dict(FIXTURE_SPECS[0])
    if not overrides:
        return base
    qty_ft = int(overrides.get("qtyFt", 8000))
    reels_count = max(1, round(qty_ft / 2000))
    unit_price = round(float(overrides.get("unitPrice", 2.70)), 2)
    total_usd = round(qty_ft * unit_price, 2)
    spot_lb = float(overrides.get("spotCopperPerLbUsd", 6.26))
    cat_price = float(overrides.get("catalogUnitPrice", 2.89))
    copper_lbs = int(overrides.get("copperLbs", 3288))
    spot_src = str(overrides.get("spotSource", "COMEX HG"))
    deliv_date = str(overrides.get("deliveryDate", base["delivery_date"]))

    unit_str = f"${unit_price:,.2f}"
    total_str = f"${total_usd:,.2f}"
    spot_lb_str = f"${spot_lb:,.2f}/lb"
    base["qty_int"] = qty_ft
    base["reels_count"] = reels_count
    base["delivery_date"] = deliv_date
    base["qty_str"] = f"{qty_ft:,}"
    base["description"] = f"2/0 AWG Bare Stranded Copper Wire ({reels_count}x2000FT Reels)"
    base["weight_str"] = f"{copper_lbs:,} LBS Net Copper ({reels_count} Master Reels · 0.411 lb/FT)"
    base["spot_cu_lb_str"] = spot_lb_str
    base["spot_basis_str"] = f"Live {spot_src} {spot_lb_str} + $0.32 Adder -> {unit_str}/FT (vs ${cat_price:,.2f}/FT Std)"
    base["unit_price_str"] = unit_str
    base["line_total_str"] = total_str
    base["total_due_str"] = total_str
    base["subject"] = f"Encore Wire Invoice INV-25800 for Purchase Order PO-25800 ({total_str})"
    base["email_body"] = (
        f"Attached please find Encore Wire Commercial Invoice INV-25800 covering your spot-locked delivery "
        f"of {qty_ft:,} FT ({reels_count} x 2,000-FT Master Reels, {copper_lbs:,} lbs Cu) 2/0 AWG Bare Stranded Copper Wire "
        f"(ITM-CU-20-BARE) @ {unit_str}/FT (Live {spot_src} {spot_lb_str} spot lock) under PO-25800 / {base['oa_id']} / BOL-25800."
    )
    return base


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def render_supporting_trade_pdfs(spec, out_dir):
    reels = spec.get("reels_count", 4)
    qty_s = spec["qty_str"]

    # 0. PO-25800.pdf — Official Outbound Purchase Order
    po_path = os.path.join(out_dir, spec["po_file"])
    doc = _TopDownPdfDoc()
    p = doc.new_page(width=612, height=460)
    p.draw_rect(_Rect(30, 26, 582, 94), color=(0.08, 0.20, 0.44), fill=(0.94, 0.97, 1.0), width=1.2)
    p.insert_text((44, 52), "CENTRALIZED PURCHASING — PURCHASE ORDER", fontsize=14.5, fontname="hebo", color=(0.07, 0.14, 0.28))
    p.insert_text((44, 72), "Approved Requisition REQ-25800 (Signed: VP Devon Brooks · $100,000 Signing Limit)", fontsize=8.5, fontname="helv", color=(0.25, 0.32, 0.42))
    p.insert_text((436, 52), f"PO #: {spec['po_ref']}", fontsize=14, fontname="hebo", color=(0.08, 0.25, 0.56))
    p.insert_text((436, 73), f"Order Date: {spec['order_date']}", fontsize=9.2, fontname="hebo", color=(0.1, 0.12, 0.18))

    p.draw_rect(_Rect(30, 108, 582, 190), color=(0.75, 0.79, 0.85), width=0.9)
    p.insert_text((42, 127), f"SUPPLIER: {spec['vendor_header']} ({spec['vendor_sub']})", fontsize=9.0, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((42, 145), f"SHIP TO DOCK: {spec['ship_to']}", fontsize=8.8, fontname="helv", color=(0.15, 0.18, 0.24))
    p.insert_text((42, 163), f"PRICING BASIS: {spec['spot_basis_str']}", fontsize=8.8, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((42, 180), "BUYER DESK: Nancy Rostova (Centralized Purchasing · Automated Spot-Lock Execution)", fontsize=8.6, fontname="helv", color=(0.15, 0.20, 0.28))

    p.draw_rect(_Rect(30, 206, 582, 232), color=(0.12, 0.18, 0.28), fill=(0.14, 0.20, 0.32), width=0.8)
    p.insert_text((40, 223), "LINE / SKU", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((145, 223), "ITEM SPECIFICATION", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((374, 223), "QTY (FT)", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((442, 223), "PRICE / FT", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((512, 223), "PO TOTAL", fontsize=9, fontname="hebo", color=(1, 1, 1))

    p.draw_rect(_Rect(30, 232, 582, 282), color=(0.75, 0.78, 0.84), width=0.8)
    p.insert_text((40, 261), f"1 · {spec['sku']}", fontsize=9, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((145, 261), spec["description"], fontsize=8.8, fontname="helv", color=(0.1, 0.12, 0.18))
    p.insert_text((380, 261), qty_s, fontsize=9.5, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((448, 261), spec["unit_price_str"], fontsize=9.5, fontname="helv", color=(0.1, 0.12, 0.18))
    p.insert_text((506, 261), spec["line_total_str"], fontsize=9.5, fontname="hebo", color=(0.08, 0.38, 0.20))

    p.draw_rect(_Rect(30, 300, 582, 366), color=(0.12, 0.45, 0.25), fill=(0.95, 0.99, 0.96), width=1.1)
    p.insert_text((44, 324), f"AUTHORIZED PURCHASE ORDER TOTAL: {spec['total_due_str']} ({spec['weight_str']})", fontsize=9.5, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((44, 344), "Signing Tree Verified: Darius Mercer ($20k) -> Escalated & Signed by VP Devon Brooks ($100k Signing Limit).", fontsize=8.8, fontname="helv", color=(0.15, 0.22, 0.18))
    doc.save(po_path)
    doc.close()

    # 1. ENC-OA-2026-884192.pdf — Vendor Order Acknowledgement
    oa_path = os.path.join(out_dir, spec["oa_file"])
    doc = _TopDownPdfDoc()
    p = doc.new_page(width=612, height=460)
    p.draw_rect(_Rect(30, 26, 582, 94), color=(0.10, 0.22, 0.45), fill=(0.94, 0.97, 1.0), width=1.2)
    p.insert_text((44, 52), spec["vendor_header"], fontsize=15, fontname="hebo", color=(0.07, 0.14, 0.28))
    p.insert_text((44, 72), spec["vendor_sub"], fontsize=8.5, fontname="helv", color=(0.28, 0.34, 0.44))
    p.insert_text((352, 52), "ORDER ACKNOWLEDGEMENT", fontsize=13.5, fontname="hebo", color=(0.08, 0.25, 0.56))
    p.insert_text((344, 73), f"Vendor Ack: {spec['oa_id']}  |  PO: {spec['po_ref']}", fontsize=8.4, fontname="hebo", color=(0.1, 0.12, 0.18))

    p.draw_rect(_Rect(30, 108, 582, 190), color=(0.75, 0.79, 0.85), width=0.9)
    p.insert_text((42, 127), f"CUSTOMER PO: {spec['po_ref']} — Central Purchasing (Nancy Rostova)", fontsize=9.2, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((42, 145), f"SHIP TO: {spec['ship_to']}", fontsize=8.8, fontname="helv", color=(0.15, 0.18, 0.24))
    p.insert_text((42, 163), f"SPOT LOCK BASIS: {spec['spot_basis_str']}", fontsize=8.8, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((42, 180), f"PROMISED DELIVERY DATE: {spec['delivery_date']} (FOB Destination - Encore Flatbed)", fontsize=8.8, fontname="hebo", color=(0.1, 0.22, 0.48))

    p.draw_rect(_Rect(30, 206, 582, 232), color=(0.12, 0.18, 0.28), fill=(0.14, 0.20, 0.32), width=0.8)
    p.insert_text((40, 223), "LINE / SKU", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((145, 223), "CONDUCTOR SPECIFICATION", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((374, 223), "QTY (FT)", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((442, 223), "SPOT / FT", fontsize=9, fontname="hebo", color=(1, 1, 1))
    p.insert_text((512, 223), "COMMITTED", fontsize=9, fontname="hebo", color=(1, 1, 1))

    p.draw_rect(_Rect(30, 232, 582, 282), color=(0.75, 0.78, 0.84), width=0.8)
    p.insert_text((40, 261), f"1 · {spec['sku']}", fontsize=9, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((145, 261), spec["description"], fontsize=8.8, fontname="helv", color=(0.1, 0.12, 0.18))
    p.insert_text((380, 261), qty_s, fontsize=9.5, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((448, 261), spec["unit_price_str"], fontsize=9.5, fontname="helv", color=(0.1, 0.12, 0.18))
    p.insert_text((506, 261), spec["line_total_str"], fontsize=9.5, fontname="hebo", color=(0.08, 0.38, 0.20))

    p.draw_rect(_Rect(30, 300, 582, 366), color=(0.12, 0.45, 0.25), fill=(0.95, 0.99, 0.96), width=1.1)
    p.insert_text((44, 324), f"MILL ACKNOWLEDGEMENT: Copper spot locked at {spec.get('spot_cu_lb_str', '$6.26/lb')} ({spec['unit_price_str']}/FT).", fontsize=9.5, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((44, 344), f"Total Committed Value: {spec['total_due_str']}  |  Delivery ETA: {spec['delivery_date']}  |  Signed: Encore Mill Desk", fontsize=9, fontname="helv", color=(0.15, 0.22, 0.18))
    doc.save(oa_path)
    doc.close()

    # 2. BOL-25800.pdf — Carrier Straight Bill of Lading
    bol_path = os.path.join(out_dir, spec["bol_file"])
    doc = _TopDownPdfDoc()
    p = doc.new_page(width=612, height=460)
    p.draw_rect(_Rect(30, 26, 582, 94), color=(0.45, 0.28, 0.06), fill=(1.0, 0.98, 0.93), width=1.2)
    p.insert_text((44, 52), "STRAIGHT BILL OF LADING — SHORT FORM", fontsize=14, fontname="hebo", color=(0.38, 0.22, 0.04))
    p.insert_text((44, 72), f"Carrier: Encore Dedicated Flatbed #TX-441  |  Shipper: {spec['vendor_header']}", fontsize=8.6, fontname="helv", color=(0.3, 0.26, 0.2))
    p.insert_text((422, 52), f"BOL #: {spec['bol_id']}", fontsize=13, fontname="hebo", color=(0.45, 0.24, 0.04))
    p.insert_text((356, 72), f"PO: {spec['po_ref']}  |  Ack: {spec['oa_id']}", fontsize=8.3, fontname="hebo", color=(0.2, 0.18, 0.15))

    p.draw_rect(_Rect(30, 108, 582, 184), color=(0.78, 0.76, 0.70), width=0.9)
    p.insert_text((42, 128), f"CONSIGNEE / DOCK: {spec['ship_to']}", fontsize=9.2, fontname="hebo", color=(0.1, 0.12, 0.16))
    p.insert_text((42, 148), f"DELIVERY DATE: {spec['delivery_date']}  |  FREIGHT TERMS: FOB Destination Prepaid", fontsize=8.8, fontname="helv", color=(0.2, 0.22, 0.26))
    p.insert_text((42, 168), f"PACKAGE COUNT: {reels} Sealed Wooden Master Reels (2,000 FT ea)  |  WEIGHT: {spec['weight_str']}", fontsize=8.5, fontname="hebo", color=(0.1, 0.12, 0.16))

    p.draw_rect(_Rect(30, 200, 582, 272), color=(0.75, 0.78, 0.84), width=0.9)
    p.insert_text((42, 222), f"COMMODITY: {spec['sku']} — {spec['description']}", fontsize=9.5, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((42, 242), f"GS1 REEL BARCODES: ENC-GS1-884192-R01 .. R0{reels} (2,000 FT / 822 lbs per reel = {qty_s} FT total)", fontsize=8.6, fontname="helv", color=(0.2, 0.24, 0.30))
    p.insert_text((42, 260), "NMFC CLASS: 60 (ASTM B8 Bare Copper Electrical Strand) — 4 Separate RF Reel Barcode Scans Required", fontsize=8.5, fontname="helv", color=(0.28, 0.32, 0.38))

    p.draw_rect(_Rect(30, 290, 582, 366), color=(0.12, 0.45, 0.25), fill=(0.95, 0.99, 0.96), width=1.1)
    p.insert_text((44, 314), "DOCK SCAN-IN CERTIFICATION (WMS.stock_stockitem · 4 Reel Barcodes):", fontsize=9.5, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((44, 334), f"Scanned & Inspected: {reels} / {reels} Barcoded Reels = {qty_s} FT Good Condition (0 Damaged / 0 Short)", fontsize=9, fontname="hebo", color=(0.1, 0.18, 0.14))
    p.insert_text((44, 352), "Signed Dock Custodian: EMP-0003 Marcus Vance (Receiving Dock Scan Gun)", fontsize=8.8, fontname="helv", color=(0.15, 0.22, 0.18))
    doc.save(bol_path)
    doc.close()

    # 3. PS-25800.pdf — Packing Slip & ASTM B8 Mill Test Certificate
    ps_path = os.path.join(out_dir, spec["ps_file"])
    doc = _TopDownPdfDoc()
    p = doc.new_page(width=612, height=460)
    p.draw_rect(_Rect(30, 26, 582, 94), color=(0.15, 0.24, 0.36), fill=(0.96, 0.98, 1.0), width=1.2)
    p.insert_text((44, 52), f"{spec['vendor_header']} — PACKING SLIP & MILL CERT", fontsize=13.5, fontname="hebo", color=(0.08, 0.16, 0.28))
    p.insert_text((44, 72), "ASTM B8 Certified Electrolytic Tough Pitch (ETP) Bare Copper Conductor", fontsize=8.6, fontname="helv", color=(0.28, 0.34, 0.42))
    p.insert_text((430, 52), f"SLIP #: {spec['ps_id']}", fontsize=12, fontname="hebo", color=(0.10, 0.24, 0.52))
    p.insert_text((430, 72), f"PO: {spec['po_ref']} | BOL: {spec['bol_id']}", fontsize=8.8, fontname="hebo", color=(0.15, 0.18, 0.24))

    p.draw_rect(_Rect(30, 110, 582, 224), color=(0.75, 0.78, 0.84), width=0.9)
    p.insert_text((42, 132), f"LINE 1 SKU: {spec['sku']}  ({spec['description']})", fontsize=9.5, fontname="hebo", color=(0.1, 0.12, 0.18))
    p.insert_text((42, 154), f"ORDERED QTY: {qty_s} FT   |   SHIPPED QTY: {qty_s} FT   |   BACKORDERED: 0 FT", fontsize=9.2, fontname="hebo", color=(0.08, 0.38, 0.20))
    p.insert_text((42, 176), "MILL HEAT / LOT: HEAT-CU-2611-884   |   PURITY: 99.95% Cu   |   CONDUCTIVITY: 101.2% IACS", fontsize=8.8, fontname="helv", color=(0.15, 0.18, 0.24))
    p.insert_text((42, 198), "STRANDING: 19-Strand Concentric Bare Copper (#2/0 AWG, 0.414 in Dia, 0.411 lb/FT) — ASTM B8 Compliant", fontsize=8.8, fontname="helv", color=(0.15, 0.18, 0.24))

    p.draw_rect(_Rect(30, 244, 582, 314), color=(0.15, 0.24, 0.42), fill=(0.96, 0.98, 1.0), width=1.0)
    p.insert_text((44, 268), "3-WAY MATCH PHYSICAL RECEIPT TIE-OUT:", fontsize=9.5, fontname="hebo", color=(0.08, 0.22, 0.48))
    p.insert_text((44, 290), f"Matches {spec['po_ref']} ({qty_s} FT) == {spec['oa_id']} == {spec['bol_id']} == WMS Stock Batch {spec['bol_id']}.", fontsize=9, fontname="helv", color=(0.15, 0.2, 0.28))
    doc.save(ps_path)
    doc.close()

    return {
        "poFile": spec["po_file"],
        "poSha256": sha256_file(po_path),
        "oaFile": spec["oa_file"],
        "oaSha256": sha256_file(oa_path),
        "bolFile": spec["bol_file"],
        "bolSha256": sha256_file(bol_path),
        "psFile": spec["ps_file"],
        "psSha256": sha256_file(ps_path),
    }


def render_vendor_invoice_pdf_and_scan(spec, out_dir):
    from PIL import Image
    docs_meta = render_supporting_trade_pdfs(spec, out_dir)
    qty_s = spec["qty_str"]

    doc = _TopDownPdfDoc()
    page = doc.new_page(width=612, height=520)

    page.draw_rect(_Rect(30, 26, 582, 96), color=(0.12, 0.16, 0.24), fill=(0.95, 0.97, 1.0), width=1.2)
    page.insert_text((44, 54), spec["vendor_header"], fontsize=15.5, fontname="hebo", color=(0.07, 0.12, 0.22))
    page.insert_text((44, 74), spec["vendor_sub"], fontsize=8.5, fontname="helv", color=(0.30, 0.35, 0.44))
    page.insert_text((462, 54), "INVOICE", fontsize=17, fontname="hebo", color=(0.10, 0.24, 0.52))
    page.insert_text((432, 76), f"Invoice #: {spec['invoice_id']}", fontsize=10, fontname="hebo", color=(0.08, 0.10, 0.15))

    page.draw_rect(_Rect(30, 110, 302, 196), color=(0.75, 0.78, 0.84), width=0.8)
    page.insert_text((42, 128), "BILL TO: Accounts Payable (ap@company-8090.com)", fontsize=8.8, fontname="hebo", color=(0.1, 0.1, 0.15))
    page.insert_text((42, 146), "SHIP / DOCK LOCATION:", fontsize=8.2, fontname="hebo", color=(0.3, 0.35, 0.42))
    page.insert_text((42, 162), spec["ship_to"], fontsize=8.4, fontname="helv", color=(0.1, 0.1, 0.15))
    page.insert_text((42, 181), f"Terms: {spec['terms']}", fontsize=7.8, fontname="helv", color=(0.25, 0.3, 0.38))

    page.draw_rect(_Rect(312, 110, 582, 196), color=(0.75, 0.78, 0.84), width=0.8)
    page.insert_text((324, 130), f"Invoice Date: {spec['invoice_date']}", fontsize=9.5, fontname="helv", color=(0.1, 0.1, 0.15))
    page.insert_text((324, 152), f"Customer PO: {spec['po_ref']}", fontsize=10, fontname="hebo", color=(0.08, 0.22, 0.48))
    page.insert_text((324, 171), f"Vendor Ack / BOL: {spec['oa_id']} · {spec['bol_id']}", fontsize=7.9, fontname="hebo", color=(0.15, 0.36, 0.22))
    page.insert_text((324, 188), f"Remit Email: {spec['from_addr']}", fontsize=8.2, fontname="helv", color=(0.25, 0.3, 0.38))

    page.draw_rect(_Rect(30, 214, 582, 240), color=(0.12, 0.18, 0.28), fill=(0.14, 0.20, 0.32), width=0.8)
    page.insert_text((38, 231), "ITEM / SKU", fontsize=9, fontname="hebo", color=(1, 1, 1))
    page.insert_text((138, 231), "DESCRIPTION", fontsize=9, fontname="hebo", color=(1, 1, 1))
    page.insert_text((376, 231), "QTY (FT)", fontsize=9, fontname="hebo", color=(1, 1, 1))
    page.insert_text((436, 231), "SPOT / FT", fontsize=9, fontname="hebo", color=(1, 1, 1))
    page.insert_text((510, 231), "AMOUNT", fontsize=9, fontname="hebo", color=(1, 1, 1))

    page.draw_rect(_Rect(30, 240, 582, 294), color=(0.75, 0.78, 0.84), width=0.8)
    page.insert_text((36, 269), spec["sku"], fontsize=8.8, fontname="hebo", color=(0.1, 0.12, 0.18))
    page.insert_text((138, 269), spec["description"], fontsize=8.4, fontname="helv", color=(0.1, 0.12, 0.18))
    page.insert_text((378, 269), qty_s, fontsize=10, fontname="hebo", color=(0.1, 0.12, 0.18))
    page.insert_text((442, 269), spec["unit_price_str"], fontsize=9.5, fontname="helv", color=(0.1, 0.12, 0.18))
    page.insert_text((504, 269), spec["line_total_str"], fontsize=9.5, fontname="hebo", color=(0.1, 0.12, 0.18))

    page.draw_rect(_Rect(360, 314, 582, 392), color=(0.15, 0.24, 0.42), fill=(0.96, 0.98, 1.0), width=1.2)
    page.insert_text((374, 336), f"Subtotal ({qty_s} FT): {spec['line_total_str']}", fontsize=9.2, fontname="helv", color=(0.2, 0.24, 0.3))
    page.insert_text((374, 355), "Mill Freight (FOB Dest): $0.00", fontsize=8.8, fontname="helv", color=(0.3, 0.34, 0.4))
    page.insert_text((374, 378), f"TOTAL DUE: {spec['total_due_str']}", fontsize=12, fontname="hebo", color=(0.06, 0.22, 0.48))

    page.draw_rect(_Rect(38, 322, 332, 384), color=(0.65, 0.22, 0.22), width=1.1)
    page.insert_text((48, 342), "RECEIVED VIA AP INBOX (RAPIDOCR TAG)", fontsize=8.8, fontname="hebo", color=(0.65, 0.20, 0.20))
    page.insert_text((48, 358), f"{spec['spot_basis_str']}", fontsize=7.6, fontname="helv", color=(0.25, 0.25, 0.30))
    page.insert_text((48, 373), f"ap@company-8090.com - {spec['invoice_date']}", fontsize=7.8, fontname="helv", color=(0.65, 0.20, 0.20))

    png_path = os.path.join(out_dir, spec["png_file"])
    doc.render_png(png_path, dpi=135)
    doc.close()

    with Image.open(png_path) as raw_img:
        rotated = raw_img.convert("RGB").rotate(-0.30, resample=Image.BICUBIC, expand=False, fillcolor=(252, 252, 250))
    try:
        rotated.save(png_path, "PNG")
        pdf_path = os.path.join(out_dir, spec["pdf_file"])
        rotated.save(pdf_path, "PDF", resolution=135.0)
    finally:
        rotated.close()

    eml_path = os.path.join(out_dir, spec["eml_file"])
    eml_text = (
        f"Message-ID: <{spec['invoice_id']}.20261113@encorewire.mail>\n"
        f"From: {spec['from_addr']}\n"
        f"To: {spec['to_addr']}\n"
        f"Date: Fri, 13 Nov 2026 14:15:00 -0800\n"
        f"Subject: {spec['subject']}\n"
        f"X-Attachment: {spec['pdf_file']} (application/pdf, raster-scan)\n"
        f"\n"
        f"{spec['email_body']}\n"
    )
    with open(eml_path, "w", encoding="utf-8") as f:
        f.write(eml_text)

    return {
        "dealId": spec["deal_id"],
        "invoiceId": spec["invoice_id"],
        "emlFile": spec["eml_file"],
        "pdfFile": spec["pdf_file"],
        "pngFile": spec["png_file"],
        "pdfSha256": sha256_file(pdf_path),
        "emlSha256": sha256_file(eml_path),
        **docs_meta,
    }


def parse_money(val):
    m = re.findall(r"\$?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+\.[0-9]{2})", str(val or ""))
    if not m:
        return None
    return float(m[-1].replace(",", ""))


def prettify_ocr_spacing(s):
    if not s:
        return s
    s = re.sub(r"ENCORE\s*WIRE\s*CORPORATION", "ENCORE WIRE CORPORATION", s, flags=re.IGNORECASE)
    s = re.sub(r"([24]/0)\s*AWG\s*Bare", r"\1 AWG Bare", s, flags=re.IGNORECASE)
    s = re.sub(r"([12]000)\s*FT\s*Reels", r"\1FT Reels", s, flags=re.IGNORECASE)
    s = re.sub(r"([a-z])([A-Z])", r"\1 \2", s)
    s = re.sub(r"(&)", r" & ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def run_ocr_on_file(input_path, preview_png_path=None, *, ocr_callable=None):
    import pypdfium2
    from PIL import Image

    t0 = time.perf_counter()
    ext = os.path.splitext(input_path)[1].lower()
    if ext == ".pdf":
        if not preview_png_path:
            preview_png_path = input_path + ".page1.png"
        pdf_doc = pypdfium2.PdfDocument(input_path)
        try:
            page = pdf_doc[0]
            try:
                bitmap = page.render(scale=135.0 / 72.0)
                try:
                    pil_img = bitmap.to_pil().convert("RGB")
                    try:
                        pil_img.save(preview_png_path, "PNG")
                    finally:
                        pil_img.close()
                finally:
                    bitmap.close()
            finally:
                page.close()
        finally:
            pdf_doc.close()
        img_path = preview_png_path
    else:
        img_path = input_path
        if preview_png_path and os.path.abspath(img_path) != os.path.abspath(preview_png_path):
            with Image.open(img_path) as src_im:
                rgb_im = src_im.convert("RGB")
                try:
                    rgb_im.save(preview_png_path, "PNG")
                finally:
                    rgb_im.close()

    with Image.open(img_path) as im:
        img_w, img_h = im.size

    runner = ocr_callable if ocr_callable is not None else get_ocr_engine()
    try:
        result, _ = runner(img_path, use_cls=False)
    except TypeError:
        result, _ = runner(img_path)
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

    boxes = []
    if result:
        for idx, item in enumerate(result):
            poly, text, conf = item[0], str(item[1]).strip(), float(item[2])
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            x0, y0, x1, y1 = min(xs), min(ys), max(xs), max(ys)
            boxes.append({
                "id": f"ocr-box-{idx}",
                "text": text,
                "confidence": round(conf, 4),
                "xPct": round((x0 / img_w) * 100, 2),
                "yPct": round((y0 / img_h) * 100, 2),
                "wPct": round(((x1 - x0) / img_w) * 100, 2),
                "hPct": round(((y1 - y0) / img_h) * 100, 2),
            })

    vendor_name, vendor_box = "Scanned Vendor", None
    invoice_no, invoice_box = None, None
    po_ref, po_box = None, None
    total_due, total_box = None, None
    sku_code, sku_box = None, None
    qty_val, qty_box = None, None
    unit_price, price_box = None, None
    desc_text, desc_box = None, None

    for i, b in enumerate(boxes):
        t = b["text"]
        tu = t.upper()
        tu_ns = tu.replace(" ", "")
        if i <= 3 and any(k in tu_ns for k in ["ENCORE", "WIRE", "CORP", "CUMMINS", "HARGER", "INC", "LLC", "SUPPLY"]) and vendor_box is None:
            vendor_name, vendor_box = prettify_ocr_spacing(t), b["id"]
        if "INVOICE#" in tu_ns or "INV-" in tu_ns:
            m = re.search(r"(INV-[A-Z0-9-]+)", tu_ns)
            if m and not invoice_no:
                invoice_no, invoice_box = m.group(1), b["id"]
        if "CUSTOMERPO" in tu_ns or tu_ns.startswith("PO-"):
            if "NONE" in tu_ns or "NON-PO" in tu_ns:
                po_ref, po_box = "NONE", b["id"]
            else:
                m = re.search(r"(PO-[A-Z0-9-]+)", tu_ns)
                if m:
                    po_ref, po_box = m.group(1), b["id"]
        if "TOTALDUE" in tu_ns:
            val = parse_money(t)
            if val is not None:
                total_due, total_box = val, b["id"]
        if re.match(r"^(ITM-[A-Z0-9-]+|FLEET-[A-Z-]+|CLOUD-[A-Z0-9-]+)$", tu_ns):
            sku_code, sku_box = tu_ns, b["id"]
        if b["yPct"] > 44 and b["yPct"] < 58:
            clean_num = re.sub(r"\s*FT$", "", t.strip(), flags=re.IGNORECASE).replace(",", "")
            if b["xPct"] > 18 and b["xPct"] < 58 and len(t) > 10 and "DESCRIPTION" not in tu_ns:
                desc_text, desc_box = prettify_ocr_spacing(t), b["id"]
            elif b["xPct"] >= 58 and b["xPct"] < 70 and re.match(r"^[0-9]+(\.[0-9]+)?$", clean_num):
                qty_val, qty_box = float(clean_num), b["id"]
            elif b["xPct"] >= 70 and b["xPct"] < 82:
                vp = parse_money(t)
                if vp is not None:
                    unit_price, price_box = vp, b["id"]

    if total_due is None:
        money_candidates = [(parse_money(b["text"]), b["id"]) for b in boxes if parse_money(b["text"]) is not None]
        if money_candidates:
            money_candidates.sort(key=lambda x: x[0], reverse=True)
            total_due, total_box = money_candidates[0]

    avg_conf = round(sum(b["confidence"] for b in boxes) / max(len(boxes), 1), 4)
    computed_line = round((qty_val or 0) * (unit_price or 0), 2) if (qty_val is not None and unit_price is not None) else total_due
    math_verified = (total_due is not None and computed_line is not None and abs(computed_line - total_due) <= 0.02)

    return {
        "engine": "RapidOCR (PaddleOCR-v4 ONNX CPU)",
        "elapsedMs": elapsed_ms,
        "fileSha256": sha256_file(input_path),
        "imageWidth": img_w,
        "imageHeight": img_h,
        "boxCount": len(boxes),
        "avgConfidence": avg_conf,
        "mathVerified": bool(math_verified),
        "computedLineTotal": computed_line,
        "rawLines": [b["text"] for b in boxes],
        "extracted": {
            "vendorName": {"value": vendor_name, "boxId": vendor_box},
            "invoiceNumber": {"value": invoice_no or "INV-OCR", "boxId": invoice_box},
            "poReference": {"value": po_ref or "NONE", "boxId": po_box},
            "sku": {"value": sku_code or "NON-PO-EXP", "boxId": sku_box},
            "description": {"value": desc_text or "Scanned Vendor Line Item", "boxId": desc_box},
            "quantity": {"value": qty_val if qty_val is not None else 1, "boxId": qty_box},
            "unitPrice": {"value": unit_price if unit_price is not None else (total_due or 0), "boxId": price_box},
            "totalDue": {"value": total_due or 0.0, "boxId": total_box},
        },
        "boxes": boxes,
    }


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
                self.ocr = _create_warm_rapidocr()
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
                        results, _ = self.ocr(np.asarray(image), use_cls=False)
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

    def mint_trade_bundle(self, body: dict):
        out_dir_raw = body.get("outDir") if body.get("outDir") is not None else str(self.docs_dir)
        if not isinstance(out_dir_raw, str) or not out_dir_raw.strip() or "\x00" in out_dir_raw:
            raise Refusal(400, "INVALID_REQUEST", "outDir must be a valid local directory path")
        resolved_out = Path(out_dir_raw).resolve()
        if str(resolved_out) == "/":
            raise Refusal(400, "INVALID_REQUEST", "Refusing root outDir")
        with self.lock:
            os.makedirs(resolved_out, exist_ok=True)
            spec = build_dynamic_copper_spec(body)
            res = render_vendor_invoice_pdf_and_scan(spec, str(resolved_out))
            return {"ok": True, **res}

    def scan_local_document(self, body: dict):
        input_raw = body.get("inputPath")
        if not isinstance(input_raw, str) or not input_raw.strip() or "\x00" in input_raw:
            raise Refusal(400, "INVALID_REQUEST", "inputPath is required")
        resolved_in = Path(input_raw).resolve()
        if resolved_in.suffix.lower() not in {".pdf", ".png"} or not resolved_in.is_file():
            raise Refusal(400, "INVALID_REQUEST", "inputPath must be an existing local .pdf or .png file")
        preview_raw = body.get("previewPngPath")
        resolved_preview = None
        if preview_raw is not None:
            if not isinstance(preview_raw, str) or not preview_raw.strip() or "\x00" in preview_raw:
                raise Refusal(400, "INVALID_REQUEST", "previewPngPath must be a valid .png path")
            cand = Path(preview_raw).resolve()
            if cand.suffix.lower() != ".png":
                raise Refusal(400, "INVALID_REQUEST", "previewPngPath must end with .png")
            os.makedirs(cand.parent, exist_ok=True)
            resolved_preview = str(cand)
        with self.lock:
            return run_ocr_on_file(str(resolved_in), resolved_preview, ocr_callable=self.ocr)


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
                if self.path not in {"/generate", "/ocr", "/match", "/payment-check", "/scan", "/mint"}:
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
                elif self.path == "/payment-check":
                    result = engine.check_payment(body)
                elif self.path == "/scan":
                    result = engine.scan_local_document(body)
                else:
                    result = engine.mint_trade_bundle(body)
                self._respond(200, result)
            except Refusal as exc:
                self._respond(exc.status, {"error": exc.code, "message": str(exc)})
            except (ValueError, UnicodeError, TimeoutError, RecursionError):
                self._respond(400, {"error": "INVALID_REQUEST", "message": "Invalid JSON request"})
            except OSError:
                self._respond(503, {"error": "OCR_UNAVAILABLE", "message": "Document storage unavailable"})

    return ThreadingHTTPServer(("127.0.0.1", port), Handler)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-dir", default="sor-sandbox/docs")
    parser.add_argument("--fast-smoke", action="store_true", help="Explicit deterministic layout boxes; no OCR model")
    parser.add_argument("--port", type=int, default=int(os.environ.get("OCR_PORT", "3591")))
    parser.add_argument("command", choices=("generate", "ocr", "smoke", "serve", "mint", "scan"))
    parser.add_argument("extra", nargs="*", help="Optional target paths for mint/scan")
    args = parser.parse_args(argv)
    try:
        fast_smoke = args.fast_smoke or args.command == "smoke"
        engine = InvoiceOCREngine(args.docs_dir, fast_smoke=fast_smoke)
        if args.command == "serve":
            with make_server(engine, args.port) as server:
                # Ready line: the model is loaded and the socket is bound (--port 0 picks a free port).
                print(json.dumps({"ok": True, "url": "http://127.0.0.1:%d" % server.server_address[1],
                                  "docsDir": str(engine.docs_dir.resolve())}), flush=True)
                server.serve_forever()
        elif args.command == "smoke":
            gen = engine.generate_documents()
            ocr = engine.extract_invoice()
            print(json.dumps({"ok": True, "generated": gen, "ocr": ocr}, allow_nan=False))
        elif args.command == "mint":
            target_dir = args.extra[0] if args.extra else str(engine.docs_dir)
            os.makedirs(target_dir, exist_ok=True)
            manifest = [render_vendor_invoice_pdf_and_scan(s, target_dir) for s in FIXTURE_SPECS]
            print(json.dumps({"ok": True, "fixtures": manifest}, allow_nan=False))
        elif args.command == "scan":
            in_file = args.extra[0] if args.extra else str(engine.docs_dir / "INV-25800.pdf")
            out_png = args.extra[1] if len(args.extra) > 1 else None
            res = run_ocr_on_file(in_file, out_png, ocr_callable=engine.ocr)
            print(json.dumps(res, allow_nan=False))
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
