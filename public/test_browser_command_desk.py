"""Real Chromium projection checks for the Golden-Master ZeroSaaS P2P 3-panel workbench (WO-16).

Requires playwright and its Chromium installation; skips cleanly when playwright is absent.
"""
from pathlib import Path
import subprocess
import time

import pytest

playwright = pytest.importorskip("playwright.sync_api")
ROOT = Path(__file__).resolve().parents[1]
DESKTOP = [(1440, 900), (1366, 768), (1280, 720)]


def check_shell_bounds(page):
    return page.evaluate(
        """() => {
        const doc = document.documentElement;
        const issues = [];
        if (doc.scrollHeight > window.innerHeight + 1) issues.push(`vertical overflow ${doc.scrollHeight} > ${window.innerHeight}`);
        if (doc.scrollWidth > window.innerWidth + 1) issues.push(`horizontal overflow ${doc.scrollWidth} > ${window.innerWidth}`);
        return issues;
    }"""
    )


def test_real_browser_golden_master_workbench(tmp_path):
    server = subprocess.Popen(
        ["node", "src/sor_3panel_server.mjs", "--port", "0", "--offline", "--sandbox", str(tmp_path / "sandbox")],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        deadline = time.time() + 10
        line = ""
        while time.time() < deadline and not line:
            line = server.stdout.readline().strip()
        assert line.startswith("http://"), server.stderr.read()
        url = line.split()[0]
        with playwright.sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1440, "height": 900})
                errors = []
                page.on("pageerror", lambda err: errors.append(str(err)))
                page.goto(url)
                assert page.title() == "ZeroSaaS P2P · Headless Stock-to-Pay ERP & KAL Steward"
                assert page.locator("#strictPill").inner_text() == "GAAP DR == CR"
                assert "Start KAL" in page.locator("#leftStartKalBtn").inner_text()
                for tab_id in ("#nav-workflow", "#nav-registers", "#nav-security", "#nav-factory"):
                    page.locator(tab_id).click()
                page.locator("#nav-workflow").click()
                for width, height in DESKTOP:
                    page.set_viewport_size({"width": width, "height": height})
                    assert check_shell_bounds(page) == []
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
