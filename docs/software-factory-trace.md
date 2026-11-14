# 8090 Software Factory ⇄ Build Traceability Matrix (`zerosaas-p2p-app`)

This file traces each **8090 Software Factory Planner Work Order** (`SF WO-1` .. `SF WO-14`) both ways:

- **Forward:** from each SF Work Order to the build work order (`HARA WO-xx`) that implements it, then to the commit on `main`, then to its independent **Qualify Review** verdict.
- **Backward:** from each commit on `main` to the SF Work Orders it satisfies.

The SF Work Orders came out of the live 2-way **Refinery ➔ Foundry ➔ Planner ➔ Validator** loop. Validator feedback went back into the build queue as follow-up work orders. It also went back into the Software Factory twice:

- Feedback `FB-1` and `FB-2` ➔ Theme `THM-1` ➔ Planner Work Order `SF WO-12` (route contract and replay hardening).
- Feedback `FB-3` ➔ Theme `THM-2` ➔ Foundry `REQ-P2P-012`..`REQ-P2P-020` and `BP-01` `ADR-006` ➔ Planner Work Order `SF WO-13` (white enterprise workbench and brand).

The Planner then issued `SF WO-14` (interactive parity for the workbench: voice steward, dock RF scanner, RapidOCR bounding boxes and the CFO check view). Only its title reached the build row. Its UUID and its source feedback, theme or requirement records were not delivered to the build seat, so this file does not name them.

- **Snapshot (UTC):** `2026-11-14T06:35Z`
- **Repository:** `loop-smith/zerosaas-p2p-app`, formerly `8090-p2p-app`
- **Planner status:** **12 / 14** Work Orders Completed. `SF WO-13` is built by `HARA WO-13` (`c5026200`) and `SF WO-14` by `HARA WO-14` (`44cad6d1`, polished by `HARA T21`); both wait for their Qualify Reviews. Theme `THM-1` Resolved; Theme `THM-2` stays open until `SF WO-13` passes.

## 1. Live 8090 Software Factory Anchors

| Software Factory Entity | Name | UUID |
| --- | --- | --- |
| Organization | Robert Paddock — EVOLVE Hackathon | `ab209dd1-ce3e-4eda-9839-f5982b4b1c22` |
| Project | ZeroSaaS P2P | `9e2da614-7738-46a6-9152-69c4ec850ed5` |
| Refinery Knowledge Base | `KB-00` | `2fb45197-ecd8-463e-b72b-db79275329e3` |
| Foundry Requirement | `REQ-01` | `1fc08c46-ed36-4a14-99a3-0eae8de04206` |
| Foundry Architecture Blueprint | `BP-01` | `61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d` |
| Foundry Feature Blueprint | Feature Blueprint | `bf2a43c7-eea6-4ea6-839a-6d83ae12b8a8` |
| Foundry Agent Session | Agent Session | `6efbe532-dc88-467d-89fd-db361b5d1f75` |
| Validator Feedback | `FB-1` — Command Desk UI/server route mismatch | `f817adb9-0be8-49fe-9cfe-9eaa599b9f2e` |
| Validator Feedback | `FB-2` — SOX 404 red-team replay, GS1 reel, KAL spoof and 28-box `409` regression checks | `804e1202-8162-4fca-9f6f-55d051f7b8df` |
| Validator Theme | `THM-1` — ZeroSaaS P2P Route Contract & SOX 404 Adverse Replay Hardening (Resolved) | `2c9639f9-302f-4fa9-801d-8fcc162b2920` |
| Validator Feedback | `FB-3` — Product owner UX change order: replace the dark desk with the white ZeroSaaS P2P workbench | `0ce52256-27a7-4167-b1ea-ea9628ad7a00` |
| Validator Theme | `THM-2` — ZeroSaaS P2P White Enterprise Workbench & Brand Change Order (Urgent; open) | `d3ab7474-57fa-40f0-9876-c0099c863806` |
| Foundry Requirement extension | `REQ-P2P-012`..`REQ-P2P-020` under `REQ-01` | `REQ-01` above |
| Foundry Architecture Decision | `ADR-006` in `BP-01` — 48px topbar + 3-column white layout | `BP-01` above |
| Planner Work Order | `SF WO-13` — Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign | `97cb2858-1488-4b34-829c-b0162ea65be3` |
| Planner Work Order | `SF WO-14` — Implement ZeroSaaS P2P Interactive Parity (Voice Steward, Dock RF Scanner, RapidOCR BBox & CFO Check View) | Not delivered with the build row |

> **REQ-01 identifier note:** the local per-WO indexes `.sw-factory/WO-01..WO-06/context.md` still list `c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc` as `REQ-01`. That value was recorded when the WO execution plans were staged (commit `5baba895`). This matrix uses the current Foundry `REQ-01` identifier above.

## 2. The 2-Way Loop

```text
 Refinery KB-00 ──► Foundry REQ-01 ──► BP-01 Architecture + Feature Blueprint ──► Planner SF WO-1..WO-14
       ▲                                                                                  │
       │                                                                                  ▼
 Validator FB-1 / FB-2 / FB-3 ◄── Qualify Review (PASS / FAIL) ◄── commit on main ◄── HARA WO-xx build (.sw-factory/WO-xx)
       │
       ├──► follow-up work order (WO-04-A.f1, T19.f1) ──► back into the build queue
       ├──► Theme THM-1 ──► Planner SF WO-12 ──► Completed; THM-1 Resolved
       └──► FB-3 ──► Theme THM-2 ──► REQ-P2P-012..020 + BP-01 ADR-006 ──► Planner SF WO-13 ──► HARA WO-13 (awaiting Qualify Review)
                                                                          Planner SF WO-14 ──► HARA WO-14 (44cad6d1) + T21 (awaiting Qualify Review)
```

- **Forward direction (plan to code):**
  - Each Planner Work Order is assigned to a HARA build work order.
  - Each HARA WO executes against its `.sw-factory/WO-xx/` plan, checklist and review log, then lands on `main` as a single fast-forward commit.
- **Backward direction (code to plan):**
  - After a commit lands, an independent Qualify Review re-runs the evidence against the commit's intent and records a verdict of `PASS` or `FAIL`.
  - A `FAIL` verdict produces a typed follow-up work order. The follow-up records the failing command, the expected behavior and a fix direction.
  - The same findings were filed in the Validator as `FB-1` and `FB-2`. Both were grouped into Theme `THM-1`, linked to `REQ-01` and `BP-01`. The Planner issued `SF WO-12` from `THM-1`.

## 3. Forward Matrix — SF Planner WO ➔ HARA WO ➔ Commit ➔ Qualify Review (14 rows)

| SF WO | Planner Work Order | HARA WO | Commit on `main` | Qualify Review | Status |
| --- | --- | --- | --- | --- | --- |
| **SF WO-1** | Validate brownfield contracts (`contracts/p2p-lineage-contract.json` semantic bindings) | `HARA WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-2** | Stocked-copper inventory (`ITM-CU-20-BARE`, InvenTree WMS / HRM / CRM / 89-account COA seeds) | `HARA WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-3** | KAL zero-authority steward (`403 AI_STEWARD_ZERO_AUTHORITY`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-4** | Darius / Devon DOA approval gates (`403 DOA_LIMIT_EXCEEDED`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-5** | Dock GS1 intake (`ENC-GS1-884192-R01..R04`, `403 SOX_SOD_VIOLATION`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-6** | 28-box 3-way reconciliation (PO = BOL = INV, `409 MATCH_VARIANCE_HOLD`) | `HARA WO-03-A`, wired into the kernel by `HARA WO-05` (`T19` ➔ `T19.f1`) | `2ba3ae52`, `cae71057` | `WO-03-A.q2`: **PASS**; `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-7** | COMEX copper (`HG`) spot pricing (gold-api.com ➔ Yahoo `HG=F` ➔ offline) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-8** | `501900` Purchase Price Variance ledger (balanced 3-leg GAAP journal) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-9** | Disbursement controls: Operating `101100` #8801 vs Payroll/Petty `101200` #4409 (`403 BANK_POLICY_VIOLATION`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-10** | Audit recovery (red-team replay / tamper / spoof regression, `.sw-factory` certification) | `HARA WO-06` + `HARA T19.f1` | `fca1c225`, `cae71057` | `WO-06.q`: **PASS**; `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-11** | PO-25800 end-to-end (`tests/test-copper-e2e.mjs`, ≥16 live assertions) | `HARA WO-05` (`T19` ➔ `T19.f1`) | `11a63009` ➔ `cae71057` | `T19.q2`: **FAIL** (`null` `/generate` sidecar reply) ➔ `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-12** | Harden live `/api/step/:n` route contracts and adversarial replay guards (Urgent, Fix; from `THM-1`) | `HARA WO-04-A.f1` + `HARA WO-06` + `HARA T19.f1` | `9094b2bb`, `fca1c225`, `cae71057` | `WO-04-A.f1.q`: **PASS**; `WO-06.q`: **PASS**; `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-13** | Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign (Urgent; from `THM-2`; `REQ-P2P-012`..`020`, `BP-01` `ADR-006`) | `HARA WO-13` | `c5026200` | `WO-13.q`: not yet run | 🔄 Built; awaiting Qualify Review |
| **SF WO-14** | Implement ZeroSaaS P2P Interactive Parity (Voice Steward, Dock RF Scanner, RapidOCR BBox & CFO Check View) | `HARA WO-14` | `44cad6d1` | `WO-14.q`: not yet run | 🔄 Built; awaiting Qualify Review |

### Cross-cutting: UI Command Desk and the Validator Feedback Loop

| Deliverable | HARA WO | Commit on `main` | Qualify Review | Validator Feedback |
| --- | --- | --- | --- | --- |
| One-Screen (`100vh`) Copper Command Desk + KAL voice + WebM recorder (`public/`) | `HARA WO-04-A` | `1ad7f604` | `WO-04-A.q`: **FAIL** | ↩ `WO-04-A.f1`; filed as `FB-1` |
| Command Desk bound to the real kernel contract | `HARA WO-04-A.f1` | `9094b2bb` | `WO-04-A.f1.q`: **PASS** | ✅ Closed under `SF WO-12` |

The `WO-04-A` desk passed its own in-fence review (`.sw-factory/WO-04/review-log.md`, Round 3: client APPROVED). Its Qualify Review then ran the landed `public/app.js` against the real `WO-02` server and returned **FAIL**. The client used a self-authored transport contract:

- `validateState()` rejected the kernel's real `GET /api/state` snapshot.
- Step and probe writes went to `POST /api/step` instead of `/api/step/:n`.

The FAIL produced follow-up work order `WO-04-A.f1`, fenced to `public/` and the WO-04 execution docs. It landed as `9094b2bb`:

- `validateState` accepts the real kernel snapshot.
- Step POSTs reach `/api/step/:n` and return `200` or a typed refusal.

`WO-04-A.f1.q` returned **PASS**.

The same path repeated for the integration. `T19` (`11a63009`) wired the RapidOCR sidecar into the kernel. `T19.q2` returned **FAIL**: a sidecar `/generate` reply of JSON `null` made Step 5 answer `500 INTERNAL_ERROR`, and the refusal was not audited. Follow-up `T19.f1` (`cae71057`) refuses any non-object sidecar reply with an audited `503 OCR_UNAVAILABLE`. It also added `tests/test-sidecar-reply.mjs`. `T19.f1.q` returned **PASS**.

This is the backward half of the loop. Each Validator finding became a tracked work order, not a silent patch.

### Validator Round-Trip: FB-1 / FB-2 ➔ THM-1 ➔ SF WO-12

| Record | Content | Closed by | Status |
| --- | --- | --- | --- |
| `FB-1` (`f817adb9`) | Command Desk called routes the server does not serve (`POST /api/step`) and rejected the real `/api/state` snapshot | `9094b2bb` (`WO-04-A.f1`) | ✅ Closed |
| `FB-2` (`804e1202`) | SOX 404 red-team regressions: Check #10045 replay, GS1 reel quantity, KAL spoofing, 28-box `409 MATCH_VARIANCE_HOLD` | `fca1c225` (`WO-06`), `cae71057` (`T19.f1`) | ✅ Closed |
| `THM-1` (`2c9639f9`) | ZeroSaaS P2P Route Contract & SOX 404 Adverse Replay Hardening; linked to `REQ-01` and `BP-01` | `SF WO-12` | ✅ Resolved |
| `SF WO-12` | Harden live `/api/step/:n` route contracts and adversarial replay guards (Urgent, Fix) | `9094b2bb`, `fca1c225`, `cae71057` | ✅ Completed |

Evidence for `SF WO-12` is in [`.sw-factory/WO-12/`](../.sw-factory/WO-12/).

### Validator Round-Trip 2: FB-3 ➔ THM-2 ➔ SF WO-13 (White Enterprise Workbench & Brand)

| Record | Content | Closed by | Status |
| --- | --- | --- | --- |
| `FB-3` (`0ce52256`) | The product owner rejected the dark `public/` desk from `WO-04-A`, on its look and on its name. The app is ZeroSaaS P2P, a headless procure-to-pay ERP, not a copper desk. | `HARA WO-13` | 🔄 Built; awaiting Qualify Review |
| `THM-2` (`d3ab7474`) | ZeroSaaS P2P White Enterprise Workbench & Brand Change Order (Urgent). Groups `FB-3`. | `SF WO-13` | Open |
| `REQ-P2P-012`..`020` | Foundry extension of `REQ-01`: light palette, `ZeroSaaS P2P` brand, 48px topbar, left rail with 4 views, 8-step flow strip, live trial balance, 6-document packet trail, consent-gated recorder, confirmation-gated reset | `HARA WO-13` | Built |
| `BP-01` `ADR-006` | 100vh shell: 48px white topbar + `236px \| minmax(0, 1fr) \| 392px` grid at the 1440×900 boundary | `HARA WO-13` | Built |
| `SF WO-13` (`97cb2858`) | Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign | `HARA WO-13` | In Progress ➔ awaiting `WO-13.q` |

**Root cause of the "Copper Command Desk" name.** Software Factory did not name the desk. Before kickoff we wrote a local fallback work-order list for the bridge that turns Planner Work Orders into build rows (`sf_wo_bridge.py --from-fallback`). Its `WO-04` entry was titled *Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk*. The `WO-04` row was lit from that fallback title, and the builder built what the title said, including the dark look. Both Qualify Reviews of that row (`WO-04-A.q` FAIL, `WO-04-A.f1.q` PASS) checked the client/server contract, not the brand. The fix went back through the Software Factory instead of being patched directly: `FB-3` ➔ `THM-2` ➔ `REQ-P2P-012`..`020` + `ADR-006` ➔ `SF WO-13`.

**What `HARA WO-13` changed.** `public/index.html`, `public/styles.css` and the DOM layer of `public/app.js` were written fresh from the `SF WO-13` specification. No pre-event UI file was copied. The exported client API is unchanged (`validateState`, `REELS`, `REFUSALS`, `safeDocumentUrl`, `request`, `refresh`, `runStep`, `render`, `speak`, `startRecording`, `stopRecording`), and `trialBalance` was added for the right-rail trial balance. The client still reads only `GET /api/state` and `GET /docs/:name`, and still writes only `POST /api/step/:n` and `POST /api/reset`. Server, kernel, routes and refusal codes are unchanged. `tests/test-copper-e2e.mjs` changes one assertion: it now matches the new page title instead of the old one. Evidence is in [`.sw-factory/WO-13/`](../.sw-factory/WO-13/).

**What `HARA WO-14` changed.** `SF WO-14` made the four interactive parts of the `c5026200` workbench work end to end, in `public/` only:

- The KAL voice steward maps speech to read-only intents and narrates server-confirmed progress. Write verbs get its `$0.00` answer and never reach a route.
- The dock RF scanner parses keyboard-wedge reads (AIM prefix, CR/LF/Tab/GS terminators). It refuses unknown, duplicate and empty reads locally with the server's codes, and shows received feet and pounds of copper.
- The RapidOCR viewer tags the five three-way-match fields on the server boxes, using the sidecar parser's label rules, and reads out each box's text, confidence and pixel position.
- The CFO check view shows Check `#10045` from `GET /api/state`, with its amount in words. Signing it is the existing Step 8 write.

New exports: `stewardIntent`, `stewardReply`, `parseReelScan`, `tagOcrFields`, `checkWords`. The client still reads only `GET /api/state` and `GET /docs/:name`, and still writes only `POST /api/step/:n` and `POST /api/reset`. Server, kernel, routes and refusal codes are unchanged. `tests/test-copper-e2e.mjs` gains one assertion: the five fields are tagged on real RapidOCR boxes from the sidecar. Evidence is in [`.sw-factory/WO-14/`](../.sw-factory/WO-14/).

**What `HARA T21` changed on top of `44cad6d1`.** Two WO-14 follow-up findings, and the voice proxy the desk already called:

- **Encore Wire intent.** The refuse pattern treated "wire" in the vendor's name as the write verb, so "Tell me about Encore Wire" got KAL's `$0.00` refusal. "Wire" is still refused as a verb ("Wire the money to Encore Wire"). "Encore Wire" or "payee" alone now maps to the read-only `check` intent.
- **ACH prefix.** The kernel's trace already reads `ACH-000582`, and the check face printed `ACH ACH-000582`. The new pure export `achLabel` adds the `ACH` prefix only to a bare trace.
- **Zero-secret voice proxy.** `src/sor_3panel_server.mjs` now serves `POST /api/kal/speak` (`{"text"}` ➔ ElevenLabs `eleven_turbo_v2_5` audio) and `POST /api/kal/transcribe` (`audio/webm` ➔ ElevenLabs `scribe_v1` ➔ `{"text"}`). The key is read from the server's runtime env (`ELEVENLABS_API_KEY`) on each request. No key is in the repository or `public/`, and no response or log echoes it. With the key unset, both routes answer `503 KAL_VOICE_UNCONFIGURED` and the desk falls back to browser speech. New refusal codes: `400 BAD_TEXT`, `400 NO_AUDIO`, `502 KAL_VOICE_UPSTREAM`, `503 KAL_VOICE_UNCONFIGURED`. The voice routes never reach the kernel, and KAL's steward identity is still refused on them. The kernel, the step and reset routes, and their refusal codes are unchanged.

`tests/test-copper-e2e.mjs` gains a 13th red-team check. It drives the proxy against a loopback stand-in for `api.elevenlabs.io` and checks that the key is forwarded only as `xi-api-key`, that upstream bodies are never relayed, that bad input is refused before any upstream call, and that the journal and audit chain do not change.

## 4. Backward Matrix — Commit ➔ SF Planner WOs

| Commit | Subject | HARA WO | SF WOs satisfied | Qualify Review verdict (summary) |
| --- | --- | --- | --- | --- |
| `2105fdcc` | initialize scaffold and P2P domain contract | — | Pre-event contract (input to SF WO-1) | n/a (scaffold) |
| `5baba895` | stage WO-01..WO-06 execution plans and checklists | — | Planner ➔ `.sw-factory/WO-01..WO-06` | n/a (plans) |
| `3769d7e6` | Bootstrap 4 MIT Headless SoR Seeds in `seeds/` | `WO-01` | SF WO-1, SF WO-2 | **PASS**: all four seeds satisfy the bootstrap intent. 23 tests, drift checks, SQLite integrity checks and semantic-binding checks pass. No baseline regression. |
| `2ba3ae52` | Build Warm RapidOCR 5-PDF Sidecar (`:3591`) | `WO-03-A` | SF WO-6 | **PASS**: self-contained `sidecar/`. Builds the 5 contract-named PDFs with one warm RapidOCR instance and exact `Decimal` matching. Payment checks are proposals only (`posted=False`). `pytest sidecar` gives 39 passed. |
| `11e6a606` | Implement Core P2P State Kernel | `WO-02` | SF WO-3, 4, 5, 7, 8, 9 | **PASS**: Steps 1–8, live COMEX, guardrails and balanced `501900` PPV verified. 26 self-checks and 62 existing tests pass. No base regression. |
| `1ad7f604` | Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk | `WO-04-A` | UI Command Desk (cross-cutting) | **FAIL**: client/server contract mismatch against the `WO-02` server. Follow-up `WO-04-A.f1` opened; filed as `FB-1`. |
| `6943f1a6` | Publish Full 8090 Software Factory Bidirectional Traceability Matrix | `WO-07` | Traceability (this file, 11-row edition) | n/a (documentation) |
| `fca1c225` | Red-Team Adversarial Audit, Feedback ➔ Themes Triage & Final `.sw-factory` Certification | `WO-06` | SF WO-10, SF WO-12 (`FB-2`) | **PASS**: SQL/parameter tamper, Check #10045 replay, negative reel quantity, KAL header spoof and unbalanced journal injection regressions run against the live server. |
| `9094b2bb` | FIX qualify-finding on `WO-04-A` | `WO-04-A.f1` | UI Command Desk, SF WO-12 (`FB-1`) | **PASS**: `validateState` accepts the real snapshot; step writes use `/api/step/:n`. |
| `11a63009` | Integrate `src/` (`:3590`) + `sidecar/` (`:3591`) + `public/` + `seeds/`; wire the end-to-end suite | `WO-05` (`T19`) | SF WO-6 (kernel wiring), SF WO-11 | **FAIL** (`T19.q2`): a `null` sidecar `/generate` reply gave `500 INTERNAL_ERROR`. Follow-up `T19.f1` opened. |
| `cae71057` | FIX qualify-finding on `T19` | `T19.f1` | SF WO-10, SF WO-11, SF WO-12 (`FB-2`) | **PASS**: non-object sidecar replies are an audited `503 OCR_UNAVAILABLE`; `npm test` runs `tests/test-sidecar-reply.mjs` and `tests/test-copper-e2e.mjs`. |
| `8721678d` | Finalize 12/12 Software Factory Traceability | `WO-08` | SF WO-12 evidence (`.sw-factory/WO-12/`), rename metadata | **FAIL** (`WO-08.q`): acceptance R10 unmet; `contracts/p2p-lineage-contract.json` still targeted `8090-p2p-app`. Regression checks passed. |
| `6db3195f` | FIX `tests_failed` on `WO-08.f1` | `WO-08.f2` | — (kept R10 open rather than land red) | n/a (documentation). `WO-08.f1` was refused `tests_failed` and never landed. |
| `c1d69467` | Update `contracts/p2p-lineage-contract.json` (`targetRepo`) and regenerate `seeds/coa_seed.journal` | `T20` | Closes `WO-08` R10 | Seeds drift check and 23 seed tests green at landing (`.sw-factory/WO-12/review-log.md` Round 3). |
| `c5026200` | White Enterprise Workbench & Brand Redesign (`public/`) | `WO-13` | SF WO-13 (`FB-3`, `THM-2`) | Not yet qualified. In-fence review APPROVED (`.sw-factory/WO-13/review-log.md`). |
| `44cad6d1` | Interactive parity: voice steward, dock RF scanner, RapidOCR boxes, CFO check view (`public/`) | `WO-14` | SF WO-14 | Not yet qualified. In-fence review in `.sw-factory/WO-14/review-log.md`. |
| the `HARA T21` commit | WO-14 follow-ups (Encore Wire intent, ACH prefix) + zero-secret `/api/kal/speak` and `/api/kal/transcribe` proxy | `T21` | SF WO-14 | Not yet qualified. |

Every listed build commit is a fast-forward on `main`. Each landed with its fenced test commands green before qualification.

## 5. Qualify Review Ledger

| Qualify Review | Target commit | Base | Verdict | Lines deleted | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `WO-01.q` | `3769d7e6` | `5baba895` | **PASS** | 0 | Duty-flag constraint defect logged as separate follow-up work |
| `WO-02.q` | `11e6a606` | `2ba3ae52` | **PASS** | 0 | — |
| `WO-03-A.q` | `2ba3ae52` | `3769d7e6` | Refused (invalid review slot) ➔ requalified | — | Re-run as `WO-03-A.q2` |
| `WO-03-A.q2` | `2ba3ae52` | `3769d7e6` | **PASS** | 0 | Deeply nested JSON body drops the connection instead of returning `400` |
| `WO-04-A.q` | `1ad7f604` | `11e6a606` | **FAIL** | 0 | `WO-04-A.f1`: align `public/app.js` with the real `/api/state` and `/api/step/:n` contract (`FB-1`) |
| `WO-06.q` | `fca1c225` | `6943f1a6` | **PASS** | — | — |
| `WO-04-A.f1.q` | `9094b2bb` | `fca1c225` | **PASS** | — | — (closes `WO-04-A.q` FAIL) |
| `T19.q` | `11a63009` | `9094b2bb` | Not run (review slot unlaunched) ➔ re-routed | — | Re-run as `T19.q2` |
| `T19.q2` | `11a63009` | `9094b2bb` | **FAIL** | — | `T19.f1`: refuse a non-object sidecar reply with an audited `503 OCR_UNAVAILABLE` |
| `T19.f1.q` | `cae71057` | `11a63009` | **PASS** | — | — (closes `T19.q2` FAIL) |
| `WO-08.q` | `8721678d` | `cae71057` | **FAIL** | — | R10 (`targetRepo`): `WO-08.f1` refused `tests_failed` (stale journal digest) ➔ `WO-08.f2` (`6db3195f`) ➔ `T20` (`c1d69467`) closes R10 |
| `WO-13.q` | `c5026200` | `c1d69467` | Not yet run | — | — |
| `WO-14.q` | `44cad6d1` | `c5026200` | Not yet run | — | — |

`—` in *Lines deleted* means the review did not record a count.

## 6. Per-WO Evidence Index (`.sw-factory/`)

| HARA WO | Plan / checklist / review log | In-fence review verdict | Status |
| --- | --- | --- | --- |
| `WO-01` | `.sw-factory/WO-01/` | APPROVED (Round 1, 0 blocking; 8 advisories fixed; 23 passed; Round 2 certification) | ✅ Closed |
| `WO-02` | `.sw-factory/WO-02/` | APPROVED (Round 1, 0 blocking; 14 advisories, 8 fixed; selfcheck 26/26; Round 2 certification) | ✅ Closed |
| `WO-03-A` | `.sw-factory/WO-03/` | APPROVED (Round 3, fenced sidecar scope; 39 passed; Round 4 certification) | ✅ Closed |
| `WO-04-A` / `WO-04-A.f1` | `.sw-factory/WO-04/` | APPROVED (Round 5, independent `WO-04-A.f1` API and UI review against the real kernel) | ✅ Closed |
| `WO-05` (`T19` / `T19.f1`) | `.sw-factory/WO-05/` | APPROVED (Round 2 integration; Round 3 `T19.f1` sidecar-reply fix) | ✅ Closed |
| `WO-06` | `.sw-factory/WO-06/` | APPROVED (Round 1, red-team audit + `.sw-factory` certification) | ✅ Closed |
| `SF WO-12` | `.sw-factory/WO-12/` | APPROVED (Round 1, round-trip evidence for `FB-1`, `FB-2`, `THM-1`; Rounds 2–3 `T20`) | ✅ Closed |
| `SF WO-13` | `.sw-factory/WO-13/` | APPROVED (Round 1, in-fence review of the white workbench against `REQ-P2P-012`..`020`) | 🔄 Awaiting Qualify Review |
| `SF WO-14` | `.sw-factory/WO-14/` | APPROVED (Round 1, in-fence review of the four interactive parts against the Work Order title) | 🔄 Awaiting Qualify Review |

## 7. Items Carried by the Previous Edition

| # | Item | Resolution | Status |
| --- | --- | --- | --- |
| 1 | `WO-04-A.f1`: connect the Command Desk to the real kernel contract | `9094b2bb`, `WO-04-A.f1.q` **PASS** | ✅ Resolved |
| 2 | `WO-05`: integrate `src/`, `sidecar/`, `public/` and `seeds/`; `npm test` runs the end-to-end suite (closes SF WO-11) | `11a63009` ➔ `cae71057`, `T19.f1.q` **PASS**. `npm test` runs `tests/test-sidecar-reply.mjs` then `tests/test-copper-e2e.mjs` | ✅ Resolved |
| 3 | `WO-06`: red-team replay, tamper, spoof and negative-quantity regressions; final `.sw-factory` certification (closes SF WO-10) | `fca1c225`, `WO-06.q` **PASS** | ✅ Resolved |
| 4 | Server-side OCR sourcing for Step 7 | `11a63009` + `cae71057`: with `OCR_URL` set, Step 7 reads `INV-25800.pdf` through the RapidOCR sidecar and holds a forged invoice at `409 MATCH_VARIANCE_HOLD` | ✅ Resolved |
| 5 | Repository rename to `zerosaas-p2p-app` | `README.md`, this file, `package.json` `name`, and the kernel's COMEX `user-agent` and `/api/health` `service` strings now say `zerosaas-p2p-app` | ✅ Resolved |
| 6 | `WO-08` R10: lineage contract `targetRepo` still said `8090-p2p-app` | `T20` (`c1d69467`) edited `targetRepo` and regenerated `seeds/coa_seed.journal` in one fence | ✅ Resolved |
| 7 | Dark "Copper Command Desk" name and look rejected by the product owner (`FB-3`) | `SF WO-13` ➔ `HARA WO-13` white ZeroSaaS P2P workbench; root cause in Section 3 | 🔄 Awaiting `WO-13.q` |

**Rename follow-up — resolved by `T20` (`c1d69467`), closing `WO-08` R10.** `contracts/p2p-lineage-contract.json` `provenance.targetRepo` now points to `https://github.com/loop-smith/zerosaas-p2p-app`. The journal was regenerated with the existing seed builder; its whole-contract `canonical-sha256` is now `57311e23ada34f45a8db4cbc71e1f3032f61b2c122b545edb531f2193410a5ac`. All 89 account declarations are unchanged.

The earlier contract-only attempt (`WO-08.f1`) was refused `tests_failed` because the journal digest was stale. T20 updates both fenced files together. Use `python3 seeds/build_seeds.py --check` and `python3 -m pytest seeds -q -p no:cacheprovider` to verify drift and seed integrity.
