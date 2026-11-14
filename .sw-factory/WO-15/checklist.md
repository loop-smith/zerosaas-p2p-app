<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-15 .. WO-18

**Work Order Numbers:** WO-15, WO-16, WO-17, WO-18
**Theme:** `THM-4` (`05591d02-9ff7-41ce-886d-92fdcda411a9`) from `FB-5` (`a19b9a76-2adb-405b-8d34-53ec41fbbf76`)
**Initialized At (UTC):** 2026-11-14T10:15Z

## Phase 1: Context Gathering

- [x] Verified live 8090 Software Factory Round 4 UUIDs (`KB-00`, `REQ-01`, `BP-01`, `FB-5`, `THM-4`, `WO-15`..`WO-18`) recorded in `context.md`.
- [x] Mapped existing kernel, sidecar, seed, and ES-module client contracts so zero existing regression tests break.
- [x] **Certification: Phase 1 complete.**

## Phase 2: Planning And Implementation

- [x] `WO-15` (`000bf83`): Streaming female KAL voice (`EXAVITQu4vr4xnSDxMaL`), controller phonetic lexicon, Scribe v1 keyterms, and RapidOCR `/mint` + `/scan` 28-box parity.
- [x] `WO-16` (`116b75b`): 1:1 3-panel workbench UI (`public/index.html`, `public/styles.css`, `public/app.js`), RF laser scan, inline RapidOCR invoice, Check `#10045`, EO 14434 × KYSI matrix, Tab 4 `WO 1-18`, and static/unit test coverage.
- [x] `WO-17` (`f0e0f5c`): 275-table brownfield SQLite schema explorer (`151` CRM / `119` WMS / `5` HRM), live/offline COMEX spot subview, cross-platform `hledger` discovery, 13-route workbench engine, and `tests/test-golden-master-e2e.mjs`.
- [x] `WO-18`: Internal prefix scrub across `.sw-factory/` and `tests/`, EO 14434 × KYSI governance documentation, and Round 4 Software Factory traceability in `README.md` and `docs/software-factory-trace.md`.
- [x] **Certification: Phase 2 complete.**

## Phase 3: Review And Verification

- [x] `npm test` — PASS (`test-sidecar-reply.mjs`, `selfcheck.mjs` 26/26, `test-copper-e2e.mjs` 13/13, `test-golden-master-e2e.mjs` 15/15).
- [x] `node --test public/command-desk.test.mjs` — PASS (16/16).
- [x] `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py` — PASS (71 passed).
- [x] `python3 seeds/build_seeds.py --check` — PASS (`seeds OK`, 0 drift).
- [x] Repository-wide forbidden-string and secret scan — PASS (0 matches).
- [x] **Certification: Ready for independent cross-family Qualify Review.**
