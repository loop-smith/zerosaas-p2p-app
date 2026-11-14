# ZeroSaaS P2P

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/Built%20With-8090%20Software%20Factory-1d4ed8)](./docs/software-factory-trace.md)
[![Upstream Intake: BOSS Digital Twin](https://img.shields.io/badge/Upstream%20Twin-BOSS%208090-7c3aed)](./contracts/p2p-lineage-contract.json)
[![Headless SoRs: 275 SQLite Tables + 89 GAAP Accounts](https://img.shields.io/badge/Headless%20SoRs-275%20Tables%20%C2%B7%2089%20GAAP%20Accts-0f766e)](#the-four-technical-pillars-no-mocks)

> **8090 was founded on a blunt bet: enterprises don't need 1,000 bloated SaaS screens — they need the 80% of workflow that actually runs the business, for 90% less.**
>
> **We pushed that bet to its logical conclusion: `ZeroSaaS`.**

Most "AI procurement" demos hand an LLM a corporate credit card, a database password, and a prayer. Show that to a sitting CFO, Controller, or SOX 404 auditor and you won't make it past the lobby.

Enterprise buyers are trapped between two bad deals: paying millions in per-seat **SaaS rent** for forms sitting over ordinary SQL tables, or trusting **probabilistic agents** with live financial authority.

**ZeroSaaS P2P is the third path** — a complete, self-contained Stock-to-Pay ERP workbench shipped in under 20 hours at **EVOLVE: 8090 AI Hackathon** with **100% agent-written application code** directed by one human enterprise operator:

1. **$0 Per-Seat SaaS Rent (`ZeroSaaS`):** Four real, MIT-licensed open-source Systems of Record run headless underneath (`275` SQLite tables across WMS, CRM & HRM + an `89`-account `hledger` double-entry General Ledger) with **zero external `npm` dependencies** (`Node.js 22+` native `node:sqlite`) behind one zero-scroll operator desk.
2. **Binary Intelligence — 95% AI Legwork, $0.00 AI Authority (`KYSI` in Code, Not Prompts):** Deterministic code boundaries govern fast agentic work. **KAL**, our streaming ElevenLabs voice and `RapidOCR` vision steward, catches the copper stock-out, calls live COMEX copper spot feeds, guides a 4-reel barcode dock scan, and tags a 28-box vendor invoice — while SQLite `CHECK` constraints and `HTTP 403` gates lock her signing limit to **`$0.00`**. AI prepares; four human officers and strict `DR == CR` math commit every dollar.

---

## From `BOSS` Digital Twin ➔ `8090 Software Factory` ➔ Live `ZeroSaaS P2P`

Enterprise builds fail when code generation starts from vague prompts instead of real brownfield rules. This app demonstrates the full pipeline:

* **Upstream `BOSS` Digital Twin Intake:** Distilled **6 clean-room client discovery workshops** and **336 raw client files** (org chart, Delegation of Authority limits, SOPs, and standard-cost policies) into **35 specification files** and the machine-enforced lineage contract ([`contracts/p2p-lineage-contract.json`](./contracts/p2p-lineage-contract.json)).
* **Compiled in `8090 Software Factory`:** Loaded into `Refinery` ➔ `Foundry` ➔ `Planner` ➔ `Validator`, generating **11 initial Work Orders + 7 Change Orders** across **4 closed-loop Validator rounds** (**18/18 completed** in [`.sw-factory/`](./.sw-factory/) and traced in [`docs/software-factory-trace.md`](./docs/software-factory-trace.md)).
* **Live `BOSS` Stage Bridge & Autopilot Modes:** Includes a loopback `postMessage` (`zerosaas-cmd` / `zerosaas-status`) and CORS stage bridge so a live **BOSS** instance can embed, start, pause, and step the P2P workbench directly — plus standalone **Executive Overview**, **Hands-Free `KAL` Autopilot**, and **Human-Gate Stop Mode** (pausing at the 4 human officer checkpoints for live commentary).

---

## The Four Technical Pillars (No Mocks)

### 1. 🎙️ ElevenLabs Voice Steward & Live Ledger Q&A (`src/voice.mjs`)
* **Continuous Single-Stream TTS:** Streams `KAL` via **`ElevenLabs Turbo v2.5`** (automatic **`Flash v2.5`** fallback + live `X-Voice-Latency-Ms` badge) across dual steward personas (`ops_steward` & `treasury_steward`).
* **Controller Phonetic Lexicon:** Normalizes accounting & mill nomenclature (`GRNI`, `SOX 404`, `2/0 AWG`, `ASTM B8`, `GS1-128`, GL accounts `101100`–`501900`, and spoken dollar/cent figures) for crisp financial narration.
* **Push-to-Talk `🎙️ Ask KAL` (`ElevenLabs Scribe v1` STT):** Transcribes live voice questions and answers strictly **read-only** from SQLite and `hledger` (write commands return `$0` refusal). Automatically falls back to browser Web Speech when `ELEVENLABS_API_KEY` is unset; keys stay strictly in runtime `env` and are never echoed.

### 2. 📈 Outbound Live Copper Spot API & Wire-Mill Formula (`src/documents.mjs`, `src/lineage_core.mjs`)
* **Dual-Feed Live Market Callout:** Queries **`https://api.gold-api.com/price/HG`** and **`Yahoo Finance COMEX (HG=F)`** in parallel (with deterministic `$6.2436/lb` offline fallback if disconnected).
* **ASTM B8 Pricing & Standard-Cost `PPV`:** Applies the wire-mill draw formula `round((spotPerLb + $0.32 mill adder) × 0.411 lb/FT)` across `8,000 FT` (`3,288 lbs` net Cu), comparing live spot (`~$21,600`) against locked FY26 Annual Standard Cost (`$2.89/FT` = `$23,120.00`) to book favorable **Purchase Price Variance (`PPV`)** in GL `501900`.

### 3. 📦 Bay 4 GS1-128 Barcode Scan & 28-Box `RapidOCR` Vision (`sidecar/invoice_ocr_engine.py`)
* **4-Reel Handheld Dock Scan:** Warehouse Lead Marcus Vance (`EMP-0003`) scans all **4 GS1-barcoded master reels** (`ENC-GS1-884192-R01..R04`, `4 × 2,000 FT`) into `InvenTree` SQLite (`0 ➔ 8,000 FT`), blocking duplicate scans (`409 DUPLICATE_SCAN`), unknown barcodes (`422`), and Buyer self-receipt (`403 SOX_SOD_VIOLATION`).
* **Local `RapidOCR` ONNX Sidecar (`:3591`):** Mints the SHA-256-hashed 5-PDF trade packet (`PO-25800.pdf`, `ENC-OA-2026-884192.pdf`, `BOL-25800.pdf`, `PS-25800.pdf`, `INV-25800.pdf`), runs local ONNX neural detection/recognition across **`28` pixel bounding boxes** on `INV-25800.pdf`, overlays live bounding boxes in the UI, and enforces penny-exact **3-Way Match** (`PO == Dock BOL == OCR Invoice`, holding tampered bills with `409 MATCH_VARIANCE_HOLD`).

### 4. 🗄️ Four MIT Headless Systems of Record (`/seeds`)
* **WMS:** `InvenTree` schema (`seeds/wms_seed.sqlite3` — `119` tables)
* **CRM:** `Django-CRM` schema (`seeds/crm_seed.sqlite3` — `151` tables)
* **HRM:** Officer DOA signing limits, SoD roles & `$0.00` AI `CHECK` cap (`seeds/hrm_seed.sqlite3` — `5` tables)
* **GL:** `89`-account plaintext double-entry journal (`seeds/coa_seed.journal`, `hledger --strict` & built-in JS verifier)

---

## Inside the 3-Panel Zero-Scroll Workbench (`PO-25800` · Steps 1–8)

* **Left Rail — 4 Views & Adversarial Drawers:**
  1. **P2P Flow Desk (`Steps 1–8`):** Supply Chain stock-out (`0 FT < 8,000 FT`) ➔ Planner Darius (`$20k` cap escalation) ➔ VP Devon (`$100k` sign-off) ➔ Live COMEX Spot `PO-25800` & Encore Wire `OA` ➔ Marcus 4-Reel Bay 4 Scan (`DR 121100 Inventory / CR 201200 GRNI / CR 501900 PPV`) ➔ 28-Box `RapidOCR` 3-Way Match (`GRNI ➔ 201100 AP`) ➔ CFO Meredith Check `#10045` (`ACH-000582`) from Operating `#8801` while Payroll `#4409` (`$140,000`) stays ring-fenced.
  2. **DB & GL Registers:** Live SQLite table explorer across all headless databases + posted journal legs.
  3. **SOX & White House SI (`EO 14434`):** Deterministic control, assurance, evaluation, and oversight mapping.
  4. **Software Factory (`WO 1–18`):** Full requirement-to-work-order build lineage.
  * **🧪 6 Live Guardrail Tests:** Fire adversarial probes (`KAL $0 override`, `DOA breach`, `buyer self-receipt SoD`, `forged invoice price spike`, `payroll #4409 raid`, `duplicate check replay`) and watch deterministic `403`/`409` refusals hold with `$0.00` book impact.
* **Center Stage:** Interactive Officer Command Desk, Executive Overview brief, live Spot API ticker, 4-reel scanner, and visual OCR bounding-box inspector.
* **Right Rail & Top Controls:** Real-time `GAAP DR == CR` Trial Balance, rendered Check `#10045`, SHA-256 audit chain, `🎙️ Ask KAL`, built-in `🎥 60fps Recorder`, and `↺ 1-Click Reset` (wipes and re-seeds all databases back to Step 1).

---

## Run It in 30 Seconds (100% Self-Contained)

Requires **Node.js 22+** (uses built-in `node:sqlite` — **no `npm install` needed**) and **Python 3.12+** for the local `RapidOCR` ONNX sidecar. Boots cleanly with **zero API keys**.

```bash
pip install -r sidecar/requirements.txt
python3 sidecar/invoice_ocr_engine.py --port 3591 serve &
PORT=3590 OCR_URL=http://127.0.0.1:3591 npm start
# Open http://127.0.0.1:3590
```

### Optional Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3590` | HTTP port for the ZeroSaaS P2P workbench (`127.0.0.1`) |
| `OCR_URL` | `http://127.0.0.1:3591` | Local `RapidOCR` sidecar URL (`npm run sidecar`) |
| `ELEVENLABS_API_KEY` | *(unset)* | Enables live ElevenLabs streaming TTS (`eleven_turbo_v2_5`) & `Scribe v1` STT; falls back to browser Web Speech when unset |
| `ELEVENLABS_VOICE_ID` | `EXAVITQu4vr4xnSDxMaL` | Optional custom ElevenLabs voice ID override for `KAL` |

## Verification Suite

```bash
npm test
node --test public/command-desk.test.mjs
pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py
python3 seeds/build_seeds.py --check
```

## Repository Layout

```text
├── contracts/p2p-lineage-contract.json  # BOSS 8090 brownfield lineage, DOA caps, reels & GL rules
├── public/                              # Zero-scroll 3-panel UI, Executive Overview & stage bridge
├── src/                                 # Node 22 SQLite/GL kernel, Spot API, ElevenLabs & HTTP gates
├── sidecar/                             # Local RapidOCR ONNX invoice vision & 5-PDF trade mint
├── seeds/                               # 275-table MIT SQLite seeds (WMS/CRM/HRM) + 89-acct journal
├── tests/                               # Copper E2E, golden-master parity & red-team regression suites
├── docs/software-factory-trace.md       # Forward/backward Software Factory traceability
└── .sw-factory/WO-01..WO-18/            # Software Factory checklists, plans & Validator review logs
```

---

## Pre-Event Planning & Third-Party Tool / License Disclosure (EVOLVE Rules §10)

* **Pre-Event Planning Disclosure:** Per EVOLVE FAQ (*brainstorming, problem exploration, wireframing, and tech-stack setup permitted prior to kickoff*), upstream brownfield workflow discovery (`BOSS` export) and the static P2P target schema contract (`contracts/p2p-lineage-contract.json`) were prepared prior to kickoff; application server code, workbench UI, OCR sidecar, ledger bindings, voice steward, 275-table seed builder, and automated test suites in this repository were built and refined through **8090 Software Factory** (`WO-01`..`WO-18`).
* **Open-Source Libraries, External APIs, Partner & AI Coding Tools (`100%` MIT-Compatible):**
  * `Node.js 22+` (`node:sqlite`, `node:http`, `node:crypto`) — MIT License
  * `SQLite 3` + `4` MIT Headless Seeds (`InvenTree` WMS `119` tables MIT · `Django-CRM` `151` tables MIT · `Headless HRM` `5` tables MIT · `89`-account `coa_seed.journal` MIT) — Public Domain & MIT
  * `hledger` (optional external plaintext accounting CLI verifier; built-in MIT JS verifier included) — GPL-3.0 (unmodified external CLI binary only, not bundled)
  * `Python 3.12+` (`PSF-2.0`), `rapidocr-onnxruntime` (`Apache-2.0`), `pypdfium2` (`Apache-2.0`), `Pillow` (`MIT-CMU`), `reportlab` (`BSD-3-Clause`)
  * `8090 Software Factory` (`Refinery` · `Foundry` · `Planner` · `Validator`) + `software-factory` plugin — EVOLVE Host Platform / Partner Tool
  * `ElevenLabs API` (`Eleven Turbo v2.5` / `Flash v2.5` TTS & `Scribe v1` STT for `KAL` Steward) — EVOLVE Sponsor API (Commercial Terms)
  * `gold-api.com` (`/price/HG` COMEX Copper feed) & `Yahoo Finance` (`HG=F` fallback) — Public REST Market Data APIs
  * AI Coding Harnesses: `Claude Code`, `OpenAI Codex`, `Google Antigravity (Gemini)`, and `xAI Grok`

## License

MIT © 2026 Robert Paddock (`loop-smith`)
