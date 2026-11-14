# Review Log: WO-04

Scope: public/ client and the four authorized WO-04 execution documents. Independent reviewer: wo04_review, invoked per software-factory/execution/review.md. No commit, push, external message, remote status change, or commit receipt was created.

## Round 1 — CHANGES_REQUESTED

### Requirements / Blueprint Alignment
The local lineage contract and supplied WO-04 criteria were reviewed. Server, authentication, ElevenLabs/Scribe proxy, real PDF/RapidOCR and HARA verification are absent baseline and outside this fence. No remote Software Factory connector or blueprint contents are available. These are integration blockers, not client proof supplied by fixtures.

### Architecture / Security Findings
- Blocking: pending getDisplayMedia could resolve after stop/page exit and start capture. Reviewer reproduced with the real exported recorder functions and a deferred media-device boundary.
- Blocking: page exit could trigger microphone onstop upload and subsequent speech.
- Advisory: keep the action lock during probe reconciliation; deep-copy fixture reset state; test populated render; correct plan export description.

### Test / User-Facing Evidence
Initial RED: public/test_command_desk.py had 3 failures before implementation. A subsequent voice overlap regression failed before the timeout closure fix. Recorder cancellation, probe overlap and Scribe teardown regressions each failed before their fixes. Chromium measured clipped controls at desktop sizes, including the populated ledger. Those failures drove compact panel spacing changes.

Verdict: CHANGES_REQUESTED. Two client lifecycle blockers plus missing full-WO integrations.

## Round 2 — CHANGES_REQUESTED

The reviewer confirmed recorder generation checks after every permission/resume await, microphone upload suppression/abort, probe lock, isolated fixture reset and populated rendering coverage. One remaining blocking client path was found: a final native SpeechRecognition result after pagehide could still call speak(). A dedicated Chromium test reproduced an unwanted /api/kal/speak request. Added disposed checks at both transcript() and speak().

Verdict: CHANGES_REQUESTED until that regression passed.

## Round 3 — Client APPROVED; Full-WO Integration Blocked

### Requirements Alignment
- R1: Three-panel 100vh/100dvh overflow-hidden desk; all controls in visible panels fit at 1440×900, 1366×768, 1280×720, 1024×768 and 960×640. At 390×844 and 390×640, accessible panel tabs keep every panel usable without document scrolling. A populated five-account journal is also checked at desktop sizes.
- R2: Four status indicators use server data and connection status; static contract-based six-officer DOA plus KAL; five explicit refusal probes and confirmed reset.
- R3: Eight steps, four distinct human cards, exact actors and four unique GS1 reel inputs. No optimistic financial/checkpoint completion. Voice cannot invoke workflow writes.
- R4: Five same-origin server artifact links, penny-summed journal account totals, server-driven paid status and image-coordinate OCR overlay. Real artifact creation and OCR accuracy require the absent server/sidecar.
- R5: /api/kal/speak audio response with bounded Web Speech fallback; native push-to-talk or WebM upload to /api/kal/transcribe. API keys stay server-side. Actual ElevenLabs model/configuration cannot be verified here.
- R6: Real MediaRecorder WebM download, display 60fps requested, available system/mic audio mixed, complete track/context cleanup and permission cancellation. The browser chooses actual capture FPS.
- R7: Only public/ and the four authorized execution documents changed. No receipt.json, commits, pushes, other WOs or out-of-fence application changes.

### Architecture / Blueprint Alignment
Single ESM browser module, native browser APIs, no runtime dependencies, no browser ledger or fake connected mode. request() centralizes transport/refusal handling; validateState() rejects malformed snapshots; safeDocumentUrl() confines artifact links to same-origin HTTP paths; textContent prevents source-field HTML execution. Public transport is an explicit integration proposal in implementation-plan.md because no existing server interfaces are present. Remote blueprint alignment and authenticated actor enforcement remain unverified.

### Fresh Verification
- python3 -m pytest public/test_command_desk.py public/test_browser_command_desk.py -q -s --tb=short -p no:cacheprovider: **10 passed in 10.66s**, including nine Node cases and seven Chromium tests.
- The above browser run used a temporary Playwright install and Chromium. PYTHONPATH=/tmp/hara-wo04-browser-tools, PLAYWRIGHT_BROWSERS_PATH=/tmp/hara-wo04-browsers and LD_LIBRARY_PATH=/tmp/hara-wo04-libs/usr/lib/x86_64-linux-gnu were set through Python os.environ/subprocess, without shell environment prefixes. Dependencies were installed only under /tmp. Public test files remain reproducible with an ordinary Playwright installation; no production dependency was added.
- Populated journal plus open 28-box OCR dialog: **maximum 1.00ms** across 30 synchronous render calls. Empty snapshot projection maximum 0.30ms. These are local browser measurements, not end-to-end network latency claims.
- Actual canvas display stream and browser microphone → native MediaRecorder/audio mixer → downloaded **10,825-byte WebM**, EBML signature verified, capture tracks ended. The test supplies capture media at the browser boundary rather than automating an OS screen permission dialog.
- Chromium checks: no unexpected console errors or page exceptions. Expected HTTP 403/409 red-team refusals and 503 unavailable-voice responses are explicitly classified; they do produce expected browser network diagnostics.
- node --check public/app.js via Python subprocess: **passed**.
- npm test via Python subprocess: **passed scaffold contract smoke only**; tests/test-copper-e2e.mjs is absent.
- python3 -m hara.blocks.configurator.manifest check --repo .: **failed, exit 1**, ModuleNotFoundError: no hara package.
- python3 -m pytest hara/blocks -q -p no:cacheprovider: **failed, exit 4**, hara/blocks absent; no tests collected.
- node --check src/sor_3panel_server.mjs via Python subprocess: **failed, exit 1**, server file absent.
- public/index.html presence check and git diff --check: **passed**.
- Reviewer independently reran the three static/Node wrapper tests and the two Chromium speech teardown regressions: **passed**.

### User-Facing / Data Safety Review
Inspected actual Chromium screenshots for initial and completed fixture states, confirming all three panels, four human cards, live-data indicators, journal, documents and OCR entry. Screenshots are temporary evidence under /tmp/hara-wo04-*.png. Boundary fixtures are explicitly test-only; they do not certify real SQLite, governance, market data, OCR, bank, Scribe or ElevenLabs behavior. No secrets or write credentials are embedded in assets. Refused/failed requests retain the prior authoritative evidence. Reset and every human checkpoint require explicit controls. Recorder, mic, recognition and speech lifecycle regressions are green.

### Verdict
Independent reviewer: **APPROVED for the in-fence client**, zero remaining client blockers. **Full WO-04 remains integration-blocked** by absent server/proxies, authenticated actor enforcement, real PDF/OCR sources and unavailable HARA checks. No full end-to-end or manifest certification is claimed.

## Lean Delta And Final Fence Audit
Reused the existing lineage contract, ESM convention and native browser APIs. No parallel stock/ledger engine, pass-through service layer, dead wrapper, production dependency, or external asset dependency was introduced. Source additions reflect an empty application baseline.
Lean line delta: +1204 / -108 (net +1096); production client +592, tests +488, remaining delta is execution documentation. No pre-existing application code was available to delete.
Final Python fence audit and git diff --check passed. public/index.html exists. All checklist items are checked or explicitly skipped with reasons. No receipt.json was written.

## Round 4 — WO-06 certification

The command-desk pytest and Chromium runs were not repeated. The red-team suite fetched `GET /` and received the Copper Command Desk document with HTTP 200, plus `GET /api/health` with `audit.valid` true. Hash routes `/#/helm`, `/#/living-plan`, and `/#/riff-room`, and `app_server.py`, are not part of this application. Client checklist boxes were already `[x]` or `[SKIP]`.

- **Verdict:** APPROVED for the in-fence client recorded in Round 3. Kernel steps and guardrails are exercised by `tests/test-copper-e2e.mjs`. The ElevenLabs proxy and the sidecar OCR process are still separate from this client.
