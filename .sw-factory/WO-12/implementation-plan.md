<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-12

**Work Order:** SF WO-12 — Harden live `/api/step/:n` route contracts and adversarial replay guards
**Created At (UTC):** 2026-11-14T04:16:19Z

## Summary

SF WO-12 came from Validator Theme `THM-1`, which groups Feedback `FB-1` and `FB-2`. The hardening was built by three work orders that were already on `main` and had each passed an independent Qualify Review:

- `9094b2bb` (`WO-04-A.f1`) — route contract.
- `fca1c225` (`WO-06`) — red-team replay guards.
- `cae71057` (`T19.f1`) — sidecar reply guard on the integrated kernel.

This seat writes the evidence that links them. It also finishes the `zerosaas-p2p-app` rename in the files its fence allows. It adds no new route, guard or refusal code.

## Code Reuse And Package Structure

Inspected before editing:

- `public/app.js` — `validateState`, `runStep` (calls `/api/step/:n`). Read only.
- `src/sor_3panel_server.mjs` — `startServer`, `/api/step/:n` routing, pre-kernel KAL refusal. Read only.
- `src/lineage_core.mjs` — `#sidecar()` non-object refusal, `health()`, COMEX fetch. Two string edits only.
- `tests/test-copper-e2e.mjs`, `tests/test-sidecar-reply.mjs`, `public/command-desk.test.mjs` — existing regressions reused as the evidence. Not changed.
- `seeds/build_seeds.py` — `coa_journal()` hashes the whole contract into `seeds/coa_seed.journal`.

Public signatures and refusal codes are unchanged:

- `403 AI_STEWARD_ZERO_AUTHORITY`
- `403 DOA_LIMIT_EXCEEDED`
- `403 SOX_SOD_VIOLATION`
- `403 BANK_POLICY_VIOLATION`
- `409 MATCH_VARIANCE_HOLD`
- `409 STEP_ALREADY_COMPLETE`
- `422 INVALID_QUANTITY`
- `503 OCR_UNAVAILABLE`

## Requirement Tracking

| ID | Requirement | Evidence | Result |
| --- | --- | --- | --- |
| R1 | `FB-1`: the desk accepts the real `GET /api/state` snapshot | `9094b2bb`; `public/command-desk.test.mjs` "real server snapshots and client actions share the kernel contract" | Green |
| R2 | `FB-1`: step writes go to `/api/step/:n` and get `200` or a typed refusal | `9094b2bb`; same test; red-team "steps 2-5 accept the seated actors only" | Green |
| R3 | `FB-2`: Check #10045 pays once; replay, amount tamper and a concurrent double post do not pay again | `fca1c225`; red-team check of the same name | Green |
| R4 | `FB-2`: negative or wrong GS1 reel quantities are refused and never stored | `fca1c225`; red-team "negative-quantity reel scans are refused and never stored" | Green |
| R5 | `FB-2`: KAL header spoofing is `403` on every write | `fca1c225`; red-team "KAL header spoofing is 403 on every write and is chained as EMP-AI-KAL" | Green |
| R6 | `FB-2`: a forged invoice holds the 28-box match at `409` against real RapidOCR | `11a63009` + `cae71057`; red-team "invoice tamper holds the match" | Green |
| R7 | `FB-2`: a malformed sidecar reply is an audited `503`, not a `500` | `cae71057`; `tests/test-sidecar-reply.mjs` 4/4 | Green |
| R8 | `package.json` `name` is `zerosaas-p2p-app` | `package.json` | Done |
| R9 | `src/lineage_core.mjs` COMEX `user-agent` and `/api/health` `service` say `zerosaas-p2p-app` | `src/lineage_core.mjs` | Done |
| R10 | `contracts/p2p-lineage-contract.json` `targetRepo` says `zerosaas-p2p-app` | Not landed; see Deviation | Blocked by fence |
| R11 | README and trace show 12/12 Completed, `THM-1` Resolved, `FB-1`/`FB-2`, SF WO-10/11/12 rows, and Sections 6–7 closed | `README.md`, `docs/software-factory-trace.md` | Done |
| R12 | No local paths, seat or session ids in published files | Search of changed files | Done |

## Deviation

R10 was applied, tested and reverted in this seat:

- `seeds/coa_seed.journal` records a `canonical-sha256` of the whole contract.
- After the `targetRepo` edit, `seeds/test_seeds.py::test_committed_seeds_match_contract` failed with `drift() == ['coa_seed.journal']`.
- `seeds/` is outside this fence, so the seed could not be regenerated here.

The edit was reverted so `main` stays green. The trace doc's Section 7 records the fix: one work order fenced to both files edits `targetRepo`, then runs `python3 seeds/build_seeds.py` and `python3 -m pytest seeds -q`.

`WO-08.f1` landed the contract edit alone and was refused `tests_failed` for this reason (seeds suite `1 failed, 22 passed`). `WO-08.f2` had the same fence and kept R10 open rather than land red. It confirmed that a seed build from the edited contract succeeds and changes only the `coa_seed.journal` stamp: `canonical-sha256` goes from `f8af589e…` to `57311e23…`. The follow-up work order is fenced to `contracts/p2p-lineage-contract.json` and `seeds/coa_seed.journal`, and its acceptance check is that new stamp plus a green seeds suite.

## Testing

- `npm test` (through a `python3` subprocess)
- `node --test public/command-desk.test.mjs` (through a `python3` subprocess)
- `python3 -m pytest seeds sidecar public -q -p no:cacheprovider`
- `python3 -m hara.blocks.configurator.manifest check --repo .`
- `python3 -m pytest hara/blocks -q -p no:cacheprovider`

## Concrete Acceptance Criteria

- Align the remaining `8090-p2p-app` metadata strings to `zerosaas-p2p-app` in `package.json`, `contracts/p2p-lineage-contract.json` and `src/lineage_core.mjs`.
- Update `docs/software-factory-trace.md` and `README.md` to show 12/12 Completed Planner Work Orders and the full Validator round-trip `FB-1` + `FB-2` ➔ `THM-1` ➔ `SF WO-12`.
- Create `.sw-factory/WO-12/{context.md,implementation-plan.md,checklist.md,review-log.md}` with SF WO-12, `THM-1`, `FB-1`, `FB-2` and commits `9094b2bb`, `fca1c225`, `cae71057`.
- No forbidden internal strings; all tests pass.

## T20 follow-up: resolve R10

Scope: update only provenance.targetRepo to https://github.com/loop-smith/zerosaas-p2p-app and regenerate the journal stamp; close the stale rename exception in the trace document. Reuse seeds/build_seeds.py load_contract(), build(out_dir, contract_path), coa_journal(), drift(), and seeds/test_seeds.py::test_committed_seeds_match_contract. No new helpers, public signatures, schema changes, or refusal-code changes.

Requirements: T20-1 correct repository URL; T20-2 generated journal matches the full contract; T20-3 all writes stay inside the task fence, with no commit, push, or receipt; T20-4 run seed checks and both task-card commands and record their actual results.

Steps: reproduce the contract-only failure using the existing test in a temporary copied seed root; edit the URL; build all seeds into a temporary directory and copy only coa_seed.journal into the fence; update the trace; run seed drift check, seeds pytest, manifest check, and hara/blocks pytest; review the final diff. Runtime and UI code are untouched. Remote Software Factory records are outside this task; MCP is unavailable.

T20 outcome: T20-1 and T20-2 verified by the seed drift check and 23 passing seed tests. T20-3 verified by the fenced diff. T20-4 executed; both HARA commands are unavailable in this checkout, as recorded in review Round 3. R10 is resolved; the earlier Deviation section is historical.
