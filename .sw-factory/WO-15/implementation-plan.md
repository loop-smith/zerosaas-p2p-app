<!--lint disable strong-marker-->

# Implementation Plan: WO-15 .. WO-18 (Round 4 Workbench, Voice, 275-Table Vault & Governance Parity)

## Summary

Closes Validator `FB-5` (`a19b9a76-2adb-405b-8d34-53ec41fbbf76`) and Theme `THM-4` (`05591d02-9ff7-41ce-886d-92fdcda411a9`) across four modular, reviewable commits (`WO-15`..`WO-18`) while keeping 100% of existing seed, sidecar, kernel, red-team, and client contract suites green.

## Requirements & Acceptance Mapping

| ID | Requirement | Implementation | Verification |
| --- | --- | --- | --- |
| R1 | RapidOCR `/mint` + `/scan` parity alongside existing sidecar contract | `sidecar/invoice_ocr_engine.py`, `sidecar/test_invoice_ocr_engine.py` | `pytest sidecar/test_invoice_ocr_engine.py` (40 passed) |
| R2 | Streaming female KAL voice (`EXAVITQu4vr4xnSDxMaL`), controller phonetic lexicon, Scribe keyterms, zero secret leakage | `src/voice.mjs` | `tests/test-copper-e2e.mjs` + `tests/test-golden-master-e2e.mjs` (0 raw digits, 0 duplicate words, 0 leaked keys) |
| R3 | 1:1 3-panel ZeroSaaS P2P workbench glass, 4-reel RF laser scan, inline 28-box RapidOCR viewer, inline Check `#10045`, Tab 3 EO 14434 × KYSI matrix, Tab 4 `WO 1-18` | `public/index.html`, `public/styles.css`, `public/app.js` | `pytest public/test_command_desk.py` (7 passed) + `node --test public/command-desk.test.mjs` (16/16) |
| R4 | 275-table MIT brownfield SQLite seeds (`151` CRM / `119` WMS / `5` HRM) with `drift() == []` and zero secret/hash artifacts | `seeds/schemas_275.json`, `seeds/build_seeds.py`, `seeds/test_seeds.py` | `python3 seeds/build_seeds.py --check` + `pytest seeds/test_seeds.py` (24 passed) |
| R5 | 13-route workbench engine (`GET /api/state`, `POST /api/step`, `POST /api/reset`, `GET /api/table`, `GET /api/copper-spot`, `GET /api/invoice-image`, `GET /api/invoice-pdf`, `GET /api/trade-pdf`, `POST /api/lineage/recrawl`, `/api/voice/*`) unified with deterministic kernel | `src/workbench_lineage.mjs`, `src/table_explorer.mjs`, `src/documents.mjs`, `src/workbench_engine.mjs`, `src/sor_3panel_server.mjs`, `tests/test-golden-master-e2e.mjs` | `npm test` (4 sidecar-reply + 26 selfcheck + 13 red-team + full 8-step & 275-table E2E) |
| R6 | Repository hygiene, internal prefix scrub, EO 14434 × KYSI documentation, and Round 4 Software Factory traceability | `.sw-factory/WO-15/`, `README.md`, `docs/software-factory-trace.md` | Forbidden-string grep exits 1 (0 matches); all suites green |

## Testing Commands

1. `npm test`
2. `node --test public/command-desk.test.mjs`
3. `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py`
4. `python3 seeds/build_seeds.py --check`
