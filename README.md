# ZeroSaaS P2P — Headless Copper Stock-to-Pay ERP (`zerosaas-p2p-app`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Built With: 8090 Software Factory](https://img.shields.io/badge/SDLC-8090%20Software%20Factory-1d4ed8)](#8090-software-factory-traceability-sf-wo-1--wo-14--commits--qualify-reviews)
[![Planner: 12/14 Work Orders Completed, WO-13 and WO-14 in review](https://img.shields.io/badge/Planner-12%2F14%20Completed%20%C2%B7%20WO--13%20%26%20WO--14%20in%20review-b45309)](./docs/software-factory-trace.md)
[![Headless SoRs: 4 MIT Databases](https://img.shields.io/badge/Systems%20of%20Record-4%20MIT%20Databases-0f766e)](#8090-software-factory-build-queue-wo-01--wo-06)

> **Most AI procurement demos hand an LLM a corporate credit card, a database password, and a prayer. Try showing that to a sitting CFO, Controller, or external SOX 404 auditor — you won't make it past the lobby.**

Project scaffold initialized live at the **EVOLVE: 8090 AI Hackathon** (`2026-11-13`) from upstream **BOSS** brownfield enterprise discovery for end-to-end build-out through **8090 Software Factory** (`Refinery` ➔ `Foundry` ➔ `Planner` ➔ `Validator`).

> Repository renamed from `8090-p2p-app` to **`zerosaas-p2p-app`** (`loop-smith/zerosaas-p2p-app`).

## 8090 Software Factory Build Queue (`WO-01` .. `WO-06`)

A self-contained, **`100%` MIT-licensed industrial P2P workflow application** on a single zero-scroll (`100vh`) white enterprise workbench (`SF WO-13`) for single-item stocked commodity replenishment (`PO-25800` · `8,000 FT` `2/0 AWG` ASTM B8 Bare Stranded Copper = `4 × 2,000-FT` GS1-barcoded wooden master reels `ENC-GS1-884192-R01..R04` / `3,288 lbs` net Cu):

- **`4` Real Headless Systems of Record (`100%` MIT in `/seeds`, Zero Toy Mocks):** `InvenTree` WMS (`115` tables, strictly `1` stocked copper item `ITM-CU-20-BARE`), `Django-CRM` (`150` tables), `Headless HRM` (`6` human signing limits + `$0.00` AI cap), and an `89`-account double-entry GAAP general ledger (`coa_seed.journal`, `hledger --strict` compatible with locked `$2.89/FT` FY2026 Annual Standard Cost = `$23,120.00` + `501900` Purchase Price Variance `PPV`).
- **`KAL` Zero-Authority Voice Steward (`$0.00` Signing Limit, `0` DB/GL/Bank Write Credentials):** Orchestrates deterministic workflow blocks and `<500ms` ElevenLabs `Turbo v2.5` voice briefings while enforcing **`HTTP 403 AI_STEWARD_ZERO_AUTHORITY`** on any unapproved commitment attempt and pausing strictly at **4 Human Checkpoints** (`Darius $20k` ➔ `VP Devon $100k` ➔ `Marcus 4-Reel GS1 Dock Scan` ➔ `CFO Meredith Check #10045`).
- **`3` Clean External/Sidecar Pipes — Zero API Maze:** (1) **ElevenLabs** (`Eleven Turbo v2.5` TTS + `Scribe` STT), (2) **Warm Local `RapidOCR` Sidecar** (`Apache-2.0` / `BSD-3` / `MIT-CMU` — mints `PO-25800`, Vendor OA `ENC-OA-2026-884192`, `BOL-25800`, `PS-25800`, `INV-25800` and extracts `28` pixel OCR boxes for `$0.00`-variance 3-Way Match), and (3) **Live COMEX Copper (`HG`) Spot Feed** (`gold-api.com` + `Yahoo Finance` fallback, locking `~$2.70/FT = ~$21,600.00` for `-$1,520.00` favorable `501900 PPV`).

## ZeroSaaS P2P White Enterprise Workbench (`SF WO-13`)

`npm start` serves the workbench at `http://127.0.0.1:3590`. It is one 1440×900 screen with no scrolling:

- **48px topbar:** `[P2P]` badge, the `ZeroSaaS P2P` brand and the stock-to-pay flow line, a live `GAAP DR == CR` pill, KAL voice mute, push-to-talk **Ask KAL**, a consent-gated WebM **Record** button and a confirmation-gated **Reset Queue** (`POST /api/reset`).
- **Left rail (236px):** **Start KAL · P2P Steward**, four views (`1. P2P Flow Desk` with a `Step N/8` tag, `2. DB & GL Registers`, `3. SOX & White House SI`, `4. Software Factory` with a `WO 1-14` tag), the `ITM-CU-20-BARE` stocked-item box, and drawers for **Guardrail Tests** and the **GL & Audit Register**.
- **Center stage:** the 8-step flow strip (`WMS Signal` ➔ `Supply Chain` ➔ `VP Approval` ➔ `Spot & PO` ➔ `Order Ack` ➔ `Dock Scan` ➔ `OCR & Match` ➔ `Cut Check`), the active step card with the 4-reel GS1 scanner, five probe triggers (`403` KAL `$0`, `403` Darius `>$20k`, `403` dock SoD, `409` invoice variance, `403` Petty `#4409`), the KAL `$0.00` steward banner, and a compact balance sheet and P&L.
- **Right rail (392px):** the live 6-account GAAP trial balance (`121100`, `201200`, `201100`, `501900`, `101100`, `101200`, DR == CR), the 6-document packet trail (Stock Signal, `PO-25800`, `OA-25800`, `BOL-25800`, `INV-25800`, Check `#10045`) and the RapidOCR 28-box invoice viewer.

Every number comes from `GET /api/state`. Every write goes through `POST /api/step/:n` or `POST /api/reset`, and every document through `GET /docs/:name`. The browser never approves, posts or pays.

## Interactive Parity (`SF WO-14`)

`SF WO-14` (`44cad6d1`) makes the four interactive parts of the workbench work end to end. It changed no server route or refusal code. The follow-up `T21` added the voice proxy routes described below:

- **KAL voice steward:** **Start KAL** starts a steward session. KAL briefs once, then narrates each server-confirmed step, dock reel and reset. Push-to-talk questions are mapped to read-only intents (status, dock, invoice, check, ledger, governance), and KAL may open the matching view or viewer. Any write verb (approve, sign, pay, wire, scan, reset …) gets KAL's `$0.00` answer and names the human officer the next step needs. The vendor's name is not a verb: "Tell me about Encore Wire" is a read-only check question, while "Wire the money" is refused. Voice never calls a write route.
- **Zero-secret voice proxy (`T21`):** the server proxies `POST /api/kal/speak` (`{"text"}` ➔ ElevenLabs `eleven_turbo_v2_5` audio) and `POST /api/kal/transcribe` (`audio/webm` ➔ ElevenLabs `scribe_v1` ➔ `{"text"}`). The ElevenLabs key is read from the server's runtime environment on every request. It is never stored in the repository or `public/`, and it never appears in a response or a log. Set it when you start the server: `ELEVENLABS_API_KEY` (required), and optionally `ELEVENLABS_VOICE_ID`, `ELEVENLABS_TTS_MODEL`, `ELEVENLABS_STT_MODEL` and `ELEVENLABS_BASE_URL`. With no key set, both routes answer `503 KAL_VOICE_UNCONFIGURED`, and the desk uses browser speech. Upstream failures answer `502 KAL_VOICE_UPSTREAM` without relaying the upstream body. Bad input is refused before any upstream call with `400 BAD_TEXT` (more than 1,500 characters, or empty), `400 NO_AUDIO` or `415 UNSUPPORTED_MEDIA_TYPE`. The voice routes never reach the kernel.
- **Dock RF scanner:** the reel buttons, the barcode field and keyboard-wedge bursts typed anywhere on screen all use one parser. It strips AIM symbology prefixes (`]C1`) and CR/LF/Tab/GS terminators. Unknown, duplicate or empty reads are refused locally with the server's own codes (`UNKNOWN_REEL`, `DUPLICATE_SCAN`, `NO_BARCODE`), so a bad read never becomes a write. A readout shows received feet and pounds of copper (`n × 2,000 FT`, `822 lbs` per reel) and the last read, and a short tone confirms or rejects each read (muted with KAL).
- **RapidOCR bounding-box viewer:** the 28+ server boxes are drawn over the invoice image. The five match fields (Vendor, PO #, Quantity FT, Unit price USD, Total due USD) are tagged in green and listed beside the image. Click a box or a field to read its text, confidence and pixel position. The tagger accepts the same label forms as the sidecar parser, including RapidOCR's dropped spaces (`TOTALDUEUSD:21600.00`).
- **CFO check view:** **View ↗** on the Check `#10045` packet opens the check face: payee, amount in figures and words, drawing account, memo, ACH trace (`ACH-000582`, printed once), signer, three-way match, funding policy and journal effect. It shows `DRAFT`, then `AWAITING CFO` after Step 7, then `PAID` once the server reports the payment. **Sign as CFO** is the same Step 8 server write as the step card (`EMP-0007`, `101100`).

## 8090 Software Factory Traceability (SF `WO-1` .. `WO-14` ⇄ Commits ⇄ Qualify Reviews)

The build ran in a live 2-way 8090 Software Factory loop. **12 / 14** Planner Work Orders are Completed, and Validator Theme `THM-1` is Resolved. `SF WO-13` (from Theme `THM-2`, commit `c5026200`) and `SF WO-14` (commit `44cad6d1`, polished by `T21`) are built and wait for their Qualify Reviews.

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
  - Feedback `FB-3` (product owner UX change order): `0ce52256-27a7-4167-b1ea-ea9628ad7a00`
  - Theme `THM-2` *ZeroSaaS P2P White Enterprise Workbench & Brand Change Order* (Urgent, open): `d3ab7474-57fa-40f0-9876-c0099c863806`
  - Foundry `REQ-01` extended with `REQ-P2P-012`..`REQ-P2P-020`; `BP-01` updated with `ADR-006` (48px topbar + 3-column white layout)
  - Planner `SF WO-13` *Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign* (`97cb2858-1488-4b34-829c-b0162ea65be3`): built (`c5026200`), awaiting Qualify Review
  - Planner `SF WO-14` *Implement ZeroSaaS P2P Interactive Parity (Voice Steward, Dock RF Scanner, RapidOCR BBox & CFO Check View)*: built by `HARA WO-14` (`44cad6d1`), awaiting Qualify Review. Only the title reached the build row; its UUID and source records were not delivered.

Each Planner Work Order maps to a build WO and then to a commit on `main`. An independent Qualify Review then checks each commit. A `FAIL` verdict returns to the Validator as a typed follow-up work order. Two of those findings were also filed in the Validator as `FB-1` and `FB-2` and grouped into Theme `THM-1`. The Planner then issued `SF WO-12`, which is now Completed.

The second round-trip was a product change. The first desk (`WO-04-A`) shipped dark and was named "Copper Command Desk". **That name came from us, not from Software Factory:** our own pre-written fallback work-order list for the Planner-to-build bridge titled `WO-04` that way, and the builder built what the title said. The product owner rejected both the look and the name. Instead of patching `public/` directly, the change was filed as `FB-3` ➔ `THM-2` ➔ `REQ-P2P-012`..`020` + `ADR-006`, and the Planner minted `SF WO-13`. `HARA WO-13` wrote the white ZeroSaaS P2P workbench fresh from that Work Order.

`WO-08` (`8721678d`) failed its Qualify Review on R10: the lineage contract still targeted `8090-p2p-app`. `T20` (`c1d69467`) closed R10 by updating `targetRepo` and regenerating the seed journal in the same fence.

The full forward and backward matrix, the Qualify Review ledger and the closed items are in **[`docs/software-factory-trace.md`](./docs/software-factory-trace.md)**.

| SF Planner WO | Build WO | Commit | Qualify Review |
| --- | --- | --- | --- |
| SF WO-1 Validate brownfield contracts · SF WO-2 Stocked-copper inventory | `HARA WO-01` | `3769d7e6` | ✅ PASS |
| SF WO-3 KAL zero-authority · SF WO-4 Darius/Devon gates · SF WO-5 Dock GS1 intake · SF WO-7 COMEX pricing · SF WO-8 `501900` PPV ledger · SF WO-9 Disbursement `#8801` vs `#4409` controls | `HARA WO-02` | `11e6a606` | ✅ PASS |
| SF WO-6 28-box 3-way reconciliation | `HARA WO-03-A` | `2ba3ae52` | ✅ PASS |
| UI Command Desk (cross-cutting) | `HARA WO-04-A` ➔ `WO-04-A.f1` | `1ad7f604` ➔ `9094b2bb` | ❌ FAIL (`FB-1`) ➔ ✅ PASS |
| SF WO-10 Audit recovery | `HARA WO-06` + `T19.f1` | `fca1c225`, `cae71057` | ✅ PASS |
| SF WO-11 PO-25800 E2E | `HARA WO-05` (`T19` ➔ `T19.f1`) | `11a63009` ➔ `cae71057` | ❌ FAIL (`null` sidecar reply) ➔ ✅ PASS |
| SF WO-12 Route contract & replay hardening (from `THM-1`) | `HARA WO-04-A.f1` + `WO-06` + `T19.f1` | `9094b2bb`, `fca1c225`, `cae71057` | ✅ PASS |
| Rename follow-up (`WO-08` R10) | `HARA WO-08` ➔ `T20` | `8721678d` ➔ `c1d69467` | ❌ FAIL (R10) ➔ ✅ R10 closed |
| SF WO-13 White Enterprise Workbench & brand (from `THM-2`) | `HARA WO-13` | `c5026200` | 🔄 Awaiting Qualify Review |
| SF WO-14 Interactive parity: voice steward, dock RF scanner, RapidOCR boxes, CFO check view | `HARA WO-14` + `T21` | `44cad6d1` + the `T21` commit | 🔄 Awaiting Qualify Review |

Run the full verification with `npm test`. It runs `tests/test-sidecar-reply.mjs` and then `tests/test-copper-e2e.mjs` (26 self-checks and 13 integrated red-team checks). The workbench client suite is `node --test public/command-desk.test.mjs`, and `python3 -m pytest seeds sidecar public -q` runs the seed, sidecar and workbench checks.

## Pre-Event Planning & Third-Party Tool / License Disclosure (EVOLVE Rules §10)

- **Pre-Event Planning Disclosure:** Per EVOLVE FAQ (*brainstorming, problem exploration, wireframing, and tech-stack setup permitted prior to kickoff*), upstream brownfield workflow discovery (`BOSS` export) and the static P2P target schema contract (`contracts/p2p-lineage-contract.json`) were prepared prior to kickoff; `100%` of application server code, UI, OCR sidecar, ledger bindings, voice steward, and test suites in this repository are built live during the event via **8090 Software Factory** (`WO-01`..`WO-14`). The `SF WO-13` workbench UI was written fresh from its Work Order; no pre-event UI file was copied.
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