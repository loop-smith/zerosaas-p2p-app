<!--lint disable strong-marker-->

# Implementation Plan: WO-18

## Summary

Documents and enforces the 4-Layer White House Superintelligence Accord (`EO 14434` L1-L4) x `8090 KYSI` sovereign governance matrix, hardens steward header-spoof refusal on `POST /api/step` (`403 AI_STEWARD_ZERO_AUTHORITY`), scrubs internal prefixes from documentation, and completes Round 4 Software Factory traceability.

## Touched Files

- `README.md`, `docs/software-factory-trace.md`, `src/sor_3panel_server.mjs`, `src/workbench_lineage.mjs`, `tests/test-golden-master-e2e.mjs`, `.sw-factory/WO-15..WO-18/`

## Testing

1. `npm test`
2. `node --test public/command-desk.test.mjs`
3. `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py`
4. `python3 seeds/build_seeds.py --check`
