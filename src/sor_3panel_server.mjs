// ZeroSaaS P2P HTTP server — thin JSON adapter over src/lineage_core.mjs on 127.0.0.1:${PORT||3590}.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openKernel, ROOT, Refusal, isStewardIdentity, stewardRefusal } from './lineage_core.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf', '.webm': 'video/webm' };

const PLACEHOLDER = `<!doctype html><meta charset="utf-8"><title>ZeroSaaS P2P · PO-25800</title>
<body style="font:14px system-ui;margin:2rem"><h1>ZeroSaaS P2P kernel online</h1>
<p>Command Desk UI (public/index.html) lands in WO-04. JSON API:</p>
<ul><li>GET /api/health · /api/state · /api/journal · /api/audit · /api/comex · /docs/&lt;trade PDF or OCR page&gt;</li>
<li>POST /api/step/1..8 {"actor":"EMP-xxxx", ...} · POST /api/reset</li></ul></body>`;

function send(res, status, body, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body, null, 2) : body;
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Refusal(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`);
    chunks.push(chunk);
  }
  if (!size) return {};
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new Refusal(400, 'BAD_JSON', 'Body must be valid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Refusal(400, 'BAD_JSON', 'Body must be a JSON object');
  return body;
}

function serveStatic(res, publicDir, pathname) {
  const root = path.resolve(publicDir);
  let decoded;
  try {
    decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch {
    return send(res, 400, { ok: false, code: 'BAD_PATH' });
  }
  const file = path.resolve(root, `.${decoded}`);
  if (!file.startsWith(root + path.sep)) return send(res, 403, { ok: false, code: 'FORBIDDEN_PATH' });
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] ?? 'application/octet-stream');
  if (pathname === '/') return send(res, 200, PLACEHOLDER, MIME['.html']);
  return send(res, 404, { ok: false, code: 'NOT_FOUND' });
}

async function route(kernel, req, res, publicDir) {
  // DNS-rebinding guard: only loopback Host names reach the kernel.
  if (!LOOPBACK_HOST.test(req.headers.host ?? '')) throw new Refusal(403, 'BAD_HOST', 'Host must be 127.0.0.1 or localhost');
  const { pathname } = new URL(req.url, 'http://127.0.0.1');
  const headerIds = [req.headers['x-actor'], req.headers['x-agent-id']];
  const step = pathname.match(/^\/api\/step\/(\d{1,2})$/);
  const kernelWrite = req.method === 'POST' && (step || pathname === '/api/reset');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // KAL holds zero write authority on every route; step/reset refusals are audit-chained by the kernel instead.
    if (!kernelWrite && isStewardIdentity(headerIds)) throw stewardRefusal();
    // CSRF guard: JSON-only writes force a CORS preflight that this server never grants.
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) throw new Refusal(415, 'UNSUPPORTED_MEDIA_TYPE', 'Writes require Content-Type: application/json');
  }
  if (req.method === 'GET') {
    const reads = {
      '/api/health': () => kernel.health(),
      '/api/state': () => kernel.snapshot(),
      '/api/journal': () => kernel.journalReport(),
      '/api/audit': () => kernel.verifyChain({ entries: true }),
      '/api/comex': () => kernel.quote(),
    };
    if (reads[pathname]) return send(res, 200, await reads[pathname]());
    // Trade PDFs and the OCR page image written by the sidecar into the kernel sandbox.
    const doc = pathname.match(/^\/docs(\/[^/]+)$/);
    if (doc) return serveStatic(res, kernel.docsDir, doc[1]);
    if (!pathname.startsWith('/api/')) return serveStatic(res, publicDir, pathname);
  }
  if (kernelWrite) {
    const body = await readJson(req);
    const identities = [body.actor, ...headerIds];
    const result = step ? await kernel.act(Number(step[1]), { identities, body }) : await kernel.reset(identities);
    return send(res, result.status, result.body);
  }
  return send(res, pathname.startsWith('/api/') ? 405 : 404, { ok: false, code: 'NOT_FOUND', message: `${req.method} ${pathname} is not a route` });
}

export function createAppServer(kernel, { publicDir = path.join(ROOT, 'public') } = {}) {
  return http.createServer((req, res) => {
    route(kernel, req, res, publicDir).catch((e) => {
      if (!(e instanceof Refusal)) console.error('[sor_3panel_server]', e);
      if (!res.headersSent) send(res, e.status ?? 500, { ok: false, code: e.code ?? 'INTERNAL_ERROR', message: e instanceof Refusal ? e.message : 'internal error', bookImpactUsd: 0 });
      if (e.status === 413) req.destroy();
    });
  });
}

/** Boots kernel + server. Options: port, host, sandboxDir, seedsDir, offline, fresh, hledgerBin, fetchImpl, publicDir, ocrUrl (env OCR_URL). */
export async function startServer({ port = Number(process.env.PORT || 3590), host = '127.0.0.1', publicDir, ...kernelOpts } = {}) {
  const kernel = openKernel({ fresh: process.env.SOR_KEEP_SANDBOX !== '1', ...kernelOpts });
  const server = createAppServer(kernel, { publicDir });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, resolve);
    });
  } catch (e) {
    kernel.close();
    throw e;
  }
  server.on('close', () => kernel.close());
  const bound = server.address().port;
  return { server, kernel, port: bound, url: `http://${host}:${bound}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, kernel, url } = await startServer();
  console.log(`[sor_3panel_server] ${url} · sandbox ${kernel.dir} · sources ${JSON.stringify(kernel.sources)} · hledger ${kernel.hledgerBin ?? 'absent'} · ocr ${kernel.ocrUrl ?? 'off (PO-derived invoice)'}`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}
