<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-01

**Work Order:** WO-01 — Bootstrap 4 MIT Headless SoR Seeds in seeds/ (wms_seed.sqlite3, hrm_seed.sqlite3, crm_seed.sqlite3, coa_seed.journal per contracts/p2p-lineage-contract.json)
**Created At (UTC):** 2026-11-14T02:48:07Z

## Summary

Deliver the four System-of-Record seed files in `seeds/`. They come from a single stdlib-only Python generator (`seeds/build_seeds.py`) that reads `contracts/p2p-lineage-contract.json`, checks its internal arithmetic and identities, and writes the WMS, HRM and CRM SQLite databases plus the 89-account hledger chart of accounts. A pytest suite builds the seeds into a temporary root, asserts the contract facts, and fails when the committed seeds drift from the contract.

## Code Reuse And Package Structure

- Reused: `contracts/p2p-lineage-contract.json` is the only source of truth. The generator reads these values from it rather than restating them: ids 218/181/124/469, SKU, UOM, description, minimum stock, $2.89 standard, 0 FT on hand, vendor name, KAL steward identity and caps, and the Nancy Rostova purview seat. The contract's `semanticBindings` (table, key and value column names) set the table and column names.
- Reused: the repo has no existing application code yet (`package.json` `start` points at a future `src/`). Nothing else is available to reuse.
- Followed pattern: InvenTree table and column names (`company_company`, `part_part`, `part_partpricing`, `part_supplierpart`, `stock_stocklocation`, `stock_stockitem`, `order_purchaseorder`, `order_purchaseorderlineitem`) and the Django-CRM `accounts_account`. This keeps later work orders' SQL aligned with the upstream MIT SoRs.
- Created (layer `seeds/`):
  - `seeds/build_seeds.py`: generator plus `--check` drift guard
  - `seeds/test_seeds.py`: pytest suite
  - `seeds/wms_seed.sqlite3`, `seeds/hrm_seed.sqlite3`, `seeds/crm_seed.sqlite3`, `seeds/coa_seed.journal`: generated artifacts, committed

## Components And Flow

Public surface of `seeds/build_seeds.py` (signatures locked):

- `build(out_dir: Path = SEEDS_DIR, contract_path: Path = CONTRACT) -> dict[str, Path]` writes all four seeds and returns name → path.
- `drift(seed_dir: Path = SEEDS_DIR, contract_path: Path = CONTRACT) -> list[str]` returns the names of seeds that are missing or differ logically from a fresh build.
- `logical_dump(path: Path) -> str` returns the SQLite `iterdump()`, or the journal text. Comparison does not depend on the SQLite library version.
- CLI: `python3 seeds/build_seeds.py [--out DIR] [--contract PATH] [--check]`.
- Refusal code: `ValueError("SEED_CONTRACT_DRIFT: …")` when the contract is internally inconsistent. The checks are: stocked item count is not 1, std × min ≠ catalog estimate, reels × ft/reel ≠ qty, reel barcode count is wrong, the AI steward does not hold $0 / 0 credentials, the purview seat does not match, ledger bindings are missing from the COA, or the COA does not have 89 unique accounts. CLI `--check` prints `SEED_DRIFT: <files>` and exits 1.

Flow: `load_contract` → `_validate` → `wms_rows` / `hrm_rows` / `crm_rows` → `_write_sqlite`. `_write_sqlite` writes to a temp file with FKs enforced and deferred (because `part_part.default_supplier_id` ↔ `part_supplierpart.part_id` is circular), runs `PRAGMA foreign_key_check`, then `VACUUM`, then does an atomic `os.replace`. `coa_journal` writes the journal and stamps it with the contract sha256.

Schema-level controls:
- `stock_stockitem.quantity >= 0`
- `hrm_doa_authority_seat` CHECK: an AI steward row must hold a $0 limit, 0 DB write credentials and no duty flags. This is the KAL zero-authority rule, enforced at layer 1.
- `emp_id LIKE 'EMP-AI-%'` is tied to `is_ai` / `is_ai_steward`, so KAL cannot flip the AI flag off to unlock authority.
- On a failed write, the temp file is removed. Malformed contract keys also raise `SEED_CONTRACT_DRIFT`.
- The journal stamp is the sha256 of the canonical JSON, so it does not change with CRLF/LF line endings.

## Steps

1. **Generator**: write `seeds/build_seeds.py` with the DDL, the officer and COA tables, contract validation and the writers.
2. **Tests**: write `seeds/test_seeds.py` and run it red (committed seeds absent → drift test fails).
3. **Generate**: run `python3 seeds/build_seeds.py` to write the four committed seeds, then rerun the tests green.
4. **Docs**: fill the WO-01 checklist, context and review log.

## Testing

- `python3 -m pytest seeds -q -p no:cacheprovider` runs 23 tests. They build into a pytest `tmp_path` and do not mock the unit under test. They cover:
  - all 4 files are written
  - `integrity_check` passes and there are no FK violations
  - strictly 1 stocked item with exact ids, including the 0-FT stock row at location 469 / supplier part 124
  - the stock-out signal (0 < 8,000) and $2.89 × 8,000 = $23,120.00 using `Decimal`
  - negative stock and dangling FKs are refused
  - all 7 DOA limits, plus FG-11
  - segregation of duties holder sets for all 6 duties. Requisition approval is limit-tiered (Darius ≤ $20k, else Devon). The buyer cannot dock-receive.
  - the schema refuses KAL authority, write credentials, duties, and the multi-column AI-flag flip
  - the CRM vendor cross-reference
  - journal shape: 89 unique `account` directives with `type:` tags, `commodity` declared, no postings, banks #8801/#4409, and the contract LEDGER bindings plus 501900 declared
  - 8 contract-drift mutations are refused with `SEED_CONTRACT_DRIFT` and write nothing
  - a failed write leaves no temp file
  - `drift()` reports corrupt and missing seeds
  - the committed seeds match the contract
- `python3 seeds/build_seeds.py --check` is the drift guard.
- Python equivalent of the Required Verification node one-liner: the files exist and `part_part` id 218 count is 1.
- `npm test` / `node:sqlite` were not run in this lane. Only `python3` and `git` are permitted here.

## Concrete Acceptance Criteria
- Read contracts/p2p-lineage-contract.json and create seeds/wms_seed.sqlite3, seeds/hrm_seed.sqlite3, seeds/crm_seed.sqlite3, and seeds/coa_seed.journal (plus a deterministic generator script in seeds/ if helpful).
- Strictly 1 stocked item ITM-CU-20-BARE (part_part.id=218, company_company.id=181 Encore Wire Corporation, part_supplierpart.id=124, stock_stocklocation.id=469 WH-TX-NORTH, part_partpricing.internal_cost_min=2.89 locked FY2026 Std Cost = $23,120.00, stock_stockitem 0 FT < 8,000 FT par) in seeds/wms_seed.sqlite3.
- Officer DOA limits in seeds/hrm_seed.sqlite3 (hrm_doa_authority_seat + hrm_employee + hrm_beehive_department FG-11): EMP-AI-KAL=$0.00 limit, EMP-0021 Darius Mercer=$20,000, EMP-0002 Nancy Rostova=$50,000, EMP-0005 Devon Brooks=$100,000, EMP-0003 Marcus Vance=Dock Lead, EMP-0001 Duncan Vance=$250,000, EMP-0007 Meredith Hale=$500,000.
- 89-account seeds/coa_seed.journal (hledger --strict compatible) including 101100 Operating Checking (#8801), 101200 Payroll/Petty Cash (#4409), 121100 WMS Inventory Stock, 201100 Trade Payables, 201200 GRNI Clearing, and 501900 Purchase Price Variance (PPV).

## Required Verification Commands
- `node --input-type=module -e "import fs from 'node:fs'; import {DatabaseSync} from 'node:sqlite'; for (const f of ['seeds/wms_seed.sqlite3','seeds/hrm_seed.sqlite3','seeds/crm_seed.sqlite3','seeds/coa_seed.journal']) { if (!fs.existsSync(f)) throw new Error('missing '+f); } const db=new DatabaseSync('seeds/wms_seed.sqlite3'); const r=db.prepare('SELECT COUNT(*) AS c FROM part_part WHERE id=218').get(); if (Number(r.c)!==1) throw new Error('part 218 missing');"`
- `npm test`
