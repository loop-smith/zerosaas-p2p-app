"""SF WO-13 ZeroSaaS P2P workbench checks (REQ-P2P-012..020, BP-01 ADR-006).

Static markup, stylesheet and source checks; no backend or persistent state root.
The file name is kept from WO-04 because the task card runs the public/ suite by path.
"""
from collections import defaultdict
from html.parser import HTMLParser
from pathlib import Path
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
HTML = (PUBLIC / "index.html").read_text(encoding="utf-8")
CSS = (PUBLIC / "styles.css").read_text(encoding="utf-8")
APP = (PUBLIC / "app.js").read_text(encoding="utf-8")
# Built from parts so this file does not contain the name it forbids.
LEGACY_NAME = " ".join(["Copper", "Command", "Desk"])


class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.attrs = defaultdict(list)
        self.chunks = defaultdict(list)
        self.title = ""
        self._stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            assert attrs["id"] not in self.ids, f"duplicate DOM id {attrs['id']}"
            self.ids.add(attrs["id"])
        for key, value in attrs.items():
            if key.startswith("data-"):
                self.attrs[key].append(value)
        self._stack.append((tag, attrs))

    def handle_endtag(self, tag):
        while self._stack and self._stack.pop()[0] != tag:
            pass

    def handle_data(self, data):
        if self._stack and self._stack[-1][0] == "title":
            self.title += data
        if not data.strip():
            return
        for tag, attrs in self._stack:
            if tag == "body":
                continue
            for key in ("data-step", "data-view", "data-trap", "data-account", "data-packet"):
                if key in attrs:
                    self.chunks[(key, attrs[key])].append(data.strip())

    def text(self, key, value):
        return " ".join(self.chunks[(key, value)])


def markup():
    parsed = Markup()
    parsed.feed(HTML)
    return parsed


def css_var(name):
    match = re.search(rf"{re.escape(name)}:\s*([^;]+);", CSS)
    return match and match.group(1).strip()


def test_brand_title_and_no_legacy_desk_name():
    parsed = markup()
    assert parsed.title == "ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward"
    assert "ZeroSaaS P2P" in HTML and ">P2P<" in HTML
    assert "Headless Stock-to-Pay ERP · WMS Signal → Signing Limits → Live COMEX PO → Dock Scan → RapidOCR 3WM → CFO Check" in HTML
    for path in sorted(PUBLIC.iterdir()):
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            assert LEGACY_NAME.lower() not in text.lower(), path.name
    # Shipped UI files carry no desk naming in any form (the old title was "Copper — Command Desk").
    for text in (HTML, CSS, APP):
        assert not re.search(r"command[\s\-—]*desk", text, re.IGNORECASE)
    assert "copper-demo" not in APP


def test_light_palette_and_three_column_shell():
    palette = {
        "--bg-app": "#f1f5f9", "--bg-panel": "#ffffff", "--bg-subtle": "#f8fafc", "--border": "#e2e8f0",
        "--text-main": "#0f172a", "--blue": "#1d4ed8", "--green": "#15803d", "--amber": "#b45309", "--red": "#b91c1c",
    }
    for name, value in palette.items():
        assert css_var(name) == value, name
    assert "color-scheme: light" in CSS
    assert css_var("--topbar") == "48px" and css_var("--rail-left") == "236px" and css_var("--rail-right") == "392px"
    assert "grid-template-rows: var(--topbar) minmax(0, 1fr)" in CSS
    assert "grid-template-columns: var(--rail-left) minmax(0, 1fr) var(--rail-right)" in CSS
    assert "height: 100vh" in CSS and "overflow: hidden" in CSS
    # The dark WO-04 palette is gone.
    for dark in ("#101719", "#172023", "color-scheme: dark"):
        assert dark not in CSS and dark not in HTML


def test_topbar_controls_and_gates():
    parsed = markup()
    assert {"gaap-pill", "connection", "refresh", "kal-mute", "kal-mic", "record", "record-download", "reset"} <= parsed.ids
    assert "GAAP DR == CR" in HTML and "Ask KAL" in HTML and "Reset Queue" in HTML
    # Record and Reset only act through their confirmation dialogs.
    assert {"record-dialog", "confirm-record", "cancel-record", "reset-dialog", "confirm-reset", "cancel-reset"} <= parsed.ids
    assert "$('record-dialog').showModal()" in APP and "void startRecording()" in APP
    assert "request('/api/reset', {method: 'POST', body: {}})" in APP


def test_left_rail_views_item_and_drawers():
    parsed = markup()
    # <body data-view="flow"> carries the active view; the four nav buttons follow it.
    assert parsed.attrs["data-view"] == ["flow", "flow", "registers", "sox", "factory"]
    labels = {view: parsed.chunks[("data-view", view)] for view in ("flow", "registers", "sox", "factory")}
    assert labels["flow"] == ["1. P2P Flow Desk", "Step —/8"]
    assert labels["registers"] == ["2. DB & GL Registers"]
    assert labels["sox"] == ["3. SOX & White House SI"]
    assert labels["factory"] == ["4. Software Factory", "WO 1-13"]
    assert "Step ${completed + 1}/8" in APP
    assert parsed.attrs["data-view-panel"] == ["flow", "registers", "sox", "factory"]
    assert "Start KAL · P2P Steward" in HTML
    for fact in ("ITM-CU-20-BARE", "8,000 FT", "$2.89/FT Std", 'id="stock"'):
        assert fact in HTML
    assert {"open-guardrails", "guardrail-dialog", "open-ledger", "ledger-dialog", "journal", "systems", "authority"} <= parsed.ids
    assert "Guardrail Tests" in HTML and "GL &amp; Audit Register" in HTML
    for wo in range(1, 14):
        assert f"<td>WO-{wo}</td>" in HTML


def test_eight_step_strip_scanner_and_probes():
    parsed = markup()
    steps = parsed.attrs["data-step"]
    assert steps == [str(n) for n in range(1, 9)]
    expected = ["1. WMS Signal", "2. Supply Chain", "3. VP Approval", "4. Spot & PO", "5. Order Ack", "6. Dock Scan", "7. OCR & Match", "8. Cut Check"]
    assert [parsed.chunks[("data-step", n)][0] for n in steps] == expected
    assert parsed.attrs["data-checkpoint"] == ["2", "3", "6", "8"]
    contract = json.loads((ROOT / "contracts/p2p-lineage-contract.json").read_text())
    reels = contract["primaryItem"]["lowStockTrigger"]["reelBarcodes"]
    assert parsed.attrs["data-reel"] == reels
    assert {"step-card", "run-step", "barcode", "scan-count", "kal-line", "pipeline"} <= parsed.ids
    assert parsed.attrs["data-trap"] == ["kal", "doa", "sod", "invoice", "bank"]
    probes = [parsed.text("data-trap", name) for name in parsed.attrs["data-trap"]]
    assert probes == ["KAL $0 403", "Darius >$20k 403", "Dock SoD 403", "Invoice variance 409", "Petty #4409 >$5k 403"]
    assert "$0.00 signing limit" in HTML
    assert parsed.attrs["data-book"] == ["121100", "101100", "101200", "201200", "201100"]


def test_right_rail_trial_balance_and_packet_trail():
    parsed = markup()
    assert parsed.attrs["data-account"] == ["121100", "201200", "201100", "501900", "101100", "101200"]
    accounts = [parsed.chunks[("data-account", code)][0] for code in parsed.attrs["data-account"]]
    assert accounts == ["121100 Raw Copper", "201200 GRNI", "201100 Trade AP", "501900 PPV", "101100 Operating #8801", "101200 Payroll/Petty #4409"]
    assert {"tb-debit", "tb-credit", "ledger-balance"} <= parsed.ids
    assert parsed.attrs["data-packet"] == ["signal", "po", "oa", "bol", "inv", "check"]
    titles = [parsed.chunks[("data-packet", packet)][:2] for packet in parsed.attrs["data-packet"]]
    assert titles == [["1", "Stock Signal"], ["2", "PO-25800"], ["3", "OA-25800"], ["4", "BOL-25800"], ["5", "INV-25800"], ["6", "Check #10045"]]
    contract = json.loads((ROOT / "contracts/p2p-lineage-contract.json").read_text())
    pdfs = [name for name in contract["primaryItem"]["tradeDocuments"].values() if name.endswith(".pdf")]
    assert sorted(parsed.attrs["data-document"]) == sorted(pdfs)
    for name in pdfs:
        assert name in APP
    assert {"ocr-count", "open-ocr", "ocr-dialog", "ocr-image", "ocr-boxes"} <= parsed.ids
    assert "28-box" in HTML


def test_server_contract_only_and_no_embedded_secrets_or_remote_dependencies():
    # Writes reach only POST /api/step/:n and POST /api/reset; reads only /api/state; documents only via server URLs.
    assert set(re.findall(r"request\(`?'?(/api/[a-z/]+)", APP)) == {"/api/state", "/api/step/", "/api/reset"}
    assert "`/api/step/${step}`" in APP
    assert "ELEVENLABS_API_KEY" not in APP
    assert "https://" not in HTML and "http://" not in APP.replace("'http://localhost'", "")
    assert "app.js" in HTML and "styles.css" in HTML and "aria-live" in HTML
    for name in ("validateState", "REELS", "REFUSALS", "safeDocumentUrl", "request", "refresh", "runStep", "render", "speak", "startRecording", "stopRecording"):
        assert re.search(rf"export (async )?(function|const) {name}\b", APP), name


def test_every_element_id_the_client_touches_exists():
    # No browser runs in every lane, so pin the DOM contract statically: a missing id would throw in render() or boot().
    referenced = set(re.findall(r"(?:\$|setText)\('([a-z0-9-]+)'", APP))
    # Opener/closer pairs for dialogs, e.g. ['open-ledger', 'ledger-dialog'].
    referenced |= {name for pair in re.findall(r"\['([a-z][a-z0-9-]*)', '([a-z][a-z0-9-]*-dialog)'\]", APP) for name in pair}
    selectors = re.findall(r"querySelector(?:All)?\(['`]([^'`]+)['`]\)", APP)
    referenced |= {name for selector in selectors for name in re.findall(r"#([a-z][a-z0-9-]*)", selector)}
    assert {"run-step", "gaap-pill", "trial-balance", "tb-other", "journal", "gl-register", "audit-status", "open-ledger", "close-ocr", "cancel-record"} <= referenced
    assert referenced <= markup().ids, sorted(referenced - markup().ids)
    for selector in selectors:
        attr = re.search(r"\[(data-[a-z-]+)\]", selector)
        if attr:
            assert attr.group(1) in markup().attrs, selector


def test_no_internal_strings_in_published_files():
    # Parts are joined at runtime so this file does not contain the strings it forbids.
    forbidden = ["".join(parts) for parts in (("agen", "tics"), ("ener", "getics"), ("rig", "org"), ("flow", "craft"), ("/ho", "me/"), ("/m", "nt/"), ("hara-", "lanes"))]
    files = [path for path in PUBLIC.iterdir() if path.is_file()]
    files += [ROOT / "README.md", ROOT / "docs/software-factory-trace.md"]
    files += sorted((ROOT / ".sw-factory/WO-13").glob("*.md"))
    for path in files:
        text = path.read_text(encoding="utf-8").lower()
        for word in forbidden:
            assert word not in text, f"{path.relative_to(ROOT)} contains an internal string"


def test_client_behavior_suite():
    result = subprocess.run(["node", "--test", "public/command-desk.test.mjs"], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
