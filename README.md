# ZeroSaaS P2P — Headless Copper Stock-to-Pay ERP (`zerosaas-p2p-app`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/SDLC-8090%20Software%20Factory-1d4ed8)](#8090-software-factory-traceability-sf-wo-1--wo-18--commits--qualify-reviews)
[![Planner: WO-1..WO-18 Built (Round 4 Parity)](https://img.shields.io/badge/Planner-WO--1..WO--18%20Built%20%C2%B7%20Round%204%20Parity-0f766e)](./docs/software-factory-trace.md)
[![Headless SoRs: 275 SQLite Tables + 89 GAAP Accounts](https://img.shields.io/badge/Systems%20of%20Record-275%20SQLite%20Tables%20%2B%2089%20GAAP%20Accts-0f766e)](#headless-systems-of-record--13-route-workbench-architecture)

> **Most AI procurement demos hand an LLM a corporate credit card, a database password, and a prayer. Try showing that to a sitting CFO, Controller, or external SOX 404 auditor — you won't make it past the lobby.**

Project scaffold initialized live at the **EVOLVE: 8090 AI Hackathon** (`2026-11-13`) from upstream **BOSS** brownfield enterprise discovery for end-to-end build-out through **8090 Software Factory** (`Refinery` ➔ `Foundry` ➔ `Planner` ➔ `Validator`).

> Repository renamed from `8090-p2p-app` to **`zerosaas-p2p-app`** (`loop-smith/zerosaas-p2p-app`).

## Headless Systems of Record & 13-Route Workbench Architecture

A self-contained, **`100%` MIT-licensed industrial P2P workflow application** on a single zero-scroll (`100vh`) white enterprise workbench for single-item stocked commodity replenishment (`PO-25800` · `8,000 FT` `2/0 AWG` ASTM B8 Bare Stranded Copper = `4 × 2,000-FT` GS1-barcoded wooden master reels `ENC-GS1-884192-R01..R04` / `3,288 lbs` net Cu):

- **`4` Real Headless Systems of Record (`100%` MIT in `/seeds`, Zero Toy Mocks):**
  - `InvenTree` WMS (`seeds/wms_seed.sqlite3` — **`119` tables**, strictly `1` stocked copper item `ITM-CU-20-BARE` at `0 FT < 8,000 FT` minimum)
  - `Django-CRM` (`seeds/crm_seed.sqlite3` — **`151` tables**, approved vendor `Encore Wire Corporation`)
  - `Headless HRM` (`seeds/hrm_seed.sqlite3` — **`5` tables**, `6` human DOA signing limits + `$0.00` AI steward cap)
  - Plaintext Double-Entry GAAP General Ledger (`seeds/coa_seed.journal` — **`89` accounts**, `hledger --strict` compatible with locked `$2.89/FT` FY2026 Annual Standard Cost = `$23,120.00` + `501900` Purchase Price Variance `PPV`)
- **Female Streaming `KAL` Zero-Authority Voice Steward (`$0.00` Signing Limit, `0` DB/GL/Bank Write Credentials):**
  - Streams ElevenLabs female steward voice `EXAVITQu4vr4xnSDxMaL` (`eleven_turbo_v2_5` / `eleven_flash_v2_5`) and `scribe_v1` STT with domain keyterms (`InvenTree`, `RapidOCR`, `hledger`, `COMEX`, `ASTM B8`, `GS1`, `GRNI`, `PPV`, `EO 14434`, `KYSI`, `SOX 404`) and a controller-grade phonetic lexicon (`H-ledger`, `three-way match`, `G-R-N-I`, `P-P-V`, `E-O fourteen four thirty-four`, `K-Y-S-I`, zero raw unspoken digits).
  - Enforces **`HTTP 403 AI_STEWARD_ZERO_AUTHORITY`** on every write route and pauses strictly at **4 Human Checkpoints** (`Darius $20k` ➔ `VP Devon $100k` ➔ `Marcus 4-Reel GS1 Dock Scan` ➔ `CFO Meredith Check #10045`).
- **`3` Clean External/Sidecar Pipes — Zero API Maze:**
  1. **ElevenLabs** (`EXAVITQu4vr4xnSDxMaL` streaming TTS + `scribe_v1` STT via zero-secret server routes; instant Web Speech fallback when `ELEVENLABS_API_KEY` is unset)
  2. **Warm Local `RapidOCR` Sidecar (`:3591`)** (`Apache-2.0` / `BSD-3` / `MIT-CMU` — `/mint`, `/scan`, `/generate`, `/ocr`, `/match`, `/payment-check`; mints `PO-25800`, Vendor OA `ENC-OA-2026-884192`, `BOL-25800`, `PS-25800`, `INV-25800` and extracts **`28` pixel OCR boxes** at ~`97.2%` confidence for `$0.00`-variance 3-Way Match)
  3. **Live COMEX Copper (`HG`) Spot Feed** (`gold-api.com/price/HG` + `Yahoo Finance HG=F` fallback, locking `~$2.70/FT = ~$21,600.00` for `+$1,520.00` favorable `501900 PPV`)

## ZeroSaaS P2P 3-Panel Enterprise Workbench (`WO-15` .. `WO-18`)

`npm start` serves the workbench at `http://127.0.0.1:3590` (with the RapidOCR sidecar on `:3591`). It renders inside one `1440×900` zero-scroll light enterprise frame:

- **Topbar (`48px`):** `[P2P]` badge, `ZeroSaaS P2P` brand (`WMS Signal ➔ 1-Click Dock Scan ➔ RapidOCR 3WM ➔ CFO Check`), live `GAAP DR == CR` strict balance pill, `KAL Voice` toggle, push-to-talk **Ask KAL**, WebM **Record**, and **Reset Queue**.
- **Left rail (`236px`):** **`▶ Start KAL · P2P Steward`** guided narration button, 4 interactive views (`1. P2P Flow Desk` with `Step N/8`, `2. DB & GL Registers` with `275 Tbls`, `3. SOX & White House SI` with `EO 14434`, `4. Software Factory` with `WO 1-18`), live order & copper spot summary, **Guardrail Tests** (`6` live `403`/`409` red-team probes), and the **GL & Audit Register** drawer.
- **Center stage:**
  - **View 1 (`P2P Flow Desk`):** 8-step progress strip, active step workstation with 4-reel GS1 RF laser scanner (`@keyframes rfLaserFlash`), live COMEX copper spot & ASTM B8 formula subview, inline Check `#10045` (`ACH-000582`) face with legal check words and CFO signature gate, and live GAAP Balance Sheet (`$250,000` ➔ `$228,400` Operating `#8801`, `$140,000` ring-fenced Payroll `#4409`, `$23,120` Standard Inventory) & Income Statement (`+$1,520` favorable `501900 PPV`).
  - **View 2 (`DB & GL Registers`):** Live SQLite schema explorer across all **`275` tables** (`151` CRM, `119` WMS, `5` HRM) + `89`-account `hledger` journal & SHA-256 lineage hops (`POST /api/lineage/recrawl`).
  - **View 3 (`SOX & White House SI`):** **White House Super Intelligence Accord (`EO 14434`) 4-Layer × 8090 Know Your Superintelligence (`KYSI`) L1–L4 × SOX 404** deterministic governance matrix:
    - **Layer 1 · Technical Controls (`KYSI L1` Identity & Capability Bounds):** `EMP-AI-KAL = $0.00` SQLite `CHECK` cap, zero DB/GL/bank write credentials, deterministic HTTP `403 AI_STEWARD_ZERO_AUTHORITY`.
    - **Layer 2 · Internal Oversight Gates (`KYSI L2` Human-in-the-Loop Checkpoints):** 4 seated officer gates (`Darius $20k`, `VP Devon $100k`, `Marcus Dock Scan SoD`, `CFO Meredith $500k`), `403 DOA_LIMIT_EXCEEDED`, `403 SOX_SOD_VIOLATION`, `409 MATCH_VARIANCE_HOLD`, `403 BANK_POLICY_VIOLATION`.
    - **Layer 3 · External Audit & Cryptographic Evidence (`KYSI L3` Verifiable Lineage):** Hash-chained audit log, SHA-256 trade PDFs & 28-box RapidOCR coordinates, `hledger check --strict` (`DR == CR`).
    - **Layer 4 · Board & Officer Governance (`KYSI L4` Statutory Accountability):** Named human officer attribution on every commitment and disbursement, ring-fenced `$140,000` Payroll `#4409`, instant session kill/reset.
  - **View 4 (`Software Factory`):** Closed-loop 5-stage 8090 Software Factory trace (`KB-00` ➔ `REQ-01` & `BP-01` ➔ `WO-1..WO-18` ➔ `FB-1..FB-5` & `THM-1..THM-4`) and enterprise stream expansion (`O2C`, `P2M`, `R2R`, `H2R`, `L2O`).
- **Right rail (`392px`):** Live GAAP trial balance, 5-PDF trade packet drawer, and inline 28-box RapidOCR invoice scanner with `.ocr-laser-bar` and zoom inspection modal.

### Unified 13-Route Workbench + Kernel API Surface (`:3590`)

| Route | Purpose |
| --- | --- |
| `GET /api/state` | Unified workbench + deterministic kernel snapshot (`state`, `deals`, `runtimeState`, `sorVault`, `hledger`, `financialStatements`) |
| `POST /api/step` & `POST /api/step/:n` | Execute workflow steps `1..8` and red-team guardrail probes (`403` / `409` / `200`) |
| `POST /api/reset` | Reset sandbox SQLite DBs, journal, artifacts, and lineage hops (`SYSTEM` / human only; `403` for `KAL`) |
| `GET /api/table?system=wms\|crm\|hrm&table=...` (or `db=`) | Live read-only SQLite table & row explorer across all `275` brownfield tables |
| `GET /api/copper-spot` & `GET /api/comex` | Live COMEX Copper (`HG`) spot quote + ASTM B8 `$2.70/FT` conversion |
| `GET /api/invoice-image` | Rendered `INV-25800` scan PNG for the inline 28-box RapidOCR overlay |
| `GET /api/invoice-pdf` & `GET /api/trade-pdf` & `GET /docs/:file` | Path-traversal-guarded PDF artifact streaming (`PO`, `OA`, `BOL`, `PS`, `INV`) |
| `POST /api/lineage/recrawl` | Re-verify live SQLite + journal SHA-256 hop digests |
| `GET /api/voice/status` | Active ElevenLabs voice configuration (`EXAVITQu4vr4xnSDxMaL`) & STT readiness |
| `POST /api/voice/kal` | Read-only `KAL` conversational Q&A with controller phonetic normalization (`0` write authority) |
| `POST /api/voice/tts` & `POST /api/kal/speak` | Zero-secret ElevenLabs streaming TTS proxy (`web_speech` fallback / `503` contract) |
| `POST /api/voice/stt` & `POST /api/kal/transcribe` | Zero-secret ElevenLabs `scribe_v1` STT proxy with P2P domain keyterms |
| `GET /api/health`, `GET /api/journal`, `GET /api/audit` | Service health, balanced GAAP journal legs, and hash-chained audit trail |

## 8090 Software Factory Traceability (SF `WO-1` .. `WO-18` ⇄ Commits ⇄ Qualify Reviews)

The application was built and refined across **4 closed-loop rounds** in **8090 Software Factory** (`WO-1` .. `WO-18`, `FB-1` .. `FB-5`, `THM-1` .. `THM-4`):

- **Organization:** `ab209dd1-ce3e-4eda-9839-f5982b4b1c22`
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Core Anchors:**
  - Refinery `KB-00`: `2fb45197-ecd8-463e-b72b-db79275329e3`
  - Foundry `REQ-01`: `1fc08c46-ed36-4a14-99a3-0eae8de04206`
  - Architecture Blueprint `BP-01`: `61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`
  - Feature Blueprint: `bf2a43c7-eea6-4ea6-839a-6d83ae12b8a8`
  - Agent Session: `6efbe532-dc88-467d-89fd-db361b5d1f75`
- **Validator Round-Trips (`FB-1..FB-5` ➔ `THM-1..THM-4`):**
  - **Round 1 (`FB-1` `f817adb9…` + `FB-2` `804e1202…` ➔ `THM-1` `2c9639f9…`):** Route contract alignment & SOX 404 adversarial replay hardening ➔ `SF WO-12` (Completed).
  - **Round 2 (`FB-3` `0ce52256…` ➔ `THM-2` `d3ab7474…`):** White enterprise workbench & `ZeroSaaS P2P` brand redesign ➔ `SF WO-13` (`97cb2858-1488-4b34-829c-b0162ea65be3`, `c5026200`).
  - **Round 3 (`SF WO-14`):** Interactive voice steward, dock RF wedge parser, RapidOCR field tagger, CFO check face & zero-secret voice proxy (`44cad6d1`, `465c3cd9`).
  - **Round 4 (`FB-5` `a19b9a76-2adb-405b-8d34-53ec41fbbf76` ➔ `THM-4` `05591d02-9ff7-41ce-886d-92fdcda411a9`):** Full-stack 3-panel workbench, streaming female `KAL` voice & phonetic lexicon, 275-table SQLite explorer, cross-platform `hledger`, and `EO 14434` × `KYSI` governance parity:
    - `SF WO-15` (`3988d7f2-c356-487d-9ed2-9a1c045d3ee1`) ➔ `000bf83`
    - `SF WO-16` (`bd3f7822-1571-4b81-80ca-6a32215a25aa`) ➔ `116b75b`
    - `SF WO-17` (`78e025ce-ac9b-4714-a769-4b38767baa9d`) ➔ `f0e0f5c`
    - `SF WO-18` (`346dd5b4-37e7-45ed-bca0-6d36528bd0c6`) ➔ `adfec36d`

See **[`docs/software-factory-trace.md`](./docs/software-factory-trace.md)** for the full forward and backward traceability matrix.

| SF Planner WO | Build Unit | Commit | Status |
| --- | --- | --- | --- |
| SF WO-1 Brownfield contracts · SF WO-2 Stocked-copper inventory | `WO-01` | `3769d7e6` | ✅ PASS |
| SF WO-3 KAL `$0` · SF WO-4 DOA gates · SF WO-5 Dock GS1 · SF WO-7 COMEX · SF WO-8 `501900` PPV · SF WO-9 `#8801` vs `#4409` | `WO-02` | `11e6a606` | ✅ PASS |
| SF WO-6 28-box 3-way reconciliation | `WO-03-A` | `2ba3ae52` | ✅ PASS |
| UI Command Desk & kernel contract binding | `WO-04-A` ➔ `WO-04-A.f1` | `1ad7f604` ➔ `9094b2bb` | ✅ PASS |
| SF WO-10 Audit recovery · SF WO-11 PO-25800 E2E · SF WO-12 Replay hardening | `WO-05` / `WO-06` / `T19.f1` | `fca1c225`, `11a63009`, `cae71057` | ✅ PASS |
| Rename follow-up (`targetRepo` & seed journal digest) | `WO-08` ➔ `T20` | `8721678d` ➔ `c1d69467` | ✅ Closed |
| SF WO-13 White Enterprise Workbench & brand (`THM-2`) | `WO-13` | `c5026200` | ✅ Built |
| SF WO-14 Interactive parity + zero-secret voice proxy | `WO-14` + `T21` | `44cad6d1`, `465c3cd9` | ✅ Built |
| SF WO-15 Streaming female KAL voice, phonetic lexicon & RapidOCR `/mint`+`/scan` (`THM-4`) | `WO-15` | `000bf83e` | ✅ PASS |
| SF WO-16 1:1 3-panel workbench glass, RF laser scan, inline OCR & Check `#10045` (`THM-4`) | `WO-16` | `116b75b5` | ✅ PASS |
| SF WO-17 275-table SQLite explorer, COMEX spot subview, cross-platform `hledger` & 13 routes (`THM-4`) | `WO-17` | `f0e0f5cd` | ✅ PASS |
| SF WO-18 Internal prefix scrub, `EO 14434` × `KYSI` governance & Round 4 trace (`THM-4`) | `WO-18` | `adfec36d` | ✅ PASS |

## Verification Suite

```bash
npm test
node --test public/command-desk.test.mjs
pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py
python3 seeds/build_seeds.py --check
```

## Pre-Event Planning & Third-Party Tool / License Disclosure (EVOLVE Rules §10)

- **Pre-Event Planning Disclosure:** Per EVOLVE FAQ (*brainstorming, problem exploration, wireframing, and tech-stack setup permitted prior to kickoff*), upstream brownfield workflow discovery (`BOSS` export) and the static P2P target schema contract (`contracts/p2p-lineage-contract.json`) were prepared prior to kickoff; application server code, workbench UI, OCR sidecar, ledger bindings, voice steward, 275-table seed builder, and automated test suites in this repository were built and refined through **8090 Software Factory** (`WO-01`..`WO-18`).
- **Open-Source Libraries, External APIs, Partner & AI Coding Tools (`100%` MIT-Compatible):**
  - `Node.js 22+` (`node:sqlite`, `node:http`, `node:crypto`) — MIT License
  - `SQLite 3` + `4` MIT Headless Seeds (`InvenTree` WMS `119` tables MIT · `Django-CRM` `151` tables MIT · `Headless HRM` `5` tables MIT · `89`-account `coa_seed.journal` MIT) — Public Domain & MIT
  - `hledger` (optional external plaintext accounting CLI verifier; built-in MIT JS verifier included) — GPL-3.0 (unmodified external CLI binary only, not bundled)
  - `Python 3.12+` (`PSF-2.0`), `rapidocr-onnxruntime` (`Apache-2.0`), `pypdfium2` (`Apache-2.0`), `Pillow` (`MIT-CMU`), `reportlab` (`BSD-3-Clause`)
  - `8090 Software Factory` (`Refinery` · `Foundry` · `Planner` · `Validator`) + `software-factory` plugin — EVOLVE Host Platform / Partner Tool
  - `ElevenLabs API` (`EXAVITQu4vr4xnSDxMaL` `Eleven Turbo v2.5` / `Flash v2.5` TTS & `Scribe v1` STT for `KAL` Steward) — EVOLVE Sponsor API (Commercial Terms)
  - `gold-api.com` (`/price/HG` COMEX Copper feed) & `Yahoo Finance` (`HG=F` fallback) — Public REST Market Data APIs
  - AI Coding Harnesses: `Claude Code`, `OpenAI Codex`, `Google Antigravity (Gemini)`, and `xAI Grok`

## License

MIT © 2026 Robert Paddock (`loop-smith`)
