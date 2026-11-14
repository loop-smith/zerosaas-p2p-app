"""Deterministic generator for the 4 MIT headless System-of-Record seeds (WO-01).

Reads contracts/p2p-lineage-contract.json and writes, into seeds/ (or --out DIR):

  wms_seed.sqlite3   InvenTree-shaped WMS: strictly 1 stocked item (ITM-CU-20-BARE) at 0 FT on hand
  hrm_seed.sqlite3   Headless HRM: FG-11 department, 6 human officers + KAL AI steward DOA seats
  crm_seed.sqlite3   Django-CRM-shaped vendor account for the WMS supplier
  coa_seed.journal   89-account hledger --strict chart of accounts (declarations only, no postings)

Standard library only. Re-running produces the same logical content; `--check` exits 1 if the
committed seeds drifted from what the contract generates.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

SEEDS_DIR = Path(__file__).resolve().parent
CONTRACT = SEEDS_DIR.parent / "contracts" / "p2p-lineage-contract.json"
SQLITE_SEEDS = ("wms_seed.sqlite3", "hrm_seed.sqlite3", "crm_seed.sqlite3")
JOURNAL_SEED = "coa_seed.journal"
SEED_FILES = SQLITE_SEEDS + (JOURNAL_SEED,)

# ---------------------------------------------------------------------------------------------
# WMS (InvenTree table/column names; only the tables the contract binds, FKs declared)
# ---------------------------------------------------------------------------------------------
WMS_DDL = """
CREATE TABLE company_company (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  is_customer INTEGER NOT NULL DEFAULT 0,
  is_supplier INTEGER NOT NULL DEFAULT 0,
  is_manufacturer INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE part_partcategory (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_id INTEGER REFERENCES part_partcategory(id),
  pathstring TEXT NOT NULL
);
CREATE TABLE stock_stocklocation (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  parent_id INTEGER REFERENCES stock_stocklocation(id),
  pathstring TEXT NOT NULL,
  structural INTEGER NOT NULL DEFAULT 0,
  external INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE part_part (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  IPN TEXT UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES part_partcategory(id),
  units TEXT NOT NULL DEFAULT '',
  minimum_stock NUMERIC NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  default_location_id INTEGER REFERENCES stock_stocklocation(id),
  default_supplier_id INTEGER REFERENCES part_supplierpart(id),
  active INTEGER NOT NULL DEFAULT 1,
  purchaseable INTEGER NOT NULL DEFAULT 1,
  salable INTEGER NOT NULL DEFAULT 0,
  trackable INTEGER NOT NULL DEFAULT 0,
  component INTEGER NOT NULL DEFAULT 0,
  assembly INTEGER NOT NULL DEFAULT 0,
  virtual INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE part_partpricing (
  id INTEGER PRIMARY KEY,
  part_id INTEGER NOT NULL UNIQUE REFERENCES part_part(id),
  currency TEXT NOT NULL DEFAULT 'USD',
  internal_cost_min NUMERIC,
  internal_cost_min_currency TEXT NOT NULL DEFAULT 'USD',
  internal_cost_max NUMERIC,
  internal_cost_max_currency TEXT NOT NULL DEFAULT 'USD',
  overall_min NUMERIC,
  overall_min_currency TEXT NOT NULL DEFAULT 'USD',
  overall_max NUMERIC,
  overall_max_currency TEXT NOT NULL DEFAULT 'USD'
);
CREATE TABLE part_supplierpart (
  id INTEGER PRIMARY KEY,
  part_id INTEGER NOT NULL REFERENCES part_part(id),
  supplier_id INTEGER NOT NULL REFERENCES company_company(id),
  SKU TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pack_quantity TEXT NOT NULL DEFAULT '1',
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE (part_id, supplier_id, SKU)
);
CREATE TABLE order_purchaseorder (
  id INTEGER PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  reference_int INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  status INTEGER NOT NULL DEFAULT 10,
  supplier_id INTEGER NOT NULL REFERENCES company_company(id),
  supplier_reference TEXT NOT NULL DEFAULT '',
  issue_date TEXT,
  target_date TEXT,
  complete_date TEXT,
  total_price NUMERIC,
  total_price_currency TEXT NOT NULL DEFAULT 'USD'
);
CREATE TABLE order_purchaseorderlineitem (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES order_purchaseorder(id),
  part_id INTEGER REFERENCES part_supplierpart(id),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  received NUMERIC NOT NULL DEFAULT 0 CHECK (received >= 0),
  purchase_price NUMERIC,
  purchase_price_currency TEXT NOT NULL DEFAULT 'USD',
  destination_id INTEGER REFERENCES stock_stocklocation(id),
  reference TEXT NOT NULL DEFAULT ''
);
CREATE TABLE stock_stockitem (
  id INTEGER PRIMARY KEY,
  part_id INTEGER NOT NULL REFERENCES part_part(id),
  location_id INTEGER REFERENCES stock_stocklocation(id),
  supplier_part_id INTEGER REFERENCES part_supplierpart(id),
  purchase_order_id INTEGER REFERENCES order_purchaseorder(id),
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  serial TEXT,
  batch TEXT,
  status INTEGER NOT NULL DEFAULT 10,
  purchase_price NUMERIC,
  purchase_price_currency TEXT NOT NULL DEFAULT 'USD'
);
"""

# ---------------------------------------------------------------------------------------------
# HRM (DOA seats carry the zero-authority rule for AI stewards as a table CHECK)
# ---------------------------------------------------------------------------------------------
HRM_DDL = """
CREATE TABLE hrm_beehive_department (
  beehive_fg_id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE hrm_employee (
  emp_id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  title TEXT NOT NULL,
  beehive_fg_id TEXT REFERENCES hrm_beehive_department(beehive_fg_id),
  is_ai INTEGER NOT NULL DEFAULT 0 CHECK (is_ai IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1,
  CHECK ((emp_id LIKE 'EMP-AI-%') = (is_ai = 1))
);
CREATE TABLE hrm_doa_authority_seat (
  emp_id TEXT PRIMARY KEY REFERENCES hrm_employee(emp_id),
  seat_code TEXT NOT NULL UNIQUE,
  approval_limit_usd NUMERIC NOT NULL CHECK (approval_limit_usd >= 0),
  may_request INTEGER NOT NULL DEFAULT 0,
  may_approve_requisition INTEGER NOT NULL DEFAULT 0,
  may_issue_po INTEGER NOT NULL DEFAULT 0,
  may_receive_dock INTEGER NOT NULL DEFAULT 0,
  may_voucher_ap INTEGER NOT NULL DEFAULT 0,
  may_release_payment INTEGER NOT NULL DEFAULT 0,
  is_ai_steward INTEGER NOT NULL DEFAULT 0 CHECK (is_ai_steward IN (0, 1)),
  db_write_credentials INTEGER NOT NULL DEFAULT 0 CHECK (db_write_credentials >= 0),
  CHECK ((emp_id LIKE 'EMP-AI-%') = (is_ai_steward = 1)),
  CHECK (is_ai_steward = 0 OR (approval_limit_usd = 0 AND db_write_credentials = 0
    AND may_request + may_approve_requisition + may_issue_po + may_receive_dock
      + may_voucher_ap + may_release_payment = 0))
);
"""

DEPARTMENTS = (("FG-11", "Warehouse & Central Receiving Hub"),)

# emp_id, full_name, title, fg, seat_code, limit, (request, approve_req, issue_po, receive, voucher, pay)
OFFICERS = (
    ("EMP-0001", "Duncan Vance", "Controller", None, "CONTROLLER_AP_VOUCHER", "250000.00", (0, 0, 0, 0, 1, 0)),
    ("EMP-0002", "Nancy Rostova", "Centralized Purchasing Lead", None, "CENTRAL_PURCHASING", "50000.00", (0, 0, 1, 0, 0, 0)),
    ("EMP-0003", "Marcus Vance", "Warehouse Dock Lead", "FG-11", "DOCK_RECEIVER", "0.00", (0, 0, 0, 1, 0, 0)),
    ("EMP-0005", "Devon Brooks", "VP Supply Chain", None, "VP_SUPPLY_CHAIN", "100000.00", (0, 1, 0, 0, 0, 0)),
    ("EMP-0007", "Meredith Hale", "Chief Financial Officer", None, "CFO_PAYMENT_RELEASE", "500000.00", (0, 0, 0, 0, 0, 1)),
    ("EMP-0021", "Darius Mercer", "Supply Chain Planner", None, "SUPPLY_CHAIN_PLANNER", "20000.00", (1, 1, 0, 0, 0, 0)),
)

# ---------------------------------------------------------------------------------------------
# CRM (Django-CRM accounts_account shape; vendor cross-referenced to the WMS supplier)
# ---------------------------------------------------------------------------------------------
CRM_DDL = """
CREATE TABLE accounts_account (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  account_type TEXT NOT NULL CHECK (account_type IN ('CUSTOMER', 'VENDOR', 'PARTNER')),
  status TEXT NOT NULL DEFAULT 'open',
  external_ref TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1
);
"""

# ---------------------------------------------------------------------------------------------
# 89-account chart of accounts: (code, leaf name, hledger type, extra tags)
# ---------------------------------------------------------------------------------------------
COA = (
    ("101100", "Operating-Checking", "C", "bank: 8801"),
    ("101200", "Payroll-Checking", "C", "bank: 4409, payment_cap_usd: 5000"),
    ("101300", "Money-Market-Sweep", "C", ""),
    ("101400", "Undeposited-Funds", "C", ""),
    ("111100", "AR-Trade-Receivables", "A", ""),
    ("111200", "Allowance-For-Doubtful-Accounts", "A", ""),
    ("111300", "Employee-Advances", "A", ""),
    ("121100", "WMS-Inventory-Stock", "A", "valuation: FY2026-standard-cost"),
    ("121200", "Inventory-In-Transit", "A", ""),
    ("121300", "Inventory-Obsolescence-Reserve", "A", ""),
    ("131100", "Prepaid-Expenses", "A", ""),
    ("131200", "Prepaid-Insurance", "A", ""),
    ("131300", "Vendor-Deposits", "A", ""),
    ("141100", "Sales-Tax-Receivable", "A", ""),
    ("151100", "Land", "A", ""),
    ("151200", "Buildings", "A", ""),
    ("151300", "Warehouse-Equipment", "A", ""),
    ("151400", "Vehicles-Forklifts", "A", ""),
    ("151500", "Computer-Equipment", "A", ""),
    ("151600", "Furniture-Fixtures", "A", ""),
    ("159100", "Accumulated-Depreciation", "A", ""),
    ("161100", "Security-Deposits", "A", ""),
    ("201100", "AP-Trade-Payables", "L", ""),
    ("201200", "GRNI-Goods-Received-Not-Invoiced", "L", ""),
    ("201300", "Accrued-Freight", "L", ""),
    ("211100", "Accrued-Payroll", "L", ""),
    ("211200", "Accrued-Payroll-Taxes", "L", ""),
    ("211300", "Accrued-Benefits", "L", ""),
    ("211400", "Accrued-Expenses", "L", ""),
    ("221100", "Sales-Tax-Payable", "L", ""),
    ("221200", "Use-Tax-Payable", "L", ""),
    ("221300", "Income-Tax-Payable", "L", ""),
    ("231100", "Customer-Deposits", "L", ""),
    ("241100", "Line-Of-Credit", "L", ""),
    ("251100", "Current-Portion-Long-Term-Debt", "L", ""),
    ("261100", "Long-Term-Debt", "L", ""),
    ("271100", "Deferred-Rent", "L", ""),
    ("301100", "Common-Stock", "E", ""),
    ("301200", "Additional-Paid-In-Capital", "E", ""),
    ("311100", "Retained-Earnings", "E", ""),
    ("321100", "Owner-Distributions", "E", ""),
    ("391100", "Opening-Balances", "E", ""),
    ("401100", "Product-Sales", "R", ""),
    ("401200", "Service-Revenue", "R", ""),
    ("401300", "Freight-Revenue", "R", ""),
    ("411100", "Sales-Returns-Allowances", "R", ""),
    ("411200", "Sales-Discounts", "R", ""),
    ("421100", "Interest-Income", "R", ""),
    ("421200", "Other-Income", "R", ""),
    ("501100", "COGS-Materials", "X", ""),
    ("501200", "COGS-Freight-In", "X", ""),
    ("501300", "COGS-Direct-Labor", "X", ""),
    ("501400", "Inventory-Shrinkage", "X", ""),
    ("501500", "Inventory-Adjustments", "X", ""),
    ("501900", "Purchase-Price-Variance", "X", ""),
    ("511100", "Warehouse-Supplies", "X", ""),
    ("511200", "Packaging-Materials", "X", ""),
    ("511300", "Dock-Equipment-Rental", "X", ""),
    ("601100", "Salaries-Wages", "X", ""),
    ("601200", "Payroll-Taxes", "X", ""),
    ("601300", "Employee-Benefits", "X", ""),
    ("601400", "Workers-Compensation", "X", ""),
    ("611100", "Rent-Lease", "X", ""),
    ("611200", "Utilities", "X", ""),
    ("611300", "Repairs-Maintenance", "X", ""),
    ("611400", "Property-Taxes", "X", ""),
    ("621100", "Insurance-General-Liability", "X", ""),
    ("621200", "Insurance-Property", "X", ""),
    ("631100", "Professional-Fees-Audit", "X", ""),
    ("631200", "Professional-Fees-Legal", "X", ""),
    ("641100", "Software-Subscriptions", "X", ""),
    ("641200", "Telecommunications", "X", ""),
    ("641300", "Office-Supplies", "X", ""),
    ("651100", "Travel", "X", ""),
    ("651200", "Meals", "X", ""),
    ("661100", "Advertising-Marketing", "X", ""),
    ("671100", "Bank-Service-Charges", "X", ""),
    ("671200", "Merchant-Fees", "X", ""),
    ("681100", "Depreciation-Expense", "X", ""),
    ("691100", "Freight-Out", "X", ""),
    ("691200", "Fuel-Vehicle", "X", ""),
    ("691300", "Training-Development", "X", ""),
    ("691400", "Dues-Subscriptions", "X", ""),
    ("691900", "Miscellaneous-Expense", "X", ""),
    ("701100", "Interest-Expense", "X", ""),
    ("701200", "Loss-On-Disposal", "X", ""),
    ("711100", "Income-Tax-Expense", "X", ""),
    ("721100", "FX-Gain-Loss", "X", ""),
    ("791100", "Suspense-Clearing", "X", ""),
)
TOP_LEVEL = {"A": "Assets", "C": "Assets", "L": "Liabilities", "E": "Equity", "R": "Revenues", "X": "Expenses"}


def account_name(code: str, leaf: str, kind: str) -> str:
    return f"{TOP_LEVEL[kind]}:{code}-{leaf}"


def _require(ok: bool, what: str) -> None:
    if not ok:
        raise ValueError(f"SEED_CONTRACT_DRIFT: {what}")


def load_contract(path: Path = CONTRACT) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _validate(contract: dict) -> None:
    item = contract["primaryItem"]
    trig = item["lowStockTrigger"]
    std = Decimal(str(trig["catalogUnitPriceUsd"])) * trig["minThresholdFt"]
    _require(item["stockedItemCountInWms"] == 1, "WMS must carry strictly 1 stocked item")
    _require(std == Decimal(str(trig["catalogEstimateUsd"])), "standard cost x min stock != catalog estimate")
    _require(trig["reelCount"] * trig["ftPerReel"] == item["quantityFt"], "reels x ft/reel != PO quantity")
    _require(len(trig["reelBarcodes"]) == trig["reelCount"], "reel barcode count != reel count")
    steward, purview = contract["provenance"]["aiSteward"], contract["provenance"]["purviewSeat"]
    _require(steward["signingLimitUsd"] == 0 and steward["dbWriteCredentials"] == 0, "AI steward must hold $0 / 0 creds")
    nancy = next(o for o in OFFICERS if o[0] == purview["empId"])
    _require(nancy[1] == purview["name"] and Decimal(nancy[5]) == purview["doaLimitUsd"], "purview seat mismatch")
    journal_accounts = {b["value_column"] for b in contract["semanticBindings"] if b["source_system"] == "LEDGER"}
    declared = {account_name(*row[:3]) for row in COA}
    _require(journal_accounts <= declared, f"ledger bindings not in COA: {sorted(journal_accounts - declared)}")
    _require(len(COA) == 89 and len({row[0] for row in COA}) == 89, "COA must hold 89 unique accounts")


def _write_sqlite(path: Path, ddl: str, rows: dict[str, list[tuple]]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.unlink(missing_ok=True)
    con = sqlite3.connect(tmp)
    try:
        con.execute("PRAGMA foreign_keys = ON")
        con.executescript(ddl)
        con.execute("PRAGMA defer_foreign_keys = ON")  # part_part <-> part_supplierpart is circular
        for table, values in rows.items():
            for row in values:
                con.execute(f"INSERT INTO {table} VALUES ({', '.join('?' * len(row))})", row)
        con.commit()
        _require(not con.execute("PRAGMA foreign_key_check").fetchall(), f"{path.name} FK violations")
        con.execute("VACUUM")
    except BaseException:
        con.close()
        tmp.unlink(missing_ok=True)
        raise
    con.close()
    os.replace(tmp, path)


def wms_rows(contract: dict) -> dict[str, list[tuple]]:
    item = contract["primaryItem"]
    trig = item["lowStockTrigger"]
    std = trig["catalogUnitPriceUsd"]
    return {
        "company_company": [(item["wmsSupplierId"], item["vendorName"], "Copper wire mill supplier", "USD", 0, 1, 1, 1)],
        "part_partcategory": [(1, "Copper Wire & Cable", "Bare stranded copper conductors", None, "Copper Wire & Cable")],
        "stock_stocklocation": [(item["wmsLocationId"], "WH-TX-NORTH", "Receiving hub", None, "WH-TX-NORTH", 0, 0)],
        "part_part": [(
            item["wmsPartId"], item["sku"], item["sku"], item["description"], 1, item["uom"], trig["minThresholdFt"],
            item["wmsLocationId"], item["wmsSupplierPartId"], 1, 1, 0, 1, 0, 0, 0,
        )],
        "part_partpricing": [(1, item["wmsPartId"], "USD", std, "USD", std, "USD", std, "USD", std, "USD")],
        "part_supplierpart": [(
            item["wmsSupplierPartId"], item["wmsPartId"], item["wmsSupplierId"], item["sku"], item["description"], "1", 1,
        )],
        "stock_stockitem": [(
            1, item["wmsPartId"], item["wmsLocationId"], item["wmsSupplierPartId"], None,
            trig["onHandStockFt"], None, None, 10, std, "USD",
        )],
    }


def hrm_rows(contract: dict) -> dict[str, list[tuple]]:
    steward = contract["provenance"]["aiSteward"]
    employees = [(e, n, t, fg, 0, 1) for e, n, t, fg, *_ in OFFICERS]
    seats = [(e, code, limit, *flags, 0, 1) for e, _n, _t, _fg, code, limit, flags in OFFICERS]
    employees.append((steward["id"], steward["name"], steward["role"], None, 1, 1))
    seats.append((steward["id"], "AI_STEWARD_ZERO_AUTHORITY", "0.00", 0, 0, 0, 0, 0, 0, 1, steward["dbWriteCredentials"]))
    return {"hrm_beehive_department": list(DEPARTMENTS), "hrm_employee": employees, "hrm_doa_authority_seat": seats}


def crm_rows(contract: dict) -> dict[str, list[tuple]]:
    item = contract["primaryItem"]
    return {"accounts_account": [(1, item["vendorName"], "VENDOR", "open", f"WMS:company_company:{item['wmsSupplierId']}", 1)]}


def coa_journal(contract: dict) -> str:
    canonical = json.dumps(contract, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    lines = [
        "; coa_seed.journal - 89-account GAAP chart of accounts (hledger --strict compatible). MIT License.",
        f"; Generated by seeds/build_seeds.py from contracts/p2p-lineage-contract.json canonical-sha256={digest}",
        "; Declarations only: no postings. Inventory 121100 carries the locked FY2026 standard cost;",
        "; spot variance against standard books to 501900 Purchase Price Variance.",
        "",
        "decimal-mark .",
        "commodity $1,000.00",
        "",
    ]
    for code, leaf, kind, tags in COA:
        tag_text = f"type: {kind}" + (f", {tags}" if tags else "")
        lines.append(f"account {account_name(code, leaf, kind)}  ; {tag_text}")
    return "\n".join(lines) + "\n"


def build(out_dir: Path = SEEDS_DIR, contract_path: Path = CONTRACT) -> dict[str, Path]:
    contract = load_contract(contract_path)
    try:
        _validate(contract)
        rows = {"wms_seed.sqlite3": (WMS_DDL, wms_rows(contract)), "hrm_seed.sqlite3": (HRM_DDL, hrm_rows(contract)),
                "crm_seed.sqlite3": (CRM_DDL, crm_rows(contract))}
    except (KeyError, TypeError, StopIteration) as exc:
        raise ValueError(f"SEED_CONTRACT_DRIFT: malformed contract ({type(exc).__name__}: {exc})") from exc
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {name: out_dir / name for name in SEED_FILES}
    for name, (ddl, values) in rows.items():
        _write_sqlite(paths[name], ddl, values)
    paths[JOURNAL_SEED].write_text(coa_journal(contract), encoding="utf-8", newline="\n")
    return paths


def logical_dump(path: Path) -> str:
    """Version-independent content of a seed (SQL dump for SQLite, text for the journal)."""
    if path.suffix == ".journal":
        return path.read_text(encoding="utf-8")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        return "\n".join(con.iterdump())
    finally:
        con.close()


def drift(seed_dir: Path = SEEDS_DIR, contract_path: Path = CONTRACT) -> list[str]:
    """Names of seeds in seed_dir that are missing or differ from a fresh build."""
    def same(committed: Path, fresh: Path) -> bool:
        try:
            return committed.exists() and logical_dump(committed) == logical_dump(fresh)
        except (sqlite3.DatabaseError, UnicodeDecodeError):
            return False

    with tempfile.TemporaryDirectory() as tmp:
        fresh = build(Path(tmp), contract_path)
        return [name for name in SEED_FILES if not same(seed_dir / name, fresh[name])]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=SEEDS_DIR)
    parser.add_argument("--contract", type=Path, default=CONTRACT)
    parser.add_argument("--check", action="store_true", help="exit 1 if seeds in --out drifted from the contract")
    args = parser.parse_args(argv)
    if args.check:
        stale = drift(args.out, args.contract)
        print("seeds OK" if not stale else f"SEED_DRIFT: {', '.join(stale)}")
        return 1 if stale else 0
    for name, path in build(args.out, args.contract).items():
        print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
