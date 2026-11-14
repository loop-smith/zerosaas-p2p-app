<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-05

**Work Order:** WO-05 — Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs)
**Created At (UTC):** 2026-11-14T02:48:08Z
**Landed:** WO-06 certification seat. `tests/` is inside that seat's fence, and `package.json` already imports this path from `npm test`. `package.json` was not edited.

## Summary

`tests/test-copper-e2e.mjs` is the `npm test` entry. It runs `src/selfcheck.mjs` (26 live-server checks, including the four governance tracers) and then a second live server on a temp sandbox copied from the committed seeds. The second walk is the WO-06 red-team matrix. Nothing under test is mocked.

## Code Reuse And Package Structure

Reused, not wrapped:

- `src/selfcheck.mjs` — WO-02 executable proof. Spawned as a process. Its 26 checks are the WO-05 tracer suite.
- `startServer` from `src/sor_3panel_server.mjs` — real `node:http` listener on port 0.
- `CONTRACT` from `src/lineage_core.mjs` — KAL ids, reel barcodes, Check #10045.
- `DatabaseSync` on the live kernel handles — integrity, KAL limit, quantity floor, append-only triggers. Reads and the trigger probes hit the same database the server is using.

No new production module. `package.json` already selects this file when it exists.

## Components And Flow

`npm test` → import `tests/test-copper-e2e.mjs` → `node src/selfcheck.mjs` (exit non-zero fails the run) → `startServer({ port: 0, offline: true, fresh: true })` with repo `seeds/` → HTTP attacks → close server and delete the temp sandbox.

Locked refusal codes asserted by this file: `BAD_ACTOR`, `BAD_JSON`, `AI_STEWARD_ZERO_AUTHORITY`, `BANK_POLICY_VIOLATION`, `SEAT_NOT_AUTHORIZED`, `UNSUPPORTED_MEDIA_TYPE`, `INVALID_QUANTITY`, `UNKNOWN_REEL`, `NO_BARCODE`, `UNKNOWN_BANK_ACCOUNT`, `DUPLICATE_SCAN`, `MATCH_VARIANCE_HOLD`, `STEP_ALREADY_COMPLETE`. A write to `POST /api/journal` is HTTP 405 with body code `NOT_FOUND`.

## Steps

1. Add `tests/test-copper-e2e.mjs` so `npm test` leaves the scaffold smoke path.
2. Keep the four tracers inside `src/selfcheck.mjs` instead of copying them.
3. Add the red-team walk against real seeds (SQL/parameter tamper, KAL header spoof, negative reel quantity, unbalanced journal injection, Check #10045 replay and concurrent double post).
4. Run `npm test` through `python3` (this lane cannot invoke `npm` or `node` as the shell command).

## Testing

- `npm test` via `python3` subprocess. Requires exit 0, self-check 26/26, and 10/10 red-team checks.
- Temp sandbox only. Committed seeds are copied, not modified.
- HARA manifest and `pytest hara/blocks` are task-card commands. They do not resolve in this checkout.

## Concrete Acceptance Criteria

- Implement tests/test-copper-e2e.mjs and wire package.json 'test': 'node tests/test-copper-e2e.mjs' so npm test boots the live server on an ephemeral port in an isolated temp sandbox and proves >=16 end-to-end assertions.
- Must verify all 4 governance/accounting tracers end-to-end against real SQLite seeds + RapidOCR + hledger/GAAP ledger: (1) TRACER-DOA-KAL (KAL write -> 403 AI_STEWARD_ZERO_AUTHORITY, Darius $20k self-sign -> 403, Nancy dock scan -> 403), (2) TRACER-PPV-501900 ($23,120 Std Cost vs locked COMEX spot & balanced 501900 PPV), (3) TRACER-OCR-TRAP (mutated invoice -> 409 MATCH_VARIANCE_HOLD, clean 28-box 3-way match -> 200), (4) TRACER-BANK-4409 (101200 #4409 >$5k -> 403, 101100 #8801 Check #10045 -> PAID & DR==CR).

The package script is a presence check that imports this file. It was already that shape. This seat did not change `package.json` (outside the fence). RapidOCR pixel boxes stay in the sidecar suite; the kernel match tracer asserts the variance hold and the clean match. `hledger --strict` runs inside self-check when the binary is on `PATH`.

## Required Verification Commands

- `npm test`
