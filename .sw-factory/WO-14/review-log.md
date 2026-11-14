<!--lint disable strong-marker-->

# Review Log: WO-14

**Work Order:** SF WO-14 — Implement ZeroSaaS P2P Interactive Parity (Voice Steward, Dock RF Scanner, RapidOCR BBox & CFO Check View)
**Initialized At (UTC):** 2026-11-14T06:34Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

An independent read-only review subagent traced the `public/app.js`, `public/index.html` and `public/styles.css` diff against the unchanged kernel `snapshot()`. It checked runtime errors, logic, security and one-screen layout. This seat reviewed the tests and documentation, then fixed every finding below.

### Requirements Alignment

R1–R12 are derived from the Work Order title (see `context.md`). No Planner acceptance text was delivered.

| ID | Result | Evidence |
| --- | --- | --- |
| R1 voice write verbs refused, no network | Met | node: 15 phrasings mapped, including "Approve payment now", "Issue the PO" and "Reset the queue" ➔ `refuse`; the reply names the next officer; `fetch` called 0 times |
| R2 voice replies from the server snapshot | Met | node unit cases; the real-kernel walk asserts the dock reply after 4 reels and the check reply `Check #10045 paid $21,600.00 to Encore Wire Corporation from Operating Checking #8801.` |
| R3 steward session narration | Met (reviewed, not executed) | Reviewer traced `accept()` for step advances, dock reels (step 6 stays `in_progress`) and resets |
| R4 voice moves are read-only | Met | `test_wo14_voice_rf_ocr_and_check_controls`; the reviewer confirmed that `refuse` and `status` have no move |
| R5 RF parser and local refusals | Met | node "RF wedge reads…"; real-kernel `DUPLICATE_SCAN` for `]C1…R01\r` after receipt |
| R6 keyboard wedge | Met (not executed) | Capture-phase listener; browser test types the fourth reel with no focused field |
| R7 RF readout | Met (not executed) | Browser test `#rf-feet` = `8,000 / 8,000 FT · 3,288 lbs Cu`, `#rf-last` ✓/✕ |
| R8 OCR field tagging | Met | **Real RapidOCR** in `tests/test-copper-e2e.mjs`: vendor, `PO-25800`, `8000`, `2.70`, `21600.00`; node single-line, squeezed and split-box cases |
| R9 OCR viewer list and selection | Met (not executed) | Static ids; browser test checks 5 field rows and `Box 2: “Field 2”` |
| R10 CFO check view | Met | node `checkWords`; real kernel `checkWords(paid.payment.amountUsd)`; reviewer confirmed `#sign-check` is enabled only when connected, not pending, at 7/8; static test that it calls `authorize(8)` ➔ `runStep(8)` with `bankAccount: '101100'` |
| R11 server contract unchanged | Met | `test_server_contract_only…`; `git diff --stat` shows no `src/` change; reviewer found no new write path and no `innerHTML` |
| R12 lineage and docs | Met | `WO 1-14`, WO-1..WO-14 rows; internal-string scan now covers `.sw-factory/WO-14/` |

**Blocking:** none.

### Findings From The Independent Review (all addressed in this round)

The reviewer found **no blocking defects**:

- Every id the DOM layer reads exists.
- Every snapshot field name matches the kernel after `usdView`.
- Server strings reach only `textContent`, `title` and `aria-label`.
- The OCR image `src` still goes through `safeDocumentUrl`.

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | should-fix | With focus on Ask KAL, an RF burst's Enter reached the mic's own key handler first and started push-to-talk | The wedge listener runs in the capture phase and consumes a burst's Enter (`preventDefault` + `stopPropagation`) |
| 2 | should-fix | Holding Enter on Ask KAL leaked auto-repeat Enter. A `dock` voice reply then focused `#barcode`, and a held key could submit a scan | Ask KAL swallows repeat Space/Enter; the barcode and wedge handlers ignore `event.repeat`; the `dock` voice move no longer focuses `#barcode` |
| 3 | should-fix | The OCR viewer rebuilt all box and field buttons on every 15 s poll while open, which lost keyboard focus | `renderOcr` rebuilds only when the image, hash, size or boxes change; otherwise it re-applies the selection |
| 4 | nit | A read during a pending scan was dropped silently | The wedge stays armed at Step 6 while a scan is pending; such a read reaches `scan()` and shows `✕ NOT SENT` |
| 5 | nit | An old RF message could reappear in a new run after a reset | `rfLast` is cleared when the server's step count goes down |
| 6 | nit | "issue" and "reset" in questions were refused | Narrowed to write phrases (`reset the queue/run/workflow`, `issue the PO/check/payment`); "Is there any issue with the reset?" ➔ `status` (node case) |

**Layout (estimated by the reviewer, not measured).**

- At 1280×720, the new RF readout line could overflow the center column by 0–10px at Step 7; 1024×768 is also tight. 1440×900 and 1366×768 have 40px or more to spare. The right-rail `View ↗` button and the extra factory row are low risk.
- Response: `@media (max-height: 780px)` now trims center padding and gaps by about 15–20px.
- `public/test_browser_command_desk.py` now checks the one-screen bounds at Step 6 and Step 7 at all four desktop sizes. Before, it checked only Step 0 and Step 8.
- These checks have **not been executed** (see User-Facing Verification).

### Architecture And Conventions

- The server, kernel, routes and refusal codes are unchanged. `src/` is untouched.
- The 12 existing exports are unchanged. Five pure exports were added: `stewardIntent`, `stewardReply`, `parseReelScan`, `tagOcrFields`, `checkWords`.
- `briefing()` is now `stewardReply('status', …)`, so one code path produces the KAL status text.
- The OCR tagger reuses the sidecar parser's label rules instead of a second format.
- Lean delta, from `git diff --stat HEAD`, before this log: 9 tracked files, about +470 / −67. Most of it is `public/app.js` (+~200 net, for four features) and tests.

**Blocking:** none.

### Tests And Build

**Commands run fresh on the final tree:**

| Command | Result |
| --- | --- |
| `node --test public/command-desk.test.mjs` (through `python3`) | 15 pass, 0 fail (11 before this WO) |
| `node tests/test-copper-e2e.mjs` (through `python3`) | Exit 0. Self-check 26/26, red-team 12/12, including the new real-RapidOCR field-tagging assertion |
| `node tests/test-sidecar-reply.mjs` (through `python3`) | Exit 0, 4 passed |
| `python3 -m pytest seeds sidecar public -q -p no:cacheprovider` | 74 passed, 1 skipped (the Playwright module). Baseline before this WO: 73 passed, 1 skipped |
| `git diff --check HEAD` | Clean |
| `python3 -m hara.blocks.configurator.manifest check --repo .` | Exit 1, `No module named 'hara'` |
| `python3 -m pytest hara/blocks -q -p no:cacheprovider` | Exit 4, `hara/blocks` not found; no tests ran |

The two HARA commands cannot pass until that package exists in this repository. They are **not** claimed green.

**Red evidence:**

- The five new exports and the `rf-last`, `check-dialog`, `ocr-fields` and `sign-check` ids are absent from `HEAD`'s `public/app.js` and `public/index.html`.
- The first version of the tagger failed the e2e assertion against real RapidOCR. It returned `{"vendor":"EncoreWireCorporation","po":null,"quantity":null,"unit":null,"total":null}` because RapidOCR drops inter-word spaces. The label rules were aligned with `sidecar/invoice_ocr_engine.py`, and the run went green.

### User-Facing Verification

- The integrated e2e run boots the real kernel and the real RapidOCR sidecar, and tags the five fields on the served invoice's OCR boxes.
- The node client suite drives the real kernel through all 8 steps and checks the voice, RF and check projections.

**Skipped:** a live browser render and console capture. Playwright and all browser binaries are absent in this lane, so `public/test_browser_command_desk.py` skips. It was extended for:

- the unknown-reel refusal, the AIM prefix and the wedge burst;
- the RF readout;
- the OCR field list and selection;
- signing from the check view;
- the Step 6 and Step 7 one-screen bounds.

**It has not been executed.**

**Blocking:** none inside this fence. Run the browser module where Playwright is installed, and treat its 1024×768 and 1280×720 bounds checks as the layout gate.

### Security, Privacy, And Data Safety

- No new route or write path. Voice cannot write: write verbs return text only, and voice moves only open views or viewers.
- Malformed RF reads are refused before any write; the server still decides every scan that is sent.
- `#sign-check` is the existing Step 8 write, with the same actor and bank account as the step card.
- Server text is set only through `textContent`, `title` and `aria-label`. The OCR image stays behind `safeDocumentUrl`.
- `validateState` now also rejects a non-object `match` and a negative or non-finite `match.varianceUsd`.
- The beep `AudioContext` is closed on `pagehide`.
- Tests ran in temporary sandboxes. No receipt file was written.

**Blocking:** none.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 3:
  - The requirements are derived from the title only.
  - The browser module, including the new mid-run layout bounds, was not executed in this lane.
  - There is no blueprint or requirement body to align against (no MCP).
- Files changed:
  - `public/app.js`, `public/index.html`, `public/styles.css`
  - `public/command-desk.test.mjs`, `public/test_command_desk.py`, `public/test_browser_command_desk.py`
  - `tests/test-copper-e2e.mjs`
  - `README.md`, `docs/software-factory-trace.md`
  - `.sw-factory/WO-14/{context.md,implementation-plan.md,checklist.md,review-log.md}`
- **Verdict:** APPROVED

The verdict covers the in-fence build of `SF WO-14`. It is not the `WO-14.q` Qualify Review. It does not say the absent HARA package checks passed, and it does not certify a live browser render.

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
