// Golden-Master 1:1 Parity E2E + Red-Team + 275-Table Brownfield + RapidOCR 28-Box + Voice Lexicon Suite.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/sor_3panel_server.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const startSidecar = (docsDir) => new Promise((resolve, reject) => {
  const proc = spawn(process.env.PYTHON ?? 'python3', ['sidecar/invoice_ocr_engine.py', '--docs-dir', docsDir, '--port', '0', 'serve'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const fail = (e) => {
    clearTimeout(timer);
    proc.kill();
    reject(e);
  };
  const timer = setTimeout(() => fail(new Error('OCR sidecar not ready within 60s')), 60000);
  let out = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', (chunk) => {
    out += chunk;
    if (!out.includes('\n')) return;
    try {
      const ready = JSON.parse(out.slice(0, out.indexOf('\n')));
      if (ready.ok !== true) throw new Error(`OCR sidecar refused to start: ${out}`);
      clearTimeout(timer);
      resolve({ proc, ...ready });
    } catch (e) {
      fail(e);
    }
  });
  proc.once('exit', (code) => fail(new Error(`OCR sidecar exited ${code} before ready: ${out}`)));
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2p-golden-master-'));
const sandboxDir = path.join(tmp, 'sor-sandbox');
const sidecar = await startSidecar(path.join(sandboxDir, 'docs'));
const { server, url: BASE } = await startServer({
  port: 0,
  host: '127.0.0.1',
  sandboxDir,
  offline: true,
  fresh: true,
  ocrUrl: sidecar.url,
  voiceEnv: {},
}).catch((e) => {
  sidecar.proc.kill();
  throw e;
});

async function postStep(action, extra = {}) {
  const res = await fetch(`${BASE}/api/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealId: 'PO-25800', action, ...extra }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

try {
  console.log('=== KAL P2P STEWARD · GOLDEN-MASTER 8-STEP + 275-TABLE + RED-TEAM E2E SUITE ===');

  // 0. Reset (empty POST with no Content-Type, matching browser button) + verify 275-table brownfield schemas
  const r0 = await fetch(`${BASE}/api/reset`, { method: 'POST' });
  assert.equal(r0.status, 200);
  const s0 = await r0.json();
  const d0 = s0.deals['PO-25800'];
  const st0 = s0.runtimeState['PO-25800'];
  assert.equal(s0.provenance.aiSteward.name, 'KAL', 'AI Steward must be KAL');
  assert.equal(s0.provenance.aiSteward.bossAgentId, 'AGT-8090-KAL-01', 'BOSS Agent ID must be AGT-8090-KAL-01');
  assert.equal(s0.provenance.archifyRevision, 'REV-02', 'Archify revision must be REV-02');
  assert.equal(s0.stewards[0].bossWorkflowId, 'WF-P2M-1A', 'Flow 1 must map to BOSS WF-P2M-1A in P2M Supply Chain');
  assert.equal(s0.stewards[5].code, 'STD-COST-PPV', 'WF-05 / WF-P2P-2B must enforce Annual Standard Cost & Purchase Price Variance (PPV)');
  assert.equal(s0.provenance.aiSteward.signingLimitUsd, 0, 'KAL must have $0.00 Signing Limit');
  assert.equal(s0.provenance.aiSteward.dbWriteCredentials, 0, 'KAL must have 0 DB write credentials');
  assert.equal(s0.catalogs.crmTableCount, 151, 'CRM SQLite seed must expose 151 tables');
  assert.equal(s0.catalogs.wmsTableCount, 119, 'WMS SQLite seed must expose 119 tables');
  assert.equal(s0.catalogs.hrmTableCount, 5, 'HRM SQLite seed must expose 5 tables');
  assert.ok(s0.catalogs.crmTableCount + s0.catalogs.wmsTableCount + s0.catalogs.hrmTableCount >= 275, 'Must expose >= 275 brownfield SQLite tables');
  assert.equal(s0.hledger.accountCount, 89, 'GAAP COA must expose 89 accounts');
  assert.equal(s0.catalogs.fkMap.partCount, 1, 'InvenTree part_part must contain strictly 1 stocked item');
  assert.equal(d0.itemCanonical, 'ITM-CU-20-BARE', 'Stocked item SKU must be ITM-CU-20-BARE');
  assert.equal(d0.onHandStockFt, 0, 'Seeded stock must be 0 FT');
  assert.equal(d0.minThresholdFt, 8000, 'Minimum stock threshold must be 8,000 FT');
  assert.equal(d0.reelCount, 4, 'Must configure 4 barcoded master reels');
  assert.equal(Array.isArray(d0.reelBarcodes) && d0.reelBarcodes.length, 4, 'Must expose 4 Encore Wire GS1 reel barcodes');
  assert.equal(d0.oaId, 'ENC-OA-2026-884192');
  assert.equal(d0.oaFile, 'ENC-OA-2026-884192.pdf');
  assert.equal(d0.catalogUnitPrice, 2.89);
  assert.equal(d0.catalogEstimateUsd, 23120);
  assert.equal(d0.isBelowThreshold, true);
  assert.equal(st0.wf0_req_status, 'stock_out_alert');
  assert.equal(s0.activeHats['PO-25800'].empId, 'EMP-0021');
  console.log(`[PASS] Seed State: 275 SQLite tables (151 CRM / 119 WMS / 5 HRM) + 89 GAAP accounts | 1 WMS Item = 0 FT < 8,000 FT ($23,120 std)`);

  // Verify /api/voice/status and /api/table across all 4 SQLite systems
  const vStatus = await (await fetch(`${BASE}/api/voice/status`)).json();
  assert.equal(vStatus.opsVoiceId, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(vStatus.treasuryVoiceId, 'EXAVITQu4vr4xnSDxMaL');
  assert.equal(vStatus.preferredModel, 'eleven_turbo_v2_5');
  assert.equal(vStatus.fallbackModel, 'eleven_flash_v2_5');
  assert.equal(vStatus.sttModel, 'scribe_v1');

  const crmTbl = await (await fetch(`${BASE}/api/table?system=crm&table=crm_company`)).json();
  assert.equal(crmTbl.totalRows, 1);
  const hrmTbl = await (await fetch(`${BASE}/api/table?system=hrm&table=hrm_doa_authority_seat`)).json();
  assert.equal(hrmTbl.totalRows, 7);
  const badTbl = await fetch(`${BASE}/api/table?system=wms&table=nonexistent_table`);
  assert.equal(badTbl.status, 400);

  // 0b. RED-TEAM 403 #0: KAL Rogue Write Attempt
  const blkKalRogue = await postStep('kal_rogue_attempt');
  assert.equal(blkKalRogue.status, 403);
  assert.equal(blkKalRogue.body.guardrailBlock.code, 'AI_STEWARD_ZERO_AUTHORITY');
  const blkKalSign = await postStep('wf0_submit_req', { actingEmpId: 'KAL' });
  assert.equal(blkKalSign.status, 403);
  assert.equal(blkKalSign.body.guardrailBlock.code, 'AI_STEWARD_ZERO_AUTHORITY');
  console.log('[PASS] RED-TEAM 403 #0: Blocked KAL Rogue Token Buy & Checkpoint Signing (AI_STEWARD_ZERO_AUTHORITY · $0.00 impact)');

  // 1. Step 1 (Auto SQL Block): Start KAL Steward & Verify Live WMS Stock-Out Signal + "Good day" Opener
  const pStart = await postStep('wf0_detect_stockout');
  assert.equal(pStart.status, 200);
  assert.equal(pStart.body.runtimeState['PO-25800'].kal_started, true);
  assert.match(pStart.body.runtimeState['PO-25800'].lastVoiceBrief, /^Good day\./);
  console.log('[PASS] Step 1 (Auto SQL): KAL greeted "Good day..." & routed Supply Chain signal to Darius Mercer');

  // 2. Step 2 (Human Checkpoint #1): Darius Mercer ($20k Signing Limit) confirms need -> Escalates
  const p2Req = await postStep('wf0_submit_req');
  assert.equal(p2Req.status, 200);
  assert.equal(p2Req.body.runtimeState['PO-25800'].wf0_req_status, 'pending_manager_doa');
  assert.equal(p2Req.body.moneyFlow.perDeal['PO-25800'].upstreamReqUsd, 23120);
  assert.equal(p2Req.body.activeHats['PO-25800'].empId, 'EMP-0005');
  console.log('[PASS] Step 2 (Human #1): Darius Mercer ($20k Signing Limit) confirmed REQ-25800 ($23,120) -> Escalated to VP Devon Brooks ($100k)');

  // 3. RED-TEAM 403 #1: Planner Darius Mercer ($20k) tries to self-approve $23,120 REQ-25800
  const blkDoa = await postStep('wf0_approve_req', { actingEmpId: 'EMP-0021' });
  assert.equal(blkDoa.status, 403);
  assert.equal(blkDoa.body.guardrailBlock.code, 'DOA_LIMIT_EXCEEDED');
  console.log(`[PASS] RED-TEAM 403 #1: Blocked EMP-0021 self-approval (${blkDoa.body.guardrailBlock.code})`);

  // 4. Step 3 (Human Checkpoint #2): VP Supply Chain Devon Brooks ($100k) approves REQ-25800
  const p3Vp = await postStep('wf0_approve_req');
  assert.equal(p3Vp.status, 200);
  assert.equal(p3Vp.body.runtimeState['PO-25800'].wf0_req_status, 'approved');
  assert.equal(p3Vp.body.activeHats['PO-25800'].empId, 'EMP-0002');
  console.log('[PASS] Step 3 (Human #2): VP Supply Chain Devon Brooks ($100k Signing Limit) approved REQ-25800');

  // 5. Steps 4 & 5 (Auto Purchasing Block): COMEX Copper Spot + Issue PO-25800 + Vendor OA
  const spotDirect = await (await fetch(`${BASE}/api/copper-spot`)).json();
  assert.ok(spotDirect.spotPerLbUsd > 2.0);
  const pAutoBuy = await postStep('kal_auto_purchasing');
  assert.equal(pAutoBuy.status, 200);
  const sq = pAutoBuy.body.runtimeState['PO-25800'].spotQuote;
  assert.equal(sq.httpMethod, 'GET');
  assert.match(sq.endpointUrl, /^https:\/\//);
  assert.equal(sq.httpStatus, 200);
  assert.ok(sq.rawJsonSnippet && sq.rawJsonSnippet.includes('HG'));
  assert.ok(pAutoBuy.body.moneyFlow.portfolio.openPoCommitmentUsd > 20000);
  const lockedAmt = pAutoBuy.body.deals['PO-25800'].poAmount;
  const expectedUnit = Number(((sq.spotPerLbUsd + 0.32) * 0.411).toFixed(2));
  assert.equal(sq.lockedUnitPriceFt, expectedUnit);
  assert.ok(lockedAmt < 23120);
  assert.equal(pAutoBuy.body.runtimeState['PO-25800'].wf1_po_committed, 'done');
  assert.equal(pAutoBuy.body.deals['PO-25800'].catalogUnitPrice, 2.89);
  assert.equal(pAutoBuy.body.deals['PO-25800'].syncedCatalogUnitPrice, 2.89);
  assert.equal(pAutoBuy.body.runtimeState['PO-25800'].wf1_vendor_ack, 'done');
  assert.equal(pAutoBuy.body.moneyFlow.perDeal['PO-25800'].grniLiabilityUsd, 0);
  assert.equal(pAutoBuy.body.activeHats['PO-25800'].empId, 'EMP-0003');
  console.log(`[PASS] Steps 4-5 (Auto Purchasing): Spot $${sq.spotPerLbUsd}/lb -> $${sq.lockedUnitPriceFt}/FT = $${lockedAmt} (Saved $${sq.savingsVsCatalogUsd})`);

  // 6. RED-TEAM 403 #2: Buyer Nancy tries to scan her own PO at Dock + 6b Incomplete Reel Scan 409
  const blkDock = await postStep('wf2_dock_receipt', { actingEmpId: 'EMP-0002' });
  assert.equal(blkDock.status, 403);
  assert.equal(blkDock.body.guardrailBlock.code, 'SOX_SOD_VIOLATION');
  const blkShortScan = await postStep('wf2_dock_receipt', { scannedBarcodes: ['ENC-GS1-884192-R01', 'ENC-GS1-884192-R02'] });
  assert.equal(blkShortScan.status, 409);
  console.log('[PASS] RED-TEAM 403 #2 & 409: Blocked Buyer Nancy Dock self-scan + Incomplete 2/4 Reel Scan');

  // 7. Step 6 (Human Checkpoint #3): Marcus Vance scans all 4 GS1 reel barcodes
  const p6Dock = await postStep('wf2_dock_receipt', {
    scannedBarcodes: d0.reelBarcodes.map(r => r.barcode),
  });
  assert.equal(p6Dock.status, 200);
  assert.equal(p6Dock.body.deals['PO-25800'].onHandStockFt, 8000);
  const wmsStockTbl = await (await fetch(`${BASE}/api/table?system=wms&table=stock_stockitem`)).json();
  assert.equal(wmsStockTbl.rows.length, 4);
  assert.deepEqual(
    wmsStockTbl.rows.map(r => r.barcode_data).sort(),
    ['ENC-GS1-884192-R01', 'ENC-GS1-884192-R02', 'ENC-GS1-884192-R03', 'ENC-GS1-884192-R04']
  );
  assert.equal(p6Dock.body.deals['PO-25800'].isBelowThreshold, false);
  assert.equal(p6Dock.body.moneyFlow.perDeal['PO-25800'].inventoryAssetUsd, 23120);
  assert.equal(p6Dock.body.moneyFlow.perDeal['PO-25800'].grniLiabilityUsd, lockedAmt);
  assert.equal(p6Dock.body.moneyFlow.perDeal['PO-25800'].ppvSignedUsd, Number((lockedAmt - 23120).toFixed(2)));
  assert.equal(p6Dock.body.hledger.strictBalanced, true);
  console.log(`[PASS] Step 6 (Human #3 · 4 Reel Scans): 4 stock_stockitem rows = 8,000 FT -> 121100=$23,120 | 201200=$${lockedAmt} | 501900=$${(lockedAmt - 23120).toFixed(2)}`);

  // 8. RED-TEAM 409 #3: Over-Billed Vendor Invoice (+$500 Variance Hold)
  const blk3Var = await postStep('wf3_test_variance_hold');
  assert.equal(blk3Var.status, 409);
  assert.equal(blk3Var.body.guardrailBlock.code, 'MATCH_VARIANCE_HOLD');
  assert.equal(blk3Var.body.state.moneyFlow.perDeal['PO-25800'].tradeApLiabilityUsd, 0);
  console.log('[PASS] RED-TEAM 409 #3: Blocked +$500 over-billed vendor invoice (MATCH_VARIANCE_HOLD, $0.00 AP leakage)');

  // 9. Step 7 (Auto AP Block): Warm RapidOCR /scan tags 28 boxes & 3-Way Match approves ($0.00 variance)
  const p7Ocr = await postStep('wf3_poll_and_ocr');
  assert.equal(p7Ocr.status, 200);
  const ocr = p7Ocr.body.runtimeState['PO-25800'].wf3_ocr_result;
  const em = p7Ocr.body.runtimeState['PO-25800'].wf3_email_meta;
  assert.ok(em && em.from.includes('encorewire.com') && em.emlFile === 'EMAIL-INV-25800.eml');
  assert.equal(ocr.mathVerified, true);
  assert.equal(ocr.boxCount, 28);
  assert.equal(Number(ocr.extracted.quantity.value), 8000);
  assert.equal(Number(ocr.extracted.totalDue.value), lockedAmt);
  assert.equal(p7Ocr.body.runtimeState['PO-25800'].wf4_match_status, 'voucher_posted');
  assert.equal(p7Ocr.body.moneyFlow.perDeal['PO-25800'].grniLiabilityUsd, 0);
  assert.equal(p7Ocr.body.moneyFlow.perDeal['PO-25800'].tradeApLiabilityUsd, lockedAmt);
  assert.equal(p7Ocr.body.activeHats['PO-25800'].empId, 'EMP-0007');
  assert.equal(ocr.ocrEndpoint, `POST ${sidecar.url}/scan`);
  const p7Rescan = await postStep('wf3_rescan_ocr');
  assert.equal(p7Rescan.status, 200);
  assert.equal(p7Rescan.body.runtimeState['PO-25800'].wf3_ocr_result.boxCount, 28);
  console.log(`[PASS] Step 7 (Live RapidOCR /scan + 3WM): ${ocr.boxCount} boxes (${(ocr.avgConfidence * 100).toFixed(1)}% conf, ${ocr.elapsedMs}ms) -> $0.00 3-Way Match`);

  // 10. RED-TEAM 403 #4 & #5: Nancy Cash Self-Approval + 101200 Payroll Bank Ring-Fence
  const blk4Sod = await postStep('wf4_release_ach', { actingEmpId: 'EMP-0002' });
  assert.equal(blk4Sod.status, 403);
  assert.equal(blk4Sod.body.guardrailBlock.code, 'SOX_SOD_VIOLATION');
  const blk4Bank = await postStep('wf4_release_ach', { bankAccount: 'Assets:101200-Payroll-Checking' });
  assert.equal(blk4Bank.status, 403);
  assert.equal(blk4Bank.body.guardrailBlock.code, 'TREASURY_BANK_GUARDRAIL');
  console.log('[PASS] RED-TEAM 403 #4 & #5: Blocked Nancy Cash SoD + Blocked 101200 Payroll Bank Ring-Fence');

  // 11. Step 8 (Human Checkpoint #4): CFO Meredith Hale cuts Check #10045 / ACH-000582
  const p8Pay = await postStep('wf4_release_ach');
  assert.equal(p8Pay.status, 200);
  const st8 = p8Pay.body.runtimeState['PO-25800'];
  const mf8 = p8Pay.body.moneyFlow.perDeal['PO-25800'];
  const lens8 = p8Pay.body.lineage.controlLenses['PO-25800'];
  assert.equal(st8.checkNumber, 'Check #10045');
  assert.equal(st8.achTrace, 'ACH-000582');
  assert.match(st8.poPaidStamp, /PAID.*Check #10045/);
  assert.match(st8.invoicePaidStamp, /PAID.*Check #10045/);
  assert.equal(mf8.grniLiabilityUsd, 0);
  assert.equal(mf8.tradeApLiabilityUsd, 0);
  assert.equal(mf8.settledCashUsd, lockedAmt);
  assert.equal(p8Pay.body.hledger.strictBalanced, true);
  assert.equal(lens8.gaapAndSox404.distinctHumanSignersCount, 6);
  assert.equal(lens8.gaapAndSox404.segregationOfDutiesPass, 'PASS_ZERO_ROLE_COLLISION');
  assert.match(lens8.fourLayerActionGovernance.layer4_executiveFiduciaryGate, /SIGNED_BY_EXECUTIVE_DOA/);
  const fs8 = p8Pay.body.financialStatements;
  assert.ok(fs8 && fs8.balanceSheet && fs8.profitAndLoss);
  const expectedGain = Number((23120 - lockedAmt).toFixed(2));
  assert.equal(fs8.balanceSheet.balanced, true);
  assert.equal(fs8.balanceSheet.inventoryStdUsd, 23120);
  assert.equal(fs8.balanceSheet.operatingCashChangeUsd, -lockedAmt);
  assert.equal(fs8.balanceSheet.totalLiabilitiesUsd, 0);
  assert.equal(fs8.balanceSheet.retainedEarningsNetIncomeUsd, expectedGain);
  assert.equal(fs8.balanceSheet.totalAssetsUsd, expectedGain);
  assert.equal(fs8.balanceSheet.totalLiabilitiesAndEquityUsd, expectedGain);
  assert.equal(fs8.profitAndLoss.favorableVarianceGainUsd, expectedGain);
  assert.equal(fs8.balanceSheet.operatingCashOpeningUsd, 250000);
  assert.equal(fs8.balanceSheet.operatingCashEndingUsd, Number((250000 - lockedAmt).toFixed(2)));
  assert.equal(fs8.balanceSheet.payrollCashBalanceUsd, 140000);
  assert.equal(fs8.balanceSheet.totalEndingAssetsUsd, fs8.balanceSheet.totalEndingLiabAndEquityUsd);
  assert.equal(Array.isArray(fs8.coaTrialBalance) && fs8.coaTrialBalance.length, 6);
  assert.equal(fs8.coaTrialBalance[0].acctNum, '101100');
  console.log(`[PASS] Step 8 (Human #4 + GAAP Books): ${st8.checkNumber} ($${lockedAmt}) | 101100 Cash=$${fs8.balanceSheet.operatingCashEndingUsd} | P&L Gain=+$${fs8.profitAndLoss.favorableVarianceGainUsd}`);

  // 11b. Verify Vault + KAL Speech Normalizer & SOX/DB Tour
  assert.ok(p8Pay.body.sorVault && p8Pay.body.sorVault.gitTracked === false);
  assert.equal(p8Pay.body.sorVault.files.length, 5);
  for (const vf of p8Pay.body.sorVault.files) {
    assert.ok(vf.bytes > 0 && vf.sha256.length === 64, `Vault file ${vf.fileName} must have live bytes & SHA-256`);
  }

  for (const preset of ['status', 'spot', 'governance', 'sox_db_tour']) {
    const kalRes = await (await fetch(`${BASE}/api/voice/kal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    })).json();
    assert.equal(kalRes.ok, true);
    assert.equal(/\d/.test(kalRes.spokenText), false, `KAL spokenText for '${preset}' must contain ZERO raw digits, got: ${kalRes.spokenText}`);
    assert.equal(/\b([a-z]{3,})\s+\1\b/i.test(kalRes.spokenText), false, `KAL spokenText must contain ZERO repeated words, got: ${kalRes.spokenText}`);
  }
  const dryTts = await (await fetch(`${BASE}/api/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dryRun: true,
      text: 'Review Requisition REQ-25800, Purchase Order PO-25800, Vendor Order Acknowledgement ENC-OA-2026-884192, Invoice INV-25800, and Check number 10045.',
    }),
  })).json();
  assert.equal(/\b([a-z]{3,})\s+\1\b/i.test(dryTts.normalizedText), false);
  assert.equal(/\d/.test(dryTts.normalizedText), false);
  console.log('[PASS] KAL Voice Pronunciation Normalizer: 0 raw digits & 0 repeated words across all presets');

  // 12. Verify all 5 trade PDFs + Invoice PNG + traversal protection + /api/lineage/recrawl
  for (const f of ['PO-25800.pdf', 'ENC-OA-2026-884192.pdf', 'BOL-25800.pdf', 'PS-25800.pdf', 'INV-25800.pdf']) {
    const pdfRes = await fetch(`${BASE}/api/trade-pdf?file=${f}`);
    assert.equal(pdfRes.status, 200, `Trade PDF ${f} must serve HTTP 200`);
  }
  const invPdfRes = await fetch(`${BASE}/api/invoice-pdf?file=INV-25800.pdf`);
  assert.equal(invPdfRes.status, 200);
  const pngRes = await fetch(`${BASE}/api/invoice-image?file=INV-25800.png`);
  assert.equal(pngRes.status, 200);
  const travRes = await fetch(`${BASE}/api/trade-pdf?file=../../package.json`);
  assert.equal(travRes.status, 404);

  const recrawlRes = await fetch(`${BASE}/api/lineage/recrawl`, { method: 'POST' });
  assert.equal(recrawlRes.status, 200);
  const recrawlJson = await recrawlRes.json();
  assert.ok(Array.isArray(recrawlJson.lineage.semanticBindings) && recrawlJson.lineage.semanticBindings.length >= 13);
  console.log('[PASS] Trade Packet Artifacts + Invoice PNG + Traversal Guard + Lineage Recrawl all HTTP 200/404');

  // 13. Reset back to clean 0 FT / $0.00 baseline
  const rClean = await fetch(`${BASE}/api/reset`, { method: 'POST' });
  assert.equal(rClean.status, 200);
  console.log('=== ALL GOLDEN-MASTER E2E + KAL GUARDRAIL + 275-TABLE ASSERTIONS 100% GREEN ===');
} finally {
  await new Promise((resolve) => server.close(resolve));
  sidecar.proc.kill('SIGTERM');
  await new Promise((resolve) => sidecar.proc.once('exit', resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
}
