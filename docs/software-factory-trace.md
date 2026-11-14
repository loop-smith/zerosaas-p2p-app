# 8090 Software Factory ⇄ Build Traceability Matrix (`zerosaas-p2p-app`)

This file traces each **8090 Software Factory Planner Work Order** (`SF WO-1` .. `SF WO-11`) both ways:

- **Forward:** from each SF Work Order to the build work order (`HARA WO-xx`) that implements it, then to the commit on `main`, then to its independent **Qualify Review** verdict.
- **Backward:** from each commit on `main` to the SF Work Orders it satisfies.

The SF Work Orders came out of the live 2-way **Refinery ➔ Foundry ➔ Planner ➔ Validator** loop. Validator feedback is routed back into the build queue as follow-up work orders, for example `WO-04-A.f1`.

- **Snapshot (UTC):** `2026-11-14T03:27Z`
- **Repository:** `loop-smith/zerosaas-p2p-app`, formerly `8090-p2p-app`

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

> **REQ-01 identifier note:** the local per-WO indexes `.sw-factory/WO-0x/context.md` still list `c2bd88dc-6cf0-41d2-8a20-6eb60e9b3dbc` as `REQ-01`. That value was recorded when the WO execution plans were staged (commit `5baba895`). This matrix uses the current Foundry `REQ-01` identifier above.

## 2. The 2-Way Loop

```text
 Refinery KB-00 ──► Foundry REQ-01 ──► BP-01 Architecture + Feature Blueprint ──► Planner SF WO-1..WO-11
       ▲                                                                                  │
       │                                                                                  ▼
 Validator feedback ◄── Qualify Review (PASS / FAIL) ◄── commit on main ◄── HARA WO-xx build (.sw-factory/WO-0x)
       │
       └──► follow-up work order (e.g. WO-04-A.f1) ──► back into the build queue
```

- **Forward direction (plan to code):**
  - Each Planner Work Order is assigned to a HARA build work order.
  - Each HARA WO executes against its `.sw-factory/WO-0x/` plan, checklist and review log, then lands on `main` as a single fast-forward commit.
- **Backward direction (code to plan):**
  - After a commit lands, an independent Qualify Review re-runs the evidence against the commit's intent and records a verdict of `PASS` or `FAIL`.
  - A `FAIL` verdict produces a typed follow-up work order. The follow-up records the failing command, the expected behavior and a fix direction, and goes back to the Validator and Planner.

## 3. Forward Matrix — SF Planner WO ➔ HARA WO ➔ Commit ➔ Qualify Review (11 rows)

| SF WO | Planner Work Order | HARA WO | Commit on `main` | Qualify Review | Status |
| --- | --- | --- | --- | --- | --- |
| **SF WO-1** | Validate brownfield contracts (`contracts/p2p-lineage-contract.json` semantic bindings) | `HARA WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ PASS |
| **SF WO-2** | Stocked-copper inventory (`ITM-CU-20-BARE`, InvenTree WMS / HRM / CRM / 89-account COA seeds) | `HARA WO-01` | `3769d7e6` | `WO-01.q`: **PASS** | ✅ PASS |
| **SF WO-3** | KAL zero-authority steward (`403 AI_STEWARD_ZERO_AUTHORITY`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-4** | Darius / Devon DOA approval gates (`403 DOA_LIMIT_EXCEEDED`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-5** | Dock GS1 intake (`ENC-GS1-884192-R01..R04`, `403 SOX_SOD_VIOLATION`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-6** | 28-box 3-way reconciliation (PO = BOL = INV, `409 MATCH_VARIANCE_HOLD`) | `HARA WO-03-A` | `2ba3ae52` | `WO-03-A.q2`: **PASS** | ✅ PASS (sidecar scope) |
| **SF WO-7** | COMEX copper (`HG`) spot pricing (gold-api.com ➔ Yahoo `HG=F` ➔ offline) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-8** | `501900` Purchase Price Variance ledger (balanced 3-leg GAAP journal) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-9** | Disbursement controls: Operating `101100` #8801 vs Payroll/Petty `101200` #4409 (`403 BANK_POLICY_VIOLATION`) | `HARA WO-02` | `11e6a606` | `WO-02.q`: **PASS** | ✅ PASS |
| **SF WO-10** | Audit recovery (red-team replay / tamper / spoof regression, `.sw-factory` certification) | `HARA WO-05-A` & `HARA WO-06` | — (not yet landed) | — (pending) | ⏳ In progress |
| **SF WO-11** | PO-25800 end-to-end (`tests/test-copper-e2e.mjs`, ≥16 live assertions) | `HARA WO-05-A` & `HARA WO-06` | — (not yet landed) | — (pending) | ⏳ In progress |

### Cross-cutting: UI Command Desk and the Validator Feedback Loop

| Deliverable | HARA WO | Commit on `main` | Qualify Review | Validator Feedback |
| --- | --- | --- | --- | --- |
| One-Screen (`100vh`) Copper Command Desk + KAL voice + WebM recorder (`public/`) | `HARA WO-04-A` | `1ad7f604` | `WO-04-A.q`: **FAIL** | ↩ `WO-04-A.f1` (open) |

The `WO-04-A` desk passed its own in-fence review (`.sw-factory/WO-04/review-log.md`, Round 3: client APPROVED). Its Qualify Review then ran the landed `public/app.js` against the real `WO-02` server and returned **FAIL**. The client used a self-authored transport contract:

- `validateState()` rejects the kernel's real `GET /api/state` snapshot.
- Step and probe writes `POST /api/step` instead of `/api/step/:n`.

The FAIL produced follow-up work order `WO-04-A.f1`. It is fenced to `public/` and the WO-04 execution docs. Its failing command boots `startServer({offline:true})`, validates the live snapshot and posts a step. It succeeds when:

- `validateState` accepts the real kernel snapshot.
- Step POSTs reach `/api/step/:n` and return `200` or a typed refusal.

This is the backward half of the loop. A Validator finding becomes a tracked work order instead of a silent patch.

## 4. Backward Matrix — Commit ➔ SF Planner WOs

| Commit | Subject | HARA WO | SF WOs satisfied | Qualify Review verdict (summary) |
| --- | --- | --- | --- | --- |
| `2105fdcc` | initialize scaffold and P2P domain contract | — | Pre-event contract (input to SF WO-1) | n/a (scaffold) |
| `5baba895` | stage WO-01..WO-06 execution plans and checklists | — | Planner ➔ `.sw-factory/WO-01..WO-06` | n/a (plans) |
| `3769d7e6` | Bootstrap 4 MIT Headless SoR Seeds in `seeds/` | `WO-01` | SF WO-1, SF WO-2 | **PASS**: all four seeds satisfy the bootstrap intent. 23 tests, drift checks, SQLite integrity checks and semantic-binding checks pass. No baseline regression. |
| `2ba3ae52` | Build Warm RapidOCR 5-PDF Sidecar (`:3591`) | `WO-03-A` | SF WO-6 | **PASS**: self-contained `sidecar/`. Builds the 5 contract-named PDFs with one warm RapidOCR instance and exact `Decimal` matching. Payment checks are proposals only (`posted=False`). `pytest sidecar` gives 39 passed. |
| `11e6a606` | Implement Core P2P State Kernel | `WO-02` | SF WO-3, 4, 5, 7, 8, 9 | **PASS**: Steps 1–8, live COMEX, guardrails and balanced `501900` PPV verified. 26 self-checks and 62 existing tests pass. No base regression. |
| `1ad7f604` | Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk | `WO-04-A` | UI Command Desk (cross-cutting) | **FAIL**: client/server contract mismatch against the `WO-02` server. Follow-up `WO-04-A.f1` opened. |

Every listed build commit is a fast-forward on `main`. Each landed with its fenced test commands green before qualification.

## 5. Qualify Review Ledger

| Qualify Review | Target commit | Base | Verdict | Lines deleted | Follow-up |
| --- | --- | --- | --- | --- | --- |
| `WO-01.q` | `3769d7e6` | `5baba895` | **PASS** | 0 | Duty-flag constraint defect logged as separate follow-up work |
| `WO-02.q` | `11e6a606` | `2ba3ae52` | **PASS** | 0 | — |
| `WO-03-A.q` | `2ba3ae52` | `3769d7e6` | Refused (invalid review slot) ➔ requalified | — | Re-run as `WO-03-A.q2` |
| `WO-03-A.q2` | `2ba3ae52` | `3769d7e6` | **PASS** | 0 | Deeply nested JSON body drops the connection instead of returning `400` |
| `WO-04-A.q` | `1ad7f604` | `11e6a606` | **FAIL** | 0 | `WO-04-A.f1`: align `public/app.js` with the real `/api/state` and `/api/step/:n` contract |

## 6. Per-WO Evidence Index (`.sw-factory/`)

| HARA WO | Plan / checklist / review log | In-fence review verdict |
| --- | --- | --- |
| `WO-01` | `.sw-factory/WO-01/` | APPROVED (Round 1, 0 blocking; 8 advisories fixed; 23 passed) |
| `WO-02` | `.sw-factory/WO-02/` | APPROVED (Round 1, 0 blocking; 14 advisories, 8 fixed; selfcheck 26/26) |
| `WO-03-A` | `.sw-factory/WO-03/` | APPROVED (Round 3, fenced sidecar scope; 39 passed) |
| `WO-04-A` | `.sw-factory/WO-04/` | Client APPROVED (Round 3); full-WO integration blocked, as later confirmed by `WO-04-A.q` FAIL |
| `WO-05-A` | `.sw-factory/WO-05/` | Not yet reviewed (integration + 16-assertion E2E) |
| `WO-06` | `.sw-factory/WO-06/` | Not yet reviewed (red-team audit + final certification) |

## 7. Open Items Carried by This Matrix

1. **`WO-04-A.f1`:** connect the Command Desk to the real kernel contract. It is required before any UI end-to-end claim.
2. **`WO-05-A`:** integrate `src/` (`:3590`), `sidecar/` (`:3591`), `public/` and `seeds/`, and make `npm test` run `tests/test-copper-e2e.mjs`. This closes **SF WO-11**.
   - Until it lands, `npm test` is a scaffold contract-presence smoke check only.
3. **`WO-06`:** red-team replay, tamper, spoof and negative-quantity regressions, and final `.sw-factory` certification. This closes **SF WO-10**.
4. **Server-side OCR sourcing for Step 7:** the WO-02 kernel's default invoice is PO-derived until the sidecar is wired in. SF WO-6 is therefore PASS for the sidecar scope, and kernel integration is pending under `WO-05-A`.
5. **Repository rename:**
   - Done: `README.md` and this file now say `zerosaas-p2p-app`.
   - Still pending: `package.json` `name` and `contracts/p2p-lineage-contract.json` `targetRepo` still read `8090-p2p-app` and need a separately fenced change.
