# Review Log: WO-03 / WO-03-A

Review scope: only new sidecar/ files and authorized WO-03 execution artifacts. No src/ or HARA tree exists in this checkout. Full WO-03 accounting/server acceptance is not claimed.

## Round 1 — CHANGES_REQUESTED

Reviewer: dedicated Software Factory review delegate /root/sidecar_review, read-only. The skill explicitly called for delegated review.

- Requirements/architecture: sidecar PDF/OCR and validation proposals fit the fence. Actual receipt binding, journal posting, human authentication, duplicate-settlement protection and PAID stamps require the missing application owner. README must state these limits.
- Blocking / financial parsing: real RapidOCR recognized UNIT PRICE USD: 2.70e9, but the parser accepted numeric prefix 2.70. A second real-PDF case showed duplicate unit-price fields were accepted. Both regression cases failed with DID NOT RAISE before the parser fix.
- Fix: collect full anchored field lines, require exactly one occurrence per field, and fullmatch numeric grammar before Decimal parsing. Preserve OCR spacing tolerance without truncating values.
- Advisory / portability: deeply nested JSON returns structured 400 on the installed Python 3.14. The delegate corrected their initial RecursionError concern; no current-runtime failure was claimed. A 60,001-byte nested-body regression passes.
- Verdict: CHANGES_REQUESTED until parser and documentation fixes verified.

## Round 2 — APPROVED for parser and documented scope

- Independent delegate command: python3 -m pytest sidecar/test_invoice_ocr_engine.py -q -p no:cacheprovider -k numeric_suffix — 2 passed, 36 deselected.
- Whole local suite at this stage: 38 passed in 18.57s.
- Reviewer confirmed README explicitly limits /match and /payment-check to proposals, with posted:false and external receipt/authentication/posting responsibilities.
- Verdict: APPROVED for fenced sidecar scope; no full workflow completion claim.

## Round 3 — final APPROVED for fenced sidecar scope

- Additional reproduced integrity issue: a second invoice page containing an additional charge was ignored. The real two-page ReportLab/PDFium/RapidOCR regression failed with DID NOT RAISE before adding the one-page gate.
- Fix: reject non-single-page invoices before extraction; existing finally closes the PDF. README documents this restriction.
- Independent delegate command: python3 -m pytest sidecar/test_invoice_ocr_engine.py -q -p no:cacheprovider -k unexamined_extra_invoice_pages — 1 passed, 38 deselected.
- Delegate final verdict: APPROVED; no remaining blocking findings within documented fenced scope.

### Fresh verification of final code

| Command | Result |
| --- | --- |
| python3 -m pytest sidecar -q -p no:cacheprovider | PASS: 39 tests in 21.05s, real PDFs/PDFium/Pillow/RapidOCR; no mocked unit under test |
| python3 -m py_compile sidecar/invoice_ocr_engine.py | PASS |
| python3 -m hara.blocks.configurator.manifest check --repo . | FAIL, exit 1: No module named hara (absent baseline target) |
| python3 -m pytest hara/blocks -q -p no:cacheprovider | FAIL, exit 4: hara/blocks missing; no tests ran |
| node --check src/sor_3panel_server.mjs, invoked through python3 subprocess | FAIL, exit 1: missing server file; outside fence |
| npm test, invoked through python3 subprocess | PASS, exit 0: scaffold contract-presence smoke only; no copper E2E suite exists |

### Evidence and safety

Initial TDD run failed collection because sidecar.invoice_ocr_engine did not exist. First implementation run passed 34 tests and exposed a real-model omitted-label-spacing failure; raw model output showed QUANTITYFT and UNITPRICEUSD. That failure was fixed before the review regressions above. All identified current bugs are hard input/parser failures, not transient failures; no silent synthetic fallback or retry was added.

Automated HTTP checks exercised the live loopback listener, generation, OCR, match/payment proposals, variance/bank refusals, invalid JSON, body shape, path-selection refusal, size limit and nested JSON. CLI checks ran actual subprocesses with temporary docs roots. Independent exploratory review generated five real PDFs, rendered a 1224x1584 invoice and observed 35 smoke boxes; real model extraction independently returned 35 recognized boxes with 8000 FT / 2.70 / 21600.00. No browser UI is part of this sidecar; UI routes and app_server.py are absent and out of scope.

All test document roots were temporary; /home/rig/state was not opened or changed. The server accepts no caller-selected filesystem paths, binds only 127.0.0.1, limits JSON bodies, serializes PDF/OCR operations, and returns financial proposals rather than posting money. Normal mode retains one real OCR model; synthetic boxes require explicit startup smoke mode and an exact canonical PDF byte match. No external messages or record mutations occurred.

### Lean accounting

No existing application helpers/functions were available to reuse or delete. Reused the contract and mature library APIs rather than adding abstractions. Production delta: +308/-0 lines in one sidecar module; tests +239/-0, README +41/-0, dependency list +4/-0. No dead legacy branches, wrappers, or pass-through layers existed. Execution-document line changes are tracked separately by Git.

### Delivery limitation

The fenced sidecar is approved and verified. Full Step 7/8 server integration, actual ordered/received/invoiced state reconciliation, accounting transfers, CFO authentication, real settlement, and PAID stamps remain with the application-owning seat. Required HARA checks cannot pass without the missing HARA package. No commit, push, landing or commit receipt was created; launcher owns that handoff.

## Round 4 — WO-06 certification

Sidecar tests were not re-run in this seat. The prior fenced verdict stands. `npm test` is now the copper end-to-end file rather than the scaffold smoke check; see WO-06 review-log.md for that command's fresh result. HARA manifest and `hara/blocks` remain absent.

- **Verdict:** APPROVED for the fenced sidecar scope recorded in Round 3.
