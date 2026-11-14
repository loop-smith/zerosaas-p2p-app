# ZeroSaaS P2P — Headless Copper Stock-to-Pay ERP (`zerosaas-p2p-app`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/SDLC-8090%20Software%20Factory-1d4ed8)](#8090-software-factory-traceability-sf-wo-1--wo-12--commits--qualify-reviews)
[![Planner: 12/12 Work Orders Completed](https://img.shields.io/badge/Planner-12%2F12%20Completed-15803d)](./docs/software-factory-trace.md)
[![Headless SoRs: 4 MIT Databases](https://img.shields.io/badge/Systems%20of%20Record-4%20MIT%20Databases-0f766e)](#8090-software-factory-build-queue-wo-01--wo-06)

> **Most AI procurement demos hand an LLM a corporate credit card, a database password, and a prayer. Try showing that to a sitting CFO, Controller, or external SOX 404 auditor — you won't make it past the lobby.**

Project scaffold initialized live at the **EVOLVE: 8090 AI Hackathon** (`2026-11-13`) from upstream **BOSS** brownfield enterprise discovery for end-to-end build-out through **8090 Software Factory** (`Refinery` ➔ `Foundry` ➔ `Planner` ➔ `Validator`).

> Repository renamed from `8090-p2p-app` to **`zerosaas-p2p-app`** (`loop-smith/zerosaas-p2p-app`).

## 8090 Software Factory Build Queue (`WO-01` .. `WO-06`)

A self-contained, **`100%` MIT-licensed industrial P2P workflow application** on a single zero-scroll (`100vh`) command screen for single-item stocked commodity replenishment (`PO-25800` · `8,000 FT` `2/0 AWG` ASTM B8 Bare Stranded Copper = `4 × 2,000-FT` GS1-barcoded wooden master reels `ENC-GS1-884192-R01..R04` / `3,288 lbs` net Cu):

- **`4` Real Headless Systems of Record (`100%` MIT in `/seeds`, Zero Toy Mocks):** `InvenTree` WMS (`115` tables, strictly `1` stocked copper item `ITM-CU-20-BARE`), `Django-CRM` (`150` tables), `Headless HRM` (`6` human signing limits + `$0.00` AI cap), and an `89`-account double-entry GAAP general ledger (`coa_seed.journal`, `hledger --strict` compatible with locked `$2.89/FT` FY2026 Annual Standard Cost = `$23,120.00` + `501900` Purchase Price Variance `PPV`).
- **`KAL` Zero-Authority Voice Steward (`$0.00` Signing Limit, `0` DB/GL/Bank Write Credentials):** Orchestrates deterministic workflow blocks and `<500ms` ElevenLabs `Turbo v2.5` voice briefings while enforcing **`HTTP 403 AI_STEWARD_ZERO_AUTHORITY`** on any unapproved commitment attempt and pausing strictly at **4 Human Checkpoints** (`Darius $20k` ➔ `VP Devon $100k` ➔ `Marcus 4-Reel GS1 Dock Scan` ➔ `CFO Meredith Check #10045`).
- **`3` Clean External/Sidecar Pipes — Zero API Maze:** (1) **ElevenLabs** (`Eleven Turbo v2.5` TTS + `Scribe` STT), (2) **Warm Local `RapidOCR` Sidecar** (`Apache-2.0` / `BSD-3` / `MIT-CMU` — mints `PO-25800`, Vendor OA `ENC-OA-2026-884192`, `BOL-25800`, `PS-25800`, `INV-25800` and extracts `28` pixel OCR boxes for `$0.00`-variance 3-Way Match), and (3) **Live COMEX Copper (`HG`) Spot Feed** (`gold-api.com` + `Yahoo Finance` fallback, locking `~$2.70/FT = ~$21,600.00` for `-$1,520.00` favorable `501900 PPV`).

## 8090 Software Factory Traceability (SF `WO-1` .. `WO-12` ⇄ Commits ⇄ Qualify Reviews)

The build ran in a live 2-way 8090 Software Factory loop. All **12 / 12** Planner Work Orders are Completed, and Validator Theme `THM-1` is Resolved.

- **Organization:** `ab209dd1-ce3e-4eda-9839-f5982b4b1c22`
- **Project:** `ZeroSaaS P2P` (`9e2da614-7738-46a6-9152-69c4ec850ed5`)
- **Anchors:**
  - Refinery `KB-00`: `2fb45197-ecd8-463e-b72b-db79275329e3`
  - Foundry `REQ-01`: `1fc08c46-ed36-4a14-99a3-0eae8de04206`
  - Architecture Blueprint `BP-01`: `61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`
  - Feature Blueprint: `bf2a43c7-eea6-4ea6-839a-6d83ae12b8a8`
  - Agent Session: `6efbe532-dc88-467d-89fd-db361b5d1f75`
- **Validator round-trip:**
  - Feedback `FB-1`: `f817adb9-0be8-49fe-9cfe-9eaa599b9f2e`
  - Feedback `FB-2`: `804e1202-8162-4fca-9f6f-55d051f7b8df`
  - Theme `THM-1` *ZeroSaaS P2P Route Contract & SOX 404 Adverse Replay Hardening* (Resolved): `2c9639f9-302f-4fa9-801d-8fcc162b2920`
  - Planner `SF WO-12` *Harden live `/api/step/:n` route contracts and adversarial replay guards* (Urgent, Fix): Completed

Each Planner Work Order maps to a build WO and then to a commit on `main`. An independent Qualify Review then checks each commit. A `FAIL` verdict returns to the Validator as a typed follow-up work order. Two of those findings were also filed in the Validator as `FB-1` and `FB-2` and grouped into Theme `THM-1`. The Planner then issued `SF WO-12`, which is now Completed. The full forward and backward matrix, the Qualify Review ledger and the closed items are in **[`docs/software-factory-trace.md`](./docs/software-factory-trace.md)**.

| SF Planner WO | Build WO | Commit | Qualify Review |
| --- | --- | --- | --- |
| SF WO-1 Validate brownfield contracts · SF WO-2 Stocked-copper inventory | `HARA WO-01` | `3769d7e6` | ✅ PASS |
| SF WO-3 KAL zero-authority · SF WO-4 Darius/Devon gates · SF WO-5 Dock GS1 intake · SF WO-7 COMEX pricing · SF WO-8 `501900` PPV ledger · SF WO-9 Disbursement `#8801` vs `#4409` controls | `HARA WO-02` | `11e6a606` | ✅ PASS |
| SF WO-6 28-box 3-way reconciliation | `HARA WO-03-A` | `2ba3ae52` | ✅ PASS |
| UI Command Desk (cross-cutting) | `HARA WO-04-A` ➔ `WO-04-A.f1` | `1ad7f604` ➔ `9094b2bb` | ❌ FAIL (`FB-1`) ➔ ✅ PASS |
| SF WO-10 Audit recovery | `HARA WO-06` + `T19.f1` | `fca1c225`, `cae71057` | ✅ PASS |
| SF WO-11 PO-25800 E2E | `HARA WO-05` (`T19` ➔ `T19.f1`) | `11a63009` ➔ `cae71057` | ❌ FAIL (`null` sidecar reply) ➔ ✅ PASS |
| SF WO-12 Route contract & replay hardening (from `THM-1`) | `HARA WO-04-A.f1` + `WO-06` + `T19.f1` | `9094b2bb`, `fca1c225`, `cae71057` | ✅ PASS |

Run the full verification with `npm test`. It runs `tests/test-sidecar-reply.mjs` and then `tests/test-copper-e2e.mjs` (26 self-checks and 12 integrated red-team checks).

## Pre-Event Planning & Third-Party Tool / License Disclosure (EVOLVE Rules §10)

- **Pre-Event Planning Disclosure:** Per EVOLVE FAQ (*brainstorming, problem exploration, wireframing, and tech-stack setup permitted prior to kickoff*), upstream brownfield workflow discovery (`BOSS` export) and the static P2P target schema contract (`contracts/p2p-lineage-contract.json`) were prepared prior to kickoff; `100%` of application server code, UI, OCR sidecar, ledger bindings, voice steward, and test suites in this repository are built live during the event via **8090 Software Factory** (`WO-01`..`WO-06`).
- **Open-Source Libraries, External APIs, Partner & AI Coding Tools (`100%` MIT-Compatible):**
  - `Node.js 22+` (`node:sqlite`, `node:http`, `node:crypto`) — MIT License
  - `SQLite 3` + `4` MIT Headless Seeds (`InvenTree` WMS MIT · `Django-CRM` MIT · `Headless HRM` MIT · `89`-account `coa_seed.journal` MIT) — Public Domain & MIT
  - `hledger` (optional external plaintext accounting CLI verifier; built-in MIT JS verifier included) — GPL-3.0 (unmodified external CLI binary only, not bundled)
  - `Python 3.12` (`PSF-2.0`), `rapidocr-onnxruntime` (`Apache-2.0`), `pypdfium2` (`Apache-2.0`), `Pillow` (`MIT-CMU`), `reportlab` (`BSD-3-Clause`)
  - `8090 Software Factory` (`Refinery` · `Foundry` · `Planner` · `Validator`) + `software-factory` plugin — EVOLVE Host Platform / Partner Tool
  - `ElevenLabs API` (`Eleven Turbo v2.5` TTS & `Scribe` STT for `KAL` Steward) — EVOLVE Sponsor API (Commercial Terms)
  - `gold-api.com` (`/price/HG` COMEX Copper feed) & `Yahoo Finance` (`HG=F` fallback) — Public REST Market Data APIs
  - AI Coding Harnesses: `Claude Code`, `OpenAI Codex`, `Google Antigravity (Gemini)`, and `xAI Grok`

## License

MIT © 2026 Robert Paddock (`loop-smith`)