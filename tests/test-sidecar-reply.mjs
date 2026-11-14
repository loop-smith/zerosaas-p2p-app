// Regression (HARA-06.T19.f1): a sidecar reply that is valid JSON but not an object (null, array, scalar)
// must refuse Step 5 with an audited 503 OCR_UNAVAILABLE and zero book impact, never a 500.
// Real kernel + HTTP server; only the OCR sidecar is a stub, since its misbehavior is the input under test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../src/sor_3panel_server.mjs';

const ACTORS = ['SYSTEM', 'EMP-0021', 'EMP-0005', 'EMP-0002'];
const REPLIES = ['null', '[]', '"ok"', '42'];

for (const reply of REPLIES) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p2p-sidecar-reply-'));
  const side = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(reply); });
  await new Promise((r) => side.listen(0, '127.0.0.1', r));
  const app = await startServer({
    port: 0, host: '127.0.0.1', sandboxDir: path.join(tmp, 'sandbox'), offline: true, fresh: true, hledgerBin: false,
    ocrUrl: `http://127.0.0.1:${side.address().port}`,
  });
  const call = async (method, route, body) => {
    const res = await fetch(app.url + route, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  try {
    for (const [i, actor] of ACTORS.entries()) {
      const r = await call('POST', `/api/step/${i + 1}`, { actor });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    const r = await call('POST', '/api/step/5', { actor: 'EMP-0002' });
    assert.deepEqual([r.status, r.body.code, r.body.bookImpactUsd], [503, 'OCR_UNAVAILABLE', 0], `reply ${reply}: ${JSON.stringify(r.body)}`);
    const audit = (await call('GET', '/api/audit')).body;
    assert.equal(audit.valid, true);
    assert.ok(audit.entries.some((e) => e.event === 'REFUSED' && e.payload.code === 'OCR_UNAVAILABLE'), `reply ${reply}: refusal not audited`);
    assert.equal((await call('GET', '/api/journal')).body.entries.length, 0);
    console.log(`  ok  sidecar reply ${reply} -> audited 503 OCR_UNAVAILABLE, no journal`);
  } finally {
    await new Promise((r) => app.server.close(r));
    await new Promise((r) => side.close(r));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
console.log(`${REPLIES.length} sidecar-reply regressions passed`);
