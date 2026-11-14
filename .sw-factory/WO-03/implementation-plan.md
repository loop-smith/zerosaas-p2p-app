<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-03

**Work Order:** WO-03 — Build Warm RapidOCR 5-PDF Sidecar (:3591 sidecar/invoice_ocr_engine.py), Deterministic 28-Box Step 7 3-Way Match & Step 8 CFO Check #10045
**Created At (UTC):** 2026-11-14T02:48:07Z

## Summary

_1-3 sentences: what this work order delivers and the high-level approach._

## Code Reuse And Package Structure

_List critical existing files/components/services/hooks/utilities/schemas/tests to reuse or import as dependencies. Note reuse/extract/follow-pattern decisions. Then list files/packages/directories intentionally created or modified by this plan, grouped by module or layer. Do not list incidental import-order, barrel export, formatting, generated-code, or mechanical follow-on edits._

## Components And Flow

_Name Blueprint-defined components, supporting components, important interfaces/signatures, and call/data flow._

## Steps

_Ordered implementation steps. Each step should produce a reviewable, preferably compilable intermediate state. Note parallelizable steps (touch different files, no dependency)._

1. **[title]** - _what to do, where_
2. **[title]** - _what to do, where_

## Testing

_Automated and manual tests: suites, new/changed test files, scenarios, and commands. Not for requirements/blueprint conformance—that belongs in review._

## Concrete Acceptance Criteria
- Implement sidecar/invoice_ocr_engine.py (HTTP sidecar on 127.0.0.1:${OCR_PORT||3591} + CLI mode using reportlab, pypdfium2, Pillow, rapidocr_onnxruntime) and integrate into src/sor_3panel_server.mjs.
- Mints all 5 trade PDFs in sor-sandbox/docs/ (PO-25800.pdf, ENC-OA-2026-884192.pdf, BOL-25800.pdf, PS-25800.pdf, INV-25800.pdf) and extracts >=28 OCR bounding boxes from rendered INV-25800.pdf (with deterministic fallback if sidecar is invoked in fast smoke mode).
- Step 7 clears 201200 GRNI -> 201100 Trade Payables on $0.00 3-way match variance (Ordered PO == Received BOL == Invoiced INV) and returns HTTP 409 MATCH_VARIANCE_HOLD on any mutated/over-billed invoice (e.g. $2.89/FT or +$500 tampering).
- Step 8 CFO Meredith Hale (EMP-0007, $500k limit) settles Check #10045 / ACH-000582 on Operating Checking 101100 (#8801), clearing 201100 Trade AP to $0.00, while returning HTTP 403 BANK_POLICY_VIOLATION if Payroll/Petty Cash 101200 (#4409) is used for >$5,000.

## Required Verification Commands
- `/usr/bin/python3 -m py_compile sidecar/invoice_ocr_engine.py`
- `node --check src/sor_3panel_server.mjs`
- `npm test`
