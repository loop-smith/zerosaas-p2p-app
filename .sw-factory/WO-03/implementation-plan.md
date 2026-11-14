# Implementation Plan: WO-03 / WO-03-A

## Summary
Build a local, warm RapidOCR document sidecar with five contract-derived trade PDFs, pixel bounding boxes, and exact decimal validation. All implementation and tests stay under sidecar/. Application-server integration and actual journal/bank writes require a separate seat because src/ is absent and outside this fence.

## Code Reuse And Package Structure
Inspected the target checkout: no sidecar, src/, hara/, existing functions or reusable application modules exist. Reuse contracts/p2p-lineage-contract.json primaryItem and semantic bindings directly; use reportlab Canvas, pypdfium2 PdfDocument, Pillow images, RapidOCR, Decimal, hashlib, and stdlib HTTPServer. New files: sidecar/invoice_ocr_engine.py, sidecar/test_invoice_ocr_engine.py, sidecar/requirements.txt, sidecar/README.md. Update only authorized WO-03 execution documents.

## Components And Flow / Locked Interfaces
- InvoiceOCREngine(docs_dir, *, fast_smoke=False, contract_path=CONTRACT_PATH): owns one OCR model and serializes PDF/OCR operations.
- generate_documents() -> {documents: [{name, sha256}], quantityFt, unitPriceUsd, totalUsd}; generates exactly the five named contract PDFs.
- extract_invoice() -> {engine, boxes: [{text, confidence, box, page}], width, height, sha256, fields}; rendered invoice boxes use top-left pixel coordinates. Normal mode calls the retained RapidOCR instance. Only explicit fast_smoke uses deterministic generated layout. Smoke refuses unrecognized/mutated PDFs.
- match_invoice(invoice) -> validated zero-variance account transfer proposal. Compare all of quantityFt, unitPriceUsd, totalUsd against locked contract values with Decimal; no journal writes.
- check_payment(payment) -> authority and bank policy validated transfer proposal; no money movement. CFO EMP-0007 and Operating 101100/#8801 required; KAL refused.
- make_server(engine, port=3591) -> loopback HTTP server. GET /health; POST /generate, /ocr, /match, /payment-check. JSON body capped at 64 KiB, no request-selected filesystem paths. Port from OCR_PORT or 3591.
- CLI: generate, ocr, serve; --docs-dir, --fast-smoke, --port. CLI emits JSON; no external server integration within this fence.
- Refusal codes locked: 409 MATCH_VARIANCE_HOLD, 403 BANK_POLICY_VIOLATION, 403 AI_STEWARD_ZERO_AUTHORITY, 403 CFO_AUTHORITY_REQUIRED, 409 DOCUMENT_INTEGRITY_HOLD, 400 INVALID_REQUEST, 404 NOT_FOUND, 413 REQUEST_TOO_LARGE, 503 OCR_UNAVAILABLE. Hard validation failures are not retried or silently converted into OCR fallback.

## Steps
1. Write behavioral tests and observe failing import before implementation.
2. Implement contract-backed PDFs, rendering and OCR lifecycle, exact-match and payment validation, loopback HTTP and CLI.
3. Run focused tests and real OCR, exploratory CLI/HTTP checks; review changes; record all unavailable checks without claiming completion of external integration.

## Testing
Use pytest tmp_path roots; never write host state directories. Validate all five PDF headers and hashes, >=28 positive pixel boxes, real rendered RapidOCR output and model reuse, mutated-document refusal, exact match and tampered totals/rates, CFO and bank refusal, HTTP routes and malformed bodies, CLI output. Run python3 -m pytest sidecar -q -p no:cacheprovider and python3 -m py_compile sidecar/invoice_ocr_engine.py. Also run both task-card HARA commands fresh; missing HARA is a baseline limitation. Node server check is unavailable because src/ is absent; execute package smoke through Python subprocess if node/npm exist.

## Requirements Tracking
R1 local warm HTTP + CLI: in scope.
R2 five named PDFs + >=28 OCR boxes + explicit smoke fallback: in scope.
R3 penny math + match refusal: in scope as validation/proposal; GL posting and server integration outside fence.
R4 CFO/bank policy: in scope as validation/proposal; settlement and PAID stamps outside fence.
R5 HARA suites: run and report actual results, even when absent.

## Guidance Availability
The five named HARA SKILL.md files and AGENTS.md are absent after searching the provided location and alternate local skill roots. User explicitly directed continuation on this final turn; apply their inline skill requirements. Software Factory execution guidance is available and read. No Software Factory MCP or blueprint documents are available; use the supplied contract and task as authority, and do not mutate external records.

## Final outcome
R1 and R2 implemented and verified, including 35 smoke boxes and >=28 real-model boxes. R3 and R4 delivered as precisely documented validation/proposal APIs; full accounting, physical receipt reconciliation and authenticated payment remain outside this fence. R5 commands ran: required HARA targets absent, so no green HARA conformance claim. Final sidecar suite: 39 passed; py_compile passed. Delegated review approved the final code after real-PDF regressions fixed numeric suffixes, duplicate fields and unexamined extra pages.
