<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-14

**Work Order:** SF WO-14 — Implement ZeroSaaS P2P Interactive Parity (Voice Steward, Dock RF Scanner, RapidOCR BBox & CFO Check View)
**Created At (UTC):** 2026-11-14T06:34Z

## Summary

On the `WO-13` workbench, each of the four parts named in the title was static or display-only:

- KAL read one fixed briefing, whatever was asked.
- The dock scanner was four buttons and a text field with no feedback.
- The OCR viewer drew unlabelled boxes.
- Check `#10045` was a single line in the packet trail.

This build makes each part interactive. Every part reads only the server snapshot, and none of them adds a write path. The server, kernel, routes and refusal codes are unchanged. `src/` is inside the fence but needed no change.

## Code Reuse And Package Structure

Inspected before editing:

- `public/app.js`: reused `validateState`, `request`, `runStep` (step 6 barcode and step 8 `bankAccount: '101100'` guards), `speak`, `stopVoice`, the push-to-talk `transcript` path, `trialBalance`, `safeDocumentUrl`, `render`, `renderOcr`, `setView`, and the dialog opener/closer tables. `briefing()` becomes `stewardReply('status', …)`. The officer table gains employee ids so replies can name the next officer.
- `src/lineage_core.mjs` (read only):
  - `snapshot()` supplies `vendor`, `scans[{barcode, ft, actor, at}]`, `match{po, bol, invoice, varianceUsd, source}`, `payment{check, ach, bankAccount, bankLabel, amountUsd, approvedBy, stamp}` and `ocr.boxes[{text, confidence, x, y, width, height}]`.
  - `dockScan` refusal codes: `NO_BARCODE`, `UNKNOWN_REEL`, `DUPLICATE_SCAN`.
- `sidecar/invoice_ocr_engine.py` (read only): the invoice row labels (`VENDOR:`, `PURCHASE ORDER:`, `QUANTITY FT:`, `UNIT PRICE USD:`, `TOTAL DUE USD:`) and the amount parser. That parser allows missing spaces between label words and an ASCII or full-width colon. The client tagger uses the same rules.
- `contracts/p2p-lineage-contract.json` (read only): `822 lbs` per reel (`3,288 lbs` net), the vendor name and the settlement references.
- Tests reused and extended: `public/command-desk.test.mjs`, `public/test_command_desk.py`, `public/test_browser_command_desk.py` and `tests/test-copper-e2e.mjs`.

Locked public signatures: all 12 existing exports of `public/app.js` are unchanged. Five pure exports are added:

- `stewardIntent(text)`, which returns `refuse | check | invoice | dock | ledger | governance | status`.
- `stewardReply(intent, snapshot | null)`.
- `parseReelScan(raw, scans)`, which returns `{code, error}`. `error` is one of `NO_BARCODE | UNKNOWN_REEL | DUPLICATE_SCAN | null`.
- `tagOcrFields(ocr)`, which returns `[{key, label, indices, value}]` for `vendor | po | quantity | unit | total`.
- `checkWords(amountUsd)`.

Locked refusal codes (server-owned, unchanged): `403 AI_STEWARD_ZERO_AUTHORITY`, `403 DOA_LIMIT_EXCEEDED`, `403 SOX_SOD_VIOLATION`, `409 MATCH_VARIANCE_HOLD`, `403 BANK_POLICY_VIOLATION`. The RF parser mirrors the server's `NO_BARCODE`, `UNKNOWN_REEL` and `DUPLICATE_SCAN` locally. The server still decides every scan that is sent.

## Requirement Tracking

These rows are derived from the title (see `context.md`). They are not quoted from Planner acceptance text.

| ID | Requirement | Where | Evidence |
| --- | --- | --- | --- |
| R1 | Voice steward: write verbs (approve, sign, pay, release, post, reset, scan, receive, issue, lock …) map to a `$0.00` refusal that names the next human officer, with no network call | `stewardIntent`, `stewardReply('refuse')` | node "KAL voice intents are read-only…" (`fetch` counter = 0); browser "voice cannot approve" (`Approve payment now`) |
| R2 | Voice replies for status, dock, invoice, check, ledger and governance come from the validated server snapshot only | `stewardReply` | node unit cases; real-kernel assertions after dock receipt and after Check #10045 |
| R3 | **Start KAL** opens a steward session: KAL then narrates each server-confirmed step, reel and reset. Mute still silences it | `accept()`, `#kal-speak[aria-pressed]` | code review; muted path covered by the browser test (`/api/kal/speak` count unchanged) |
| R4 | Voice may only open a view or viewer (`STEWARD_MOVES`) and never writes | `STEWARD_MOVES`, `transcript` | `test_wo14_voice_rf_ocr_and_check_controls` (no `request(`, `runStep` or `fetch` inside the moves) |
| R5 | RF parser: strips AIM prefixes (`]C1`) and CR/LF/Tab/GS terminators, uppercases, and refuses unknown, duplicate and empty reads with the server's codes before any write | `parseReelScan`, `scan` | node "RF wedge reads…"; real-kernel `DUPLICATE_SCAN` after the four reels |
| R6 | Keyboard wedge: at Step 6, a burst (under 120 ms per key) typed outside any field and ended with Enter scans. Fields and dialogs are left alone | `boot()` keydown listener | browser test, fourth reel typed with no focused field (not executed in this lane) |
| R7 | RF readout: meter, `n × 2,000 / 8,000 FT · lbs Cu`, last read (✓/✕ with code), reel tooltips with actor and time, and a tone muted with KAL | `renderRf`, `beep` | browser test `#rf-feet` = `8,000 / 8,000 FT · 3,288 lbs Cu` and `#rf-last` (not executed) |
| R8 | OCR tagger: finds the 5 match fields on the server boxes, including label and value split into two boxes on one line | `tagOcrFields` | node "OCR field tagging…" (single-line, squeezed and split cases); `tests/test-copper-e2e.mjs` on **real RapidOCR** boxes |
| R9 | OCR viewer: tagged boxes in green, a field list beside the image, and a box/field selection readout with text, confidence and pixel position | `renderOcr`, `selectOcrBox`, `#ocr-fields`, `#ocr-selected` | static ids; browser test (not executed) |
| R10 | CFO check view: payee, amount in figures and words, drawing account, ACH, signer, match line and journal effect. Stamps go `DRAFT` ➔ `AWAITING CFO` ➔ `PAID`. **Sign as CFO** is enabled only at Step 8 and is the existing Step 8 write | `renderCheck`, `checkWords`, `#check-dialog`, `#sign-check` | node `checkWords`; real-kernel `stewardReply('check')` and `checkWords(paid.payment.amountUsd)`; static test that the sign button calls `authorize(8)`; browser test (not executed) |
| R11 | Server contract unchanged: reads `GET /api/state` and `GET /docs/:name` only; writes `POST /api/step/:n` and `POST /api/reset` only; `src/` untouched | `public/app.js` | `test_server_contract_only_and_no_embedded_secrets_or_remote_dependencies`; `git diff --stat` shows no `src/` change |
| R12 | Lineage and docs: Software Factory view `WO 1-14`, WO-13 commit `c5026200`, the WO-14 row; README and trace updated; no internal strings | `public/index.html`, docs | `test_left_rail_views_item_and_drawers`; `test_no_internal_strings_in_published_files` (now scans `.sw-factory/WO-14/`) |

## Deviation

None from the delivered text, which is the title only. `tests/test-copper-e2e.mjs` gains one additive assertion (R8) and changes nothing else.

## Testing

- `node --test public/command-desk.test.mjs` (through `python3` subprocess): pure exports plus the real-kernel walk.
- `node tests/test-copper-e2e.mjs` (through `python3` subprocess): self-check 26/26 and red-team 12/12, now with R8 on real RapidOCR.
- `node tests/test-sidecar-reply.mjs`.
- `python3 -m pytest seeds sidecar public -q -p no:cacheprovider`.
- Task card: `python3 -m hara.blocks.configurator.manifest check --repo .` and `python3 -m pytest hara/blocks -q -p no:cacheprovider`. This repository has no `hara/` package, so both fail to run, as they did for `WO-13`. The results are recorded, not claimed green.

## Concrete Acceptance Criteria

See R1–R12 above. Outcome per row is in `review-log.md`.

## As Landed

The plan was followed. Two changes came from verification:

- **Real RapidOCR evidence.** The tagger's first label rules required spaces between words. Real RapidOCR drops them (`TOTALDUEUSD:21600.00`), so the rules now match the sidecar parser.
- **Review Round 1.**
  - The wedge listener moved to the capture phase.
  - Held Enter and Space on Ask KAL, the barcode field and the wedge are ignored.
  - The `dock` voice move no longer focuses the barcode field.
  - The OCR viewer rebuilds only when the evidence changes.
  - The last RF read is cleared on reset.
  - Refusal verbs were narrowed to write phrases.
  - The center column is tighter on screens 780px tall or less, and the browser module checks the bounds at Steps 6 and 7.
