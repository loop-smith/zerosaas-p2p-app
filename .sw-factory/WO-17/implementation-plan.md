<!--lint disable strong-marker-->

# Implementation Plan: WO-17

## Summary

Expands the deterministic MIT SQLite brownfield seed vault to 275 tables (`151` CRM / `119` WMS / `5` HRM) + `89` GAAP accounts, adds `/api/table`, `/api/copper-spot`, `/api/invoice-image`, `/api/invoice-pdf`, `/api/trade-pdf`, `/api/lineage/recrawl`, and cross-platform `hledger --strict` discovery alongside the existing kernel routes.

## Touched Files

- `seeds/schemas_275.json`, `seeds/build_seeds.py`, `seeds/test_seeds.py`, `src/documents.mjs`, `src/table_explorer.mjs`, `src/workbench_engine.mjs`, `src/workbench_lineage.mjs`, `src/sor_3panel_server.mjs`, `tests/test-golden-master-e2e.mjs`

## Testing

1. `npm test`
2. `node --test public/command-desk.test.mjs`
3. `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py`
4. `python3 seeds/build_seeds.py --check`
