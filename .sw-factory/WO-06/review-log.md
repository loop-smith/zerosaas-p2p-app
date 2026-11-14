<!--lint disable strong-marker-->

# Review Log: WO-06

**Work Order:** WO-06 — Red-Team Adversarial Audit, Software Factory Feedback->Themes Triage & Final .sw-factory Certification
**Initialized At (UTC):** 2026-11-14T02:48:08Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

In-seat review. No nested subagent. Production files were read and not modified. The only code change is `tests/test-copper-e2e.mjs`.

### Requirements Alignment

Feedback→themes triage: this checkout has no Software Factory feedback export and no theme list. The five classes in the acceptance criteria are the whole theme set.

| Theme | Result |
| --- | --- |
| SQL injection / parameter tampering | Refused. `DROP TABLE` actor is 400 `BAD_ACTOR`. Step 1 still reads part 218 at 0 FT and $23,120.00. `part_part` count stays 1. Query-string `actor=EMP-0007` does not promote Nancy. |
| Replay / double-payment of Check #10045 | One PAID posting for $21,600.00. Concurrent pair is one 200 and one 409. A later replay is 409. Ledger contains the check string once. Tampered amount, check number, ACH, and memo are absent. |
| Negative-quantity reel scans | 422 `INVALID_QUANTITY` for negatives, zero, strings, 8000, null, and a non-integer. `NaN` is 400 `BAD_JSON`. `MIN(quantity) >= 0`. A `ft: -2000` field on a valid scan is ignored; the reel is +2,000 FT. |
| KAL header spoofing | 403 `AI_STEWARD_ZERO_AUTHORITY` for body, phonetic `Cal`, agent id, mixed case, and CFO combined with KAL on `x-actor` or `x-agent-id`. Kernel audit actor is `EMP-AI-KAL`. `GET /api/state` with that header stays 200. |
| Unbalanced journal injection | Posted dock legs are 121100 $23,120 / 201200 $-21,600 / 501900 $-1,520. `POST /api/journal` is 405. Debit equals credit. `UPDATE` and `DELETE` on `journal_leg` abort with the append-only trigger. |

**Blocking:** none.

**Advisory:** no extra feedback items existed to accept or reject.

### Blueprint Alignment

No blueprint documents.

**Blocking:** none.

**Advisory:** certification is against the contract and the current server, not a Foundry blueprint body.

### Architecture And Conventions

Reused `startServer`, `CONTRACT`, and `src/selfcheck.mjs`. No new indirection layer. Refusal codes were not renamed. Sandbox is under `os.tmpdir()` and removed in `finally`.

Lean line delta for this seat: `tests/test-copper-e2e.mjs` +300 / −0. Production `src/` delta +0 / −0. Execution-document edits are the checklist and review updates, not a second implementation.

**Blocking:** none.

**Advisory:** none.

### Tests And Build

**Commands run (fresh this seat):**

- `npm test` via `python3` subprocess → exit 0. `src/selfcheck.mjs` 26 checks passed. Red-team 10 checks passed. The first red-team run failed before this green run: KAL `PUT /api/state` has no `actor` field because the HTTP adapter refuses it before the kernel. The test was changed. `src/` was not.
- `python3 -m pytest seeds -q -p no:cacheprovider` → 23 passed in 0.61s.
- `python3 -m hara.blocks.configurator.manifest check --repo .` → exit 1. `ModuleNotFoundError: No module named 'hara'`.
- `python3 -m pytest hara/blocks -q -p no:cacheprovider` → exit 4. `hara/blocks` not found. No tests ran.

Not re-run: `pytest sidecar`, `pytest public`. Prior WO-03 and WO-04 logs remain their evidence. Those verdicts were not flipped.

**Blocking:** none for this fence. HARA commands are a missing-package baseline, not a silent pass.

**Advisory:** none.

### User-Facing Verification

**Skipped:** full browser pass. `app_server.py` and `/#/helm`, `/#/living-plan`, `/#/riff-room` are not in this repository. No 16ms projection sample was taken; this change does not add a local render function.

**Evidence:** inside `npm test`, `GET /` returned 200 and `Copper — Command Desk`. `GET /api/health` returned `ok: true` and `audit.valid: true`.

**Blocking:** none.

**Advisory:** console and page-error capture needs a browser. This seat did not open one.

### Security, Privacy, And Data Safety

**Skipped:** no.

Same-lifecycle double payment does not post a second Check #10045. SYSTEM reset, already covered by self-check, deletes the sandbox and can run the one-shot deal again. That is a new journal, not two credits in one book. It stays the WO-02 demo behavior.

A KAL `PUT` is 403 with `bookImpactUsd` 0 and is not an audit-chain row. Kernel spoofs are chained as `EMP-AI-KAL`.

The run copies seeds into a temp directory and does not write `/home/rig/state`. No receipt file was created.

**Blocking:** none.

**Advisory:** HTTP-layer KAL refusals are not audit-chained. The write still does not land.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 3 (no external theme catalog; no browser console capture; HTTP-layer KAL `PUT` is refused but not chained)
- Files reviewed: `tests/test-copper-e2e.mjs`, `src/lineage_core.mjs`, `src/sor_3panel_server.mjs`, `src/selfcheck.mjs`, `.sw-factory/WO-01`..`WO-06` checklists and review logs
- **Verdict:** APPROVED

Scope of that word: the red-team suite and the `.sw-factory` certification. It does not mean the absent HARA package checked out green.

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
