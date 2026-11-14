<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-13

**Work Order Number:** WO-13
**Work Order Title:** Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign
**Initialized At (UTC):** 2026-11-14T05:55Z

## Phase 1: Context Gathering

### Required Steps

- [SKIP] Review work order description provided by MCP tool output — the Software Factory MCP is not exposed in this seat. The WO-13 id, the `FB-3`/`THM-2` ids and the acceptance criteria came with the build row.
- [x] Identify linked requirements and blueprints — `REQ-01` with `REQ-P2P-012`..`020`; `BP-01` with `ADR-006`. Recorded in `context.md`.
- [SKIP] Review every connected requirements document — the `REQ-P2P-012`..`020` bodies are not readable without the MCP. The acceptance text quotes their content per screen region.
- [SKIP] Review every connected blueprint document — the `BP-01` / `ADR-006` body is not readable without the MCP. The acceptance text gives the layout numbers.
- [SKIP] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP — no blueprint body was available to follow.
- [SKIP] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md` — none discovered.
- [x] Extract acceptance criteria from requirements — tracked as R1–R12 in `implementation-plan.md`.
- [x] Identify architecture path from blueprints (components, contracts, composition) — `public/index.html` + `public/styles.css` + `public/app.js` ➔ `GET /api/state`, `POST /api/step/:n`, `POST /api/reset`, `GET /docs/:name` on `src/sor_3panel_server.mjs` ➔ kernel `src/lineage_core.mjs` `snapshot()`. No new route.
- [SKIP] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` — this lane runs only `python3` and `git`. `context.md` was written directly.

- [x] **Certification: Phase 1 complete for local sources. Remote reads skipped.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md` before any implementation file changed — reuse list, locked exports, locked refusal codes, R1–R12, deviation.
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order — `public/index.html`, `public/styles.css`, `public/app.js`, the three `public/` test files, one assertion in `tests/test-copper-e2e.mjs`, `README.md`, `docs/software-factory-trace.md`, `.sw-factory/WO-13/`. Nothing outside the fence.
- [x] Written fresh — the three UI files were written from the WO-13 acceptance text. No external pre-event file was opened or copied. The guarded transport, validation, voice and recorder functions in `public/app.js` were kept from this repository's own qualified code.
- [x] Tests added or updated for changed behavior — `public/test_command_desk.py` (10 tests: brand, palette, layout, topbar gates, views, strip, right rail, server contract, DOM-id contract, internal strings); `public/command-desk.test.mjs` (trial balance against the real kernel, unbalanced journal, DOM-less render); `public/test_browser_command_desk.py` rewritten for the new DOM.
- [x] Red evidence — the new brand and legacy-name assertions fail on the `HEAD` versions of `public/index.html` (old title and `aria-label` both match). The DOM-id check failed during development until its extraction covered `querySelectorAll('#trial-balance …')`.
- [x] Documentation updated — README workbench section and traceability (FB-3, THM-2, REQ-P2P-012..020, ADR-006, SF WO-13, WO-04 title root cause, T20 closing WO-08 R10); trace matrix sections 1–7.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [x] Review subagent spawned per `execution/review.md` and returned a verdict — independent read-only review; findings and fixes in `review-log.md` Round 1.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied — R1–R12 met, with one recorded deviation (the e2e title assertion).
- [SKIP] Architecture is aligned with linked blueprints, or documented drift is accepted — no blueprint body to align against; `ADR-006` layout numbers from the acceptance text are asserted in tests.
- [x] Exploratory pass on user-visible or external behavior — `npm test` boots the real server and asserts `GET /` serves the new title; the client suite drives the real kernel through all 8 steps and checks the trial balance.
- [SKIP] Live browser DOM / console verification — Playwright and every Chromium/Firefox binary are absent in this lane, so `public/test_browser_command_desk.py` skips. The static DOM-id contract test and the independent review stand in; they are not a substitute for a real render.
- [x] Latest `review-log.md` verdict is `APPROVED`

- [x] **Certification: Phase 3 complete. Proceeding to Final Completion.**

## Final Completion Check

- [x] All phase certifications above are complete
- [x] Checklist is fully filled out with evidence
- [x] Review log is complete (`review-log.md`)
- [x] Implementation plan was followed (`implementation-plan.md`)
- [x] All intended files are present in the working tree
- [SKIP] Work order status updated to `in_review` in Software Factory — no MCP in this seat. Local `context.md` reads `in_review`.
