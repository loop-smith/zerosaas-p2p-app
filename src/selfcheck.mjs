// WO-02 end-to-end self-check: boots the real server on an ephemeral port in a temp sandbox (offline COMEX
// for determinism) and walks guardrails + Steps 1-8. Usage: node src/selfcheck.mjs  (exit 1 on any failure)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './sor_3panel_server.mjs';
import { astmB8UnitCents, openKernel } from './lineage_core.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2p-selfcheck-'));
const seedsDir = path.join(tmp, 'seeds');
fs.mkdirSync(seedsDir);
fs.writeFileSync(path.join(seedsDir, 'coa_seed.journal'), '; partial seeds: only the COA is present\n');
const { server, url } = await startServer({ port: 0, sandboxDir: path.join(tmp, 'sor-sandbox'), seedsDir, offline: true, fresh: true });

let passed = 0;
const check = async (label, fn) => {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${label}`);
  } catch (e) {
    console.error(`  FAIL ${label}\n       ${e.message}`);
    process.exitCode = 1;
  }
};
const call = async (method, route, body, headers = {}) => {
  const res = await fetch(url + route, { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await res.text();
  return { status: res.status, body: res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text };
};
const step = (n, body, headers) => call('POST', `/api/step/${n}`, body, headers);
const expectRefusal = async (res, status, code) => {
  const r = await res;
  assert.equal(r.status, status, JSON.stringify(r.body));
  assert.equal(r.body.code, code);
  assert.equal(r.body.bookImpactUsd, 0);
};
const KAL = 'EMP-AI-KAL';
const [DARIUS, DEVON, NANCY, MARCUS, DUNCAN, MEREDITH] = ['EMP-0021', 'EMP-0005', 'EMP-0002', 'EMP-0003', 'EMP-0001', 'EMP-0007'];
const REELS = ['R01', 'R02', 'R03', 'R04'].map((r) => `ENC-GS1-884192-${r}`);

try {
  await check('sandbox: seeds/* copied, missing SoRs bootstrapped from contract', async () => {
    const { body } = await call('GET', '/api/health');
    assert.deepEqual(body.sources, { wms: 'contract-bootstrap', hrm: 'contract-bootstrap', crm: 'contract-bootstrap', coa: 'seed' });
    assert.ok(fs.existsSync(path.join(tmp, 'sor-sandbox', 'wms_seed.sqlite3')));
  });
  await check('ASTM B8 math: round((6.2602 + 0.32) * 0.411, 2) = $2.70/FT', () => assert.equal(astmB8UnitCents(6.2602), 270));
  await check('sandbox wipe refuses a non-empty dir that is not a kernel sandbox, and sandbox == seeds', () => {
    const precious = path.join(tmp, 'precious');
    fs.mkdirSync(precious);
    fs.writeFileSync(path.join(precious, 'keep.txt'), 'x');
    assert.throws(() => openKernel({ sandboxDir: precious, seedsDir, offline: true }), /refusing to wipe/);
    assert.ok(fs.existsSync(path.join(precious, 'keep.txt')));
    assert.throws(() => openKernel({ sandboxDir: seedsDir, seedsDir, offline: true }), /must differ/);
  });
  await check('KAL write -> 403 AI_STEWARD_ZERO_AUTHORITY', () => expectRefusal(step(1, { actor: KAL }), 403, 'AI_STEWARD_ZERO_AUTHORITY'));
  await check('KAL header spoof behind VP identity -> 403', () => expectRefusal(step(3, { actor: DEVON }, { 'x-actor': `${DEVON}, ${KAL}` }), 403, 'AI_STEWARD_ZERO_AUTHORITY'));
  await check('conflicting identities -> 403 ACTOR_MISMATCH', () => expectRefusal(step(3, { actor: DEVON }, { 'x-actor': DARIUS }), 403, 'ACTOR_MISMATCH'));
  await check('Darius self-approval of $23,120 REQ-25800 -> 403 DOA_LIMIT_EXCEEDED', async () => {
    await expectRefusal(step(2, { actor: DARIUS, action: 'approve' }), 403, 'DOA_LIMIT_EXCEEDED');
    await expectRefusal(step(3, { actor: DARIUS }), 403, 'DOA_LIMIT_EXCEEDED');
  });
  await check('Buyer Nancy dock receipt -> 403 SOX_SOD_VIOLATION', () => expectRefusal(step(6, { actor: NANCY, barcode: REELS[0] }), 403, 'SOX_SOD_VIOLATION'));
  await check('unknown actor -> 403 UNKNOWN_ACTOR', () => expectRefusal(step(1, { actor: 'EMP-9999' }), 403, 'UNKNOWN_ACTOR'));
  await check('out-of-order Step 2 -> 409', async () => assert.equal((await step(2, { actor: DARIUS })).status, 409));

  await check('Step 1 stock-out signal: 0 FT < 8,000 FT -> REQ-25800 $23,120.00 std', async () => {
    const r = await step(1, {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.detail.onHandFt, 0);
    assert.equal(r.body.detail.stdTotalUsd, 23120);
  });
  await check('Step 2 Darius confirms need and escalates to VP Devon', async () => {
    const r = await step(2, { actor: DARIUS });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.detail.escalatedTo, DEVON);
  });
  await check('Step 3 VP Devon approves', async () => assert.equal((await step(3, { actor: DEVON })).status, 200));
  await check('Step 4 COMEX spot buy: $2.70/FT = $21,600.00, PPV $1,520.00, std $2.89 locked', async () => {
    const r = await step(4, {});
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const d = r.body.detail;
    assert.equal(d.comex.source, 'offline-reference');
    assert.equal(d.comex.spotPerLb, 6.2602);
    assert.deepEqual([d.unitUsd, d.totalUsd, d.ppvFavorableUsd, d.stdUnitUsd], [2.7, 21600, 1520, 2.89]);
    assert.equal(r.body.state.journal.entries.length, 0, 'no GL impact before dock scan');
  });
  await check('Step 5 vendor OA ENC-OA-2026-884192 hashed, $0.00 GL', async () => {
    const r = await step(5, {});
    assert.equal(r.status, 200);
    assert.match(r.body.detail.sha256, /^[0-9a-f]{64}$/);
    assert.equal(r.body.detail.glImpactUsd, 0);
  });
  await check('Step 6 rejects tampered qty, unknown reel, duplicate scan', async () => {
    await expectRefusal(step(6, { actor: MARCUS, barcode: REELS[0], quantityFt: -2000 }), 422, 'INVALID_QUANTITY');
    await expectRefusal(step(6, { actor: MARCUS, barcode: 'ENC-GS1-884192-R99' }), 422, 'UNKNOWN_REEL');
    assert.equal((await step(6, { actor: MARCUS, barcode: REELS[0] })).body.status, 'in_progress');
    await expectRefusal(step(6, { actor: MARCUS, barcode: REELS[0] }), 409, 'DUPLICATE_SCAN');
  });
  await check('Step 6 4x2,000-FT scan posts DR 121100 $23,120 / CR 201200 $21,600 / CR 501900 $1,520', async () => {
    const r = await step(6, { actor: MARCUS, barcodes: REELS.slice(1) });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.status, 'complete');
    const legs = Object.fromEntries(r.body.journal.legs.map((l) => [l.account.slice(l.account.indexOf(':') + 1, l.account.indexOf(':') + 7), l.amountUsd]));
    assert.deepEqual(legs, { 121100: 23120, 201200: -21600, 501900: -1520 });
    assert.equal(r.body.state.item.onHandFt, 8000);
    assert.equal(r.body.state.item.stdUnitUsd, 2.89);
    assert.equal(r.body.state.item.stdCostLocked, true);
    assert.equal(r.body.state.journal.balanced, true);
  });
  await check('Step 7 tampered invoice -> 409 MATCH_VARIANCE_HOLD', async () => {
    await expectRefusal(step(7, { invoice: { unitPriceUsd: 2.89, totalUsd: 23120 } }), 409, 'MATCH_VARIANCE_HOLD');
    await expectRefusal(step(7, { invoice: { totalUsd: 22100 } }), 409, 'MATCH_VARIANCE_HOLD');
    await expectRefusal(step(7, { invoice: 'TAMPERED' }), 422, 'INVALID_INVOICE');
  });
  await check('Step 7 clean 3-way match clears GRNI -> Trade AP', async () => assert.equal((await step(7, { actor: DUNCAN })).status, 200));
  await check('Step 8 payroll 101200 #4409 > $5k -> 403 BANK_POLICY_VIOLATION', () => expectRefusal(step(8, { actor: MEREDITH, bankAccount: '101200' }), 403, 'BANK_POLICY_VIOLATION'));
  await check('Step 8 CFO pays Check #10045 / ACH-000582 from 101100; replay refused', async () => {
    const r = await step(8, { actor: MEREDITH, bankAccount: '101100' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.detail.stamp, 'PAID');
    assert.equal(r.body.detail.check, 'Check #10045');
    await expectRefusal(step(8, { actor: MEREDITH }), 409, 'STEP_ALREADY_COMPLETE');
  });
  await check('ledger: DR === CR to the penny, hledger --strict ok, GRNI & AP settle to $0.00', async () => {
    const { body } = await call('GET', '/api/journal');
    assert.equal(body.balanced, true);
    assert.equal(body.debitUsd, body.creditUsd);
    if (body.hledger.available) assert.equal(body.hledger.ok, true, body.hledger.error);
    const bal = Object.fromEntries(body.balances.map((b) => [b.account.split(':')[1].slice(0, 6), b.balanceUsd]));
    assert.deepEqual(bal, { 121100: 23120, 201200: 0, 501900: -1520, 201100: 0, 101100: -21600 });
    assert.match(body.ledger, /Expenses:501900-Purchase-Price-Variance/);
  });
  await check('audit chain intact and records refusals', async () => {
    const { body } = await call('GET', '/api/audit');
    assert.equal(body.valid, true);
    const kalRefusals = body.entries.filter((e) => e.event === 'REFUSED' && e.payload.code === 'AI_STEWARD_ZERO_AUTHORITY');
    assert.ok(kalRefusals.length >= 2 && kalRefusals.every((e) => e.actor === KAL), 'header spoof must be chained as KAL, not the VP');
  });
  await check('KAL refused on every write route (unknown step, arbitrary verb)', async () => {
    await expectRefusal(step(99, { actor: KAL }), 403, 'AI_STEWARD_ZERO_AUTHORITY');
    await expectRefusal(call('PUT', '/api/state', {}, { 'x-agent-id': 'AGT-8090-KAL-01' }), 403, 'AI_STEWARD_ZERO_AUTHORITY');
  });
  await check('HTTP hygiene: bad JSON 400, non-JSON write 415, bad Host 403, bad path 400, traversal blocked', async () => {
    assert.equal((await step(1, '{nope')).status, 400);
    assert.equal((await call('POST', '/api/step/1', 'x', { 'content-type': 'text/plain' })).status, 415);
    const hostStatus = await new Promise((resolve, reject) => {
      http.get(`${url}/api/state`, { headers: { host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); }).on('error', reject);
    });
    assert.equal(hostStatus, 403);
    assert.equal((await call('GET', '/%E0%A4%A')).status, 400);
    assert.equal((await call('GET', '/')).status, 200);
    assert.notEqual((await call('GET', '/..%2Fpackage.json')).status, 200);
  });
  await check('reset: KAL and unknown actors refused, SYSTEM reseeds to pending', async () => {
    await expectRefusal(call('POST', '/api/reset', { actor: KAL }), 403, 'AI_STEWARD_ZERO_AUTHORITY');
    await expectRefusal(call('POST', '/api/reset', { actor: 'EMP-9999' }), 403, 'UNKNOWN_ACTOR');
    const r = await call('POST', '/api/reset', {});
    assert.equal(r.status, 200);
    assert.ok(r.body.state.steps.every((s) => s.status === 'pending'));
    assert.equal(r.body.state.item.onHandFt, 0);
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`${passed} checks passed${process.exitCode ? ' — FAILURES above' : ''}`);
