<!--lint disable strong-marker-->

# Work Order Entity Index: WO-04

**Initialized At (UTC):** 2026-11-14T02:48:07Z
**Current Status:** client_ready_for_integration (remote status unchanged)


## Work Order

- WO-04: Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk (:3590 public/index.html), KAL ElevenLabs Voice Steward & WebM Recorder (`WO-04`)


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

## Local Execution Context
- Scope authority: user task HARA-06.WO-04-A and local WO-04 acceptance criteria.
- Reuse authority: contracts/p2p-lineage-contract.json (four reels overrides older README eight-reel description).
- No connected Software Factory MCP or linked blueprint content is available; remote traceability and status updates cannot be performed.
- This checkout contains no src/, seeds/, sidecar/, hara/, tests/ or public/ at baseline. Server implementation is outside the fence.
- Client transport proposal and acceptance tracking are in implementation-plan.md; live integration remains required.
- No commit, push, landing, compression, or commit receipt is authorized.

## Handoff
- Client-only independent review: APPROVED; full end-to-end integration is blocked by missing server/proxies, real PDF/OCR and HARA package.
- New assets: public/index.html, public/styles.css, public/app.js. Verification: public/test_command_desk.py, public/command-desk.test.mjs, public/test_browser_command_desk.py.
- Fresh combined verification: 10 pytest tests passed, including nine Node cases and seven Chromium checks. Render max 1.00ms with populated journal and 28-box overlay. See review-log.md for exact failed infrastructure checks and replay setup.
- No existing backend routes/signatures could be verified. The server lane must supply the exact documented /api/state, /api/step, /api/reset, /api/kal/speak and /api/kal/transcribe contracts or adapt the explicit client boundary after integration.
- Follow-up integration: authenticate human seats server-side, enforce every refusal against real SoRs, serve five actual PDFs and invoice image/coordinates, configure ElevenLabs/Scribe on server, rerun end-to-end and HARA checks.
