<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-12

**Work Order Number:** WO-12
**Work Order Title:** Harden live `/api/step/:n` route contracts and adversarial replay guards
**Initialized At (UTC):** 2026-11-14T04:16:19Z

## Phase 1: Context Gathering

### Required Steps

- [SKIP] Review work order description provided by MCP tool output — the Software Factory MCP is not exposed in this seat. The WO-12 title, priority, type, status and the `FB-1`, `FB-2` and `THM-1` ids came from the task acceptance criteria.
- [x] Identify linked requirements and blueprints — `REQ-01` and `BP-01` through `THM-1`. Recorded in `context.md`.
- [SKIP] Review every connected requirements document — the remote `REQ-01` body is not readable without the MCP.
- [SKIP] Review every connected blueprint document — the remote `BP-01` body is not readable without the MCP.
- [SKIP] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP — no blueprint body was available to follow.
- [SKIP] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md` — none discovered.
- [x] Extract acceptance criteria from requirements — tracked as R1–R12 in `implementation-plan.md`.
- [x] Identify architecture path from blueprints (components, contracts, composition) — desk `public/app.js` ➔ `/api/step/:n` on `src/sor_3panel_server.mjs` ➔ kernel `src/lineage_core.mjs` ➔ RapidOCR sidecar. The source was the code and the lineage contract.
- [SKIP] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` — this lane runs only `python3` and `git`. `context.md` was written directly.

- [x] **Certification: Phase 1 complete for local sources. Remote reads skipped.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md` — reuse list, locked refusal codes, requirement ids, deviation.
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order — `README.md`, `docs/software-factory-trace.md`, `package.json`, `src/lineage_core.mjs` (two strings) and `.sw-factory/WO-12/`. `contracts/p2p-lineage-contract.json` ends with no diff; see the deviation in `implementation-plan.md`.
- [SKIP] Tests added or updated for changed behavior — no behavior changed. The hardening regressions already exist in `tests/test-copper-e2e.mjs`, `tests/test-sidecar-reply.mjs` and `public/command-desk.test.mjs`. No test reads the renamed strings.
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant — README, trace matrix and WO-12 execution docs. The generated `seeds/coa_seed.journal` is outside the fence and was not touched.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review.md` and returned a verdict — in-seat review only. It is Round 1 of `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied — R1–R9, R11 and R12 are met. R10 (`targetRepo`) is blocked by the fence and recorded as a deviation, not claimed.
- [SKIP] Architecture is aligned with linked blueprints, or documented drift is accepted — no blueprint body to align against.
- [x] Exploratory pass on user-visible or external behavior — `npm test` boots the real server and checks `GET /`, `GET /api/health` and the full 8-step flow. `node --test public/command-desk.test.mjs` runs the desk against the real kernel.
- [x] Latest `review-log.md` verdict is `APPROVED`

- [x] **Certification: Phase 3 complete. Proceeding to Final Completion.**

## Final Completion Check

- [x] All phase certifications above are complete
- [x] Checklist is fully filled out with evidence
- [x] Review log is complete (`review-log.md`)
- [x] Implementation plan was followed (`implementation-plan.md`)
- [x] All intended files are present in the working tree
- [x] Work order status updated — local `context.md` reads `completed`, matching the Planner status. The remote record was not written from this seat (no MCP).
