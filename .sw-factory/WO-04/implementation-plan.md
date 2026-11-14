# Implementation Plan: WO-04

## Summary
Deliver a dependency-free, one-screen Copper Command Desk in public/index.html, public/styles.css and public/app.js. The browser projects authoritative HTTP state; it never manufactures completed approvals, journal entries, OCR boxes or connected SoRs. Server and ElevenLabs proxy implementation are outside this lane.

## Code Reuse And Package Structure
Inspected the entire checkout before implementation. Reuse contracts/p2p-lineage-contract.json for officer IDs, four 2,000-FT reel barcodes, five trade document filenames, locked $2.89/FT standard, eight steps and refusal codes. Reuse package.json ESM convention and standard browser fetch, Web Speech, MediaRecorder and AudioContext APIs. There are no existing application modules/functions to import or extract: src/, public/, tests/ and hara/ are absent.
Create public/index.html, public/styles.css, public/app.js, public/test_command_desk.py and public/command-desk.test.mjs. Update only the four WO-04 execution documents. Do not create a commit receipt, commit, push, change server files or other WOs.

## Components And Flow
Locked client contracts (integration proposal because no server implementation exists in this checkout):
- GET /api/state -> {step:0..8, systems:{wms,crm,hrm,ledger:{ok:boolean,detail?:string}}, journal:[{account,description,debit,credit}], documents:[{name,url}], ocr:{imageUrl,width,height,boxes:[{text,x,y,width,height}]}, scans:[barcode], stockFt, unitPriceUsd, totalUsd, paid, revision}. Missing fields remain unknown; no fabricated live data.
- POST /api/step {step:1..8,actor:string,barcode?:string,bankAccount?:string,invoiceDeltaUsd?:number} -> state or {state}. Each human checkpoint requires an explicit click. Darius confirms/escalates Step 2 rather than approving beyond his cap. Step 6 submits one exact GS1 barcode at a time as EMP-0003. Step 8 uses EMP-0007 and account 101100.
- POST /api/reset {} -> state; requires a local confirmation dialog.
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
- R2: four real-status indicators, six-officer DOA plus zero-authority KAL, reset and five red-team traps.
- R3: eight server-driven steps, four separate human gates; Marcus validates four unique 2,000-FT GS1 reels, Meredith explicitly releases Check #10045.
- R4: authoritative GAAP rows, five document links and invoice image overlay using real OCR coordinates (expected 28 boxes, never invented).
- R5: KAL proxy audio with Web Speech fallback, push-to-talk/Scribe, no voice-to-approval pathway.
- R6: 60fps-requested WebM screen/audio recorder with cleanup and download.
- R7: isolated tests, explicit missing integrations, changes only in fence and no version-control publication.

## Testing
Use public/test_command_desk.py to invoke the Node behavior suite and validate HTML/CSS integration, and public/command-desk.test.mjs for request/state/voice/recording behavior with controlled browser API boundaries, without mocking application functions. Run via python3 -m pytest public/test_command_desk.py -q -p no:cacheprovider. Run node --check through Python subprocess. Attempt required python3 -m hara.blocks.configurator.manifest check --repo . and python3 -m pytest hara/blocks -q -p no:cacheprovider exactly; report missing-package failures honestly. Run npm test and server syntax command through Python subprocess; an absent server is an integration blocker. If available, exercise actual browser DOM and static HTTP server in a temporary root, measure desktop overflow and local render time, and check console/page errors. Do not write test artifacts or runtime data outside temporary roots or fence.

## Integration Limits
No Software Factory MCP tools are exposed; no linked requirement/blueprint contents can be retrieved, and no remote records will be changed. The five user-named local skill files are absent after searching local skill roots; use their supplied summaries. ui-glass routes /#/helm, /#/living-plan and /#/riff-room and app_server.py belong to a different absent application, so they cannot certify this UI. Actual server state schema/endpoints, authenticated human identity, ElevenLabs/Scribe, real PDFs/OCR and financial enforcement require integration with the server lane. Browser tests can verify transport boundaries, never replace server governance verification.

## Delivered Verification And Review
Implemented the planned three-panel client, four explicit gates, safe evidence projection, voice/STT and recording lifecycle. Added public/test_browser_command_desk.py for actual Chromium checks, including compact populated layouts, reset, all refusal probes, real WebM, microphone teardown, late native recognition and probe reconciliation. All 10 combined pytest tests passed fresh; nine Node cases execute within the wrapper test. Local projection max 1.00ms with populated journal and open 28-box overlay. Independent client-only review APPROVED. Missing server/HARA/remote blueprint verification remains an integration blocker, not a waived green check. No server proxy, API key or server governance implementation was placed in public/.
