"""WO-01 seed tests: build into a temp root, assert contract facts, and guard committed seeds against drift."""

from __future__ import annotations

import contextlib
import importlib.util
import json
import re
import sqlite3
from decimal import Decimal
from pathlib import Path

import pytest

SEEDS_DIR = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("build_seeds", SEEDS_DIR / "build_seeds.py")
build_seeds = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build_seeds)


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> dict[str, Path]:
    return build_seeds.build(tmp_path_factory.mktemp("seeds"))


def _query(path: Path, sql: str) -> list[tuple]:
    with contextlib.closing(sqlite3.connect(f"file:{path}?mode=ro", uri=True)) as con:
        return con.execute(sql).fetchall()


def _refused(path: Path, statements: tuple[str, ...]) -> None:
    """Every statement must be refused by the schema; nothing is persisted."""
    with contextlib.closing(sqlite3.connect(path)) as con:
        con.execute("PRAGMA foreign_keys = ON")
        for stmt in statements:
            with pytest.raises(sqlite3.IntegrityError):
                con.execute(stmt)
        con.rollback()


def _contract_with(tmp_path: Path, mutate) -> Path:
    contract = build_seeds.load_contract()
    mutate(contract)
    path = tmp_path / "contract.json"
    path.write_text(json.dumps(contract), encoding="utf-8")
    return path


def test_all_four_seeds_written(built):
    assert sorted(built) == sorted(build_seeds.SEED_FILES)
    assert all(p.stat().st_size > 0 for p in built.values())


@pytest.mark.parametrize("name", build_seeds.SQLITE_SEEDS)
def test_sqlite_seeds_integrity_and_fks(built, name):
    assert _query(built[name], "PRAGMA integrity_check") == [("ok",)]
    assert _query(built[name], "PRAGMA foreign_key_check") == []


def test_wms_strictly_one_stocked_copper_item(built):
    wms = built["wms_seed.sqlite3"]
    assert _query(wms, "SELECT id, IPN, units, minimum_stock FROM part_part") == [(218, "ITM-CU-20-BARE", "FT", 8000)]
    assert _query(wms, "SELECT id, name FROM company_company") == [(181, "Encore Wire Corporation")]
    assert _query(wms, "SELECT id, part_id, supplier_id, SKU FROM part_supplierpart") == [(124, 218, 181, "ITM-CU-20-BARE")]
    assert _query(wms, "SELECT id, name FROM stock_stocklocation") == [(469, "WH-TX-NORTH")]
    assert _query(wms, "SELECT part_id, location_id, supplier_part_id, purchase_order_id, quantity FROM stock_stockitem") == [
        (218, 469, 124, None, 0)
    ]
    assert _query(wms, "SELECT COUNT(*) FROM order_purchaseorder") == [(0,)]


def test_wms_stock_out_signal_and_locked_standard_cost(built):
    [(on_hand, minimum, std)] = _query(
        built["wms_seed.sqlite3"],
        "SELECT COALESCE(SUM(s.quantity), 0), p.minimum_stock, pp.internal_cost_min "
        "FROM part_part p JOIN part_partpricing pp ON pp.part_id = p.id "
        "LEFT JOIN stock_stockitem s ON s.part_id = p.id WHERE p.id = 218",
    )
    assert on_hand == 0 < minimum
    assert Decimal(str(std)) == Decimal("2.89")
    assert Decimal(str(std)) * (minimum - on_hand) == Decimal("23120.00")


def test_wms_schema_refuses_negative_stock_and_dangling_fk(built):
    _refused(built["wms_seed.sqlite3"], (
        "UPDATE stock_stockitem SET quantity = -1",
        "UPDATE part_supplierpart SET supplier_id = 999",
    ))


def test_hrm_officer_signing_limits(built):
    hrm = built["hrm_seed.sqlite3"]
    seats = _query(hrm, "SELECT e.emp_id, e.full_name, s.approval_limit_usd FROM hrm_employee e "
                        "JOIN hrm_doa_authority_seat s USING (emp_id)")
    assert {(e, n, Decimal(str(v))) for e, n, v in seats} == {
        ("EMP-AI-KAL", "KAL", Decimal("0")),
        ("EMP-0021", "Darius Mercer", Decimal("20000")),
        ("EMP-0002", "Nancy Rostova", Decimal("50000")),
        ("EMP-0005", "Devon Brooks", Decimal("100000")),
        ("EMP-0003", "Marcus Vance", Decimal("0")),
        ("EMP-0001", "Duncan Vance", Decimal("250000")),
        ("EMP-0007", "Meredith Hale", Decimal("500000")),
    }
    assert _query(hrm, "SELECT title, beehive_fg_id FROM hrm_employee WHERE emp_id = 'EMP-0003'") == [
        ("Warehouse Dock Lead", "FG-11")
    ]
    assert _query(hrm, "SELECT * FROM hrm_beehive_department") == [("FG-11", "Warehouse & Central Receiving Hub")]


def test_hrm_segregation_of_duties(built):
    rows = _query(built["hrm_seed.sqlite3"],
                  "SELECT emp_id, may_request, may_approve_requisition, may_issue_po, may_receive_dock, "
                  "may_voucher_ap, may_release_payment FROM hrm_doa_authority_seat")
    holders = [{emp for emp, *flags in rows if flags[duty]} for duty in range(6)]
    assert holders == [
        {"EMP-0021"},              # planner requests REQ-25800
        {"EMP-0021", "EMP-0005"},  # requisition approval is limit-tiered: Darius <= $20k, else VP Devon
        {"EMP-0002"},              # only Nancy issues POs ...
        {"EMP-0003"},              # ... and SOX 404 keeps her off the dock: only Marcus receives
        {"EMP-0001"},
        {"EMP-0007"},
    ]


def test_hrm_schema_refuses_ai_steward_authority(built):
    _refused(built["hrm_seed.sqlite3"], (
        "UPDATE hrm_doa_authority_seat SET approval_limit_usd = 1 WHERE emp_id = 'EMP-AI-KAL'",
        "UPDATE hrm_doa_authority_seat SET db_write_credentials = 1 WHERE emp_id = 'EMP-AI-KAL'",
        "UPDATE hrm_doa_authority_seat SET may_release_payment = 1 WHERE emp_id = 'EMP-AI-KAL'",
        # flipping the AI flag off to unlock authority is refused too
        "UPDATE hrm_doa_authority_seat SET is_ai_steward = 0, approval_limit_usd = 500000, "
        "db_write_credentials = 1, may_release_payment = 1 WHERE emp_id = 'EMP-AI-KAL'",
        "UPDATE hrm_employee SET is_ai = 0 WHERE emp_id = 'EMP-AI-KAL'",
    ))


def test_crm_vendor_cross_references_wms_supplier(built):
    assert _query(built["crm_seed.sqlite3"], "SELECT name, account_type, external_ref FROM accounts_account") == [
        ("Encore Wire Corporation", "VENDOR", "WMS:company_company:181")
    ]


ACCOUNT_LINE = re.compile(
    r"^account ((?:Assets|Liabilities|Equity|Revenues|Expenses):(\d{6})-[A-Za-z-]+)  ; type: ([ACLERX])(?:, [a-z_]+: [\w-]+)*$"
)


def test_coa_journal_89_accounts_strict_shape(built):
    lines = built["coa_seed.journal"].read_text(encoding="utf-8").splitlines()
    account_lines = [ln for ln in lines if ln.startswith("account ")]
    matches = [ACCOUNT_LINE.match(ln) for ln in account_lines]
    assert all(matches) and len(matches) == 89
    assert len({m.group(2) for m in matches}) == 89
    assert "commodity $1,000.00" in lines
    # declarations only: every non-blank line is a comment or a directive (no postings)
    assert all(ln == "" or ln.startswith((";", "account ", "commodity ", "decimal-mark ")) for ln in lines)
    by_code = dict(zip((m.group(2) for m in matches), account_lines))
    assert by_code["101100"].startswith("account Assets:101100-Operating-Checking  ; type: C, bank: 8801")
    assert by_code["101200"].startswith("account Assets:101200-Payroll-Checking  ; type: C, bank: 4409")
    ledger_bindings = {b["value_column"] for b in build_seeds.load_contract()["semanticBindings"]
                       if b["source_system"] == "LEDGER"}
    assert ledger_bindings == {
        "Assets:121100-WMS-Inventory-Stock", "Liabilities:201200-GRNI-Goods-Received-Not-Invoiced",
        "Liabilities:201100-AP-Trade-Payables", "Assets:101100-Operating-Checking",
    }
    declared = {m.group(1) for m in matches}
    assert ledger_bindings | {"Expenses:501900-Purchase-Price-Variance"} <= declared


@pytest.mark.parametrize("mutate", [
    lambda c: c["primaryItem"].update(stockedItemCountInWms=2),
    lambda c: c["primaryItem"]["lowStockTrigger"].update(catalogUnitPriceUsd=2.90),
    lambda c: c["primaryItem"]["lowStockTrigger"].update(reelCount=8),
    lambda c: c["provenance"]["aiSteward"].update(signingLimitUsd=1),
    lambda c: c["provenance"]["purviewSeat"].update(doaLimitUsd=60000),
    lambda c: c["provenance"]["purviewSeat"].update(empId="EMP-9999"),
    lambda c: c["semanticBindings"].append({"source_system": "LEDGER", "value_column": "Assets:199999-Unknown"}),
    lambda c: c["primaryItem"].pop("wmsPartId"),
], ids=["item-count", "std-cost", "reels", "ai-limit", "purview-limit", "purview-missing", "ledger-binding", "missing-key"])
def test_contract_drift_is_refused(tmp_path, mutate):
    with pytest.raises(ValueError, match="SEED_CONTRACT_DRIFT"):
        build_seeds.build(tmp_path / "out", _contract_with(tmp_path, mutate))
    assert not (tmp_path / "out").exists()


def test_failed_sqlite_write_leaves_no_temp_file(tmp_path):
    with pytest.raises(sqlite3.IntegrityError):
        build_seeds._write_sqlite(tmp_path / "x.sqlite3", build_seeds.HRM_DDL,
                                  {"hrm_employee": [("EMP-0001", "n", "t", "FG-404", 0, 1)]})
    assert list(tmp_path.iterdir()) == []


def test_drift_reports_corrupt_and_missing_seeds(tmp_path):
    build_seeds.build(tmp_path)
    assert build_seeds.drift(tmp_path) == []
    (tmp_path / "crm_seed.sqlite3").write_bytes(b"not a database")
    (tmp_path / "coa_seed.journal").unlink()
    assert build_seeds.drift(tmp_path) == ["crm_seed.sqlite3", "coa_seed.journal"]


def test_committed_seeds_match_contract():
    assert build_seeds.drift() == []


def test_sqlite_seeds_275_brownfield_tables_and_doa_metadata(built):
    counts = {
        name: _query(
            built[name],
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )[0][0]
        for name in build_seeds.SQLITE_SEEDS
    }
    assert counts == {
        "crm_seed.sqlite3": 151,
        "wms_seed.sqlite3": 119,
        "hrm_seed.sqlite3": 5,
    }
    assert sum(counts.values()) == 275
    doa_codes = dict(_query(built["hrm_seed.sqlite3"], "SELECT emp_id, emp_code FROM hrm_doa_authority_seat"))
    assert doa_codes == {
        "EMP-AI-KAL": "KAL-STEWARD",
        "EMP-0021": "SC-PLAN-01",
        "EMP-0002": "PROC-01",
        "EMP-0005": "OPS-01",
        "EMP-0003": "DOCK-01",
        "EMP-0001": "CTRL-01",
        "EMP-0007": "CFO-01",
    }
