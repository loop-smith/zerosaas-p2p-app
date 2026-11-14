<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-13

**Work Order:** SF WO-13 — Implement ZeroSaaS P2P White Enterprise Workbench & Brand Redesign (`97cb2858-1488-4b34-829c-b0162ea65be3`)
**Created At (UTC):** 2026-11-14T05:55Z

## Summary

The product owner rejected the dark `public/` desk delivered by `WO-04-A` on two grounds: its look and its name. The app is **ZeroSaaS P2P**, a headless procure-to-pay ERP, not a copper desk. The change went through the Software Factory loop instead of being patched directly:

- Validator Feedback `FB-3` (`0ce52256-27a7-4167-b1ea-ea9628ad7a00`) became Theme `THM-2` (`d3ab7474-57fa-40f0-9876-c0099c863806`), *ZeroSaaS P2P White Enterprise Workbench & Brand Change Order*.
- The Foundry extended `REQ-01` with `REQ-P2P-012`..`REQ-P2P-020` and updated `BP-01` with `ADR-006` (48px topbar and a 3-column white layout).
- The Planner minted `SF WO-13`, which this build implements.

This seat rewrites `public/index.html`, `public/styles.css` and the DOM layer of `public/app.js` from the WO-13 specification. It copies no external pre-event file. The server, kernel, routes and refusal codes are unchanged.

## Code Reuse And Package Structure

Inspected before editing:

- `public/app.js` — kept as-is: the exported transport, validation, voice and recorder logic (`validateState`, `safeDocumentUrl`, `request`, `refresh`, `runStep`, `speak`, `startRecording`, `stopRecording`, `REELS`, `REFUSALS`) and the private `probe`, `resetWorkflow`, push-to-talk and recorder cleanup paths. These are the guarded paths that `WO-04-A.f1.q` qualified. Rewritten: the static rows, `render`, the journal and trial-balance projection, the view switcher and `boot`.
- `src/sor_3panel_server.mjs` — read only. It serves `GET /api/state`, `POST /api/step/:n`, `POST /api/reset`, `GET /docs/:name` and the static `public/` files. No new route is needed.
- `src/lineage_core.mjs` — read only. `snapshot()` supplies `steps`, `item`, `po`, `scans`, `payment`, `documents`, `ocr`, `journal` (entries with `debitUsd`/`creditUsd` legs) and `sandbox.sources`.
- `public/command-desk.test.mjs`, `public/test_command_desk.py`, `public/test_browser_command_desk.py` — reused and extended. File names are kept because the task card runs `node public/command-desk.test.mjs` by path.
- `tests/test-copper-e2e.mjs` — reused. Only the page-title assertion changes (see Deviation).

Locked public signatures (unchanged exports of `public/app.js`): `validateState`, `REELS`, `REFUSALS`, `safeDocumentUrl`, `request`, `refresh`, `runStep`, `render`, `speak`, `startRecording`, `stopRecording`. One export is added: `trialBalance(snapshot)`. It is the pure journal projection that `render` uses for the right rail, exported so the node suite can check it against the real kernel. `speak` gains a muted path that returns `'muted'` without any network call.

Locked refusal codes the desk shows (server-owned, unchanged): `403 AI_STEWARD_ZERO_AUTHORITY`, `403 DOA_LIMIT_EXCEEDED`, `403 SOX_SOD_VIOLATION`, `409 MATCH_VARIANCE_HOLD`, `403 BANK_POLICY_VIOLATION`.

## Requirement Tracking

| ID | Requirement | Where | Evidence |
| --- | --- | --- | --- |
| R1 | `REQ-P2P-012` Light enterprise workbench: palette `--bg-app #f1f5f9`, `--bg-panel #ffffff`, `--bg-subtle #f8fafc`, `--border #e2e8f0`, `--text-main #0f172a`, `--blue #1d4ed8`, `--green #15803d`, `--amber #b45309`, `--red #b91c1c` | `public/styles.css` `:root` | `test_light_palette_and_three_column_shell` |
| R2 | `REQ-P2P-012` Brand strictly `ZeroSaaS P2P`; title `ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward`; zero `Copper Command Desk` text in `public/` | `public/index.html`, `public/app.js` | `test_brand_title_and_no_legacy_desk_name` |
| R3 | `REQ-P2P-012` 100vh zero-scroll shell: 48px topbar + `236px \| minmax(0, 1fr) \| 392px` grid | `public/styles.css` `.shell`, `.workbench` | `test_light_palette_and_three_column_shell` |
| R4 | Topbar: `[P2P]` badge, brand title, flow subtitle, live `GAAP DR == CR` pill, KAL mute toggle, push-to-talk Ask KAL, consent-gated Record, confirmation-gated Reset Queue (`POST /api/reset`) | `.topbar` | `test_topbar_controls_and_gates`; browser tests for consent and reset |
| R5 | Left rail: `Start KAL · P2P Steward`; 4 nav views with `Step N/8` and `WO 1-13` tags; WMS stocked item box; drawer triggers for `Guardrail Tests` and `GL & Audit Register` | `.rail-left` | `test_left_rail_views_item_and_drawers` |
| R6 | Center view 1: 8-step strip with the exact labels; active step action card; 4-reel GS1 scanner; 5 probe triggers; KAL `$0` banner; compact balance sheet and P&L | `[data-view-panel="flow"]` | `test_eight_step_strip_scanner_and_probes`; `command-desk.test.mjs` |
| R7 | Views 2, 3, 4: DB & GL Registers, SOX & Governance lenses, Software Factory WO-1..WO-13 lineage, each one screen | `[data-view-panel]` | `test_left_rail_views_item_and_drawers` |
| R8 | Right rail: 6-account live trial balance (`121100`, `201200`, `201100`, `501900`, `101100`, `101200`, DR == CR); 6-document packet trail; RapidOCR 28-box stage and modal viewer; wired only to `GET /api/state`, `POST /api/step/:n`, `GET /docs/:name` | `.rail-right` | `real server snapshots and client actions share the kernel contract` (node; trial-balance assertions after Check #10045); `test_right_rail_trial_balance_and_packet_trail` |
| R9 | Exported module API preserved; `tests/test-copper-e2e.mjs` still validates the integrated snapshot | `public/app.js` | `npm test` |
| R10 | `public/` tests assert brand, palette, layout, 4 views, 8-step strip and zero legacy name | `public/test_command_desk.py` | pytest |
| R11 | `.sw-factory/WO-13/` four files; README and trace document `FB-3`, `THM-2`, `REQ-P2P-012..020`, `ADR-006`, `SF WO-13`, the WO-04 title root cause, and T20 (`c1d69467`) closing WO-08 R10 | docs | review |
| R12 | No internal strings (local paths, seat names, session ids, internal org names) in changed files | all changed files | `test_no_internal_strings_in_public` plus a search of the docs |

## Deviation

`tests/test-copper-e2e.mjs` asserted `/Copper — Command Desk/` against `GET /`. R2 requires the new title, so that one assertion now matches the ZeroSaaS P2P title. Nothing else in the file changes, and all 12 red-team checks still run. The task card says the file should pass "unchanged". That cannot hold together with R2, so the conflict is recorded here and in the review log instead of being hidden by leaving the old title text somewhere in the page.

## Testing

- `npm test` (through a `python3` subprocess): sidecar reply 4/4, self-check 26/26, red-team 12/12.
- `node --test public/command-desk.test.mjs` (through a `python3` subprocess).
- `python3 -m pytest seeds sidecar public -q -p no:cacheprovider`.
- `python3 -m hara.blocks.configurator.manifest check --repo .` and `python3 -m pytest hara/blocks -q -p no:cacheprovider` from the task card. This repository has no `hara/` package, so both are expected to fail to run; the results are recorded, not claimed green.

## Concrete Acceptance Criteria

See R1–R12 above. Outcome per row is recorded in `review-log.md`.

## As Landed

- The plan was followed. Review Round 1 led to five render fixes:
  - The packet trail is driven by server step status; served PDFs only add the link marker.
  - Liabilities no longer show `-$0.00`.
  - Flow-strip labels wrap instead of truncating.
  - Polling pauses only while the reset or record confirmation is open.
  - The P&L standard cost comes from `item.stdTotalUsd`, and PPV reads "projected" until the dock receipt posts it.
- The balance sheet and P&L stay visible down to 680px of viewport height.
