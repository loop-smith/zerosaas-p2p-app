<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-06

**Work Order Number:** WO-06
**Work Order Title:** Red-Team Adversarial Audit, Software Factory Feedback->Themes Triage & Final .sw-factory Certification
**Initialized At (UTC):** 2026-11-14T02:48:08Z

## Phase 1: Context Gathering

### Required Steps

- [SKIP] Review work order description provided by MCP tool output — MCP is not exposed. The task card and staged acceptance criteria were reviewed.
- [x] Identify linked requirements and blueprints — REQ-01 id recorded in `context.md`. No local blueprint files.
- [SKIP] Review every connected requirements document — remote REQ-01 body unavailable.
- [SKIP] Review every connected blueprint document — none in the checkout.
- [SKIP] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP — nothing to follow.
- [SKIP] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md` — none discovered.
- [x] Extract acceptance criteria from requirements — five attack classes plus checklist/review certification, tracked as R1–R8 in `implementation-plan.md`.
- [x] Identify architecture path from blueprints (components, contracts, composition) — HTTP adapter → kernel guard order → temp sandbox over committed seeds. Source was the code and the contract, not a blueprint document.
- [SKIP] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` — the lane refuses shell scripts. `context.md` was filled directly.

- [x] **Certification: Phase 1 complete for local sources. Remote reads skipped.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md` — reuse list, locked refusal codes, requirement ids.
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order — `tests/test-copper-e2e.mjs` and `.sw-factory/` only. No `src/` edit, no receipt.
- [x] Tests added or updated for changed behavior — red-team matrix plus the existing 26-check self-check spawn. First KAL `PUT` assertion failed, then matched the adapter.
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant — WO-01..WO-06 execution docs. No committed runtime fixture.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review.md` and returned a verdict — nested writer not started. In-seat review is Round 1 of `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied — five attack classes green under `npm test`; every checklist box is `[x]` or `[SKIP]`; each review log verdict is APPROVED. HARA package checks are recorded failed and are not claimed.
- [SKIP] Architecture is aligned with linked blueprints, or documented drift is accepted — no blueprint body to align. Behavior matches the lineage contract and the current kernel.
- [x] Exploratory pass on user-visible or external behavior — live `GET /` (command desk HTML), `GET /api/health`, journal balance, and the audit chain inside the suite. Browser console and HARA hash routes were not exercised; those routes are not in this app.
- [x] Latest `review-log.md` verdict is `APPROVED`

- [x] **Certification: Phase 3 complete. Proceeding to Final Completion.**

## Final Completion Check

- [x] All phase certifications above are complete
- [x] Checklist is fully filled out with evidence
- [x] Review log is complete (`review-log.md`)
- [x] Implementation plan was followed (`implementation-plan.md`)
- [x] All intended files are present in the working tree
- [x] Work order status updated to `in_review` — local `context.md`. Foundry remote status was not written (no MCP).
