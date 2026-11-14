"""WO-04 checks; execute without a backend or persistent state root."""
from pathlib import Path
import json
import subprocess
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]

class Markup(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.checkpoints = []
        self.steps = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            assert attrs["id"] not in self.ids, "duplicate DOM id"
            self.ids.add(attrs["id"])
        if "data-checkpoint" in attrs:
            self.checkpoints.append(attrs["data-checkpoint"])
        if "data-step" in attrs:
            self.steps.append(attrs["data-step"])

def test_three_panel_accessible_hooks_and_all_human_gates():
    html = (ROOT / "public/index.html").read_text()
    parsed = Markup()
    parsed.feed(html)
    assert {"systems", "authority", "pipeline", "journal", "documents", "ocr-dialog", "kal-speak", "kal-mic", "record", "reset", "status"} <= parsed.ids
    assert parsed.checkpoints == ["2", "3", "6", "8"]
    assert sorted(parsed.steps) == [str(i) for i in range(1, 9)]
    assert "aria-live" in html
    assert "app.js" in html
    assert "styles.css" in html

def test_contract_reuse_and_no_embedded_secrets_or_remote_dependencies():
    contract = json.loads((ROOT / "contracts/p2p-lineage-contract.json").read_text())
    source = (ROOT / "public/app.js").read_text()
    html = (ROOT / "public/index.html").read_text()
    for name in contract["primaryItem"]["tradeDocuments"].values():
        if name.endswith(".pdf"):
            assert name in source
    for barcode in contract["primaryItem"]["lowStockTrigger"]["reelBarcodes"]:
        assert barcode in source
    assert "ELEVENLABS_API_KEY" not in source
    assert "https://" not in html
    assert "overflow: hidden" in (ROOT / "public/styles.css").read_text()

def test_client_behavior_suite():
    result = subprocess.run(["node", "--test", "public/command-desk.test.mjs"], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
