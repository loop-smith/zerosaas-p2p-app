<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-06

**Work Order:** WO-06 — Red-Team Adversarial Audit, Software Factory Feedback->Themes Triage & Final .sw-factory Certification
**Created At (UTC):** 2026-11-14T02:48:08Z

## Summary

Add live-server red-team regressions in `tests/test-copper-e2e.mjs` for the five attack classes, then mark every `.sw-factory/WO-01`..`WO-06` checklist box `[x]` or `[SKIP]` and record APPROVED on each review log after `npm test` exits 0. No production module is added. The seat does not commit, push, or write `receipt.json`.

## Code Reuse And Package Structure

Inspected before adding code:

- `src/lineage_core.mjs` — `P2PKernel#authorize`, `dockScan`, `cfoPayment`, `#gateLedger`, append-only SQL triggers, `isStewardIdentity`, `claimedActor`.
- `src/sor_3panel_server.mjs` — `startServer`, loopback host check, JSON content-type gate, pre-kernel KAL refusal on non-step writes.
- `src/selfcheck.mjs` — 26-check tracer process. Reused by spawn. Not copied.
- `seeds/build_seeds.py` schema — `stock_stockitem.quantity >= 0`, KAL `$0` and `db_write_credentials = 0`.
- `contracts/p2p-lineage-contract.json` — KAL ids (`EMP-AI-KAL`, `AGT-8090-KAL-01`, `KAL`, `Cal`), reel barcodes, `Check #10045`.

Public signatures left unchanged. Refusal codes locked to the names the kernel and server already return (see the header of `tests/test-copper-e2e.mjs`). No new helper module.

Created: `tests/test-copper-e2e.mjs` (also the WO-05 entry). Modified: `.sw-factory/WO-01`..`WO-06` execution records that were still open or still templates.

## Components And Flow

Attacker is an HTTP client of the real server. The kernel builds journal legs. Request `legs`, `memo`, `sql`, `amountUsd`, `checkNumber`, `ft`, and `part_id` are not posting inputs.

1. Identity list is normalized (trim, upper case, comma-split). Any KAL id fails closed with 403 before the step runs.
2. Actor characters outside `[A-Z0-9-]` fail with 400 `BAD_ACTOR` before SQL.
3. Reel `quantityFt` must be absent or exactly 2000. Negatives, zero, strings, and `NaN` do not insert.
4. Step 8 posts one PAID Check #10045 for the PO total. A second call, including a concurrent pair, is 409 `STEP_ALREADY_COMPLETE`.
5. `#gateLedger` rejects an unbalanced posting. `POST /api/journal` is not a route. `UPDATE`/`DELETE` on `journal_leg` abort.

## Steps

1. Write `tests/test-copper-e2e.mjs` against the live server. First run failed the KAL `PUT` actor assertion (adapter body has no `actor`). Fix the assertion. Do not patch `src/`.
2. Re-run `npm test` to green (26 + 10).
3. Run the task-card HARA commands and record the absent-package result. Re-run `pytest seeds`.
4. Triage: the checkout has no feedback export. The five acceptance classes are the theme list. Each theme maps to a passing check.
5. Fill WO-05 and WO-06 plans, contexts, checklists, and review logs. Convert the two open WO-01 boxes to `[SKIP]`. Append a certification round to WO-01..WO-04.

## Testing

- `npm test` through `python3` subprocess, from the repo root, after the assertion fix.
- `python3 -m pytest seeds -q -p no:cacheprovider`
- `python3 -m hara.blocks.configurator.manifest check --repo .`
- `python3 -m pytest hara/blocks -q -p no:cacheprovider`
- Sidecar and command-desk suites were not re-run. Their prior review logs stay the evidence for those seats.

## Requirement Tracking

- R1 SQL injection and parameter tampering — in the red-team file. Green.
- R2 replay and concurrent double-payment of Check #10045 — green. One ledger occurrence, amount $21,600.00, not the tampered $0.01.
- R3 negative-quantity reel scans — green. `MIN(quantity) >= 0`.
- R4 KAL header spoofing — green. Body, `x-actor`, and `x-agent-id`, including case, phonetic `Cal`, agent id, and comma-combined CFO+KAL. Kernel rows chained as `EMP-AI-KAL`. `GET` still allowed.
- R5 unbalanced journal injection — green. Injected legs ignored, `POST /api/journal` is 405, book stays balanced, append-only triggers abort UPDATE and DELETE.
- R6 every checklist box in WO-01..WO-06 is `[x]` or `[SKIP]` with a reason.
- R7 review logs say APPROVED after the green `npm test`. HARA commands are recorded as failed and are not part of that green claim.
- R8 no commit, push, or `receipt.json`.

## Concrete Acceptance Criteria

- Expand adversarial Red-Team regression assertions in tests/ against SQL injection/parameter tampering, replay/double-payment on Check #10045, negative-quantity reel scans, KAL header spoofing, and unbalanced journal injection.
- Update all .sw-factory/WO-01..WO-06/checklist.md items to [x] (or [SKIP] with reason) and stamp .sw-factory/WO-01..WO-06/review-log.md APPROVED after verifying npm test passes 100%.

## Required Verification Commands

- `npm test`
