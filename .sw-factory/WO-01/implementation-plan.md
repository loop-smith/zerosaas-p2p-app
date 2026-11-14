<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-01

**Work Order:** WO-01 — Bootstrap 4 MIT Headless SoR Seeds in seeds/ (wms_seed.sqlite3, hrm_seed.sqlite3, crm_seed.sqlite3, coa_seed.journal per contracts/p2p-lineage-contract.json)
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
- Read contracts/p2p-lineage-contract.json and create seeds/wms_seed.sqlite3, seeds/hrm_seed.sqlite3, seeds/crm_seed.sqlite3, and seeds/coa_seed.journal (plus a deterministic generator script in seeds/ if helpful).
- Strictly 1 stocked item ITM-CU-20-BARE (part_part.id=218, company_company.id=181 Encore Wire Corporation, part_supplierpart.id=124, stock_stocklocation.id=469 WH-TX-NORTH, part_partpricing.internal_cost_min=2.89 locked FY2026 Std Cost = $23,120.00, stock_stockitem 0 FT < 8,000 FT par) in seeds/wms_seed.sqlite3.
- Officer DOA limits in seeds/hrm_seed.sqlite3 (hrm_doa_authority_seat + hrm_employee + hrm_beehive_department FG-11): EMP-AI-KAL=$0.00 limit, EMP-0021 Darius Mercer=$20,000, EMP-0002 Nancy Rostova=$50,000, EMP-0005 Devon Brooks=$100,000, EMP-0003 Marcus Vance=Dock Lead, EMP-0001 Duncan Vance=$250,000, EMP-0007 Meredith Hale=$500,000.
- 89-account seeds/coa_seed.journal (hledger --strict compatible) including 101100 Operating Checking (#8801), 101200 Payroll/Petty Cash (#4409), 121100 WMS Inventory Stock, 201100 Trade Payables, 201200 GRNI Clearing, and 501900 Purchase Price Variance (PPV).

## Required Verification Commands
- `node --input-type=module -e "import fs from 'node:fs'; import {DatabaseSync} from 'node:sqlite'; for (const f of ['seeds/wms_seed.sqlite3','seeds/hrm_seed.sqlite3','seeds/crm_seed.sqlite3','seeds/coa_seed.journal']) { if (!fs.existsSync(f)) throw new Error('missing '+f); } const db=new DatabaseSync('seeds/wms_seed.sqlite3'); const r=db.prepare('SELECT COUNT(*) AS c FROM part_part WHERE id=218').get(); if (Number(r.c)!==1) throw new Error('part 218 missing');"`
- `npm test`
