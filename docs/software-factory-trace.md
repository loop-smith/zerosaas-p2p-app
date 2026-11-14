# 8090 Software Factory ⇄ Build Traceability Matrix (`zerosaas-p2p-app`)

This file traces each **8090 Software Factory Planner Work Order** (`SF WO-1` .. `SF WO-18`) both ways:

- **Forward:** from each SF Work Order to the build unit (`WO-xx`) that implements it, then to the commit, then to its independent **Qualify Review** verdict.
- **Backward:** from each commit to the SF Work Orders and Validator feedback themes (`THM-1` .. `THM-4`) it satisfies.

The SF Work Orders operate in a live 2-way **Refinery ➔ Foundry ➔ Planner ➔ Validator** closed loop across four Validator feedback rounds:

1. **Round 1 (`FB-1` + `FB-2` ➔ `THM-1` ➔ `SF WO-12`):** UI/kernel route contract alignment and SOX 404 adversarial replay hardening.
2. **Round 2 (`FB-3` ➔ `THM-2` ➔ `SF WO-13`):** White enterprise workbench and `ZeroSaaS P2P` brand redesign (`REQ-P2P-012`..`020`, `BP-01` `ADR-006`).
3. **Round 3 (`SF WO-14` + `T21`):** Interactive parity (voice intents, dock RF wedge scanner, RapidOCR field tagger, CFO check view, zero-secret voice proxy).
4. **Round 4 (`FB-5` ➔ `THM-4` ➔ `SF WO-15` .. `SF WO-18`):** Full-stack 1:1 3-panel workbench glass, streaming female `KAL` voice (`EXAVITQu4vr4xnSDxMaL`) with controller phonetic lexicon, `275`-table MIT brownfield SQLite schema explorer (`151` CRM / `119` WMS / `5` HRM), cross-platform `hledger` discovery, 13-route workbench engine, and **White House Super Intelligence Accord (`EO 14434`) 4-Layer × 8090 Know Your Superintelligence (`KYSI`) L1–L4** governance parity.

- **Snapshot (UTC):** `2026-11-14T11:15Z`
- **Repository:** `loop-smith/zerosaas-p2p-app`, formerly `8090-p2p-app`
- **Planner status:** **18** Work Orders (`SF WO-1` .. `SF WO-18`) built across 4 closed-loop rounds; `WO-15` .. `WO-18` ready for independent cross-family Qualify Review.

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
| Validator Feedback | `FB-1` — UI/server route mismatch | `f817adb9-0be8-49fe-9cfe-9eaa599b9f2e` |
| Validator Feedback | `FB-2` — SOX 404 red-team replay, GS1 reel, KAL spoof and 28-box `409` checks | `804e1202-8162-4fca-9f6f-55d051f7b8df` |
| Validator Theme | `THM-1` — Route Contract & SOX 404 Adverse Replay Hardening (Resolved) | `2c9639f9-302f-4fa9-801d-8fcc162b2920` |
| Validator Feedback | `FB-3` — Product owner UX change order: white ZeroSaaS P2P workbench | `0ce52256-27a7-4167-b1ea-ea9628ad7a00` |
| Validator Theme | `THM-2` — White Enterprise Workbench & Brand Change Order | `d3ab7474-57fa-40f0-9876-c0099c863806` |
| Planner Work Order | `SF WO-13` — Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign | `97cb2858-1488-4b34-829c-b0162ea65be3` |
| Validator Feedback | `FB-5` — Full-stack 3-panel workbench, female KAL voice lexicon, 275-table explorer & EO 14434 × KYSI parity | `a19b9a76-2adb-405b-8d34-53ec41fbbf76` |
| Validator Theme | `THM-4` — Full-Stack Golden-Master Workbench, Voice Lexicon, 275-Table Vault & Governance Parity | `05591d02-9ff7-41ce-886d-92fdcda411a9` |
| Planner Work Order | `SF WO-15` — Streaming female KAL voice, controller phonetic lexicon & 28-box RapidOCR `/mint`+`/scan` | `3988d7f2-c356-487d-9ed2-9a1c045d3ee1` |
| Planner Work Order | `SF WO-16` — 1:1 3-panel workbench glass, RF laser scan, inline OCR invoice & Check `#10045` | `bd3f7822-1571-4b81-80ca-6a32215a25aa` |
| Planner Work Order | `SF WO-17` — 275-table brownfield SQLite explorer, live COMEX spot subview, cross-platform `hledger` & 13 routes | `78e025ce-ac9b-4714-a769-4b38767baa9d` |
| Planner Work Order | `SF WO-18` — Scrub internal prefixes, document `EO 14434` × `KYSI` governance & update Software Factory trace | `346dd5b4-37e7-45ed-bca0-6d36528bd0c6` |

> **REQ-01 identifier note:** early `.sw-factory/WO-01..WO-06/context.md` files recorded `c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc` when execution plans were initially staged (`5baba895`). This matrix uses the live Foundry `REQ-01` UUID (`1fc08c46-ed36-4a14-99a3-0eae8de04206`).

## 2. The 2-Way Closed Loop

```text
 Refinery KB-00 ──► Foundry REQ-01 ──► BP-01 Architecture + Feature Blueprint ──► Planner SF WO-1..WO-18
       ▲                                                                                  │
       │                                                                                  ▼
 Validator FB-1..FB-5 ◄── Qualify Review (PASS / FAIL) ◄── modular commit ◄── fenced WO build (.sw-factory/WO-xx)
       │
       ├──► THM-1 (FB-1, FB-2) ──► SF WO-12 (route contract + replay hardening) ──► PASS
       ├──► THM-2 (FB-3) ──► REQ-P2P-012..020 + ADR-006 ──► SF WO-13 (`c5026200`) + SF WO-14 (`44cad6d1`, `465c3cd9`)
       └──► THM-4 (FB-5) ──► SF WO-15 (`000bf83`) + SF WO-16 (`116b75b`) + SF WO-17 (`f0e0f5c`) + SF WO-18
```

## 3. Forward Matrix — SF Planner WO ➔ Build Unit ➔ Commit ➔ Qualify Review (18 rows)

| SF WO | Planner Work Order | Build Unit | Commit | Qualify Review | Status |
| --- | --- | --- | --- | --- | --- |
| **SF WO-1** | Validate brownfield contracts (`contracts/p2p-lineage-contract.json` semantic bindings) | `WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-2** | Stocked-copper inventory (`ITM-CU-20-BARE`, InvenTree WMS / HRM / CRM / 89-account COA seeds) | `WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-3** | KAL zero-authority steward (`403 AI_STEWARD_ZERO_AUTHORITY`) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-4** | Darius / Devon DOA approval gates (`403 DOA_LIMIT_EXCEEDED`) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-5** | Dock GS1 intake (`ENC-GS1-884192-R01..R04`, `403 SOX_SOD_VIOLATION`) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-6** | 28-box 3-way reconciliation (PO = BOL = INV, `409 MATCH_VARIANCE_HOLD`) | `WO-03-A`, `WO-05` (`T19` ➔ `T19.f1`) | `2ba3ae52`, `cae71057` | `WO-03-A.q2`: **PASS**; `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-7** | COMEX copper (`HG`) spot pricing (`gold-api.com` ➔ Yahoo `HG=F` ➔ offline) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-8** | `501900` Purchase Price Variance ledger (balanced 3-leg GAAP journal) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-9** | Disbursement controls: Operating `101100` `#8801` vs Payroll `101200` `#4409` (`403 BANK_POLICY_VIOLATION`) | `WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-10** | Audit recovery (red-team replay / tamper / spoof regression, `.sw-factory` certification) | `WO-06` + `T19.f1` | `fca1c225`, `cae71057` | `WO-06.q`: **PASS**; `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-11** | PO-25800 end-to-end (`tests/test-copper-e2e.mjs`, ≥16 live assertions) | `WO-05` (`T19` ➔ `T19.f1`) | `11a63009` ➔ `cae71057` | `T19.q2`: **FAIL** ➔ `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-12** | Harden live `/api/step/:n` route contracts and adversarial replay guards (`THM-1`) | `WO-04-A.f1` + `WO-06` + `T19.f1` | `9094b2bb`, `fca1c225`, `cae71057` | `WO-04-A.f1.q` / `WO-06.q` / `T19.f1.q`: **PASS** | ✅ Completed / PASS |
| **SF WO-13** | Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign (`THM-2`) | `WO-13` | `c5026200` | Superseded & carried forward into Round 4 (`WO-16`) | ✅ Built |
| **SF WO-14** | Implement ZeroSaaS P2P Interactive Parity + zero-secret voice proxy | `WO-14` + `T21` | `44cad6d1`, `465c3cd9` | Carried forward into Round 4 (`WO-15`, `WO-16`) | ✅ Built |
| **SF WO-15** | Streaming female KAL voice (`EXAVITQu4vr4xnSDxMaL`), controller phonetic lexicon & 28-box RapidOCR `/mint`+`/scan` (`THM-4`) | `WO-15` | `000bf83e` | `WO-15..WO-18.q`: **PASS** (40/40 sidecar + voice E2E green) | ✅ Completed / PASS |
| **SF WO-16** | 1:1 3-panel workbench glass, 4-reel RF laser scan, inline OCR invoice, Check `#10045` & `WO 1-18` view (`THM-4`) | `WO-16` | `116b75b5` | `WO-15..WO-18.q`: **PASS** (7/7 static + 16/16 client green) | ✅ Completed / PASS |
| **SF WO-17** | 275-table SQLite explorer (`151`/`119`/`5`), live COMEX spot subview, cross-platform `hledger` & 13-route workbench engine (`THM-4`) | `WO-17` | `f0e0f5cd` | `WO-15..WO-18.q`: **PASS** (24/24 seed + full E2E green) | ✅ Completed / PASS |
| **SF WO-18** | Scrub internal task prefixes, document `EO 14434` × `KYSI` governance & update Software Factory trace (`THM-4`) | `WO-18` | `adfec36d` | `WO-15..WO-18.q`: **PASS** (0 forbidden strings + all suites green) | ✅ Completed / PASS |

### Validator Round-Trip 4 (`FB-5` ➔ `THM-4` ➔ `SF WO-15` .. `SF WO-18`) & `EO 14434` × `KYSI` Governance

| Record | UUID | Scope & Verification |
| --- | --- | --- |
| `FB-5` | `a19b9a76-2adb-405b-8d34-53ec41fbbf76` | Operator gap audit requiring 1:1 parity across the 3-panel workbench glass, female streaming KAL voice & phonetic lexicon, 275-table brownfield SQLite explorer, inline 28-box RapidOCR scan, Check `#10045`, and `EO 14434` × `KYSI` governance matrix |
| `THM-4` | `05591d02-9ff7-41ce-886d-92fdcda411a9` | Groups `FB-5` under `REQ-01` (`1fc08c46-ed36-4a14-99a3-0eae8de04206`) and `BP-01` (`61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d`) |
| `SF WO-15` | `3988d7f2-c356-487d-9ed2-9a1c045d3ee1` | `sidecar/invoice_ocr_engine.py` (`/mint`, `/scan`, 28 boxes) + `src/voice.mjs` (`EXAVITQu4vr4xnSDxMaL`, phonetic lexicon, Scribe v1 keyterms, `/api/voice/*` + `/api/kal/*`) — commit `000bf83` |
| `SF WO-16` | `bd3f7822-1571-4b81-80ca-6a32215a25aa` | `public/index.html`, `public/styles.css`, `public/app.js` (4 tabs, RF laser scan, inline RapidOCR, Check `#10045`, Tab 3 White House Super Intelligence Accord `EO 14434` 4-Layer × 8090 `KYSI` L1–L4 matrix, Tab 4 `WO 1-18`, 18 ES module exports) — commit `116b75b` |
| `SF WO-17` | `78e025ce-ac9b-4714-a769-4b38767baa9d` | `seeds/schemas_275.json` (`275` tables), `src/workbench_lineage.mjs`, `src/table_explorer.mjs`, `src/documents.mjs`, `src/workbench_engine.mjs`, `src/sor_3panel_server.mjs`, `tests/test-golden-master-e2e.mjs` — commit `f0e0f5c` |
| `SF WO-18` | `346dd5b4-37e7-45ed-bca0-6d36528bd0c6` | `.sw-factory/WO-15/`, internal prefix scrub across `.sw-factory/` and `tests/`, `EO 14434` × `KYSI` governance & Round 4 traceability in `README.md` and `docs/software-factory-trace.md` |

#### White House Super Intelligence Accord (`EO 14434`) 4-Layer × 8090 Know Your Superintelligence (`KYSI`) L1–L4 Matrix

| Governance Layer | 8090 KYSI Tier | Enforced Runtime Control in `zerosaas-p2p-app` |
| --- | --- | --- |
| **Layer 1 · Technical Controls** | **KYSI L1** — Registered Identity & Hard Capability Bounds | `EMP-AI-KAL` seeded in `hrm_doa_authority_seat` with `CHECK (emp_id != 'EMP-AI-KAL' OR approval_limit_usd = 0)`, zero SQLite/journal/bank write credentials, deterministic `403 AI_STEWARD_ZERO_AUTHORITY` on all write routes |
| **Layer 2 · Internal Oversight Gates** | **KYSI L2** — Mandatory Human-in-the-Loop Checkpoints & SoD | 4 human gates (`EMP-0021` Darius `$20k`, `EMP-0005` VP Devon `$100k`, `EMP-0003` Marcus 4-reel GS1 dock scan, `EMP-0007` CFO Meredith `$500k`) enforcing `403 DOA_LIMIT_EXCEEDED`, `403 SOX_SOD_VIOLATION`, `409 MATCH_VARIANCE_HOLD`, and `403 BANK_POLICY_VIOLATION` |
| **Layer 3 · External Audit & Lineage** | **KYSI L3** — Cryptographic Provenance & Deterministic Books | Hash-chained audit register, SHA-256 digests across all 5 trade PDFs & 28 RapidOCR pixel boxes, `LineageCoreEngine` SQLite/GL hop hashes, `hledger check --strict` (`DR == CR`) |
| **Layer 4 · Board & Officer Governance** | **KYSI L4** — Statutory Officer Attribution & Kill Switch | Named officer attribution on every PO, receipt, voucher, and Check `#10045` (`ACH-000582`), `$140,000` ring-fenced Payroll `#4409`, and immediate state reset (`POST /api/reset`) |

## 4. Backward Matrix — Commit ➔ SF Planner WOs

| Commit | Subject | Build Unit | SF WOs satisfied | Verification / Qualify Summary |
| --- | --- | --- | --- | --- |
| `2105fdcc` | initialize scaffold and P2P domain contract | — | Pre-event contract (input to SF WO-1) | n/a (scaffold) |
| `5baba895` | stage WO-01..WO-06 execution plans and checklists | — | Planner ➔ `.sw-factory/WO-01..WO-06` | n/a (plans) |
| `3769d7e6` | Bootstrap 4 MIT Headless SoR Seeds in `seeds/` | `WO-01` | SF WO-1, SF WO-2 | **PASS**: 23 seed tests & drift checks green |
| `2ba3ae52` | Build Warm RapidOCR 5-PDF Sidecar (`:3591`) | `WO-03-A` | SF WO-6 | **PASS**: 39 sidecar tests green |
| `11e6a606` | Implement Core P2P State Kernel | `WO-02` | SF WO-3, 4, 5, 7, 8, 9 | **PASS**: 26 kernel self-checks green |
| `1ad7f604` | Deliver One-Screen (100vh Zero-Scroll) Desk | `WO-04-A` | UI Desk (initial) | **FAIL** (`FB-1`) ➔ closed by `9094b2bb` |
| `6943f1a6` | Publish 8090 Software Factory Bidirectional Traceability Matrix | `WO-07` | Traceability | n/a (documentation) |
| `fca1c225` | Red-Team Adversarial Audit & `.sw-factory` Certification | `WO-06` | SF WO-10, SF WO-12 (`FB-2`) | **PASS**: red-team replay/tamper/spoof suite green |
| `9094b2bb` | Bind client contract to real `/api/state` and `/api/step/:n` | `WO-04-A.f1` | SF WO-12 (`FB-1`) | **PASS** |
| `11a63009` | Integrate `src/` + `sidecar/` + `public/` + `seeds/` | `WO-05` (`T19`) | SF WO-6, SF WO-11 | **FAIL** (`T19.q2`) ➔ closed by `cae71057` |
| `cae71057` | Refuse non-object sidecar replies with audited `503 OCR_UNAVAILABLE` | `T19.f1` | SF WO-10, SF WO-11, SF WO-12 | **PASS** |
| `8721678d` ➔ `c1d69467` | Update `contracts/p2p-lineage-contract.json` (`targetRepo`) & regenerate `seeds/coa_seed.journal` | `WO-08` ➔ `T20` | Rename & digest integrity | **PASS** (`drift() == []`) |
| `c5026200` | White Enterprise Workbench & Brand Redesign (`public/`) | `WO-13` | SF WO-13 (`FB-3`, `THM-2`) | In-fence review APPROVED |
| `44cad6d1` | Interactive parity: voice steward, dock RF scanner, RapidOCR boxes, CFO check view | `WO-14` | SF WO-14 | In-fence review APPROVED |
| `465c3cd9` | WO-14 follow-ups (Encore Wire intent, ACH prefix) + zero-secret `/api/kal/*` voice proxy | `T21` | SF WO-14 | 13/13 red-team E2E checks green |
| `000bf83` | Add streaming female KAL voice, controller phonetic lexicon, and 28-box RapidOCR `/mint`+`/scan` parity | `WO-15` | SF WO-15 (`FB-5`, `THM-4`) | 40/40 sidecar + voice E2E green |
| `116b75b` | Port 1:1 golden-master 3-panel workbench glass, RF laser scan, inline OCR invoice, and Check `#10045` | `WO-16` | SF WO-16 (`FB-5`, `THM-4`) | 7/7 static + 16/16 client tests green |
| `f0e0f5c` | Add 275-table brownfield SQLite explorer, live COMEX spot subview, cross-platform `hledger`, and 13-route workbench engine | `WO-17` | SF WO-17 (`FB-5`, `THM-4`) | 24/24 seed + full Golden-Master E2E green |
| `adfec36d` | Scrub internal task prefixes, document `EO 14434` × `KYSI` governance, and update Software Factory trace | `WO-18` | SF WO-18 (`FB-5`, `THM-4`) | **PASS** (`WO-15..WO-18.q` + `119`-table & `db=` alias follow-up closed) |

## 5. Qualify Review Ledger

| Qualify Review | Target commit | Base | Verdict | Follow-up / Notes |
| --- | --- | --- | --- | --- |
| `WO-01.q` | `3769d7e6` | `5baba895` | **PASS** | — |
| `WO-02.q` | `11e6a606` | `2ba3ae52` | **PASS** | — |
| `WO-03-A.q2` | `2ba3ae52` | `3769d7e6` | **PASS** | — |
| `WO-04-A.q` | `1ad7f604` | `11e6a606` | **FAIL** | Closed by `WO-04-A.f1` (`9094b2bb`, `FB-1`) |
| `WO-06.q` | `fca1c225` | `6943f1a6` | **PASS** | — |
| `WO-04-A.f1.q` | `9094b2bb` | `fca1c225` | **PASS** | Closes `WO-04-A.q` |
| `T19.q2` | `11a63009` | `9094b2bb` | **FAIL** | Closed by `T19.f1` (`cae71057`) |
| `T19.f1.q` | `cae71057` | `11a63009` | **PASS** | Closes `T19.q2` |
| `WO-08.q` ➔ `T20` | `c1d69467` | `6db3195f` | **PASS** | Closes `targetRepo` & journal `canonical-sha256` (`57311e23…`) |
| `WO-15..WO-18.q` | `adfec36d` | `465c3cd9` | **PASS** | `119`-table WMS desk copy & `/api/table?db=` alias follow-up closed |

## 6. Per-WO Evidence Index (`.sw-factory/`)

| Build Unit | Plan / checklist / review log | In-fence review verdict | Status |
| --- | --- | --- | --- |
| `WO-01` | `.sw-factory/WO-01/` | APPROVED (24 seed tests + drift check green) | ✅ Closed |
| `WO-02` | `.sw-factory/WO-02/` | APPROVED (26 kernel self-checks green) | ✅ Closed |
| `WO-03-A` | `.sw-factory/WO-03/` | APPROVED (40 sidecar tests green) | ✅ Closed |
| `WO-04-A` / `WO-04-A.f1` | `.sw-factory/WO-04/` | APPROVED (Round 5 API & UI contract verification) | ✅ Closed |
| `WO-05` (`T19` / `T19.f1`) | `.sw-factory/WO-05/` | APPROVED (Round 3 sidecar-reply + E2E integration) | ✅ Closed |
| `WO-06` | `.sw-factory/WO-06/` | APPROVED (red-team audit + `.sw-factory` certification) | ✅ Closed |
| `SF WO-12` | `.sw-factory/WO-12/` | APPROVED (`FB-1`, `FB-2`, `THM-1`, `T20`) | ✅ Closed |
| `SF WO-13` | `.sw-factory/WO-13/` | APPROVED (`REQ-P2P-012`..`020`) | ✅ Closed |
| `SF WO-14` | `.sw-factory/WO-14/` | APPROVED (interactive voice, RF, OCR & check parity) | ✅ Closed |
| `SF WO-15` .. `SF WO-18` | `.sw-factory/WO-15/` | APPROVED (`WO-15..WO-18.q` **PASS**, `FB-5` ➔ `THM-4`) | ✅ Closed |
