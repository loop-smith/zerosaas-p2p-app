<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-02

**Work Order:** WO-02 — Implement Core P2P State Kernel (src/lineage_core.mjs) & HTTP Server (:3590 src/sor_3panel_server.mjs) for Steps 1-8, Live COMEX Math & 501900 PPV
**Created At (UTC):** 2026-11-14T02:48:07Z

## Summary

_1-3 sentences: what this work order delivers and the high-level approach._

## Code Reuse And Package Structure

_List critical existing files/components/services/hooks/utilities/schemas/tests to reuse or import as dependencies. Note reuse/extract/follow-pattern decisions. Then list files/packages/directories intentionally created or modified by this plan, grouped by module or layer. Do not list incidental import-order, barrel export, formatting, generated-code, or mechanical follow-on edits._

## Components And Flow

_Name Blueprint-defined components, supporting components, important interfaces/signatures, and call/data flow._

## Steps

_Ordered implementation steps. Each step should produce a reviewable, preferably compilable intermediate state. Note parallelizable steps (touch different files, no dependency)._

1. **[title]** - _what to do, where_
2. **[title]** - _what to do, where_

## Testing

_Automated and manual tests: suites, new/changed test files, scenarios, and commands. Not for requirements/blueprint conformance—that belongs in review._

## Concrete Acceptance Criteria
- Read contracts/p2p-lineage-contract.json and implement src/lineage_core.mjs + src/sor_3panel_server.mjs (Node 22+ built-in node:sqlite, node:http, node:crypto; bind 127.0.0.1:${PORT||3590}; copy seeds/* into gitignored sor-sandbox/ runtime working dir, auto-bootstrapping fallback SQLite/journal tables from contracts/p2p-lineage-contract.json if seeds/ files are not present yet).
- Enforce HTTP 403 AI_STEWARD_ZERO_AUTHORITY server-side on any write/approval attempt by EMP-AI-KAL, HTTP 403 DOA_LIMIT_EXCEEDED if EMP-0021 Darius ($20k limit) attempts to self-approve $23,120 REQ-25800, and HTTP 403 SOX_SOD_VIOLATION if Buyer EMP-0002 Nancy attempts Step 6 dock receipt.
- Step 4 fetches live COMEX copper (HG) spot (https://api.gold-api.com/price/HG -> Yahoo HG=F fallback -> deterministic 6.2602/lb offline fallback) via ASTM B8 formula round((spotPerLb + 0.32) * 0.411, 2) (~$2.70/FT = $21,600.00) while keeping $2.89/FT Annual Standard Cost locked.
- Step 6 4x2,000-FT GS1 reel scan (ENC-GS1-884192-R01..R04 = +8,000 FT) posts balanced 3-leg GAAP journal: DR 121100 $23,120.00 / CR 201200 Actual PO (~$21,600.00) / CR 501900 Favorable PPV (~$1,520.00), verified with hledger (if on PATH) + built-in JS DR===CR penny verifier.

## Required Verification Commands
- `node --check src/lineage_core.mjs`
- `node --check src/sor_3panel_server.mjs`
- `npm test`
