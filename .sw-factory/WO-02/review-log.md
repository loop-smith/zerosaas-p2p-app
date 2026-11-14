<!--lint disable strong-marker-->

# Review Log: WO-02

**Work Order:** WO-02 — Implement Core P2P State Kernel (src/lineage_core.mjs) & HTTP Server (:3590 src/sor_3panel_server.mjs) for Steps 1-8, Live COMEX Math & 501900 PPV
**Initialized At (UTC):** 2026-11-14T02:48:07Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

Changed paths (single bucket, one isolated review delegate): `src/lineage_core.mjs`, `src/sor_3panel_server.mjs`,
`src/selfcheck.mjs`, `.sw-factory/WO-02/implementation-plan.md`.

### Requirements Alignment

**Blocking:** none

**Advisory:**
- A6 (`src/lineage_core.mjs`, Requirements alignment) — KAL check only on step/reset routes; KAL to step 99 got 404, other verbs 405 instead of 403. **Fixed** (identity guard runs before the 404; HTTP layer refuses KAL header identity on every other write route).

### Blueprint Alignment

**Blocking:** none

**Advisory:**
- A9 (`src/lineage_core.mjs`, Blueprint alignment) — `coa_seed.journal` is copied but `company.journal` declares only the 6 kernel accounts, so `--strict` does not validate against WO-01's 89-account chart; 101200 account name is hardcoded (contract names it only in prose). **Deferred** to WO-01 integration (seed not yet present).
- A10 (`src/lineage_core.mjs`, Blueprint alignment) — audit chain records journal txn id but not leg amounts. **Deferred** (journal_leg is append-only via triggers).

### Architecture And Conventions

**Blocking:** none

**Advisory:**
- A2 (`src/lineage_core.mjs`, Architecture) — WMS writes run outside the kernel transaction and failures are swallowed (recorded as `wms` outcome on the workflow record). **Deferred**: intentional best-effort adaptive writes until WO-01 seed schema exists; outcome visible in `/api/state`.
- A11 (`src/lineage_core.mjs`, Architecture) — `GET /api/journal` runs hledger synchronously (≤10 s timeout). **Accepted** for a single-user demo kernel.
- A14 (`implementation-plan.md`, Conventions) — documented `act` signature was wrong. **Fixed**. `fresh:false` with a missing kernel DB but bootstrapped SoRs would crash on CREATE TABLE. **Accepted** (default boot is fresh).

### Tests And Build

**Commands run:** `node --check` ×3 (pass); `node src/selfcheck.mjs` (24/24 pass, hledger 1.40 actually executed); `npm test` (exit 0, stage smoke only).
Delegate extras: ASTM B8 rounding vs exact integer math over 140,000 spot values (0 mismatches); unfavorable-PPV path with stubbed $7.50/lb spot (balanced, hledger strict ok).

**Blocking:** none

**Advisory:**
- A12 (`package.json`, Build) — `engines >=22.0.0` but `node:sqlite` needs ≥22.13 unflagged. **Out of fence** (package.json) — flagged for WO-05/WO-06.
- A13 (`package.json`, Tests) — `npm test` does not run the self-check until WO-05 lands `tests/test-copper-e2e.mjs`; Yahoo fallback / 413 / unfavorable PPV not in self-check. **Out of fence / deferred to WO-05**.

### User-Facing Verification

**Skipped:** partial - UI is WO-04; the server's observable surface is the JSON API.

**Evidence:** self-check drives the real HTTP server on an ephemeral port; `node src/sor_3panel_server.mjs` booted as main module with `PORT=0` and shut down on SIGINT (exit 0); live `fetchComexSpot()` returned gold-api.com $6.219997/lb -> $2.69/FT.

**Blocking:** none

**Advisory:**
- A7 (`src/sor_3panel_server.mjs`, User-facing) — malformed percent-encoding path returned 500. **Fixed** (400 `BAD_PATH`).

### Security, Privacy, And Data Safety

**Skipped:** no

**Blocking:** none

**Advisory:**
- A1 (`src/lineage_core.mjs`, Security) — header spoof refusal was chained under the VP identity, not KAL. **Fixed** (`claimedActor` records EMP-AI-KAL whenever asserted).
- A3 (`src/lineage_core.mjs`, Security) — sandbox wipe could `rm -rf` any non-ancestor dir set via `SOR_SANDBOX_DIR`. **Fixed** (wipe only absent/empty dirs or dirs holding `p2p_kernel.sqlite3`; sandbox == seeds refused).
- A4 (`src/sor_3panel_server.mjs`, Security) — no CSRF / DNS-rebinding guard; `text/plain` writes accepted. **Fixed** (writes require `application/json` -> 415; loopback `Host` only -> 403 `BAD_HOST`).
- A5 (`src/lineage_core.mjs`, Security) — reset accepted unknown actors and the phonetic `CAL`. **Fixed** (unknown -> 403 `UNKNOWN_ACTOR`; `Cal` added to KAL identities).
- A8 (`src/lineage_core.mjs`, Security) — Step 7 accepted a non-object `invoice`; default invoice is PO-derived (self-fulfilling until WO-03 OCR). **Fixed** non-object -> 422; OCR sourcing **deferred to WO-03** (must source invoice server-side).

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 14 (8 fixed, 6 deferred/accepted/out-of-fence with reasons above)
- Files reviewed: src/lineage_core.mjs, src/sor_3panel_server.mjs, src/selfcheck.mjs, .sw-factory/WO-02/implementation-plan.md
- **Verdict:** APPROVED

### Post-review verification (after advisory fixes)

- `node --check src/lineage_core.mjs` / `src/sor_3panel_server.mjs` / `src/selfcheck.mjs` — pass
- `node src/selfcheck.mjs` — 26/26 checks pass (adds: KAL on unknown step & arbitrary verb, KAL chained as KAL, 415, bad Host 403, bad path 400, sandbox-wipe safety, reset authority, non-object invoice 422)
- `npm test` — exit 0 (stage smoke)

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
