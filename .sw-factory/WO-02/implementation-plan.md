<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-02

**Work Order:** WO-02 — Implement Core P2P State Kernel (src/lineage_core.mjs) & HTTP Server (:3590 src/sor_3panel_server.mjs) for Steps 1-8, Live COMEX Math & 501900 PPV
**Created At (UTC):** 2026-11-14T02:48:07Z

## Summary

Deliver a dependency-free Node 22 P2P state kernel (`src/lineage_core.mjs`) that derives every business constant from
`contracts/p2p-lineage-contract.json`, runs the 8-step copper stock-to-pay stream against sandboxed SQLite SoRs with
server-side DOA / SoD / AI-steward guardrails, live COMEX pricing, a balanced 501900 PPV journal (JS penny verifier +
`hledger --strict` gate) and an append-only SHA-256 audit chain; and a thin `node:http` server
(`src/sor_3panel_server.mjs`) on `127.0.0.1:${PORT||3590}` that exposes it as JSON.

## Code Reuse And Package Structure

Reuse:
- `contracts/p2p-lineage-contract.json` — single source for item ids, quantities, reel barcodes, standard cost,
  COMEX endpoints, mill adder, lb/FT, settlement numbers, trade-document names and GAAP account names.
- `seeds/*` from WO-01 (when present) — copied verbatim into `sor-sandbox/`; DOA limits read from
  `hrm_doa_authority_seat(emp_id, approval_limit_usd)`, standard cost from `part_partpricing.internal_cost_min`,
  stock from `stock_stockitem` (contract-declared tables/columns).
- Node built-ins only: `node:sqlite`, `node:http`, `node:crypto`, `node:fs`, `node:child_process` (hledger), global `fetch`.

Created:
- `src/lineage_core.mjs` — kernel (constants, money math, sandbox bootstrap, guardrails, steps 1-8, ledger, audit chain).
- `src/sor_3panel_server.mjs` — HTTP adapter + static `public/` serving (UI itself is WO-04).
- `src/selfcheck.mjs` — boots the server on an ephemeral port in a temp sandbox and asserts the WO-02 acceptance
  criteria end to end (WO-05 owns `tests/`; this file is the in-fence executable proof and is reusable by WO-05).

## Components And Flow

`openKernel({sandboxDir, seedsDir, offline, fetchImpl, hledgerBin, fresh, now}) -> P2PKernel`
- `act(step, {identities: [bodyActor, xActor, xAgentId], body}) -> Promise<{status, body}>` — serialised through a promise queue.
- `reset(identities)`, `snapshot()`, `verifyJournal({hledger})`, `verifyChain({entries})`, `quote()`, `health()`, `journalReport()`, `close()`.
- Pure exports: `CONTRACT`, `ACCOUNTS`, `OFFICERS`, `STEPS`, `astmB8UnitCents(spotPerLb)`, `fetchComexSpot(opts)`, `usdView`, `isStewardIdentity`, `Refusal`.
- Server exports: `startServer({port, host, sandboxDir, seedsDir, offline, fresh, fetchImpl, hledgerBin, publicDir})`, `createAppServer(kernel)`.
- Env: `PORT`, `SOR_SANDBOX_DIR`, `SOR_SEEDS_DIR`, `COMEX_OFFLINE=1`, `SOR_KEEP_SANDBOX=1`, `HLEDGER_BIN`, `HLEDGER=0`.

HTTP-layer guards (before the kernel): loopback `Host` only (403 `BAD_HOST`, DNS rebinding); writes require
`Content-Type: application/json` (415, CSRF); KAL header identity on any non-kernel write route -> 403.

Guard order per kernel request (before any state/order check, so traps fire in any state):
1. any identity (body actor, `x-actor`, `x-agent-id`, comma-split) in {EMP-AI-KAL, AGT-8090-KAL-01, KAL, Cal} -> 403
   `AI_STEWARD_ZERO_AUTHORITY` (chained with actor = EMP-AI-KAL); conflicting identities -> 403 `ACTOR_MISMATCH`.
2. unknown actor -> 403 `UNKNOWN_ACTOR`.
3. approval checkpoint and actor limit < amount -> 403 `DOA_LIMIT_EXCEEDED` (Darius $20k vs $23,120).
4. actor not the step seat -> 403 `SOX_SOD_VIOLATION` on Step 6 (e.g. Buyer Nancy), else 403 `SEAT_NOT_AUTHORIZED`.
Then: 409 `STEP_OUT_OF_ORDER` / `STEP_ALREADY_COMPLETE`, 422 input errors. Every refusal is chained into the audit
log with `$0.00` book impact.

Steps: 1 SQL stock-out -> REQ-25800 @ $2.89 std; 2 Darius confirms/escalates (`action:"approve"` = self-approval trap);
3 VP Devon approves; 4 COMEX spot (gold-api -> Yahoo HG=F -> 6.2602 offline) `round((spot+0.32)*0.411,2)` locks PO
(within Nancy's $50k), std cost untouched; 5 Vendor OA ENC-OA-2026-884192 hashed; 6 Marcus scans R01..R04
(+2,000 FT each, duplicates 409, tampered qty 422) -> on 4th scan posts DR 121100 std / CR 201200 actual / CR-or-DR
501900 PPV; 7 deterministic 3-way match (invoice override hook for WO-03 OCR; variance -> 409 `MATCH_VARIANCE_HOLD`)
-> DR 201200 / CR 201100; 8 CFO Meredith pays Check #10045 / ACH-000582 from 101100 (101200 > $5k -> 403
`BANK_POLICY_VIOLATION`) -> DR 201100 / CR 101100.

Ledger: legs stored in cents; posting refused unless sum == 0; candidate `company.journal` checked with
`hledger -f <tmp> --strict check` (when on PATH) before the DB commit.

HTTP: `GET /api/health|state|journal|audit|comex`, `POST /api/step/:n`, `POST /api/reset`, `GET /` + static `public/`.

## Steps

1. **Kernel constants + money math** — contract load, officers, cents helpers, ASTM B8 formula, COMEX fetch chain.
2. **Sandbox bootstrap** — copy `seeds/*`, fallback WMS/HRM/COA from contract, kernel DB (state, journal, audit).
3. **Guardrails + steps 1-8** — guard order above, adaptive SoR writes, ledger gate, audit chain.
4. **HTTP server** — routing, body limits, identity extraction, static serving, main-module boot.
5. **Self-check** — `src/selfcheck.mjs` end-to-end assertions (offline COMEX for determinism).

## Testing

- `node --check src/lineage_core.mjs`, `node --check src/sor_3panel_server.mjs`, `node --check src/selfcheck.mjs`.
- `node src/selfcheck.mjs` (26 checks) — temp sandbox, ephemeral port, offline COMEX: KAL 403 (body, header spoof,
  unknown step, arbitrary verb), Darius 403 DOA, Nancy dock 403 SoD, happy path 1-8, $2.70/FT = $21,600.00,
  PPV $1,520.00, std cost still $2.89, stock 0 -> 8,000 FT, tampered qty 422, duplicate scan 409, tampered invoice 409,
  payroll 101200 403, replay payment 409, DR==CR, hledger ok, chain valid (KAL chained as KAL), bad Host 403,
  non-JSON write 415, malformed path 400, sandbox-wipe safety, reset authority.
- `npm test` (stage smoke until WO-05 lands `tests/test-copper-e2e.mjs`).
- Manual: live COMEX quote via `GET /api/comex` (network permitting).

## Concrete Acceptance Criteria
- Read contracts/p2p-lineage-contract.json and implement src/lineage_core.mjs + src/sor_3panel_server.mjs (Node 22+ built-in node:sqlite, node:http, node:crypto; bind 127.0.0.1:${PORT||3590}; copy seeds/* into gitignored sor-sandbox/ runtime working dir, auto-bootstrapping fallback SQLite/journal tables from contracts/p2p-lineage-contract.json if seeds/ files are not present yet).
- Enforce HTTP 403 AI_STEWARD_ZERO_AUTHORITY server-side on any write/approval attempt by EMP-AI-KAL, HTTP 403 DOA_LIMIT_EXCEEDED if EMP-0021 Darius ($20k limit) attempts to self-approve $23,120 REQ-25800, and HTTP 403 SOX_SOD_VIOLATION if Buyer EMP-0002 Nancy attempts Step 6 dock receipt.
- Step 4 fetches live COMEX copper (HG) spot (https://api.gold-api.com/price/HG -> Yahoo HG=F fallback -> deterministic 6.2602/lb offline fallback) via ASTM B8 formula round((spotPerLb + 0.32) * 0.411, 2) (~$2.70/FT = $21,600.00) while keeping $2.89/FT Annual Standard Cost locked.
- Step 6 4x2,000-FT GS1 reel scan (ENC-GS1-884192-R01..R04 = +8,000 FT) posts balanced 3-leg GAAP journal: DR 121100 $23,120.00 / CR 201200 Actual PO (~$21,600.00) / CR 501900 Favorable PPV (~$1,520.00), verified with hledger (if on PATH) + built-in JS DR===CR penny verifier.

## Required Verification Commands
- `node --check src/lineage_core.mjs`
- `node --check src/sor_3panel_server.mjs`
- `npm test`
