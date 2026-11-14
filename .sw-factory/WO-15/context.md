<!--lint disable strong-marker-->

# Work Order Entity Index: WO-15 .. WO-18 (Round 4 Full-Stack Workbench Parity)

**Initialized At (UTC):** 2026-11-14T10:15Z
**Current Status:** completed (landed and verified on `main`)

## Live 8090 Software Factory Entities (Round 4)

- **Organization:** `ab209dd1-ce3e-4eda-9839-f5982b4b1c22`
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Refinery Knowledge Base (`KB-00`):** `2fb45197-ecd8-463e-b72b-db79275329e3`
- **Foundry Requirement (`REQ-01`):** `1fc08c46-ed36-4a14-99a3-0eae8de04206`
- **Foundry Architecture Blueprint (`BP-01`):** `61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`
- **Validator Feedback (`FB-5`):** `a19b9a76-2adb-405b-8d34-53ec41fbbf76` — Full-stack 3-panel workbench, streaming female KAL voice, 275-table brownfield SQLite explorer, and EO 14434 × KYSI governance parity
- **Validator Theme (`THM-4`):** `05591d02-9ff7-41ce-886d-92fdcda411a9` — ZeroSaaS P2P Full-Stack 3-Panel Workbench, Voice Lexicon, 275-Table Explorer & EO 14434 × KYSI Parity
- **Planner Work Orders (Round 4):**
  - `SF WO-15` (`3988d7f2-c356-487d-9ed2-9a1c045d3ee1`): Add streaming female KAL voice (`EXAVITQu4vr4xnSDxMaL`), controller phonetic lexicon, and 28-box RapidOCR `/mint` + `/scan` parity (`000bf83`)
  - `SF WO-16` (`bd3f7822-1571-4b81-80ca-6a32215a25aa`): Port 1:1 3-panel workbench glass, 4-reel RF laser scan, inline RapidOCR invoice, Check `#10045`, EO 14434 × KYSI matrix, and Software Factory `WO 1-18` view (`116b75b`)
  - `SF WO-17` (`78e025ce-ac9b-4714-a769-4b38767baa9d`): Add 275-table brownfield SQLite explorer (`151` CRM / `119` WMS / `5` HRM), live COMEX spot subview, cross-platform `hledger`, and 13-route workbench engine (`f0e0f5c`)
  - `SF WO-18` (`346dd5b4-37e7-45ed-bca0-6d36528bd0c6`): Scrub internal task prefixes, document White House Super Intelligence Accord (`EO 14434`) 4-Layer × 8090 KYSI governance, and update Software Factory trace

## Architecture & Scope

- **Sidecar (`sidecar/`):** Preserves all `/generate`, `/ocr`, `/match`, `/payment-check` and CLI commands while adding `/mint` and `/scan` (`28` RapidOCR bounding boxes on `INV-25800`).
- **Voice (`src/voice.mjs`):** Female streaming voice `EXAVITQu4vr4xnSDxMaL` (`eleven_turbo_v2_5` / `eleven_flash_v2_5`), `scribe_v1` STT with domain keyterms, controller phonetic lexicon (`normalizeKalSpeech`), and zero-secret `/api/voice/{status,kal,tts,stt}` + `/api/kal/{speak,transcribe}` routes.
- **Workbench UI (`public/`):** 1440×900 zero-scroll 3-panel light enterprise workbench (`index.html`, `styles.css`, `app.js`) with all 4 views (`1. P2P Flow Desk`, `2. DB & GL Registers`, `3. SOX & White House SI (EO 14434)`, `4. Software Factory`) and all 18 exported ES module helpers.
- **Seeds & 13-Route Engine (`seeds/`, `src/`, `tests/`):** `275` MIT SQLite tables (`seeds/schemas_275.json` + `seeds/build_seeds.py`) + `89` GAAP accounts, isolated `sandboxDir/workbench` 5-DB runtime vault, cross-platform `hledger` discovery, live/offline COMEX copper spot feed, and full end-to-end test suite (`tests/test-golden-master-e2e.mjs`).
