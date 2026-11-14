<!--lint disable no-undefined-references strong-marker-->

# Work Order Execution Checklist: WO-04

**Work Order Number:** WO-04
**Work Order Title:** Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk (:3590 public/index.html), KAL ElevenLabs Voice Steward & WebM Recorder
**Initialized At (UTC):** 2026-11-14T02:48:07Z

## Phase 1: Context Gathering

### Required Steps

- [x] Review supplied task description and local WO-04 plan (MCP not exposed)
- [x] Identify local lineage contract and REQ-01 reference in context
- [SKIP] Review remote requirements — connector unavailable; only task and local contract can be read
- [SKIP] Review remote blueprints — connector unavailable; no blueprint content supplied
- [SKIP] Follow blueprint links — no blueprint documents or MCP available
- [SKIP] Review referenced blueprints — none retrievable in this checkout
- [x] Extract local acceptance criteria into R1–R7 in implementation-plan.md
- [x] Identify local client/server boundary from contract and sibling WO plans; blueprint verification unavailable
- [x] Update context.md directly with Python per shell restrictions and local evidence

- [x] **Certification: Phase 1 local context complete; remote context explicitly skipped.**

## Phase 2: Planning And Implementation

### Implementation Plan

(see `execution/writing-implementation-plans.md`)

- [x] Implementation plan documented in `implementation-plan.md`
- [x] Testing section documented in `implementation-plan.md`

### Implementation

- [x] Implemented changes are scoped to the WO-04 client fence; no receipt or publication
- [x] Tests added for client projection, transport, lifecycle, browser layout and capture; RED-to-GREEN evidence in review log
- [x] Plan, context and review evidence updated; isolated HTTP/media boundary fixtures added inside public/

- [x] **Certification: Phase 2 in-fence implementation complete.**

## Phase 3: Review And Verification

### Review

- [x] Independent wo04_review delegate returned client-only APPROVED after three review rounds
- [SKIP] Full external integration acceptance — native server/kernel now exercised by follow-up; live voice proxies, PDF/OCR delivery, remote blueprint access and HARA package remain unavailable
- [SKIP] Remote blueprint certification — no connector or blueprint content supplied; local contract alignment and explicit transport proposal reviewed
- [x] Actual Chromium HTTP/DOM, layout, screenshot inspection, 28-box dialog and real WebM checks passed; no unexpected page/console errors
- [x] Latest client review is APPROVED; full-WO integration blockers remain explicit in review-log.md

- [x] **Certification: Phase 3 client review/verification complete; full integration not certified.**

## Final Completion Check

- [x] All local phase certifications complete with integration limits and skip reasons recorded
- [x] Checklist fully filled with evidence and explicit skips
- [x] Review log complete with three rounds, test evidence and integration blockers
- [x] Implementation plan followed; boundary contracts and exports reflect final implementation
- [x] Intended client and execution files present; user forbids commit/push/own commit receipt
- [SKIP] Remote status update — Software Factory connector unavailable; local status is client ready for integration

## Follow-up HARA-06.WO-04-A.f1

- [x] Inspect existing target modules and real kernel callers/callees; list reuse, signatures, refusal codes and F1–F5 in plan before production edits
- [x] Reproduce hard schema/route failure against startServer in a temporary root; new real-server client regression fails RED before production edits
- [x] F1: Validate/render native steps, scans, journal report, item, po and payment; label local sources/absence accurately
- [x] F2: Route runStep/probes through /api/step/:n with kernel actors/body and typed refusal codes/messages
- [x] F3: Accept step/reset state wrappers; retain Step 6 until four unique scan objects and complete status; reset labels as well as classes
- [x] F4: Real-kernel Node test exercises eight steps, partial scans, refusals, payment and reset; real-server Chromium test exercises DOM/probes and absence
- [x] F5: Correct false missing-server claims in current plan/context and document remaining external integrations
- [x] Attempt required manifest/HARA pytest commands fresh and record missing module/path failures
- [SKIP] HARA green certification — hara package and hara/blocks path are absent from this checkout; cannot repair outside fence
- [SKIP] app_server.py and /#/helm, /#/living-plan, /#/riff-room verification — these belong to an absent application; verify actual Command Desk HTTP/DOM instead
- [x] Final combined public pytest passes: 11 tests, including real-server Node and Chromium flow; kernel regression passes 26 selfchecks plus 10 red-team checks
- [x] Real-kernel layout regression fixed at 960×640 and desktop sizes; local render max 1.30ms and no unexpected console/page errors
