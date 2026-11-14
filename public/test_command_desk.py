"""Golden-Master 3-panel ZeroSaaS P2P workbench static & client contract checks (WO-16).

Validates 1:1 Golden-Master markup, CSS, 4-tab navigation, RF laser scan, inline 28-box RapidOCR,
Check #10045, EO 14434 x KYSI governance matrix, Round 4 Software Factory trace (WO 1-18),
zero duplicate DOM IDs, zero legacy desk strings, and the 18-symbol ES module export contract.
"""
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
VOICE = (ROOT / "src/voice.mjs").read_text(encoding="utf-8")
LEGACY_NAME = " ".join(["Copper", "Command", "Desk"])


class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.title = ""
        self._stack = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if attrs_dict.get("id"):
            assert attrs_dict["id"] not in self.ids, f"duplicate DOM id {attrs_dict['id']}"
            self.ids.add(attrs_dict["id"])
        self._stack.append((tag, attrs_dict))

    def handle_endtag(self, tag):
        while self._stack and self._stack.pop()[0] != tag:
            pass

    def handle_data(self, data):
        if self._stack and self._stack[-1][0] == "title":
            self.title += data


def markup():
    parsed = Markup()
    parsed.feed(HTML)
    return parsed


def css_var(name):
    match = re.search(rf"{re.escape(name)}:\s*([^;]+);", CSS)
    return match and match.group(1).strip()


def test_brand_title_unique_ids_and_no_legacy_desk_name():
    parsed = markup()
    assert parsed.title == "ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward"
    assert "ZeroSaaS P2P" in HTML and ">P2P<" in HTML
    assert "Headless Copper ERP · WMS Signal" in HTML
    assert "1-Click Dock Scan" in HTML and "RapidOCR 3WM" in HTML and "CFO Check" in HTML
    for path in sorted(PUBLIC.iterdir()):
        if path.is_file() and path.suffix in {".html", ".css", ".js"}:
            text = path.read_text(encoding="utf-8")
            assert LEGACY_NAME.lower() not in text.lower(), path.name
            assert not re.search(r"command[\s\-—]*desk", text, re.IGNORECASE), path.name


def test_light_palette_and_three_panel_shell():
    palette = {
        "--bg-app": "#f1f5f9",
        "--bg-panel": "#ffffff",
        "--bg-subtle": "#f8fafc",
        "--border": "#e2e8f0",
        "--text-main": "#0f172a",
        "--blue": "#1d4ed8",
        "--green": "#15803d",
        "--amber": "#b45309",
        "--red": "#b91c1c",
    }
    for name, value in palette.items():
        assert css_var(name) == value, name
    assert "height: 100vh" in CSS and "overflow: hidden" in CSS
    assert "grid-template-columns: 236px minmax(0, 1fr) 392px" in CSS
    for dark in ("#101719", "#172023", "color-scheme: dark"):
        assert dark not in CSS and dark not in HTML


def test_topbar_and_four_golden_master_tabs():
    parsed = markup()
    expected_ids = {
        "strictPill",
        "kalMuteBtn",
        "micBtn",
        "recBtn",
        "topResetBtn",
        "leftStartKalBtn",
        "nav-workflow",
        "navStepBadge",
        "nav-registers",
        "sqlCountBadge",
        "nav-security",
        "nav-factory",
        "leftOrderSummary",
        "auditCountBadge",
        "centerStage",
        "rightRail",
        "modalBackdrop",
        "modalTitle",
        "modalBody",
        "ttsAudio",
    }
    assert expected_ids <= parsed.ids
    assert "GAAP DR == CR" in HTML
    assert "KAL Voice: ON" in HTML
    assert "Ask KAL" in HTML
    assert "Record" in HTML
    assert "Reset Queue" in HTML
    assert "Start KAL · P2P Steward" in HTML
    assert "1. P2P Flow Desk" in HTML
    assert "2. DB &amp; GL Registers" in HTML
    assert "3. SOX &amp; White House SI" in HTML and "EO 14434" in HTML
    assert "4. Software Factory" in HTML and "WO 1-18" in HTML
    assert "Guardrail Tests" in HTML and "GL &amp; Audit Register" in HTML


def test_voice_rf_laser_rapidocr_check_and_governance_parity():
    # Female streaming KAL voice & /api/voice/* endpoints
    assert "EXAVITQu4vr4xnSDxMaL" in VOICE and "EXAVITQu4vr4xnSDxMaL" in APP
    for endpoint in ("/api/voice/tts", "/api/voice/stt", "/api/voice/kal"):
        assert endpoint in APP
    assert "ELEVENLABS_API_KEY" not in HTML and "ELEVENLABS_API_KEY" not in CSS and "ELEVENLABS_API_KEY" not in APP

    # 4-Reel RF laser scan choreography
    assert "@keyframes rfLaserFlash" in CSS and ".rf-laser-beam" in CSS and ".reel-barcode-card" in CSS
    contract = json.loads((ROOT / "contracts/p2p-lineage-contract.json").read_text(encoding="utf-8"))
    for barcode in contract["primaryItem"]["lowStockTrigger"]["reelBarcodes"]:
        assert barcode in APP
    for fn_name in ("scanSingleDockReel", "scanNextDockReel", "scanAllDockReelsSequentially"):
        assert f"function {fn_name}" in APP

    # Inline 28-box RapidOCR invoice & zoom viewer
    assert ".ocr-laser-bar" in CSS and ".ocr-tag-overlay" in CSS and ".ocr-box" in CSS
    assert "/api/invoice-image" in APP and "/api/trade-pdf" in APP
    assert "28" in APP and "rerunLiveRapidOcr" in APP

    # Inline Check #10045 & CFO disbursement gate
    assert "Check #10045" in APP and "ACH-000582" in APP
    assert "usdToCheckWords" in APP and "approveCheckpoint4MeredithCfo" in APP

    # Tab 3: White House Super Intelligence Accord (EO 14434) x 8090 KYSI x SOX 404
    assert "White House Super Intelligence Accord" in APP
    assert "EO 14434" in APP and "KYSI" in APP and "SOX 404" in APP
    for layer in ("LAYER 1 · TECHNICAL CONTROLS", "LAYER 2 · INTERNAL OVERSIGHT GATES", "LAYER 3 · EXTERNAL AUDIT", "LAYER 4 · BOARD &amp; OFFICER GOVERNANCE"):
        assert layer in APP

    # Tab 4: Closed-Loop 8090 Software Factory Round 4 UUIDs (WO 1-18)
    for token in (
        "KB-00",
        "2fb45197-ecd8-463e-b72b-db79275329e3",
        "REQ-01",
        "1fc08c46-ed36-4a14-99a3-0eae8de04206",
        "BP-01",
        "61e1a72e-d90f-4d32-a3b6-a4b002ed4d2d",
        "FB-5",
        "a19b9a76-2adb-405b-8d34-53ec41fbbf76",
        "THM-4",
        "05591d02-9ff7-41ce-886d-92fdcda411a9",
        "WO-15",
        "3988d7f2-c356-487d-9ed2-9a1c045d3ee1",
        "WO-16",
        "bd3f7822-1571-4b81-80ca-6a32215a25aa",
        "WO-17",
        "78e025ce-ac9b-4714-a769-4b38767baa9d",
        "WO-18",
        "346dd5b4-37e7-45ed-bca0-6d36528bd0c6",
    ):
        assert token in APP, f"missing Factory token {token}"


def test_module_exports_window_bindings_and_dom_ids():
    assert '<link rel="stylesheet" href="/styles.css"' in HTML
    assert '<script type="module" src="/app.js"></script>' in HTML

    exported = (
        "validateState",
        "tagOcrFields",
        "safeDocumentUrl",
        "request",
        "speak",
        "refresh",
        "runStep",
        "render",
        "trialBalance",
        "REELS",
        "REFUSALS",
        "startRecording",
        "stopRecording",
        "stewardIntent",
        "stewardReply",
        "parseReelScan",
        "checkWords",
        "achLabel",
    )
    for name in exported:
        assert re.search(rf"export (async )?(function|const) {name}\b", APP), name

    # Every inline event handler in index.html & app.js templates must be attached onto window.<fn>
    inline_fns = set()
    for match in re.finditer(r'\bon[a-z]+\s*=\s*"([^"]+)"', HTML + "\n" + APP):
        for fn in re.findall(r"([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", match.group(1)):
            if fn not in {"if", "return", "encodeURIComponent", "Number", "String", "Boolean"}:
                inline_fns.add(fn)
    for fn in sorted(inline_fns):
        assert f"window.{fn} = {fn};" in APP, f"missing window.{fn} module binding"

    # Every unguarded direct-property getElementById('literal').* in APP exists in index.html
    parsed_ids = markup().ids
    direct_get_ids = set(re.findall(r"document\.getElementById\('([A-Za-z0-9_-]+)'\)\.", APP))
    assert direct_get_ids <= parsed_ids, sorted(direct_get_ids - parsed_ids)


def test_no_internal_strings_in_public_assets():
    forbidden = [
        "".join(parts)
        for parts in (
            ("agen", "tics"),
            ("ener", "getics"),
            ("rig", "org"),
            ("rig", "001"),
            ("flow", "craft"),
            ("gold", "fish"),
            ("gold", "eye"),
            ("hara", "-"),
            (":51", "00"),
            ("/ho", "me/"),
            ("/m", "nt/"),
        )
    ]
    for path in sorted(PUBLIC.iterdir()):
        if path.is_file():
            text = path.read_text(encoding="utf-8").lower()
            for word in forbidden:
                assert word not in text, f"{path.relative_to(ROOT)} contains forbidden string"


def test_client_behavior_suite():
    result = subprocess.run(["node", "--test", "public/command-desk.test.mjs"], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
