<!--lint disable strong-marker-->

# Work Order Entity Index: WO-05

**Initialized At (UTC):** 2026-11-14T02:48:08Z
**Current Status:** in_review


## Work Order

- WO-05: Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs) (`WO-05`)


## Requirements

- Foundry Requirement REQ-01 (`c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc`). Body not readable here (no Software Factory MCP). Acceptance text is the Concrete Acceptance Criteria in `implementation-plan.md`.
- Delivered file: `tests/test-copper-e2e.mjs`. `npm test` runs `node tests/test-copper-e2e.mjs`. The run is 26 self-check assertions plus 12 integrated red-team/OCR checks.
- T19 integration:
  - `src/` (:3590) gains the opt-in `ocrUrl` / `OCR_URL`, `/docs/<file>`, and `documents` + `ocr` in the snapshot.
  - `sidecar/` (:3591) writes the OCR page PNG and prints a `serve` ready line.
  - `public/app.js` `validateState` runs on the live snapshot.
  - `seeds/` are copied into the temp sandbox.


## Blueprints

- None linked. No blueprint documents are in this checkout.


## Referenced Blueprints

Blueprints reached through `@…` mentions and links while reading linked blueprints.

- None. MCP blueprint reads are unavailable. The architecture anchor is `contracts/p2p-lineage-contract.json` plus `src/selfcheck.mjs`.


## Delivery

- Branch: launcher commits this lane; this seat does not commit or push
- Pull Request URL: none

## Live 8090 Software Factory Traceability
- **Organization:** `Robert Paddock — EVOLVE Hackathon` (`ab209dd1-ce3e-4eda-9839-f5982b4b1c22`)
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Refinery Knowledge Base Resource:** `2fb45197-ecd8-463e-b72b-db79275329e3`
- **Foundry Requirement (`REQ-01`):** `c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc`
- **Foundry Agent Session:** `6efbe532-dc88-467d-89fd-db361b5d1f75`
