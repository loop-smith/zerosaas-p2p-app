"""Real Chromium projection checks against an isolated HTTP boundary fixture.

This does not certify server accounting, authentication, OCR or ElevenLabs.
Requires playwright and its Chromium installation; no npm/runtime dependencies.
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
        expected_network_errors = []
        def console(message):
            if message.type != "error": return
            if message.text.startswith("Failed to load resource: the server responded with a status of ") and any(f"status of {code}" in message.text for code in [403, 409, 503]):
                expected_network_errors.append(message.text)
            else:
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

def check_visible_panel_bounds(page):
    return page.evaluate("""() => {
      const failures = [];
      if (document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth) failures.push('document overflow');
      for (const panel of document.querySelectorAll('.panel')) {
        if (!panel.getClientRects().length) continue;
        if (panel.scrollHeight > panel.clientHeight + 1) failures.push(panel.className + ' content overflow ' + panel.scrollHeight + '/' + panel.clientHeight);
        for (const button of panel.querySelectorAll('button')) {
          if (!button.getClientRects().length) continue;
          const rect = button.getBoundingClientRect(), parent = panel.getBoundingClientRect();
          if (rect.bottom > parent.bottom + 1 || rect.top < parent.top - 1 || rect.right > parent.right + 1) failures.push(button.textContent + ' clipped');
        }
      }
      return failures;
    }""")

def test_desktop_and_mobile_zero_scroll_with_all_controls_visible(desk):
    page = open_desk(desk)
    for width, height in [(1440, 900), (1366, 768), (1280, 720), (1024, 768), (960, 640), (390, 844), (390, 640)]:
        page.set_viewport_size({"width": width, "height": height})
        assert check_visible_panel_bounds(page) == [], f"{width}x{height}: {check_visible_panel_bounds(page)}"
        if width < 901:
            for panel in ["systems", "evidence", "pipeline"]:
                page.locator(f'.mobile-tabs [data-panel="{panel}"]').click()
                assert check_visible_panel_bounds(page) == [], f"{width}x{height}, {panel}: {check_visible_panel_bounds(page)}"
    page.set_viewport_size({"width": 1440, "height": 900})
    page.screenshot(path="/tmp/hara-wo04-desk.png")
    assert desk["errors"] == []

def test_eight_steps_four_explicit_gates_real_dom_ocr_and_refusal(desk):
    page = open_desk(desk)
    for step in range(1, 6):
        page.locator(f'[data-run="{step}"]').click()
        page.wait_for_function(f"document.querySelector('[data-step=\"{step}\"]').classList.contains('done')")
        assert len([item for item in desk["requests"] if item[0].startswith("/api/step/")]) == step
    page.locator('[data-trap="sod"]').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('SOX_SOD_VIOLATION')")
    assert desk["state"]["steps"][4]["status"] == "complete"
    for index, barcode in enumerate(REELS):
        page.locator('#barcode').fill(barcode)
        page.locator('[data-run="6"]').click()
        page.wait_for_function(f"document.querySelector('#scan-count').textContent === '{index+1} / 4 reels'")
    page.locator('[data-run="7"]').click()
    page.locator('#open-ocr').wait_for(state='visible')
    page.wait_for_function("!document.querySelector('#open-ocr').disabled")
    page.locator('#open-ocr').click()
    assert page.locator('.ocr-box').count() == 28
    assert page.locator('.ocr-box').first.get_attribute('aria-label') == '1: Field 1'
    durations = page.evaluate("""async () => {
      const {render} = await import('/app.js');
      const snapshot = await (await fetch('/api/state')).json(), samples = [];
      for (let i=0;i<30;i++) { const start=performance.now(); render(snapshot); samples.push(performance.now()-start); }
      return samples;
    }""")
    assert max(durations) < 16, durations
    print(f"populated journal + 28 open OCR boxes render max={max(durations):.2f}ms")
    page.locator('#close-ocr').click()
    page.locator('[data-run="8"]').click()
    page.wait_for_function("document.querySelector('#settlement').textContent.includes('PAID')")
    writes = [payload for path, payload in desk["requests"] if path.startswith('/api/step/')]
    assert writes[-1] == {"actor": "EMP-0007", "bankAccount": "101100"}
    assert 'BALANCED' in page.locator('#ledger-balance').inner_text()
    assert page.locator('#documents a[href]').count() == 5
    for width, height in [(1440, 900), (1280, 720), (960, 640)]:
        page.set_viewport_size({"width": width, "height": height})
        assert check_visible_panel_bounds(page) == [], check_visible_panel_bounds(page)
    page.set_viewport_size({"width": 1440, "height": 900})
    page.screenshot(path="/tmp/hara-wo04-complete.png")
    assert desk["errors"] == []

def test_disconnected_and_untrusted_state_cannot_fake_success(desk):
    desk["offline"] = True
    page = desk["page"]
    page.goto(desk["url"])
    page.wait_for_function("document.querySelector('#connection').textContent.includes('DISCONNECTED')")
    assert page.locator('.system-status.ok').count() == 0
    assert page.locator('.step-action:enabled').count() == 0
    assert page.locator('#actual-total').inner_text() == '—'
    desk["offline"] = False
    desk["state"].update(documents=[{"name": DOCS[0], "url": "javascript:alert(1)"}], journal={"balanced": False, "debitUsd": 1, "creditUsd": 0, "entries": [{"memo": "<script>alert(1)</script>", "legs": [{"account": "<img src=x onerror=alert(1)>", "debitUsd": 1, "creditUsd": 0}]}]})
    page.locator('#refresh').click()
    page.wait_for_function("document.querySelector('#ledger-balance').textContent.includes('UNBALANCED')")
    assert page.locator('#journal img, #journal script').count() == 0
    assert page.locator('#documents a[href]').count() == 0
    assert desk["errors"] == []

def test_recorder_real_webm_tracks_cleanup_voice_no_approval_and_render_budget(desk, tmp_path):
    page = open_desk(desk)
    page.evaluate("""() => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#e4a375'; ctx.fillRect(0,0,640,360);
      window.testScreen = canvas.captureStream(60);
      navigator.mediaDevices.getDisplayMedia = async () => window.testScreen;
      window.SpeechRecognition = class {
        start() { this.onresult({results: [[{transcript: 'Approve payment now'}]]}); }
        stop() { this.onend?.(); }
      };
    }""")
    page.locator('#kal-mic').dispatch_event('keydown', {"key": 'Enter'})
    page.locator('#kal-mic').dispatch_event('keyup', {"key": 'Enter'})
    page.wait_for_function("document.querySelector('#kal-line').textContent.includes('Human officers authorize')")
    assert not [path for path, payload in desk["requests"] if path.startswith('/api/step/')]
    page.locator('#record').click()
    page.wait_for_function("document.querySelector('#record').classList.contains('recording')")
    time.sleep(1.1)
    with page.expect_download() as download:
        page.locator('#record').click()
    output = tmp_path / 'capture.webm'
    download.value.save_as(output)
    assert output.read_bytes().startswith(bytes.fromhex('1a45dfa3'))
    assert page.evaluate("testScreen.getTracks().every(track => track.readyState === 'ended')")
    assert page.locator('#record-download').is_visible()
    durations = page.evaluate("""async () => {
      const {render} = await import('/app.js');
      const state = await (await fetch('/api/state')).json();
      const samples = [];
      for (let i=0;i<30;i++) { const start=performance.now(); render(state); samples.push(performance.now()-start); }
      return samples;
    }""")
    assert max(durations) < 16, durations
    print(f"render max={max(durations):.2f}ms; real WebM={output.stat().st_size} bytes")
    assert desk["errors"] == []

def test_probe_reconciliation_blocks_overlapping_refresh_and_reset_is_explicit(desk):
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
        assert all(step['status'] == 'pending' for step in desk['state']['steps'])
        assert desk['state']['journal']['entries'] == []
    page.locator('[data-run="1"]').click()
    page.wait_for_function("document.querySelector('#progress-label').textContent.includes('1 / 8')")
    page.locator('#reset').click()
    page.locator('#cancel-reset').click()
    assert not [path for path, payload in desk['requests'] if path == '/api/reset']
    page.locator('#reset').click()
    page.locator('#confirm-reset').click()
    page.wait_for_function("document.querySelector('#status').textContent.includes('Server reset confirmed')")
    assert len([path for path, payload in desk['requests'] if path == '/api/reset']) == 1
    assert all(step['status'] == 'pending' for step in desk['state']['steps'])
    assert desk['state']['journal']['entries'] == []
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


def test_real_kernel_http_dom_progress_probes_journal_payment_reset(tmp_path):
    """Exercise the shipped app and real server; only capture browser observations."""
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
                assert page.locator('#progress-label').inner_text() == '0 / 8 COMPLETE'
                assert page.locator('.system-status').all_text_contents() == ['BOOTSTRAP'] * 4
                assert 'hledger absent' in page.locator('[data-system="coa"]').get_attribute('title')
                # Missing source/health must be explicit, never synthesized as LIVE.
                def absent_sources(route):
                    response = route.fetch()
                    snapshot = response.json()
                    snapshot['sandbox'].pop('sources')
                    route.fulfill(response=response, json=snapshot)
                page.route('**/api/state', absent_sources)
                page.locator('#refresh').click()
                page.wait_for_function("[...document.querySelectorAll('.system-status')].every(node => node.textContent === 'ABSENT')")
                page.unroute('**/api/state', absent_sources)
                page.locator('#refresh').click()
                page.wait_for_function("document.querySelectorAll('.system-status.ok').length === 4")
                for trap, code in [('kal', 'AI_STEWARD_ZERO_AUTHORITY'), ('doa', 'DOA_LIMIT_EXCEEDED'), ('sod', 'SOX_SOD_VIOLATION'), ('bank', 'BANK_POLICY_VIOLATION')]:
                    page.locator(f'[data-trap="{trap}"]').click()
                    page.wait_for_function(f"document.querySelector('#status').textContent.includes('PROBE BLOCKED') && document.querySelector('#status').textContent.includes('{code}')")
                    page.wait_for_function("!document.querySelector('#refresh').disabled")
                before = len(writes)
                page.locator('[data-trap="invoice"]').click()
                page.wait_for_function("document.querySelector('#status').textContent.includes('Invoice probe needs')")
                assert len(writes) == before
                for step in range(1, 6):
                    page.locator(f'[data-run="{step}"]').click()
                    page.wait_for_function(f"document.querySelector('[data-step=\"{step}\"]').classList.contains('done')")
                assert ('/api/step/1', {'actor': 'SYSTEM'}) in writes
                for index, barcode in enumerate(REELS):
                    page.locator('#barcode').fill(barcode)
                    page.locator('[data-run="6"]').click()
                    page.wait_for_function(f"document.querySelector('#scan-count').textContent === '{index + 1} / 4 reels'")
                    if index < 3:
                        assert page.locator('#progress-label').inner_text() == '5 / 8 COMPLETE'
                        assert page.locator('[data-step="6"] .step-state').inner_text() == 'IN PROGRESS'
                        assert page.locator('[data-run="6"]').is_enabled()
                page.locator('[data-trap="invoice"]').click()
                page.wait_for_function("document.querySelector('#status').textContent.includes('PROBE BLOCKED') && document.querySelector('#status').textContent.includes('MATCH_VARIANCE_HOLD')")
                snapshot = page.request.get(url + '/api/state').json()
                invoice = next(body for path, body in writes if path == '/api/step/7')
                assert invoice == {'actor': 'EMP-0001', 'invoice': {'totalUsd': snapshot['po']['totalUsd'] + 500}}
                assert page.locator('#stock').inner_text() == '8,000'
                assert 'BALANCED' in page.locator('#ledger-balance').inner_text()
                assert '$23,120.00' == page.locator('#debit-total').inner_text()
                assert page.locator('#documents a[href]').count() == 0
                assert page.locator('#open-ocr').is_disabled()
                for step in [7, 8]:
                    page.locator(f'[data-run="{step}"]').click()
                    page.wait_for_function(f"document.querySelector('[data-step=\"{step}\"]').classList.contains('done')")
                assert page.locator('#settlement').inner_text() == 'PAID · Check #10045'
                assert page.locator('#journal td[title]').count() == 5
                assert page.locator('#progress-label').inner_text() == '8 / 8 COMPLETE'
                assert writes[-1] == ('/api/step/8', {'actor': 'EMP-0007', 'bankAccount': '101100'})
                assert page.locator('#journal tr').count() == 5
                durations = page.evaluate("""async () => {
                    const {render} = await import('/app.js'), snapshot = await (await fetch('/api/state')).json(), samples = [];
                    for (let i=0; i<30; i++) {const start = performance.now(); render(snapshot); samples.push(performance.now()-start);}
                    return samples;
                }""")
                assert max(durations) < 16, durations
                print(f'real kernel populated render max={max(durations):.2f}ms')
                for width, height in [(1440, 900), (1280, 720), (960, 640)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    assert check_visible_panel_bounds(page) == []
                page.screenshot(path=str(tmp_path / 'real-kernel-paid.png'))
                page.locator('#reset').click()
                page.locator('#confirm-reset').click()
                page.wait_for_function("document.querySelector('#progress-label').textContent === '0 / 8 COMPLETE'")
                assert page.locator('[data-step="8"] .step-state').inner_text() == 'HUMAN REQUIRED'
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
