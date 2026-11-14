<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-05

**Work Order:** WO-05 — Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs)
**Created At (UTC):** 2026-11-14T02:48:08Z
**Landed:** the suite was first committed in the WO-06 seat. T19 integrated `src/` (:3590), `sidecar/` (:3591), `public/`, and `seeds/` into it and changed `package.json` `test` to `node tests/test-copper-e2e.mjs`.

## Summary

`tests/test-copper-e2e.mjs` is the `npm test` entry. It runs `src/selfcheck.mjs` (26 live-server checks, including the four governance tracers). It then boots the integrated stack on a temp sandbox copied from the committed seeds. That stack is the real RapidOCR sidecar on a free loopback port, plus the kernel/HTTP server on a free port, with `ocrUrl` pointing at the sidecar. The second walk runs 12 checks: the WO-06 red-team matrix plus the OCR integration. Nothing under test is mocked.

## Code Reuse And Package Structure

Reused, not wrapped:

- `src/selfcheck.mjs` — WO-02 executable proof. Spawned as a process. Its 26 checks are the WO-05 tracer suite. It now pins `ocrUrl: null` so it stays on the PO-derived invoice even if `OCR_URL` is set.
- `startServer` from `src/sor_3panel_server.mjs` — real `node:http` listener on port 0.
- `sidecar/invoice_ocr_engine.py serve` — real RapidOCR engine, spawned by the suite with `--port 0`.
- `validateState` from `public/app.js` — the command desk's own snapshot validator, run on the live snapshot.
- `CONTRACT` from `src/lineage_core.mjs` — KAL ids, reel barcodes, Check #10045, trade document names.
- `DatabaseSync` handles on the live kernel — integrity, KAL limit, quantity floor, append-only triggers.

Production changes in this task (no new module):

- `src/lineage_core.mjs`
  - Kernel option `ocrUrl` (env `OCR_URL`; unset means the PO-derived invoice, as before) and `docsDir = <sandbox>/docs`.
  - Step 5 calls sidecar `/generate` and re-hashes each PDF on the kernel's own disk (`receiveDocuments`).
  - Step 7 checks the claimed fields first. It then calls sidecar `/ocr` (`readInvoice`), binds the invoice hash to Step 5, and matches the OCR amounts against the PO and the receipt.
  - The snapshot adds `documents` and `ocr`. Health adds `ocrUrl`.
- `src/sor_3panel_server.mjs` — `GET /docs/<file>` from `kernel.docsDir` through the existing traversal-guarded `serveStatic`.
- `sidecar/invoice_ocr_engine.py`
  - `/ocr` writes the rendered page `INV-25800.png` atomically and returns it as `image`.
  - `serve` prints a JSON ready line with the bound URL, so `--port 0` works.
- `package.json` — `test` is `node tests/test-copper-e2e.mjs`. Added `sidecar` (:3591) and `start:ocr` (:3590 with `OCR_URL`).

Locked refusal codes added on this path: 503 `OCR_UNAVAILABLE` (sidecar unreachable or malformed reply) and 409 `DOCUMENT_INTEGRITY_HOLD` (sidecar reports it, or a PDF on disk does not match its reported hash). Both are audit-chained with `$0.00` book impact.

## Components And Flow

`npm test` → `node tests/test-copper-e2e.mjs`:

1. `node src/selfcheck.mjs`. A non-zero exit fails the run.
2. Spawn `python3 sidecar/invoice_ocr_engine.py --docs-dir <tmp>/sor-sandbox/docs --port 0 serve` and wait for the ready line.
3. `startServer({ port: 0, offline: true, fresh: true, ocrUrl })` with repo `seeds/`.
4. HTTP attacks and the OCR walk.
5. Kill the sidecar, close the server, delete the temp sandbox.

Locked refusal codes asserted by this file: `BAD_ACTOR`, `BAD_JSON`, `AI_STEWARD_ZERO_AUTHORITY`, `BANK_POLICY_VIOLATION`, `SEAT_NOT_AUTHORIZED`, `UNSUPPORTED_MEDIA_TYPE`, `INVALID_QUANTITY`, `UNKNOWN_REEL`, `NO_BARCODE`, `UNKNOWN_BANK_ACCOUNT`, `DUPLICATE_SCAN`, `MATCH_VARIANCE_HOLD`, `STEP_ALREADY_COMPLETE`. A write to `POST /api/journal` is HTTP 405 with body code `NOT_FOUND`.

## Steps

1. Add `tests/test-copper-e2e.mjs` so `npm test` leaves the scaffold smoke path. Done in WO-06; `package.json` now calls it directly.
2. Keep the four tracers inside `src/selfcheck.mjs` instead of copying them.
3. Add the red-team walk against real seeds: SQL/parameter tamper, KAL header spoof, negative reel quantity, unbalanced journal injection, Check #10045 replay and a concurrent double post.
4. Integrate the sidecar.
   - Step 5 documents are served at `/docs` hash-for-hash, and traversal probes are refused.
   - A forged invoice PDF (same-length edit to $2.89 / $23,120.00) is read by real RapidOCR and held with `variances` `invoiceSha256`, `unitPrice`, `totalDue`.
   - The restored invoice clears GRNI → Trade AP with ≥28 OCR boxes.
   - The desk's `validateState` accepts the snapshot, and the OCR box space equals the served PNG's IHDR size.
5. Run `npm test` through `python3` (this lane cannot invoke `npm` or `node` as the shell command).

## Testing

- `npm test` via a `python3` subprocess. Requires exit 0, self-check 26/26, and 12/12 integrated red-team checks. About 17 s, mostly two real RapidOCR reads.
- `python3 -m pytest sidecar seeds public/test_command_desk.py -q -p no:cacheprovider` covers the PNG output and the `serve --port 0` ready line.
- `node --test public/command-desk.test.mjs` checks that the desk still accepts real server snapshots.
- Default-port smoke: `npm run sidecar` (:3591) + `npm run start:ocr` (:3590), Steps 1-8 over HTTP, then the sandbox is removed.
- Temp sandbox only. Committed seeds are copied, not modified.
- HARA manifest and `pytest hara/blocks` are task-card commands. They do not resolve in this checkout.

## Concrete Acceptance Criteria

- Implement tests/test-copper-e2e.mjs and wire package.json 'test': 'node tests/test-copper-e2e.mjs' so npm test boots the live server on an ephemeral port in an isolated temp sandbox and proves >=16 end-to-end assertions.
- Must verify all 4 governance/accounting tracers end-to-end against real SQLite seeds + RapidOCR + hledger/GAAP ledger: (1) TRACER-DOA-KAL (KAL write -> 403 AI_STEWARD_ZERO_AUTHORITY, Darius $20k self-sign -> 403, Nancy dock scan -> 403), (2) TRACER-PPV-501900 ($23,120 Std Cost vs locked COMEX spot & balanced 501900 PPV), (3) TRACER-OCR-TRAP (mutated invoice -> 409 MATCH_VARIANCE_HOLD, clean 28-box 3-way match -> 200), (4) TRACER-BANK-4409 (101200 #4409 >$5k -> 403, 101100 #8801 Check #10045 -> PAID & DR==CR).

`package.json` `test` is now exactly `node tests/test-copper-e2e.mjs`. TRACER-OCR-TRAP runs against real RapidOCR in the integrated walk: a mutated invoice is a 409 hold, and the clean invoice is a 200 match with ≥28 boxes. `hledger --strict` runs inside self-check and on every posting gate when the binary is on `PATH`; it was on `PATH` for this run.

## Required Verification Commands

- `npm test`
