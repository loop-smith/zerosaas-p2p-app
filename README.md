# ZeroSaaS P2P — Headless Copper Stock-to-Pay ERP (`8090-p2p-app`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/SDLC-8090%20Software%20Factory-1d4ed8)](#planned-8090-software-factory-build-queue-wo-01--wo-06)
[![Headless SoRs: 4 MIT Databases](https://img.shields.io/badge/Systems%20of%20Record-4%20MIT%20Databases-0f766e)](#planned-8090-software-factory-build-queue-wo-01--wo-06)

> **Most AI procurement demos hand an LLM a corporate credit card, a database password, and a prayer. Try showing that to a sitting CFO, Controller, or external SOX 404 auditor — you won't make it past the lobby.**

Project scaffold initialized live at the **EVOLVE: 8090 AI Hackathon** (`2026-11-13`) from upstream **BOSS** brownfield enterprise discovery for end-to-end build-out through **8090 Software Factory** (`Refinery` ➔ `Foundry` ➔ `Planner` ➔ `Validator`).

## Planned 8090 Software Factory Build Queue (`WO-01` .. `WO-06`)

A self-contained, **`100%` MIT-licensed industrial P2P workflow application** on a single zero-scroll (`100vh`) command screen for single-item stocked commodity replenishment (`PO-25800` · `8,000 FT` `2/0 AWG` ASTM B8 Bare Stranded Copper = `8 × 1,000-FT` GS1-barcoded wooden master reels / `3,288 lbs` net Cu):

- **`4` Real Headless Systems of Record (`100%` MIT in `/seeds`, Zero Toy Mocks):** `InvenTree` WMS (`115` tables, strictly `1` stocked copper item `ITM-CU-20-BARE`), `Django-CRM` (`150` tables), `Headless HRM` (`6` human signing limits + `$0.00` AI cap), and an `89`-account double-entry GAAP general ledger (`coa_seed.journal`, `hledger --strict` compatible with locked `$2.89/FT` FY2026 Annual Standard Cost = `$23,120.00` + `501900` Purchase Price Variance `PPV`).
- **`KAL` Zero-Authority Voice Steward (`$0.00` Signing Limit, `0` DB/GL/Bank Write Credentials):** Orchestrates deterministic workflow blocks and `<500ms` ElevenLabs `Turbo v2.5` voice briefings while enforcing **`HTTP 403 AI_STEWARD_ZERO_AUTHORITY`** on any unapproved commitment attempt and pausing strictly at **4 Human Checkpoints** (`Darius $20k` ➔ `VP Devon $100k` ➔ `Marcus 8-Reel GS1 Dock Scan` ➔ `CFO Meredith Check #10045`).
- **`3` Clean External/Sidecar Pipes — Zero API Maze:** (1) **ElevenLabs** (`Eleven Turbo v2.5` TTS + `Scribe` STT), (2) **Warm Local `RapidOCR` Sidecar** (`Apache-2.0` / `BSD-3` / `MIT-CMU` — mints `PO-25800`, Vendor OA `ENC-OA-2026-884192`, `BOL-25800`, `PS-25800`, `INV-25800` and extracts `28` pixel OCR boxes for `$0.00`-variance 3-Way Match), and (3) **Live COMEX Copper (`HG`) Spot Feed** (`gold-api.com` + `Yahoo Finance` fallback, locking `~$2.70/FT = ~$21,600.00` for `-$1,520.00` favorable `501900 PPV`).

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