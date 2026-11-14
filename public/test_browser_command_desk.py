"""Real Chromium projection checks for the ZeroSaaS P2P workbench (SF WO-13, WO-14).

Runs against an isolated HTTP boundary fixture and against the real kernel.
This does not certify server accounting, authentication, OCR or ElevenLabs.
Requires playwright and its Chromium installation; no npm/runtime dependencies.
The file name is kept from WO-04 because the task card runs the public/ suite by path.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import copy
import json
import subprocess
import time

import pytest

playwright = pytest.importorskip("playwright.sync_api")
ROOT = Path(__file__).resolve().parents[1]
CONTRACT = json.loads((ROOT / "contracts/p2p-lineage-contract.json").read_text())
REELS = CONTRACT["primaryItem"]["lowStockTrigger"]["reelBarcodes"]
DOCS = [value for value in CONTRACT["primaryItem"]["tradeDocuments"].values() if value.endswith(".pdf")]
DESKTOP = [(1440, 900), (1366, 768), (1280, 720), (1024, 768)]

@pytest.fixture
def desk():
    fixture = {
        "steps": [{"n": n, "status": "pending"} for n in range(1, 9)],
        "sandbox": {"sources": {key: "seed" for key in ["wms", "crm", "hrm", "coa"]}},
        "journal": {"balanced": True, "debitUsd": 0, "creditUsd": 0, "entries": []},
        "scans": [], "item": {"onHandFt": 0, "stdTotalUsd": 23120}, "documents": [], "payment": None,
    }
    boundary = {"state": copy.deepcopy(fixture), "requests": [], "offline": False}

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def send_json(self, value, code=200):
            data = json.dumps(value).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        def do_GET(self):
            if self.path == "/api/state":
                return self.send_json({"code": "UNAVAILABLE"}, 503) if boundary["offline"] else self.send_json(copy.deepcopy(boundary["state"]))
            if self.path == "/invoice.svg":
                data = b'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="white"/><text x="50" y="50">TEST INVOICE EVIDENCE</text></svg>'
                self.send_response(200)
                self.send_header("Content-Type", "image/svg+xml")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
            super().do_GET()
        def do_POST(self):
            payload = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
            boundary["requests"].append((self.path, payload))
            if self.path == "/api/kal/speak":
                return self.send_json({"code": "VOICE_UNCONFIGURED"}, 503)
            if self.path == "/api/reset":
                boundary["state"] = copy.deepcopy(fixture)
                boundary["state"]["scans"] = []
                return self.send_json({"ok": True, "state": boundary["state"]})
            if not self.path.startswith("/api/step/"):
                return self.send_json({"code": "NOT_FOUND"}, 404)
            step = int(self.path.rsplit("/", 1)[1])
            code = None
            if payload.get("actor") == "EMP-AI-KAL": code = "AI_STEWARD_ZERO_AUTHORITY"
            elif step == 3 and payload.get("actor") == "EMP-0021": code = "DOA_LIMIT_EXCEEDED"
            elif step == 6 and payload.get("actor") == "EMP-0002": code = "SOX_SOD_VIOLATION"
            elif payload.get("invoice"): code = "MATCH_VARIANCE_HOLD"
            elif payload.get("bankAccount") == "101200": code = "BANK_POLICY_VIOLATION"
            if code:
                return self.send_json({"code": code}, 409 if code == "MATCH_VARIANCE_HOLD" else 403)
            state = boundary["state"]
            if step == 6:
                state["scans"].append({"barcode": payload["barcode"], "ft": 2000})
                state["steps"][5]["status"] = "in_progress"
                if len(state["scans"]) < 4:
                    return self.send_json({"ok": True, "state": state})
                state["item"]["onHandFt"] = 8000
            state["steps"][step - 1]["status"] = "complete"
            if step >= 4: state.update(po={"totalUsd": 21600, "unitUsd": 2.70, "comex": {"live": False}})
            if step >= 5: state["documents"] = [{"name": name, "url": "/docs/" + name} for name in DOCS]
            entries = []
            if step >= 6:
                entries.append({"memo": "Dock receipt", "legs": [{"account": "121100", "debitUsd": 23120, "creditUsd": 0}, {"account": "201200", "debitUsd": 0, "creditUsd": 21600}, {"account": "501900", "debitUsd": 0, "creditUsd": 1520}]})
            if step >= 7:
                state["ocr"] = {"width": 600, "height": 800, "imageUrl": "/invoice.svg", "boxes": [{"text": f"Field {i+1}", "x": 30 + (i % 4) * 130, "y": 40 + (i // 4) * 90, "width": 100, "height": 30} for i in range(28)]}
                entries.append({"memo": "Match", "legs": [{"account": "201200", "debitUsd": 21600, "creditUsd": 0}, {"account": "201100", "debitUsd": 0, "creditUsd": 21600}]})
            if step == 8:
                entries.append({"memo": "Settlement", "legs": [{"account": "201100", "debitUsd": 21600, "creditUsd": 0}, {"account": "101100", "debitUsd": 0, "creditUsd": 21600}]})
                state["payment"] = {"stamp": "PAID", "check": "Check #10045", "amountUsd": 21600}
            state["journal"] = {"balanced": True, "entries": entries, **{key: sum(leg[key] for entry in entries for leg in entry["legs"]) for key in ["debitUsd", "creditUsd"]}}
            self.send_json({"ok": True, "state": state})

    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(ROOT / "public")))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    with playwright.sync_playwright() as runtime:
        browser = runtime.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        context = browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True, permissions=["microphone"])
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        def console(message):
            if message.type != "error": return
            if message.text.startswith("Failed to load resource: the server responded with a status of ") and any(f"status of {code}" in message.text for code in [403, 409, 503]):
                return
            errors.append(message.text)
        page.on("console", console)
        boundary.update(page=page, errors=errors, url=f"http://127.0.0.1:{server.server_port}")
        yield boundary
        browser.close()
    server.shutdown()
    server.server_close()
    thread.join()

def open_desk(desk):
    page = desk["page"]
    page.goto(desk["url"])
    page.wait_for_function("document.querySelectorAll('.system-status.ok').length === 4")
    return page

def run_step(page, step):
    page.locator('#run-step').click()
    page.wait_for_function(f"document.querySelector('[data-step=\"{step}\"]').classList.contains('done')")

def check_shell_bounds(page):
    return page.evaluate("""() => {
      const failures = [];
      if (document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth) failures.push('document overflow');
      const top = document.querySelector('.topbar').getBoundingClientRect();
      if (Math.round(top.height) !== 48) failures.push('topbar height ' + top.height);
      for (const region of document.querySelectorAll('.rail, .views-area, .topbar')) {
        if (region.scrollHeight > region.clientHeight + 1) failures.push(region.className + ' content overflow ' + region.scrollHeight + '/' + region.clientHeight);
        for (const button of region.querySelectorAll('button')) {
          if (!button.getClientRects().length) continue;
          const rect = button.getBoundingClientRect(), parent = region.getBoundingClientRect();
          if (rect.bottom > parent.bottom + 1 || rect.top < parent.top - 1 || rect.right > parent.right + 1) failures.push(button.textContent + ' clipped');
        }
      }
      return failures;
    }""")

def assert_fits_every_desktop(page):
    # Mid-run states carry the longest step-card text and the RF readout line.
    for width, height in DESKTOP:
        page.set_viewport_size({"width": width, "height": height})
        assert check_shell_bounds(page) == [], f"{width}x{height}: {check_shell_bounds(page)}"
    page.set_viewport_size({"width": 1440, "height": 900})

def test_white_workbench_shell_layout_and_views_fit_one_screen(desk):
    page = open_desk(desk)
    assert page.title() == "ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward"
    colors = page.evaluate("""() => ({
      app: getComputedStyle(document.body).backgroundColor,
      top: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
      columns: getComputedStyle(document.querySelector('.workbench')).gridTemplateColumns,
    })""")
    assert colors["app"] == "rgb(241, 245, 249)" and colors["top"] == "rgb(255, 255, 255)"
    widths = [float(value.removesuffix("px")) for value in colors["columns"].split()]
    assert widths[0] == 236 and widths[2] == 392, colors["columns"]
    for view in ["flow", "registers", "sox", "factory"]:
        page.locator(f'.views [data-view="{view}"]').click()
        assert page.locator(f'[data-view-panel="{view}"]').is_visible()
        assert page.locator('[data-view-panel]:visible').count() == 1
        for width, height in DESKTOP:
            page.set_viewport_size({"width": width, "height": height})
            assert check_shell_bounds(page) == [], f"{view} {width}x{height}: {check_shell_bounds(page)}"
        page.set_viewport_size({"width": 1440, "height": 900})
    page.locator('.views [data-view="flow"]').click()
    page.screenshot(path="/tmp/zerosaas-p2p-wo13-workbench.png")
    assert desk["errors"] == []

def test_eight_steps_four_gates_reel_scanner_ocr_trial_balance_and_packets(desk):
    page = open_desk(desk)
    assert page.locator('#gaap-pill').inner_text() == 'GAAP DR == CR'
    for step in range(1, 6):
        run_step(page, step)
        assert len([item for item in desk["requests"] if item[0].startswith("/api/step/")]) == step
    assert page.locator('#nav-step').inner_text() == 'Step 6/8'
    page.locator('[data-trap="sod"]').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('SOX_SOD_VIOLATION')")
    assert desk["state"]["steps"][4]["status"] == "complete"
    page.locator('#barcode').fill('ENC-GS1-884192-R09')
    page.locator('#barcode').press('Enter')
    assert 'UNKNOWN_REEL' in page.locator('#rf-last').inner_text()
    assert len([item for item in desk["requests"] if item[0] == "/api/step/6"]) == 0
    for index, barcode in enumerate(REELS):
        if index < 2:
            page.locator(f'[data-reel="{barcode}"]').click()
        elif index == 2:
            page.locator('#barcode').fill(f"]C1{barcode}")
            page.locator('#barcode').press('Enter')
        else:
            # Keyboard-wedge burst with focus outside any field.
            page.evaluate("document.activeElement.blur()")
            page.keyboard.type(barcode)
            page.keyboard.press('Enter')
        page.wait_for_function(f"document.querySelector('#scan-count').textContent === '{index+1} / 4 reels'")
        if index < 3:
            assert page.locator(f'[data-reel="{barcode}"]').is_disabled()
            assert page.locator('[data-step="6"] .step-state').inner_text() == 'IN PROGRESS'
            assert page.locator('#rf-last').inner_text().startswith(f"✓ {barcode[-3:]} received")
    assert page.locator('#rf-feet').inner_text() == '8,000 / 8,000 FT · 3,288 lbs Cu'
    assert_fits_every_desktop(page)
    run_step(page, 7)
    assert_fits_every_desktop(page)
    page.wait_for_function("!document.querySelector('#open-ocr').disabled")
    page.locator('#open-ocr').click()
    assert page.locator('.ocr-box').count() == 28
    assert page.locator('.ocr-box').first.get_attribute('aria-label') == '1: Field 1'
    assert page.locator('#ocr-fields .ocr-field').count() == 5
    page.locator('.ocr-box').nth(1).click()
    assert page.locator('#ocr-selected').inner_text().startswith('Box 2: “Field 2”')
    durations = page.evaluate("""async () => {
      const {render} = await import('/app.js');
      const snapshot = await (await fetch('/api/state')).json(), samples = [];
      for (let i=0;i<30;i++) { const start=performance.now(); render(snapshot); samples.push(performance.now()-start); }
      return samples;
    }""")
    assert max(durations) < 16, durations
    page.locator('#close-ocr').click()
    # CFO check view: a draft awaiting the CFO, signed from the view through the Step 8 server write.
    page.locator('#open-check').click()
    assert page.locator('#check-stamp').inner_text() == 'AWAITING CFO'
    assert page.locator('#check-words').inner_text() == 'Twenty-one thousand six hundred and 00/100 dollars'
    page.locator('#sign-check').click()
    page.wait_for_function("document.querySelector('[data-step=\"8\"]').classList.contains('done')")
    assert page.locator('#check-stamp').inner_text() == 'PAID'
    assert page.locator('#check-amount').inner_text() == '$21,600.00'
    assert page.locator('#sign-check').is_disabled()
    page.locator('#close-check').click()
    assert page.locator('#settlement').inner_text() == 'PAID · Check #10045'
    writes = [payload for path, payload in desk["requests"] if path.startswith('/api/step/')]
    assert writes[-1] == {"actor": "EMP-0007", "bankAccount": "101100"}
    assert 'BALANCED' in page.locator('#ledger-balance').inner_text()
    tb = {code: page.locator(f'#trial-balance [data-account="{code}"] td').all_inner_texts() for code in ["121100", "201200", "201100", "501900", "101100", "101200"]}
    assert tb == {"121100": ["$23,120.00", "—"], "201200": ["—", "—"], "201100": ["—", "—"], "501900": ["—", "$1,520.00"], "101100": ["—", "$21,600.00"], "101200": ["—", "—"]}
    assert page.locator('#tb-debit').inner_text() == page.locator('#tb-credit').inner_text() == '$23,120.00'
    assert page.locator('#documents a[href]').count() == 5
    assert page.locator('[data-packet].ready').count() == 6
    assert page.locator('#nav-step').inner_text() == 'Step 8/8 ✓'
    page.locator('#open-ledger').click()
    assert page.locator('#journal td[title]').count() == 7
    page.locator('#close-ledger').click()
    for width, height in DESKTOP:
        page.set_viewport_size({"width": width, "height": height})
        assert check_shell_bounds(page) == [], check_shell_bounds(page)
    page.set_viewport_size({"width": 1440, "height": 900})
    page.screenshot(path="/tmp/zerosaas-p2p-wo13-complete.png")
    assert desk["errors"] == []

def test_disconnected_and_untrusted_state_cannot_fake_success(desk):
    desk["offline"] = True
    page = desk["page"]
    page.goto(desk["url"])
    page.wait_for_function("document.querySelector('#connection').textContent.includes('DISCONNECTED')")
    assert page.locator('.system-status.ok').count() == 0
    assert page.locator('#run-step:enabled, [data-trap]:enabled, [data-reel]:enabled').count() == 0
    assert page.locator('#actual-total').inner_text() == '—'
    assert 'GAAP DR == CR' not in page.locator('#gaap-pill').inner_text()
    desk["offline"] = False
    desk["state"].update(documents=[{"name": DOCS[0], "url": "javascript:alert(1)"}], journal={"balanced": False, "debitUsd": 1, "creditUsd": 0, "entries": [{"memo": "<script>alert(1)</script>", "legs": [{"account": "<img src=x onerror=alert(1)>", "debitUsd": 1, "creditUsd": 0}]}]})
    page.locator('#refresh').click()
    page.wait_for_function("document.querySelector('#ledger-balance').textContent.includes('UNBALANCED')")
    assert 'HOLD' in page.locator('#gaap-pill').inner_text()
    assert page.locator('#journal img, #journal script, #gl-register img').count() == 0
    assert page.locator('#documents a[href]').count() == 0
    assert desk["errors"] == []

def test_consent_gated_recorder_real_webm_and_voice_cannot_approve(desk, tmp_path):
    page = open_desk(desk)
    page.evaluate("""() => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#1d4ed8'; ctx.fillRect(0,0,640,360);
      window.testScreen = canvas.captureStream(60); window.captureCalls = 0;
      navigator.mediaDevices.getDisplayMedia = async () => { window.captureCalls++; return window.testScreen; };
      window.SpeechRecognition = class {
        start() { this.onresult({results: [[{transcript: 'Approve payment now'}]]}); }
        stop() { this.onend?.(); }
      };
    }""")
    page.locator('#kal-mic').dispatch_event('keydown', {"key": 'Enter'})
    page.locator('#kal-mic').dispatch_event('keyup', {"key": 'Enter'})
    page.wait_for_function("document.querySelector('#kal-line').textContent.includes('Human officers authorize')")
    assert not [path for path, payload in desk["requests"] if path.startswith('/api/step/')]
    page.locator('#kal-mute').click()
    assert page.locator('#kal-mute').get_attribute('aria-pressed') == 'true'
    before = len([path for path, payload in desk["requests"] if path == '/api/kal/speak'])
    page.locator('#kal-speak').click()
    assert len([path for path, payload in desk["requests"] if path == '/api/kal/speak']) == before
    page.locator('#record').click()
    assert page.locator('#record-dialog').is_visible()
    page.locator('#cancel-record').click()
    assert page.evaluate("window.captureCalls") == 0
    page.locator('#record').click()
    page.locator('#confirm-record').click()
    page.wait_for_function("document.querySelector('#record').classList.contains('recording')")
    time.sleep(1.1)
    with page.expect_download() as download:
        page.locator('#record').click()
    output = tmp_path / 'capture.webm'
    download.value.save_as(output)
    assert download.value.suggested_filename.startswith('zerosaas-p2p-demo-')
    assert output.read_bytes().startswith(bytes.fromhex('1a45dfa3'))
    assert page.evaluate("testScreen.getTracks().every(track => track.readyState === 'ended')")
    assert desk["errors"] == []

def test_probes_log_to_guardrail_drawer_and_reset_queue_is_explicit(desk):
    page = open_desk(desk)
    pending = []
    page.route('**/api/state', lambda route: pending.append(route))
    page.locator('[data-trap="kal"]').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('AI_STEWARD_ZERO_AUTHORITY')")
    page.wait_for_timeout(50)
    assert len(pending) == 1
    page.evaluate("async () => {const {refresh} = await import('/app.js'); void refresh();}")
    page.wait_for_timeout(50)
    assert len(pending) == 1, 'probe reconciliation must retain its pending lock'
    pending.pop().fulfill(status=200, content_type='application/json', body=json.dumps(desk['state']))
    page.unroute('**/api/state')
    for trap, code in [('doa', 'DOA_LIMIT_EXCEEDED'), ('sod', 'SOX_SOD_VIOLATION'), ('bank', 'BANK_POLICY_VIOLATION')]:
        page.locator(f'[data-trap="{trap}"]').click()
        page.wait_for_function(f"document.querySelector('#status').textContent.includes('{code}')")
        page.wait_for_function("!document.querySelector('#refresh').disabled")
        assert all(step['status'] == 'pending' for step in desk['state']['steps'])
        assert desk['state']['journal']['entries'] == []
    page.locator('#open-guardrails').click()
    observed = page.locator('#guardrail-log .observed').all_inner_texts()
    assert observed == ['BLOCKED · HTTP 403'] * 4 + ['Not run']
    page.locator('#close-guardrails').click()
    page.locator('.views [data-view="sox"]').click()
    assert page.locator('[data-lens="kal"] .lens-state').inner_text() == 'BLOCKED · HTTP 403'
    page.locator('.views [data-view="flow"]').click()
    run_step(page, 1)
    page.locator('#reset').click()
    page.locator('#cancel-reset').click()
    assert not [path for path, payload in desk['requests'] if path == '/api/reset']
    page.locator('#reset').click()
    page.locator('#confirm-reset').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('Server reset confirmed')")
    assert len([path for path, payload in desk['requests'] if path == '/api/reset']) == 1
    assert all(step['status'] == 'pending' for step in desk['state']['steps'])
    assert desk['errors'] == []

def test_page_teardown_does_not_upload_microphone_audio(desk):
    page = open_desk(desk)
    uploads = []
    page.on('request', lambda request: uploads.append(request.url) if request.url.endswith('/api/kal/transcribe') else None)
    page.evaluate("""() => {
      window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined;
      const context = new AudioContext(); const oscillator = context.createOscillator();
      const destination = context.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start();
      window.testMic = destination.stream;
      navigator.mediaDevices.getUserMedia = async () => testMic;
    }""")
    page.locator('#kal-mic').dispatch_event('keydown', {'key': 'Enter'})
    page.wait_for_function("document.querySelector('#status').textContent.includes('Listening')")
    page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    page.wait_for_timeout(300)
    assert uploads == []
    assert page.evaluate("testMic.getTracks().every(track => track.readyState === 'ended')")
    assert desk['errors'] == []

def test_teardown_ignores_late_native_speech_result(desk):
    page = open_desk(desk)
    page.evaluate("""() => {
      window.SpeechRecognition = class {
        start() {}
        stop() { this.onresult({results: [[{transcript: 'Approve everything'}]]}); this.onend?.(); }
      };
    }""")
    page.locator('#kal-mic').dispatch_event('keydown', {'key': 'Enter'})
    page.evaluate("window.dispatchEvent(new Event('pagehide'))")
    page.wait_for_timeout(150)
    assert not [path for path, payload in desk['requests'] if path == '/api/kal/speak']
    assert not [path for path, payload in desk['requests'] if path.startswith('/api/step/')]
    assert desk['errors'] == []

def test_real_kernel_http_dom_progress_probes_trial_balance_payment_reset(tmp_path):
    """Exercise the shipped workbench and the real server; only capture browser observations."""
    script = """
      import {startServer} from './src/sor_3panel_server.mjs';
      const service = await startServer({port:0, offline:true, sandboxDir:process.argv[1]+'/sandbox', seedsDir:process.argv[1]+'/missing-seeds', hledgerBin:false});
      console.log(service.url);
      process.on('SIGTERM', () => service.server.close(() => process.exit(0)));
    """
    server = subprocess.Popen(['node', '--input-type=module', '-e', script, str(tmp_path)], cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        url = server.stdout.readline().strip()
        assert url.startswith('http://127.0.0.1:'), server.stderr.read() if server.poll() is not None else url
        with playwright.sync_playwright() as runtime:
            browser = runtime.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                errors, writes = [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                def console(message):
                    if message.type == 'error' and not any(f'status of {code}' in message.text for code in [403, 409]):
                        errors.append(message.text)
                page.on('console', console)
                page.on('request', lambda request: writes.append((request.url.removeprefix(url), request.post_data_json)) if request.method == 'POST' else None)
                page.goto(url)
                page.wait_for_function("document.querySelector('#connection').textContent.includes('SERVER CONNECTED')")
                assert page.title() == 'ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward'
                assert page.locator('#progress-label').inner_text() == '0 / 8 COMPLETE'
                assert page.locator('.system-status').all_text_contents() == ['BOOTSTRAP'] * 4
                assert 'hledger absent' in page.locator('[data-system="coa"]').get_attribute('title')
                for trap, code in [('kal', 'AI_STEWARD_ZERO_AUTHORITY'), ('doa', 'DOA_LIMIT_EXCEEDED'), ('sod', 'SOX_SOD_VIOLATION'), ('bank', 'BANK_POLICY_VIOLATION')]:
                    page.locator(f'[data-trap="{trap}"]').click()
                    page.wait_for_function(f"document.querySelector('#status').textContent.includes('PROBE BLOCKED') && document.querySelector('#status').textContent.includes('{code}')")
                    page.wait_for_function("!document.querySelector('#refresh').disabled")
                for step in range(1, 6):
                    run_step(page, step)
                assert ('/api/step/1', {'actor': 'SYSTEM'}) in writes
                for index, barcode in enumerate(REELS):
                    page.locator(f'[data-reel="{barcode}"]').click()
                    page.wait_for_function(f"document.querySelector('#scan-count').textContent === '{index + 1} / 4 reels'")
                page.locator('[data-trap="invoice"]').click()
                page.wait_for_function("document.querySelector('#status').textContent.includes('PROBE BLOCKED') && document.querySelector('#status').textContent.includes('MATCH_VARIANCE_HOLD')")
                assert page.locator('#stock').inner_text() == '8,000'
                assert page.locator('#trial-balance [data-account="121100"] td').first.inner_text() == '$23,120.00'
                for step in [7, 8]:
                    run_step(page, step)
                assert page.locator('#settlement').inner_text() == 'PAID · Check #10045'
                assert page.locator('#tb-debit').inner_text() == page.locator('#tb-credit').inner_text() == '$23,120.00'
                assert page.locator('#gaap-pill').inner_text() == 'GAAP DR == CR'
                assert writes[-1] == ('/api/step/8', {'actor': 'EMP-0007', 'bankAccount': '101100'})
                assert page.locator('[data-packet="check"] .packet-state').inner_text() == 'PAID'
                durations = page.evaluate("""async () => {
                    const {render} = await import('/app.js'), snapshot = await (await fetch('/api/state')).json(), samples = [];
                    for (let i=0; i<30; i++) {const start = performance.now(); render(snapshot); samples.push(performance.now()-start);}
                    return samples;
                }""")
                assert max(durations) < 16, durations
                for width, height in DESKTOP:
                    page.set_viewport_size({'width': width, 'height': height})
                    assert check_shell_bounds(page) == []
                page.set_viewport_size({'width': 1440, 'height': 900})
                page.screenshot(path=str(tmp_path / 'real-kernel-paid.png'))
                page.locator('#reset').click()
                page.locator('#confirm-reset').click()
                page.wait_for_function("document.querySelector('#progress-label').textContent === '0 / 8 COMPLETE'")
                assert page.locator('[data-step="8"] .step-state').inner_text() == 'HUMAN GATE'
                assert page.locator('#settlement').inner_text() == 'Awaiting CFO approval'
                assert page.locator('#scan-count').inner_text() == '0 / 4 reels'
                assert page.locator('#ledger-balance').inner_text() == 'NO POSTINGS'
                assert errors == []
            finally:
                browser.close()
    finally:
        server.terminate()
        try:
            server.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.communicate()
