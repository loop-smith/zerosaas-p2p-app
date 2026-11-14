<!--lint disable strong-marker-->

# Work Order Entity Index: WO-17

**Initialized At (UTC):** 2026-11-14T10:15Z
**Current Status:** completed (landed and verified on `main`)

## Live 8090 Software Factory Entities

- **Organization:** `ab209dd1-ce3e-4eda-9839-f5982b4b1c22`
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Work Order:** `WO-17` (`78e025ce-ac9b-4714-a769-4b38767baa9d`) — Implement 275-Table ERP/WMS/HRM/CRM SQLite Explorer, Live COMEX Spot Subview & 13-Route Workbench Engine (`https://factory.8090.ai/project/9e2da614-7738-46a6-9152-69c4ec850ed5/work-orders/17`)
- **Validator Feedback (`FB-5`):** `a19b9a76-2adb-405b-8d34-53ec41fbbf76`
- **Validator Theme (`THM-4`):** `05591d02-9ff7-41ce-886d-92fdcda411a9`
- **Foundry Requirement (`REQ-01`):** `1fc08c46-ed36-4a14-99a3-0eae8de04206`
- **Foundry Blueprint (`BP-01`):** `61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`
- **Refinery Knowledge Base (`KB-00`):** `2fb45197-ecd8-463e-b72b-db79275329e3`
- **Landed Commits:** `f0e0f5c` on `main`

## Scope

- Files: `seeds/schemas_275.json`, `seeds/build_seeds.py`, `seeds/test_seeds.py`, `src/documents.mjs`, `src/table_explorer.mjs`, `src/workbench_engine.mjs`, `src/workbench_lineage.mjs`, `src/sor_3panel_server.mjs`, `tests/test-golden-master-e2e.mjs`
- Summary: Expands the deterministic MIT SQLite brownfield seed vault to 275 tables (`151` CRM / `119` WMS / `5` HRM) + `89` GAAP accounts, adds `/api/table`, `/api/copper-spot`, `/api/invoice-image`, `/api/invoice-pdf`, `/api/trade-pdf`, `/api/lineage/recrawl`, and cross-platform `hledger --strict` discovery alongside the existing kernel routes.
