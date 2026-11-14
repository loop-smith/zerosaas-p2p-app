<!--lint disable strong-marker-->

# Review Log: WO-01

**Work Order:** WO-01 — Bootstrap 4 MIT Headless SoR Seeds in seeds/ (wms_seed.sqlite3, hrm_seed.sqlite3, crm_seed.sqlite3, coa_seed.journal per contracts/p2p-lineage-contract.json)
**Initialized At (UTC):** 2026-11-14T02:48:07Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

Delegated review: a fresh general-purpose subagent with read-only scope. The change set is the new `seeds/` directory: `build_seeds.py`, `test_seeds.py` and the 4 generated seeds.

### Requirements Alignment

**Blocking:** none.

**Advisory:**
- (`seeds/build_seeds.py` OFFICERS) Segregation of duties was only partly asserted. Requisition approval is held by both Darius and Devon, which is intended because approval is limit-tiered, but no test asserted it.

### Blueprint Alignment

**Blocking:** none. No blueprint documents are linked to WO-01. `contracts/p2p-lineage-contract.json` is the governing contract, and the dumped DB contents match every `semanticBindings` table and key used by WO-01.

**Advisory:** none.

### Architecture And Conventions

**Blocking:** none.

**Advisory:**
- (`_write_sqlite`) A failed build left `*.sqlite3.tmp` behind.
- (`_validate`) A missing purview officer or a missing key escaped the `SEED_CONTRACT_DRIFT` refusal code as `StopIteration` / `KeyError`.
- (`coa_journal`) The stamp hashed the raw contract bytes, so a CRLF checkout (Windows `core.autocrlf`) would report false drift.
- (`drift`) A corrupt committed `.sqlite3` crashed `--check` with a traceback.
- (data) `internal_cost_min` is stored as SQLite REAL, which is Django-on-SQLite parity. `2.89 × 8000` is exactly 23120.0. Later WOs should do money math in `Decimal`.

### Tests And Build

**Commands run:** `python3 -m pytest seeds -q -p no:cacheprovider` → 15 passed. `python3 seeds/build_seeds.py --check` → `seeds OK`.

**Blocking:** none.

**Advisory:**
- The drift-refusal test exercised only 1 of the 8 validation branches.
- The `stock_stockitem` location and supplier part were not asserted.
- The COA test checked codes but not full account names.
- The determinism test was effectively vacuous.
- The test helpers leaked connections (`with sqlite3.connect` does not close).

### User-Facing Verification

**Skipped:** yes. WO-01 delivers data files plus a CLI generator, with no UI.

**Evidence:**
- CLI `python3 seeds/build_seeds.py` printed the 4 written paths.
- `--check` printed `seeds OK`.
- The reviewer dumped all 3 DBs and checked them row by row against the contract.

**Blocking:** none.

**Advisory:**
- `hledger --strict check` could not be executed because only python3 and git are permitted in this lane. The reviewer checked it by reading the syntax: account directives with two spaces before `;`, valid `type:` codes, a declared `commodity`, and no postings. The reviewer expects it to pass.

### Security, Privacy, And Data Safety

**Skipped:** no.

**Blocking:** none.

**Advisory:**
- (`hrm_doa_authority_seat`) The KAL zero-authority CHECK could be bypassed in a single UPDATE: `is_ai_steward=0` together with a limit, credentials and a payment duty. The reviewer reproduced this on a copy of the DB.
- f-string SQL only takes table names from hardcoded dict keys. All values are `?` parameters, so there is no external influence.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 8
- Files reviewed: seeds/build_seeds.py, seeds/test_seeds.py, seeds/wms_seed.sqlite3, seeds/hrm_seed.sqlite3, seeds/crm_seed.sqlite3, seeds/coa_seed.journal
- **Verdict:** APPROVED

### Round 1 Advisory Follow-Up (implementer)

Each fix was made in `seeds/build_seeds.py` and is covered by a test in `seeds/test_seeds.py`.

- **KAL bypass:**
  - Fix: added the CHECK `(emp_id LIKE 'EMP-AI-%') = (is_ai = 1)` on `hrm_employee`, and the same rule on `hrm_doa_authority_seat.is_ai_steward`.
  - Test: `test_hrm_schema_refuses_ai_steward_authority` now includes the multi-column flip and the `is_ai` flip.
- **Temp file left behind:**
  - Fix: `_write_sqlite` now unlinks the temp file on any exception.
  - Test: `test_failed_sqlite_write_leaves_no_temp_file`.
- **Refusal code escapes:**
  - Fix: `build` wraps `KeyError` / `TypeError` / `StopIteration` from contract reads as `SEED_CONTRACT_DRIFT`.
  - Test: `test_contract_drift_is_refused` is parametrized over 8 mutations, including `purview-missing` and `missing-key`, and asserts that nothing is written.
- **CRLF false drift:** fixed. The journal stamp is now `canonical-sha256` of `json.dumps(sort_keys=True)`.
- **Corrupt seed crash:**
  - Fix: `drift` treats unreadable seeds as drifted.
  - Test: `test_drift_reports_corrupt_and_missing_seeds`.
- **Test gaps:**
  - SoD holder sets are now asserted for all 6 duties.
  - The `stock_stockitem` row is asserted as `(218, 469, 124, NULL, 0)`.
  - Full COA names are asserted against the contract LEDGER bindings plus 501900.
  - The vacuous determinism test was dropped. The committed-vs-fresh drift test covers determinism.
  - The helpers now use `contextlib.closing`.
- **Left as-is:** REAL storage of standard cost, which is upstream InvenTree/Django parity. A mid-year price-lock trigger is out of WO-01 scope.

**Re-verification:**
- `python3 -m pytest seeds -q -p no:cacheprovider` → 23 passed.
- `python3 seeds/build_seeds.py --check` → `seeds OK`.
- A Python equivalent of the plan's node verification (4 files exist, `part_part` id 218 count = 1) → OK.

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
