<!--lint disable strong-marker-->

# Review Log: WO-13

**Work Order:** SF WO-13 — Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign (`97cb2858-1488-4b34-829c-b0162ea65be3`)
**Initialized At (UTC):** 2026-11-14T05:55Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

An independent read-only review subagent checked the rewritten `public/index.html`, `public/styles.css` and `public/app.js`. It traced `boot()` and `render()` for four cases: no snapshot, a fresh real-kernel snapshot, a fully paid snapshot, and a disconnect after a prior snapshot. It then checked them against the WO-13 acceptance text. This seat reviewed the tests and documentation.

### Requirements Alignment

| ID | Result | Evidence |
| --- | --- | --- |
| R1 palette | Met | `test_light_palette_and_three_column_shell` checks all nine values and that the dark palette is gone |
| R2 brand, title, no legacy name | Met | `test_brand_title_and_no_legacy_desk_name`: exact `<title>`; no legacy name in any `public/` file; no "command desk" in any form in the three UI files |
| R3 shell | Met | 48px topbar; `236px \| minmax(0, 1fr) \| 392px`; `height: 100vh`; `overflow: hidden` |
| R4 topbar | Met | `[P2P]` badge, brand, flow line, `GAAP DR == CR` pill, mute, Ask KAL, Record behind `#record-dialog`, Reset Queue behind `#reset-dialog` ➔ `POST /api/reset` |
| R5 left rail | Met | Start KAL; 4 views with exact labels, `Step N/8` and `WO 1-13` tags; ITM-CU-20-BARE box with live `#stock`; Guardrail Tests and GL & Audit Register drawers |
| R6 center view 1 | Met | Exact 8 labels with gates on 2/3/6/8; step card; 4 reel buttons + wedge input; 5 probes with the specified labels; KAL `$0.00` banner; balance sheet + P&L |
| R7 views 2–4 | Met | Registers (SoR, signing limits, GL account register), SOX lenses with live probe outcomes, Software Factory WO-1..WO-13 table |
| R8 right rail | Met | Real-kernel node test: `121100` DR 23,120.00; `501900` CR 1,520.00; `101100` CR 21,600.00; `201200`, `201100` and `101200` at zero; DR == CR. Packet trail and 28-box viewer are present |
| R9 API preserved | Met | All 11 exports kept; `trialBalance` added; `npm test` 12/12 red-team |
| R10 public tests | Met | `public/test_command_desk.py` has 10 tests |
| R11 docs | Met | `README.md`, `docs/software-factory-trace.md`, `.sw-factory/WO-13/` |
| R12 no internal strings | Met | `test_no_internal_strings_in_published_files` scans `public/`, README, trace and this directory |

**Blocking:** none.

**Advisory:** the e2e title assertion changed; see Deviation in `implementation-plan.md`.

### Findings From The Independent Review (all fixed in this round)

The reviewer found **no runtime errors**. Every id `$()` reads exists, `cells[1]`/`cells[2]` index the `th`+2×`td` trial-balance rows, and every optional access is guarded. It also confirmed that pending locks, probe reconciliation, reset, recording cleanup and push-to-talk match the qualified code.

| # | Finding | Fix |
| --- | --- | --- |
| 1 | Liability rows on the balance sheet showed `-$0.00` | `(… ) \|\| 0` before formatting |
| 2 | Packet states followed PDF availability, not workflow progress (with the OCR sidecar, all five PDFs arrive at Step 5) | Each packet is driven by its server step (4, 5, 6, 7, 8); a served PDF only adds `PDF ↗` |
| 3 | Flow-strip labels were truncated with an ellipsis at 1440 and 1280 | Labels wrap |
| 4 | The 15 s poll paused while any dialog was open, so the drawers and the OCR viewer went stale | The poll pauses only for the reset and record confirmations |
| 5 | The P&L standard cost was hard-coded, and PPV showed before it was posted | `#std-total` reads `item.stdTotalUsd`; PPV reads "projected until dock receipt" before Step 6 |

This seat found one more problem while fixing #2: `classList.toggle('ready', undefined)` flips the class instead of clearing it when there is no snapshot. The flag is now forced to a boolean.

### Architecture And Conventions

- Server, kernel, routes and refusal codes are unchanged.
- The client reads `GET /api/state` and `GET /docs/:name`, and writes only `POST /api/step/:n` and `POST /api/reset`. `test_server_contract_only_and_no_embedded_secrets_or_remote_dependencies` asserts the `request()` routes.
- The guarded functions are carried over from the qualified client: `validateState`, `request`, `refresh`, `runStep`, `probe`, `resetWorkflow`, voice and recorder. The changes are user-facing strings, the `muted` early return in `speak`, and probe outcome logging.
- Lean delta, from `git diff --stat`:

  | File | Delta |
  | --- | --- |
  | `public/app.js` | +179 / −74 (rewritten DOM layer) |
  | `public/index.html` | +193 / −46 |
  | `public/styles.css` | +199 / −86 |
  | `public/test_command_desk.py` | +189 / −30 |
  | `public/test_browser_command_desk.py` | +106 / −97 |
  | `public/command-desk.test.mjs` | +18 / −1 |
  | `tests/test-copper-e2e.mjs` | +2 / −2 |
  | `README.md` | +31 / −8 |
  | `docs/software-factory-trace.md` | +43 / −10 |

  Total: 9 tracked files, +960 / −354, plus the new `.sw-factory/WO-13/`.

**Blocking:** none.

### Tests And Build

**Commands run fresh on the final tree:**

| Command | Result |
| --- | --- |
| `npm test` (through a `python3` subprocess) | Exit 0. Sidecar reply 4/4, self-check 26/26, red-team 12/12, including "ZeroSaaS P2P workbench and JSON reads answer on the loopback server" |
| `node tests/test-sidecar-reply.mjs` | Exit 0, 4 passed |
| `node public/command-desk.test.mjs` | 11 pass, 0 fail |
| `node --test public/command-desk.test.mjs` | 11 pass, 0 fail |
| `python3 -m pytest seeds sidecar public -q -p no:cacheprovider` | 73 passed, 1 skipped. The skip is the Playwright browser module. Baseline before this WO: 66 passed, 1 skipped |
| `git diff --check HEAD` | Clean |
| `python3 -m hara.blocks.configurator.manifest check --repo .` | Exit 1, `No module named 'hara'` |
| `python3 -m pytest hara/blocks -q -p no:cacheprovider` | Exit 4, `hara/blocks` not found; no tests ran |

The two HARA commands cannot pass until that package exists in this repository. They are **not** claimed green.

**Red evidence:**

- The new brand and legacy-name assertions fail against `git show HEAD:public/index.html`: the old title and `aria-label` both match.
- The DOM-id contract test failed during development until its extraction covered the ids that `querySelectorAll` reaches.

**Blocking:** none.

### User-Facing Verification

- `npm test` boots the real server and asserts that `GET /` serves `<title>ZeroSaaS P2P · Headless Stock-to-Pay ERP &amp; KAL Steward</title>`.
- The node client suite drives the real kernel through all 8 steps and the trial balance.

**Skipped:** a live browser render and console capture.

- Playwright and every Chromium/Firefox binary are absent in this lane, so `public/test_browser_command_desk.py` skips.
- That file was rewritten for the new DOM: the 1440×900 down to 1024×768 one-screen bounds, the 48px topbar, the 236/392 columns, the 4 views, the reel scanner, the consent and reset gates, the guardrail drawer, and the trial-balance values. **It has not been executed.**
- Layout fit was estimated by the reviewer and by this seat, not measured: about 680 of 828px used in the right rail at 1440×900, and about 630 of 652px at 1280×720.

**Blocking:** none inside this fence. Run the browser module where Playwright is installed.

### Security, Privacy, And Data Safety

- `safeDocumentUrl` still gates every document link and the OCR image.
- Server-supplied text is set only through `textContent`.
- No route, guard or credential path changed.
- `test_no_internal_strings_in_published_files` scans every changed published file for local paths and internal org names.
- Tests ran in temporary sandboxes. No receipt file was written.

**Blocking:** none.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 3. These are: the e2e title assertion deviation; the browser module not executed in this lane; no `BP-01`/`ADR-006` body to align against (no MCP).
- Files changed: `public/index.html`, `public/styles.css`, `public/app.js`, `public/command-desk.test.mjs`, `public/test_command_desk.py`, `public/test_browser_command_desk.py`, `tests/test-copper-e2e.mjs`, `README.md`, `docs/software-factory-trace.md`, `.sw-factory/WO-13/{context.md,implementation-plan.md,checklist.md,review-log.md}`
- **Verdict:** APPROVED

The verdict covers the in-fence build of `SF WO-13`. It is not the `WO-13.q` Qualify Review, it does not say the absent HARA package checks passed, and it does not certify a live browser render.

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
