<!--lint disable strong-marker-->

# Review Log: WO-12

**Work Order:** SF WO-12 — Harden live `/api/step/:n` route contracts and adversarial replay guards
**Initialized At (UTC):** 2026-11-14T04:16:19Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

In-seat review. No nested review subagent. The three closing commits were already qualified by independent Qualify Reviews. This round checks that the evidence still holds on the current tree, and it reviews this seat's own documentation and metadata edits.

### Requirements Alignment

| Record | Closing commit | Qualify Review | Evidence re-run this round |
| --- | --- | --- | --- |
| `FB-1` route contract | `9094b2bb` (`WO-04-A.f1`) | `WO-04-A.f1.q`: PASS | `public/command-desk.test.mjs` "real server snapshots and client actions share the kernel contract": ok |
| `FB-2` replay / reel / spoof | `fca1c225` (`WO-06`) | `WO-06.q`: PASS | Red-team checks for Check #10045 replay, negative reel quantity and KAL header spoofing: ok |
| `FB-2` 28-box match and sidecar reply | `cae71057` (`T19.f1`) | `T19.f1.q`: PASS | Red-team "invoice tamper holds the match" against real RapidOCR: ok; `tests/test-sidecar-reply.mjs` 4/4 |
| `THM-1` | all three | — | Every linked feedback item is closed; Theme status Resolved |

`T19.q2` returned FAIL on `11a63009` (a `null` sidecar `/generate` reply gave `500 INTERNAL_ERROR`). `cae71057` fixed it, and `T19.f1.q` returned PASS. Both are recorded in the trace doc's Qualify Review ledger.

**Blocking:** none.

**Advisory:** `contracts/p2p-lineage-contract.json` `targetRepo` still reads `8090-p2p-app` (R10). See Tests And Build.

### Blueprint Alignment

The `BP-01` body was not readable without the Software Factory MCP.

**Blocking:** none.

**Advisory:** alignment was checked against the lineage contract and the running server, not a blueprint document.

### Architecture And Conventions

- No production logic changed.
- `src/lineage_core.mjs` has two string literals changed: the COMEX fetch `user-agent` and the `health()` `service` value. No caller or test matches on either string.
- Refusal codes and public signatures are unchanged.

Lean line delta for production code: `src/lineage_core.mjs` +2 / −2. `package.json` +1 / −1. All other changes are documentation and execution records.

**Blocking:** none.

**Advisory:** none.

### Tests And Build

**Commands run (fresh, final tree):**

- `npm test` through a `python3` subprocess → exit 0. Sidecar-reply 4/4. Self-check 26/26. Integrated red-team 12/12.
- `node --test public/command-desk.test.mjs` through a `python3` subprocess → 10 pass, 0 fail.
- `python3 -m pytest seeds sidecar public -q -p no:cacheprovider` → 66 passed, 1 skipped (Playwright browser test).
- `python3 seeds/build_seeds.py --check` → `seeds OK`.
- Live `GET /api/health` on `startServer({offline:true})` → `service: "zerosaas-p2p-app sor_3panel_server"`, `ok: true`.
- `python3 -m hara.blocks.configurator.manifest check --repo .` → exit 1, `No module named 'hara'`.
- `python3 -m pytest hara/blocks -q -p no:cacheprovider` → exit 4, `hara/blocks` not found, no tests ran.

**Red run (R10):** with `targetRepo` changed to `https://github.com/loop-smith/zerosaas-p2p-app`, the seeds suite gave `1 failed, 65 passed, 1 skipped`. The failure was `seeds/test_seeds.py::test_committed_seeds_match_contract`, with `drift() == ['coa_seed.journal']`. `seeds/coa_seed.journal` records a SHA-256 of the whole contract, and `seeds/` is outside this fence. The edit was reverted, and the green results above are on the reverted tree.

**Blocking:** none inside this fence. The two HARA commands cannot pass until that package exists in this repository. They are not claimed green.

**Advisory:** R10 needs one work order fenced to both `contracts/p2p-lineage-contract.json` and `seeds/coa_seed.journal`.

### User-Facing Verification

**Evidence:**

- `npm test` boots the real server.
  - `GET /` returns the command desk.
  - `GET /api/health` reports a valid audit chain.
  - All eight steps run with a balanced journal.
- The command-desk test drives the real kernel through `/api/step/:n`.

**Skipped:** browser console capture. Playwright is not installed in this lane. This app has no `app_server.py` or `/#/helm`, `/#/living-plan` or `/#/riff-room` routes.

**Blocking:** none.

### Security, Privacy, And Data Safety

- No guard, route or credential path changed.
- A search of every changed file found no local filesystem paths, seat names or session ids. The only identifiers are public Software Factory UUIDs, commit hashes and contract ids.
- Tests ran in temporary sandboxes. No receipt file was written.

**Blocking:** none.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 3. These are: R10 `targetRepo` blocked by the fence; no blueprint body; no browser console capture.
- Files changed: `README.md`, `docs/software-factory-trace.md`, `package.json`, `src/lineage_core.mjs`, `.sw-factory/WO-12/{context.md,implementation-plan.md,checklist.md,review-log.md}`
- **Verdict:** APPROVED

That verdict covers the WO-12 evidence and the in-fence metadata alignment. It does not cover R10, and it does not say the absent HARA package checks passed.

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->

## Round 2 — T20 rename follow-up

Dedicated read-only review checked requirements, contract digest, generated journal, conventions, security, and fence compliance. Verdict: CHANGES_REQUESTED for unintended contract CRLF normalization. The correction restored the original bytes and replaced only the URL; no semantic contract change beyond targetRepo.

## Round 3 — T20 correction verified

Dedicated review confirmed byte equality to the original contract with only the requested URL replaced, preserved CRLF, matching canonical digest, unchanged 89 account declarations, and all changed paths inside the fence. No blocking findings. **Verdict: APPROVED.**

Fresh verification after correction:

- python3 seeds/build_seeds.py --check: exit 0, seeds OK.
- python3 -m pytest seeds -q -p no:cacheprovider (Python subprocess with bytecode writes disabled): exit 0, 23 passed. This includes test_committed_seeds_match_contract.
- python3 -m hara.blocks.configurator.manifest check --repo .: exit 1, No module named hara.
- python3 -m pytest hara/blocks -q -p no:cacheprovider: exit 4, path not found; no tests ran.
- git diff --check: flags the preserved CRLF on the changed contract line. git -c core.whitespace=cr-at-eol diff --check: exit 0.

Red evidence: the existing committed-seed test in a temporary copied root with the URL changed but the old journal failed exactly on coa_seed.journal. The green suite uses the regenerated journal. No unit under test was mocked.

T20-1 URL, T20-2 generated journal, and T20-3 fence/handoff constraints are satisfied. T20-4 commands were all run with actual results recorded; absent HARA infrastructure is not claimed green. No remote records were changed; MCP is unavailable. UI verification is skipped because this change only updates provenance metadata and a generated comment. Lean delta: runtime code +0/-0; contract +1/-1; journal +1/-1. No helpers, signatures, or refusal codes changed. No commit, push, or receipt was created.
