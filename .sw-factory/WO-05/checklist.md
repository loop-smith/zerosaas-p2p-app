<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-05

**Work Order Number:** WO-05
**Work Order Title:** Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs)
**Initialized At (UTC):** 2026-11-14T02:48:08Z

The file landed in the WO-06 seat because `tests/` is inside that fence and `npm test` already imported `tests/test-copper-e2e.mjs`. T19 integrated the sidecar, desk and seeds into the suite and set `package.json` `test` to `node tests/test-copper-e2e.mjs`. See `review-log.md` Round 2.

## Phase 1: Context Gathering

### Required Steps

- [SKIP] Review work order description provided by MCP tool output — MCP is not available; the staged acceptance criteria were used.
- [x] Identify linked requirements and blueprints — REQ-01 id is in `context.md`; no blueprint documents are present.
- [SKIP] Review every connected requirements document — remote REQ-01 body is not readable.
- [SKIP] Review every connected blueprint document — none supplied.
- [SKIP] Follow `@…` mentions **and links** to other blueprints in linked documents and read each referenced blueprint via MCP — no documents and no MCP.
- [SKIP] Review every referenced blueprint discovered that way; add them to **Referenced Blueprints** in `context.md` — none discovered.
- [x] Extract acceptance criteria from requirements — four tracers and the `npm test` entry, recorded in `implementation-plan.md`.
- [x] Identify architecture path from blueprints (components, contracts, composition) — contract → `src/selfcheck.mjs` → `tests/test-copper-e2e.mjs` on a temp sandbox. No blueprint document supplied the path.
- [SKIP] `context.md` is filled or updated with `execution/scripts/update-context-index.sh` — shell scripts are refused in this lane. `context.md` was filled directly.

- [x] **Certification: Phase 1 complete for the local contract. Remote blueprint reads skipped.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md`
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the Work Order.
  - WO-06 seat: `tests/test-copper-e2e.mjs`.
  - T19 seat: the kernel's opt-in OCR sidecar path (`src/lineage_core.mjs`), `/docs` (`src/sor_3panel_server.mjs`), the sidecar PNG and ready line, and the `package.json` scripts.
- [x] Tests added or updated for changed behavior — self-check (26) plus integrated red-team/OCR (12) against the live server and real RapidOCR. Two sidecar tests were added (PNG output, `serve --port 0` ready line).
- [x] Documentation, generated files, fixtures, migrations, or config updated where relevant — execution docs updated. No new fixture is committed; the run uses `seeds/` and a temp sandbox.

- [x] **Certification: Phase 2 complete. Proceeding to Phase 3.**

## Phase 3: Review And Verification

### Review

- [SKIP] Review subagent spawned per `execution/review.md` and returned a verdict — this headless seat does not start a nested writer. The review is in `review-log.md`.
- [x] All acceptance criteria from the Work Order and linked requirements are satisfied.
  - `npm test` (`node tests/test-copper-e2e.mjs`) exits 0.
  - 26 self-check assertions cover the four tracers.
  - The integrated walk runs TRACER-OCR-TRAP on real RapidOCR: a forged invoice is a 409 hold, and the clean invoice is a 200 match with 35 boxes.
- [SKIP] Architecture is aligned with linked blueprints, or documented drift is accepted — no blueprint body was available. Alignment is to the lineage contract and the existing kernel.
- [x] Exploratory pass on user-visible or external behavior.
  - Live loopback `GET /` returned the command desk.
  - The desk's `validateState` accepted the integrated snapshot.
  - `/docs` PDFs and the OCR PNG were served.
  - The default-port stack (:3590 + :3591) walked Steps 1-8.
  - No browser console capture (Playwright absent).
- [x] Latest `review-log.md` verdict is `APPROVED`

- [x] **Certification: Phase 3 complete. Proceeding to Final Completion.**

## Final Completion Check

- [x] All phase certifications above are complete
- [x] Checklist is fully filled out with evidence
- [x] Review log is complete (`review-log.md`)
- [x] Implementation plan was followed (`implementation-plan.md`)
- [x] All intended files are present in the working tree:
  - `tests/test-copper-e2e.mjs`, `package.json`
  - `src/lineage_core.mjs`, `src/sor_3panel_server.mjs`, `src/selfcheck.mjs`
  - `sidecar/invoice_ocr_engine.py`, `sidecar/test_invoice_ocr_engine.py`, `sidecar/README.md`
- [x] Work order status updated to `in_review` — local `context.md` only. Foundry was not updated (no MCP).
