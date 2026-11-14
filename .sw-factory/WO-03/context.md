<!--lint disable strong-marker-->

# Work Order Entity Index: WO-03

**Initialized At (UTC):** 2026-11-14T02:48:07Z
**Current Status:** fenced sidecar verified; full WO-03 integration pending owning seat


## Work Order

- WO-03: Build Warm RapidOCR 5-PDF Sidecar (:3591 sidecar/invoice_ocr_engine.py), Deterministic 28-Box Step 7 3-Way Match & Step 8 CFO Check #10045 (`WO-03`)


## Requirements



## Blueprints



## Referenced Blueprints

Blueprints reached through `@…` mentions and links while reading linked blueprints.



## Delivery

- Branch:
- Pull Request URL:

## Live 8090 Software Factory Traceability
- **Organization:** `Robert Paddock — EVOLVE Hackathon` (`ab209dd1-ce3e-4eda-9839-f5982b4b1c22`)
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Refinery Knowledge Base Resource:** `2fb45197-ecd8-463e-b72b-db79275329e3`
- **Foundry Requirement (`REQ-01`):** `c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc`
- **Foundry Agent Session:** `6efbe532-dc88-467d-89fd-db361b5d1f75`

## HARA-06.WO-03-A execution scope
- User authorized implementation despite absent named HARA skills on the final turn; inline requirements govern.
- Primary source: contracts/p2p-lineage-contract.json (read in full). No existing sidecar/src/hara code or reusable application functions exist.
- Requirements trace: R1 warm local OCR/CLI; R2 five PDFs and pixel boxes; R3 contract match proposal; R4 CFO/bank policy proposal; R5 required checks. Full server/ledger integration is outside fence.
- Software Factory MCP is not available. No blueprint documents are linked in this seed; requirement identifier alone is not accessible document content. No external record mutation attempted.
- Delivery is the local fenced working tree. Launcher owns commit, push and commit receipt.

## Final local evidence
- 39 sidecar pytest tests pass; py_compile passes; delegate final verdict APPROVED for fenced scope.
- HARA manifest/pytest and server syntax checks fail because their targets are absent. npm test passes only the scaffold contract smoke.
- Actual ledger/bank writes, receipt reconciliation, CFO authentication and server wiring are deliberately unimplemented in this seat; policy responses say posted:false.
- No commit, push or commit receipt created.
