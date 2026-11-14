# Implementation Plan: WO-04

## Summary
Deliver a dependency-free, one-screen Copper Command Desk in public/index.html, public/styles.css and public/app.js. The browser projects authoritative HTTP state; it never manufactures completed approvals, journal entries, OCR boxes or connected SoRs. Server and ElevenLabs proxy implementation are outside this lane.

## Code Reuse And Package Structure
Reuse contracts/p2p-lineage-contract.json for officer IDs, four 2,000-FT reel barcodes, five trade document filenames, locked $2.89/FT standard, eight steps and refusal codes. Reuse package.json ESM convention and standard browser fetch, Web Speech, MediaRecorder and AudioContext APIs. The checkout includes src/sor_3panel_server.mjs, src/lineage_core.mjs, src/selfcheck.mjs, tests/ and public/. Reuse startServer and its real kernel in temporary sandboxes; reuse validateState, request, accept, refresh, runStep, render, renderJournal and probe without adding a second adapter layer. hara/ is absent.
Maintain the existing public assets and tests. Update only the four WO-04 execution documents. Do not create a commit receipt, commit, push, change server files or other WOs.

## Components And Flow
Locked client contracts from src/sor_3panel_server.mjs and src/lineage_core.mjs (existing exported client signatures remain unchanged):
- GET /api/state -> native snapshot: steps:[{n,status}], scans:[{barcode,ft}], item:{onHandFt,stdTotalUsd}, po:{unitUsd,totalUsd,comex}, payment:{stamp,check,...}|null, journal:{balanced,debitUsd,creditUsd,entries:[{memo,legs:[{account,debitUsd,creditUsd}]}]}, sandbox:{sources:{wms,crm,hrm,coa},hledger}. Derive completed progress from steps[]. Keep missing documents/OCR unknown. Sources identify seed/bootstrap provenance, never live service health.
- POST /api/step/:n {actor,barcode?,bankAccount?,invoice?} -> {ok:true,state}; typed refusals are {ok:false,code,message}. Step 1 uses SYSTEM; human seats and remaining actors follow the kernel. Step 6 remains current until all four scan objects are returned and its status is complete. Invoice variance probes use invoice.totalUsd (invoiceDeltaUsd is not consumed by this kernel).
- POST /api/reset {} -> {ok:true,state}; requires a local confirmation dialog.
- POST /api/kal/speak {text} -> audio/*; absent/unconfigured proxy or non-audio response triggers immediate browser speech synthesis. Server owns ELEVENLABS_API_KEY and eleven_turbo_v2_5 selection; never expose keys in public assets.
- POST /api/kal/transcribe audio/webm -> {text}; push-to-talk prefers SpeechRecognition, with MediaRecorder/Scribe proxy fallback. Transcripts only request a spoken briefing; they cannot call workflow writes.
- Public testable functions: request(path, options), validateState(value), render(state), refresh(), runStep(step,actor,extra), speak(text), startRecording(), stopRecording(). Export validation, URL safety, refusal descriptions and the named transport/render/recorder functions for isolated tests; DOM boot is guarded for Node imports.
- Lock refusal codes: AI_STEWARD_ZERO_AUTHORITY (403), DOA_LIMIT_EXCEEDED (403), SOX_SOD_VIOLATION (403), MATCH_VARIANCE_HOLD (409), BANK_POLICY_VIOLATION (403). Preserve server codes and messages visibly. Red-team requests must receive their expected refusal; unexpected success is reported as a failure and state refreshed.
- Recorder requests display capture at ideal 60fps plus optional microphone, mixes available system/mic audio with AudioContext, saves an actual video/webm and stops every track on stop/error/page exit. Unsupported browsers receive an actionable status.

## Steps
1. Write focused failing tests for DOM hooks, snapshot validation, same-origin document safety, failure preservation and human/voice boundaries before UI implementation.
2. Implement CSS 100vh/100dvh overflow-hidden grid, left SoR/DOA/guardrails, center eight-step pipeline and four distinct checkpoint cards, right ledger/PDF/OCR viewer, KAL and recorder controls.
3. Wire asynchronous server snapshots, visible pending/error state, explicit actor gates, barcode entry, traps, reset, TTS/STT and recording lifecycle. Keep network work outside synchronous render.
4. Run fresh tests and manifest command, syntax checks, browser layout/HTTP checks if browser setup succeeds. Obtain isolated review, resolve defects, and record accurate limitations.

## Requirement Tracking
- R1: zero document scroll, three panels and all controls visible at desktop sizes; responsive compact layout.
- R2: four explicit local-source/absent-status indicators, six-officer DOA plus zero-authority KAL, reset and five red-team traps.
- R3: eight server-driven steps, four separate human gates; Marcus validates four unique 2,000-FT GS1 reels, Meredith explicitly releases Check #10045.
- R4: authoritative GAAP rows, five document links and invoice image overlay using real OCR coordinates (expected 28 boxes, never invented).
- R5: KAL proxy audio with Web Speech fallback, push-to-talk/Scribe, no voice-to-approval pathway.
- R6: 60fps-requested WebM screen/audio recorder with cleanup and download.
- R7: isolated tests, explicit missing integrations, changes only in fence and no version-control publication.

## Testing
Use public/test_command_desk.py to invoke the Node behavior suite and validate HTML/CSS integration, and public/command-desk.test.mjs for request/state/voice/recording behavior with controlled browser API boundaries, without mocking application functions. Run via python3 -m pytest public/test_command_desk.py -q -p no:cacheprovider. Run node --check through Python subprocess. Attempt required python3 -m hara.blocks.configurator.manifest check --repo . and python3 -m pytest hara/blocks -q -p no:cacheprovider exactly; report missing-package failures honestly. Run npm test and server syntax command through Python subprocess; the existing server must pass syntax and real HTTP integration checks. If available, exercise actual browser DOM and static HTTP server in a temporary root, measure desktop overflow and local render time, and check console/page errors. Do not write test artifacts or runtime data outside temporary roots or fence.

## Integration Limits
No Software Factory MCP tools are exposed; no linked requirement/blueprint contents can be retrieved, and no remote records will be changed. The five user-named local skill files are absent after searching local skill roots; use their supplied summaries. ui-glass routes /#/helm, /#/living-plan and /#/riff-room and app_server.py belong to a different absent application, so they cannot certify this UI. The real kernel schema/endpoints and financial enforcement can be exercised locally. Authenticated human identity, ElevenLabs/Scribe and real PDFs/OCR remain separate integration concerns. Browser tests can verify transport boundaries, never replace server governance verification.

## Prior Verification
Prior client-only fixture checks are recorded historically in review-log.md. They did not detect the real kernel API mismatch; the follow-up below supersedes their server integration claims. Existing server and kernel modules are present and are read directly for this repair. No proxy, API key or server governance implementation is placed in public/.

## Follow-up HARA-06.WO-04-A.f1 Plan
1. Reproduce the real GET validation failure and add a failing real-server client regression before production edits.
2. Align validation/rendering with the native snapshot, remove the invented state contract, route writes/probes to /api/step/:n, preserve typed refusal codes and wrapper acceptance.
3. Update boundary fixtures to the native schema; verify real server progress, partial scans, journal, payment, reset, refusal probes and absent SoR status in Node and Chromium.
4. Run fresh public tests, kernel E2E, requested HARA checks and fence audit; append an independent review and report accurate limitations. No rebase/landing/commit/push is authorized by the latest user instruction.

Follow-up requirements: F1 native snapshot acceptance/projection; F2 correct route/body/actor and typed refusals; F3 state wrappers and partial scans; F4 regression against real startServer with temporary state; F5 correct server documentation. Public signatures and five named refusal codes above are locked.

## Follow-up Verification And Requirement Evidence
- F1: Native validation and populated projections pass real-server Node and Chromium checks; sources show BOOTSTRAP/SEED or ABSENT, never fabricated LIVE health.
- F2: Real HTTP writes/probes use /api/step/:n and preserve kernel refusal messages. Step 1 uses SYSTEM; invoice probe uses invoice.totalUsd after complete dock receipt.
- F3: Real step/reset wrappers accepted; first three scans remain IN PROGRESS with Step 6 enabled, fourth completes; reset restores pending labels and clears payment/journal/scans.
- F4: Fresh combined pytest: 11 passed (10 Node cases inside the wrapper and 8 Chromium cases). Real-kernel populated render max 1.30ms; populated fixture plus 28-box overlay max 0.90ms. Actual WebM is 10,825 bytes and tracks stop. Native account/memo layout uses ellipsis with full text available in title, including at 960×640.
- F5: Current plan/context reflect the existing server/kernel. Historical review rounds are retained as history and superseded by the follow-up review.
- Kernel regression: tests/test-copper-e2e.mjs via Python subprocess passed 26 selfchecks plus 10 red-team checks. Required manifest failed (missing hara module); required hara/blocks pytest failed (missing path). No manifest/full-HARA green certification is claimed.
