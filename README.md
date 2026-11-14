# ZeroSaaS P2P

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/Built%20With-8090%20Software%20Factory-1d4ed8)](./docs/software-factory-trace.md)
[![Headless SoRs: 275 SQLite Tables + 89 GAAP Accounts](https://img.shields.io/badge/Headless%20SoRs-275%20Tables%20%C2%B7%2089%20GAAP%20Accts-0f766e)](#what-runs-under-the-hood-no-mocks)

> **8090 was founded on a blunt bet: enterprises don't need 1,000 bloated SaaS screens — they need the workflow that actually runs the business, for 90% less.**
>
> **We pushed that bet to its logical conclusion: `ZeroSaaS`.**

Most "AI procurement" demos hand an LLM a corporate credit card, a database password, and a prayer. Show that to a sitting CFO, Controller, or SOX 404 auditor and you won't make it past the lobby.

Enterprise buyers are stuck between two bad deals: paying millions in per-seat **SaaS rent** for forms sitting over ordinary SQL tables, or trusting **probabilistic agents** with live financial authority.

**ZeroSaaS P2P shows the third path** — built in under 20 hours at **EVOLVE: 8090 AI Hackathon** with **100% agent-written application code** directed by one human enterprise operator inside **[8090 Software Factory](./docs/software-factory-trace.md)**:

1. **$0 Per-Seat SaaS Rent (`ZeroSaaS`):** Four real, MIT-licensed open-source Systems of Record run headless underneath (`275` SQLite tables across WMS, CRM & HRM + an `89`-account `hledger` double-entry General Ledger) behind one zero-scroll operator workbench forged to the exact copper stock-to-pay workflow.
2. **95% AI Legwork, $0.00 AI Authority (`KYSI` in Code, Not Prompts):** **KAL**, our streaming voice and `RapidOCR` vision steward, catches the copper stock-out, locks live COMEX spot pricing, guides a 4-reel barcode dock scan, and runs a 28-box invoice 3-way match — while SQLite `CHECK` constraints and `HTTP 403` gates lock her signing limit to **`$0.00`**. Probabilistic AI prepares; named human officers and strict `DR == CR` math commit every dollar.

---

## One Real Purchase-to-Pay Run (`PO-25800` · `8,000 FT` 2/0 Bare Copper)

1. **Stock-Out & Live Copper Spot Lock:** Headless `InvenTree` WMS hits `0 FT` (`< 8,000 FT` min) on `2/0 AWG` ASTM B8 Bare Stranded Copper (`4 × 2,000-FT` reels / `3,288 lbs` net Cu). Live COMEX Copper (`HG`) spot prices the Encore Wire order (`~$21,600` actual vs `$23,120` FY26 standard cost, locking `+$1,520` favorable Purchase Price Variance in `501900`).
2. **Human Signing-Limit Escalation:** Buyer Darius (`$20,000` limit) is blocked (`403 DOA_LIMIT_EXCEEDED`); VP Operations Devon (`$100,000` limit) countersigns `PO-25800`.
3. **Physical Dock Receipt (Segregation of Duties):** Warehouse Lead Marcus scans all `4` GS1-barcoded master reels (`0 -> 8,000 FT`). Purchasing officers are blocked from receiving (`403 SOX_SOD_VIOLATION`); receipt posts `DR Inventory / CR 201200 GRNI`.
4. **28-Box RapidOCR 3-Way Match & Check `#10045`:** Local `RapidOCR` scans raster `INV-25800.pdf` (`28` pixel bounding boxes) against `PO-25800` and the dock receipt (`$0.00` variance). CFO Meredith signs Check `#10045` (`ACH-000582`) out of Operating Cash `#8801` while Payroll `#4409` (`$140,000`) stays ring-fenced.

---

## What Runs Under the Hood (No Mocks)

* **4 MIT Headless Systems of Record (`/seeds`):**
  * **WMS:** `InvenTree` schema (`seeds/wms_seed.sqlite3` — `119` tables)
  * **CRM:** `Django-CRM` schema (`seeds/crm_seed.sqlite3` — `151` tables)
  * **HRM:** Officer DOA signing limits, SoD roles & `$0.00` AI cap (`seeds/hrm_seed.sqlite3` — `5` tables)
  * **GL:** `89`-account plaintext double-entry journal (`seeds/coa_seed.journal`, `hledger --strict` verified)
* **Warm Local `RapidOCR` Vision Sidecar (`:3591`):** Mints the 5-PDF trade packet (`PO`, `OA`, `BOL`, `PS`, `INV`) and extracts real pixel coordinates via ONNX runtime.
* **Zero-Secret Voice Pipe:** ElevenLabs streaming TTS + `scribe_v1` STT for `KAL` (automatic browser Web Speech fallback when `ELEVENLABS_API_KEY` is unset).
* **6 Live Red-Team Guardrails in the Glass:** Trigger adversarial probes (`KAL $0 override`, `DOA breach`, `buyer self-receipt SoD`, `invoice price spike`, `payroll #4409 raid`, `duplicate replay`) straight from the left rail and watch deterministic `403`/`409` gates hold.

---

## Run It in 30 Seconds

```bash
pip install -r sidecar/requirements.txt
python3 sidecar/invoice_ocr_engine.py --port 3591 serve &
PORT=3590 OCR_URL=http://127.0.0.1:3591 npm start
# Open http://127.0.0.1:3590
```

## Verification Suite

```bash
npm test
node --test public/command-desk.test.mjs
pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py
python3 seeds/build_seeds.py --check
```

## Built End-to-End in 8090 Software Factory

Shipped across **4 closed-loop Validator rounds** (`Refinery KB-00` -> `Foundry REQ-01 & BP-01` -> `Planner WO-1..WO-18` -> `Validator FB-1..FB-5 & THM-1..THM-4`). Full forward/backward commit and review traceability lives in **[`docs/software-factory-trace.md`](./docs/software-factory-trace.md)** and **[`.sw-factory/`](./.sw-factory/)**.

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
