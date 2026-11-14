// WO-05 tracers via src/selfcheck.mjs, plus WO-06 red-team regressions on the integrated stack:
// src/ kernel + HTTP server (ephemeral port, :3590 by default), sidecar/ RapidOCR (ephemeral port, :3591 by
// default) writing into the kernel sandbox, public/ desk validator, seeds/ copied. No mock of the unit under test.
// Sandbox is a temp directory; committed seeds/ are only copied.
//
// Locked refusal codes (do not rename):
//   400 BAD_ACTOR | BAD_JSON
//   403 AI_STEWARD_ZERO_AUTHORITY | BANK_POLICY_VIOLATION | SEAT_NOT_AUTHORIZED
//   405 write to a non-route (body code NOT_FOUND)
//   409 STEP_ALREADY_COMPLETE | STEP_OUT_OF_ORDER | DUPLICATE_SCAN | MATCH_VARIANCE_HOLD
//   415 UNSUPPORTED_MEDIA_TYPE
//   422 INVALID_QUANTITY | UNKNOWN_REEL | NO_BARCODE | UNKNOWN_BANK_ACCOUNT
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../src/sor_3panel_server.mjs';
import { CONTRACT } from '../src/lineage_core.mjs';
import { validateState, tagOcrFields } from '../public/app.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const AI = CONTRACT.provenance.aiSteward;
const REELS = CONTRACT.primaryItem.lowStockTrigger.reelBarcodes;
const CHECK = CONTRACT.primaryItem.settlement.checkNumber;
const TRADE = CONTRACT.primaryItem.tradeDocuments;
const PDFS = Object.values(TRADE).filter((v) => v.endsWith('.pdf')).sort();
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const KAL = AI.id;
const [DARIUS, NANCY, DEVON, MARCUS, MEREDITH] = ['EMP-0021', 'EMP-0002', 'EMP-0005', 'EMP-0003', 'EMP-0007'];
const SQL = "EMP-0007'; DROP TABLE stock_stockitem;--";
const DROP = 'DROP TABLE';

const child = spawnSync(process.execPath, ['src/selfcheck.mjs'], { cwd: ROOT, stdio: 'inherit' });
if (child.status !== 0) {
  console.error(`src/selfcheck.mjs exited ${child.status} (WO-05 tracers)`);
  process.exit(child.status ?? 1);
}

/** Real RapidOCR sidecar on a free loopback port, writing into the kernel sandbox docs dir. */
const startSidecar = (docsDir) => new Promise((resolve, reject) => {
  const proc = spawn(process.env.PYTHON ?? 'python3', ['sidecar/invoice_ocr_engine.py', '--docs-dir', docsDir, '--port', '0', 'serve'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const fail = (e) => { clearTimeout(timer); proc.kill(); reject(e); };
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2p-redteam-'));
const sandboxDir = path.join(tmp, 'sor-sandbox');
const sidecar = await startSidecar(path.join(sandboxDir, 'docs'));
const { server, url, kernel } = await startServer({
  port: 0, host: '127.0.0.1', sandboxDir, offline: true, fresh: true, ocrUrl: sidecar.url,
}).catch((e) => {
  sidecar.proc.kill();
  throw e;
});

let passed = 0;
const call = async (method, route, body, headers = {}) => {
  const res = await fetch(url + route, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const text = await res.text();
  let parsed = text;
  if (res.headers.get('content-type')?.includes('json')) parsed = JSON.parse(text);
  return { status: res.status, body: parsed };
};
const step = (n, body, headers) => call('POST', `/api/step/${n}`, body, headers);
const must = async (label, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok  ${label}`);
};
const refusal = async (pending, status, code) => {
  const r = await pending;
  assert.equal(r.status, status, JSON.stringify(r.body));
  assert.equal(r.body.code, code, JSON.stringify(r.body));
  assert.equal(r.body.bookImpactUsd, 0);
  return r;
};
const journal = async () => (await call('GET', '/api/journal')).body;
const state = async () => (await call('GET', '/api/state')).body;
const minQty = () => kernel.wms.prepare('SELECT MIN(quantity) AS m FROM stock_stockitem').get().m;
const partCount = () => kernel.wms.prepare('SELECT COUNT(*) AS c FROM part_part WHERE id = 218').get().c;

try {
  await must('baseline: real seeds, non-negative stock, KAL $0, empty journal', async () => {
    assert.equal(kernel.wms.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
    assert.equal(partCount(), 1);
    assert.ok(minQty() >= 0);
    const kal = kernel.hrm.prepare("SELECT approval_limit_usd AS lim, db_write_credentials AS creds FROM hrm_doa_authority_seat WHERE emp_id = ?").get(KAL);
    assert.equal(kal.lim, 0);
    assert.equal(kal.creds, 0);
    assert.equal((await journal()).entries.length, 0);
    assert.equal((await state()).payment, null);
  });

  await must('SQL injection and parameter tampering do not touch SoR rows or post a journal', async () => {
    await refusal(step(1, { actor: SQL, sql: `${DROP} journal_leg`, part_id: '218 OR 1=1', onHandFt: 8000 }), 400, 'BAD_ACTOR');
    await refusal(step(1, { actor: "' OR 1=1 --" }), 400, 'BAD_ACTOR');
    await refusal(step(8, { actor: 'ΕΜP-0007', amountUsd: 0.01 }), 400, 'BAD_ACTOR');
    assert.equal((await call('POST', '/api/step/1%27%20OR%201%3D1', { actor: MEREDITH })).status, 405);
    await refusal(call('POST', '/api/step/1', `${DROP} stock_stockitem`, { 'content-type': 'text/plain' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
    await refusal(step(8, { actor: NANCY }, {}), 403, 'SEAT_NOT_AUTHORIZED');
    const escalated = await step(8, { actor: NANCY, bankAccount: '101100' });
    assert.equal(escalated.status, 403, 'query/body must not promote the buyer');
    const q = await call('POST', '/api/step/8?actor=EMP-0007&sql=1', { actor: NANCY, bankAccount: '101100' });
    assert.equal(q.status, 403);
    assert.equal(q.body.code, 'SEAT_NOT_AUTHORIZED');
    await refusal(step(8, { actor: MEREDITH, bankAccount: '101200' }), 403, 'BANK_POLICY_VIOLATION');
    await refusal(step(8, { actor: MEREDITH, bankAccount: "101100'; DROP TABLE journal_leg;--" }), 422, 'UNKNOWN_BANK_ACCOUNT');
    const opened = await step(1, {
      actor: 'SYSTEM', sql: `${DROP} stock_stockitem`, part_id: 999, onHandFt: 8000, stdTotalUsd: 0, quantityFt: -1,
    });
    assert.equal(opened.status, 200, JSON.stringify(opened.body));
    assert.equal(opened.body.detail.sql, 'SELECT COALESCE(SUM(quantity), 0) FROM stock_stockitem WHERE part_id = ?');
    assert.equal(opened.body.detail.partId, 218);
    assert.equal(opened.body.detail.onHandFt, 0);
    assert.equal(opened.body.detail.stdTotalUsd, 23120);
    assert.equal(partCount(), 1);
    assert.ok(kernel.wms.prepare("SELECT name FROM sqlite_master WHERE name = 'stock_stockitem'").get());
    assert.equal((await journal()).entries.length, 0);
    assert.ok(minQty() >= 0);
  });

  await must('KAL header spoofing is 403 on every write and is chained as EMP-AI-KAL', async () => {
    const kernelSpoofs = [
      () => step(8, { actor: KAL }),
      () => step(8, { actor: 'kal' }),
      () => step(8, { actor: AI.phonetic }),
      () => step(8, { actor: AI.bossAgentId }),
      () => step(8, { actor: MEREDITH }, { 'x-actor': 'KAL' }),
      () => step(8, { actor: MEREDITH }, { 'x-actor': 'EMP-0007, kal' }),
      () => step(8, { actor: MEREDITH }, { 'x-agent-id': '  agt-8090-kal-01  ' }),
      () => step(8, { actor: MEREDITH }, { 'x-actor': '  Emp-Ai-Kal  ' }),
      () => step(3, { actor: DEVON }, { 'x-actor': `${DEVON}, ${AI.name}` }),
      () => call('POST', '/api/reset', { actor: MEREDITH }, { 'x-actor': KAL }),
    ];
    for (const fire of kernelSpoofs) {
      const r = await refusal(fire(), 403, 'AI_STEWARD_ZERO_AUTHORITY');
      assert.equal(r.body.actor, KAL);
    }
    // PUT is refused in the HTTP adapter, before the kernel, so the body has no actor field.
    const put = await refusal(call('PUT', '/api/state', { sql: DROP }, { 'x-agent-id': AI.bossAgentId }), 403, 'AI_STEWARD_ZERO_AUTHORITY');
    assert.equal(put.body.actor, undefined);
    const read = await call('GET', '/api/state', undefined, { 'x-actor': KAL });
    assert.equal(read.status, 200);
    assert.equal((await state()).payment, null);
    assert.equal((await journal()).entries.length, 0);
    const audit = await call('GET', '/api/audit');
    const rows = audit.body.entries.filter((e) => e.event === 'REFUSED' && e.payload.code === 'AI_STEWARD_ZERO_AUTHORITY');
    assert.equal(rows.length, kernelSpoofs.length);
    assert.ok(rows.every((e) => e.actor === KAL));
  });

  await must('steps 2-5 accept the seated actors only', async () => {
    assert.equal((await step(2, { actor: DARIUS, action: 'confirm', limitUsd: 999999 })).status, 200);
    assert.equal((await step(3, { actor: DEVON, amountUsd: 0 })).status, 200);
    const bought = await step(4, { actor: 'SYSTEM', unitUsd: 0.01, totalUsd: 1, sql: DROP });
    assert.equal(bought.status, 200, JSON.stringify(bought.body));
    assert.equal(bought.body.detail.totalUsd, 21600);
    assert.equal(bought.body.detail.stdUnitUsd, 2.89);
    assert.equal((await step(5, {})).status, 200);
    assert.equal((await journal()).entries.length, 0, 'no GL impact before the dock scan');
  });

  await must('step 5 receives the five sidecar trade PDFs into the sandbox; /docs serves them hash-for-hash', async () => {
    const docs = (await state()).documents;
    assert.deepEqual(docs.map((d) => d.name).sort(), PDFS);
    for (const doc of docs) {
      const bytes = fs.readFileSync(path.join(kernel.docsDir, doc.name));
      assert.equal(doc.sha256, sha(bytes));
      assert.equal(doc.url, `/docs/${doc.name}`);
      const served = await fetch(url + doc.url);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get('content-type'), 'application/pdf');
      assert.ok(Buffer.from(await served.arrayBuffer()).equals(bytes));
    }
    for (const escape of ['/docs/..%2Fp2p_kernel.sqlite3', '/docs/%2E%2E%2Fwms_seed.sqlite3','/docs/../package.json', '/docs/missing.pdf']) {
      assert.notEqual((await call('GET', escape)).status, 200, escape);
    }
  });

  await must('negative-quantity reel scans are refused and never stored', async () => {
    const attacks = [-2000, -1, 0, -0, '-2000', 8000, null, 1999.5, Number.NaN];
    for (const quantityFt of attacks) {
      const body = { actor: MARCUS, barcode: REELS[0], quantityFt, ft: -8000 };
      if (Number.isNaN(quantityFt)) {
        await refusal(call('POST', '/api/step/6', '{"actor":"EMP-0003","barcode":"ENC-GS1-884192-R01","quantityFt":NaN}'), 400, 'BAD_JSON');
      } else {
        await refusal(step(6, body), 422, 'INVALID_QUANTITY');
      }
    }
    await refusal(step(6, { actor: MARCUS, barcode: `${REELS[0]}'; ${DROP} stock_stockitem;--`, quantityFt: -2000 }), 422, 'INVALID_QUANTITY');
    await refusal(step(6, { actor: MARCUS, barcode: `'; ${DROP} stock_stockitem;--` }), 422, 'UNKNOWN_REEL');
    await refusal(step(6, { actor: MARCUS, barcodes: `${DROP} stock_stockitem` }), 422, 'NO_BARCODE');
    await refusal(step(6, { actor: MARCUS, barcodes: [REELS[0], REELS[0]], quantityFt: -2000 }), 422, 'INVALID_QUANTITY');
    await refusal(step(6, { actor: MARCUS, barcodes: [REELS[0], REELS[0]] }), 409, 'DUPLICATE_SCAN');
    assert.equal((await state()).scans.length, 0);
    assert.equal((await state()).item.onHandFt, 0);
    assert.ok(minQty() >= 0);
    assert.equal((await journal()).entries.length, 0);
  });

  await must('dock scans ignore attacker ft/legs; the posted receipt is the balanced 3-leg GAAP entry', async () => {
    const first = await step(6, { actor: MARCUS, barcode: REELS[0], ft: -2000, quantity: -2000, sql: DROP });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.equal(first.body.status, 'in_progress');
    assert.equal((await state()).scans[0].ft, 2000);
    assert.equal((await state()).item.onHandFt, 2000);
    await refusal(step(6, { actor: MARCUS, barcode: REELS[0] }), 409, 'DUPLICATE_SCAN');
    assert.equal((await step(6, { actor: MARCUS, barcode: REELS[1] })).status, 200);
    assert.equal((await step(6, { actor: MARCUS, barcode: REELS[2] })).status, 200);
    const posted = await step(6, {
      actor: MARCUS,
      barcode: REELS[3],
      quantityFt: 2000,
      legs: [{ account: 'Assets:101100-Operating-Checking', amountCents: 1 }],
      journal: [{ debit: 999999, credit: 0 }],
      memo: 'UNBALANCED_INJECT',
    });
    assert.equal(posted.status, 200, JSON.stringify(posted.body));
    assert.equal(posted.body.status, 'complete');
    const legs = Object.fromEntries(posted.body.journal.legs.map((l) => [l.account.slice(l.account.indexOf(':') + 1, l.account.indexOf(':') + 7), l.amountUsd]));
    assert.deepEqual(legs, { 121100: 23120, 201200: -21600, 501900: -1520 });
    assert.equal(posted.body.journal.legs.reduce((a, l) => a + Math.round(l.amountUsd * 100), 0), 0);
    assert.equal((await state()).item.onHandFt, 8000);
    assert.ok(minQty() >= 0);
    assert.equal(kernel.wms.prepare('SELECT COUNT(*) AS c FROM stock_stockitem WHERE quantity < 0').get().c, 0);
  });

  await must('unbalanced journal injection is not a route and does not unbalance the book', async () => {
    const before = await journal();
    const injected = await call('POST', '/api/journal', {
      legs: [{ account: 'Assets:101100-Operating-Checking', amountCents: 1 }],
      memo: 'UNBALANCED_INJECT',
    });
    assert.equal(injected.status, 405);
    assert.equal(injected.body.code, 'NOT_FOUND');
    const after = await journal();
    assert.equal(after.entries.length, before.entries.length);
    assert.equal(after.balanced, true);
    assert.equal(after.debitUsd, after.creditUsd);
    assert.equal(after.ledger.includes('UNBALANCED_INJECT'), false);
    let updateRefused = false;
    try {
      kernel.db.prepare('UPDATE journal_leg SET amount_cents = 1').run();
    } catch (e) {
      updateRefused = /append-only/.test(String(e.message));
    }
    assert.equal(updateRefused, true);
    let deleteRefused = false;
    try {
      kernel.db.prepare('DELETE FROM journal_leg').run();
    } catch (e) {
      deleteRefused = /append-only/.test(String(e.message));
    }
    assert.equal(deleteRefused, true);
    assert.equal((await journal()).balanced, true);
  });

  await must('invoice tamper holds the match: claimed fields, then a forged invoice PDF read by real RapidOCR', async () => {
    const held = await step(7, { invoice: { totalUsd: 0.01, unitPriceUsd: 0.01, quantityFt: -8000, sql: DROP } });
    assert.equal(held.status, 409);
    assert.equal(held.body.code, 'MATCH_VARIANCE_HOLD');
    assert.equal(held.body.bookImpactUsd, 0);
    assert.equal((await journal()).entries.length, 1);
    // Same-length byte edit of the uncompressed content stream: a valid PDF that overbills at the $2.89 standard.
    const invoicePath = path.join(kernel.docsDir, TRADE.vendorInvoice);
    const clean = fs.readFileSync(invoicePath);
    const forged = Buffer.from(clean.toString('latin1')
      .replace('(UNIT PRICE USD: 2.70)', '(UNIT PRICE USD: 2.89)')
      .replace('(TOTAL DUE USD: 21600.00)', '(TOTAL DUE USD: 23120.00)'), 'latin1');
    assert.equal(forged.length, clean.length);
    assert.notEqual(sha(forged), sha(clean));
    fs.writeFileSync(invoicePath, forged);
    const trap = await refusal(step(7, { actor: 'EMP-0001' }), 409, 'MATCH_VARIANCE_HOLD');
    assert.deepEqual(trap.body.variances.map((v) => v.field), ['invoiceSha256', 'unitPrice', 'totalDue']);
    assert.match(trap.body.message, /ocr:rapidocr-onnxruntime/);
    assert.equal((await state()).ocr, null);
    assert.equal((await journal()).entries.length, 1);
    fs.writeFileSync(invoicePath, clean);
    const matched = await step(7, { actor: 'EMP-0001' });
    assert.equal(matched.status, 200, JSON.stringify(matched.body));
    assert.equal(matched.body.detail.source, 'ocr:rapidocr-onnxruntime');
    assert.equal(matched.body.detail.invoiceSha256, sha(clean));
    assert.ok(matched.body.detail.ocrBoxes >= 28, `${matched.body.detail.ocrBoxes} OCR boxes`);
    assert.equal(matched.body.journal.legs.reduce((a, l) => a + Math.round(l.amountUsd * 100), 0), 0);
    assert.equal((await journal()).entries.length, 2);
  });

  await must('command desk validator accepts the integrated snapshot; OCR boxes sit on the served invoice image', async () => {
    const snap = validateState(await state());
    const invoiceDoc = snap.documents.find((d) => d.name === TRADE.vendorInvoice);
    assert.equal(snap.ocr.sha256, invoiceDoc.sha256);
    assert.equal(snap.match.invoiceSha256, invoiceDoc.sha256);
    assert.ok(snap.ocr.boxes.length >= 28);
    const text = snap.ocr.boxes.map((b) => b.text).join('\n');
    for (const needle of ['21600.00', '2.70', '8000', CHECK.replace(/\D/g, '')])assert.ok(text.includes(needle), needle);
    assert.equal(snap.ocr.imageUrl, `/docs/${TRADE.vendorInvoice.replace(/\.pdf$/, '.png')}`);
    const image = await fetch(url + snap.ocr.imageUrl);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get('content-type'), 'image/png');
    const png = Buffer.from(await image.arrayBuffer());
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [snap.ocr.width, snap.ocr.height]);
    // WO-14 bbox viewer: the five match fields are tagged on real RapidOCR boxes (RapidOCR drops inter-word spaces).
    const fields = Object.fromEntries(tagOcrFields(snap.ocr).map((f) => [f.key, f.value?.replace(/\s/g, '')]));
    assert.deepEqual(fields, { vendor: CONTRACT.primaryItem.vendorName.replace(/\s/g, ''), po: CONTRACT.primaryItem.dealId, quantity: '8000', unit: '2.70', total: '21600.00' }, JSON.stringify(fields));
  });

  await must('Check #10045 pays once; replay, amount tamper, and a concurrent double post do not pay again', async () => {
    const tamper = {
      actor: MEREDITH,
      bankAccount: '101100',
      amountUsd: 0.01,
      amountCents: 1,
      check: 'Check #00001',
      checkNumber: 'Check #00001',
      ach: 'ACH-EVIL',
      memo: 'UNBALANCED_INJECT\n    Assets:101100-Operating-Checking                                 $999999.00\n',
      legs: [{ account: 'Assets:101100-Operating-Checking', amountCents: 99999900 }],
      sql: `${DROP} journal_leg`,
    };
    const [a, b] = await Promise.all([step(8, tamper), step(8, { ...tamper })]);
    const wins = [a, b].filter((r) => r.status === 200);
    const blocks = [a, b].filter((r) => r.status === 409);
    assert.equal(wins.length, 1, JSON.stringify([a.body, b.body]));
    assert.equal(blocks.length, 1);
    assert.equal(wins[0].body.detail.stamp, 'PAID');
    assert.equal(wins[0].body.detail.check, CHECK);
    assert.equal(wins[0].body.detail.amountUsd, 21600);
    assert.equal(blocks[0].body.code, 'STEP_ALREADY_COMPLETE');
    assert.equal(blocks[0].body.bookImpactUsd, 0);
    await refusal(step(8, tamper), 409, 'STEP_ALREADY_COMPLETE');
    await refusal(step(8, { actor: MEREDITH }, { 'x-actor': KAL }), 403, 'AI_STEWARD_ZERO_AUTHORITY');
    const book = await journal();
    assert.equal(book.balanced, true);
    assert.equal(book.debitUsd, book.creditUsd);
    assert.equal(book.ledger.split(CHECK).length - 1, 1);
    assert.equal(book.ledger.includes('UNBALANCED_INJECT'), false);
    assert.equal(book.ledger.includes('999999'), false);
    assert.equal(book.ledger.includes('ACH-EVIL'), false);
    assert.equal(book.ledger.includes(DROP), false);
    const paid = book.entries.filter((e) => String(e.memo).includes(CHECK));
    assert.equal(paid.length, 1);
    const bal = Object.fromEntries(book.balances.map((row) => [row.account.split(':')[1].slice(0, 6), row.balanceUsd]));
    assert.deepEqual(bal, { 121100: 23120, 201200: 0, 501900: -1520, 201100: 0, 101100: -21600 });
    assert.equal((await state()).payment.stamp, 'PAID');
    assert.equal((await state()).payment.check, CHECK);
    assert.equal((await call('GET', '/api/audit')).body.valid, true);
  });

  await must('ZeroSaaS P2P workbench and JSON reads answer on the loopback server', async () => {
    const page = await call('GET', '/');
    assert.equal(page.status, 200);
    assert.match(String(page.body), /<title>ZeroSaaS P2P · Headless Stock-to-Pay ERP &amp; KAL Steward<\/title>/);
    const health = await call('GET', '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    assert.equal(health.body.audit.valid, true);
    assert.equal(health.body.ocrUrl, sidecar.url);
    const ocrHealth = await fetch(`${sidecar.url}/health`);
    assert.equal(ocrHealth.status, 200);
    assert.equal((await ocrHealth.json()).engine, 'rapidocr-onnxruntime');
    assert.equal(sidecar.docsDir, kernel.docsDir);
  });
} finally {
  sidecar.proc.kill();
  await new Promise((resolve) => server.close(resolve));
  kernel.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

const EXPECTED = 12;
console.log(`${passed} red-team checks passed`);
if (passed !== EXPECTED) {
  throw new Error(`expected ${EXPECTED} red-team checks, ran ${passed}`);
}
