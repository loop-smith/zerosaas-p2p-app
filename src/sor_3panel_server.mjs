// ZeroSaaS P2P HTTP server — unified 13-route Golden-Master workbench + deterministic kernel adapter.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openKernel, ROOT, Refusal, isStewardIdentity, stewardRefusal } from './lineage_core.mjs';
import {
  createVoiceTelemetry,
  getVoiceStatus,
  voiceConfig,
  kalSpeak,
  kalTranscribe,
  handleVoiceTts,
  handleVoiceStt,
  handleVoiceKal,
} from './voice.mjs';
import { createWorkbenchEngine, SoxGuardrailError } from './workbench_engine.mjs';

const MAX_BODY_BYTES = 64 * 1024;
const LOOPBACK_HOST = /^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const LOOPBACK_ORIGIN = /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png', '.pdf': 'application/pdf', '.webm': 'video/webm' };

const PLACEHOLDER = `<!doctype html><meta charset="utf-8"><title>ZeroSaaS P2P · PO-25800</title>
<body style="font:14px system-ui;margin:2rem"><h1>ZeroSaaS P2P kernel online</h1>
<p>JSON API:</p>
<ul><li>GET /api/health · /api/state · /api/journal · /api/audit · /api/comex · /api/table · /api/copper-spot · /docs/&lt;trade PDF or OCR page&gt;</li>
<li>POST /api/step · POST /api/step/1..8 {"actor":"EMP-xxxx", ...} · POST /api/reset</li>
<li>GET /api/voice/status · POST /api/voice/kal · POST /api/voice/tts · POST /api/voice/stt · POST /api/kal/speak · POST /api/kal/transcribe</li></ul></body>`;

function send(res, status, body, type = 'application/json') {
  const payload = type === 'application/json' ? JSON.stringify(body, null, 2) : body;
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(payload);
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Refusal(413, 'PAYLOAD_TOO_LARGE', `Body exceeds ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const raw = await readBody(req, MAX_BODY_BYTES);
  if (!raw.length) return {};
  let body;
  try {
    body = JSON.parse(raw.toString('utf8'));
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
    decoded = decodeURIComponent(pathname === '/' ? '/index.html' : (pathname === '/favicon.ico' ? '/favicon.svg' : pathname));
  } catch {
    return send(res, 400, { ok: false, code: 'BAD_PATH' });
  }
  const file = path.resolve(root, `.${decoded}`);
  if (!file.startsWith(root + path.sep)) return send(res, 403, { ok: false, code: 'FORBIDDEN_PATH' });
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] ?? 'application/octet-stream');
  if (pathname === '/') return send(res, 200, PLACEHOLDER, MIME['.html']);
  return send(res, 404, { ok: false, code: 'NOT_FOUND' });
}

async function route(kernel, workbench, req, res, { publicDir, voiceEnv, voiceFetch, voiceTelemetry }) {
  // DNS-rebinding guard: only loopback Host names reach the kernel.
  if (!LOOPBACK_HOST.test(req.headers.host ?? '')) throw new Refusal(403, 'BAD_HOST', 'Host must be 127.0.0.1 or localhost');
  const parsedUrl = new URL(req.url, 'http://127.0.0.1');
  const { pathname } = parsedUrl;
  const reqOrigin = String(req.headers.origin ?? '');
  if (pathname === '/api/voice/tts' && LOOPBACK_ORIGIN.test(reqOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'X-Voice-Latency-Ms, X-Voice-Model, X-Voice-Role');
    res.setHeader('Vary', 'Origin');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
  }
  const headerIds = [req.headers['x-actor'], req.headers['x-agent-id']];
  const step = pathname.match(/^\/api\/step\/(\d{1,2})$/);
  const kernelWrite = req.method === 'POST' && (step || pathname === '/api/reset');
  const workbenchStep = req.method === 'POST' && pathname === '/api/step';
  const emptyPostAllowed = req.method === 'POST' && (pathname === '/api/reset' || pathname === '/api/lineage/recrawl');
  const transcribe = req.method === 'POST' && pathname === '/api/kal/transcribe';
  const voiceStt = req.method === 'POST' && pathname === '/api/voice/stt';

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // KAL holds zero write authority on every route; step/reset refusals are audit-chained by the kernel/workbench instead.
    if (!kernelWrite && !workbenchStep && isStewardIdentity(headerIds)) throw stewardRefusal();
    // CSRF guard: JSON-only writes (and explicit audio/multipart transcript uploads) force a CORS preflight this server never grants.
    const ct = req.headers['content-type'] ?? '';
    const validType = transcribe
      ? /^audio\/webm\b/i.test(ct)
      : voiceStt
        ? /^(audio\/[\w.+-]+|video\/webm|multipart\/form-data|application\/json|application\/octet-stream)\b/i.test(ct)
        : emptyPostAllowed && !ct
          ? true
          : /^application\/json\b/i.test(ct);
    if (!validType) {
      throw new Refusal(415, 'UNSUPPORTED_MEDIA_TYPE', transcribe ? 'Transcription requires Content-Type: audio/webm' : 'Writes require Content-Type: application/json');
    }
  }

  if (req.method === 'GET') {
    if (pathname === '/api/table') return workbench.handleTable(parsedUrl, res);
    if (pathname === '/api/invoice-image') return workbench.handleInvoiceImage(parsedUrl, res);
    if (pathname === '/api/invoice-pdf' || pathname === '/api/trade-pdf') return workbench.handlePdfArtifact(parsedUrl, res);
    const reads = {
      '/api/health': () => kernel.health(),
      '/api/state': () => ({ ...workbench.getFullState(), ...kernel.snapshot() }),
      '/api/journal': () => kernel.journalReport(),
      '/api/audit': () => kernel.verifyChain({ entries: true }),
      '/api/comex': () => kernel.quote(),
      '/api/copper-spot': () => workbench.getCopperSpot(),
      '/api/voice/status': () => getVoiceStatus(voiceEnv),
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
    if (step) {
      const result = await kernel.act(Number(step[1]), { identities, body });
      return send(res, result.status, result.body);
    }
    const result = await kernel.reset(identities);
    if (result.status === 200) {
      const wbState = workbench.reset();
      return send(res, 200, {
        ...wbState,
        ...result.body,
        state: { ...wbState, ...result.body.state },
      });
    }
    return send(res, result.status, result.body);
  }

  if (workbenchStep) {
    const body = await readJson(req);
    const effectiveBody = isStewardIdentity([body.actingEmpId, body.actor, ...headerIds])
      ? { ...body, actingEmpId: 'EMP-AI-KAL' }
      : body;
    try {
      const wbState = await workbench.handleStep(effectiveBody);
      return send(res, 200, { ...wbState, ...kernel.snapshot() });
    } catch (err) {
      const statusCode = Number(err.statusCode || 400);
      const code = err.blockMeta?.code || (statusCode === 403 ? 'FORBIDDEN' : 'BAD_STEP_ACTION');
      const payload = {
        ok: false,
        code,
        error: String(err.message || err),
        message: String(err.message || err),
        bookImpactUsd: 0,
        guardrailBlock: err.blockMeta || null,
        state: { ...workbench.getFullState(), ...kernel.snapshot() },
      };
      if (code === 'AI_STEWARD_ZERO_AUTHORITY') payload.actor = 'EMP-AI-KAL';
      return send(res, statusCode, payload);
    }
  }

  if (req.method === 'POST' && pathname === '/api/lineage/recrawl') {
    try {
      const wbState = await workbench.recrawlLineage();
      return send(res, 200, { ...wbState, ...kernel.snapshot() });
    } catch (err) {
      return send(res, 400, { ok: false, error: String(err.message || err) });
    }
  }

  if (req.method === 'POST' && pathname === '/api/kal/speak') {
    return kalSpeak(req, res, voiceConfig(voiceEnv), voiceFetch, { readJson, send });
  }
  if (transcribe) {
    return kalTranscribe(req, res, voiceConfig(voiceEnv), voiceFetch, { readBody, send });
  }
  if (req.method === 'POST' && pathname === '/api/voice/tts') {
    return handleVoiceTts(req, res, { env: voiceEnv, fetchImpl: voiceFetch, telemetry: voiceTelemetry, readJson, send });
  }
  if (voiceStt) {
    return handleVoiceStt(req, res, { env: voiceEnv, fetchImpl: voiceFetch, telemetry: voiceTelemetry, readBody, send });
  }
  if (req.method === 'POST' && pathname === '/api/voice/kal') {
    return handleVoiceKal(req, res, { workbench, kernel, readJson, send });
  }
  return send(res, pathname.startsWith('/api/') ? 405 : 404, { ok: false, code: 'NOT_FOUND', message: `${req.method} ${pathname} is not a route` });
}

/** Options: publicDir; voiceEnv (default process.env, read per request) and voiceFetch for the KAL voice proxy. */
export function createAppServer(kernel, { publicDir = path.join(ROOT, 'public'), voiceEnv = process.env, voiceFetch = globalThis.fetch, hledgerBin } = {}) {
  const voiceTelemetry = createVoiceTelemetry();
  const workbench = createWorkbenchEngine({
    rootDir: ROOT,
    sandboxDir: kernel.dir,
    seedsDir: kernel.seedsDir,
    kernelDocsDir: kernel.docsDir,
    ocrUrl: kernel.ocrUrl,
    offline: kernel.offline,
    hledgerBin: hledgerBin !== undefined ? hledgerBin : kernel.hledgerBin,
    fetchImpl: kernel.fetchImpl,
    voiceEnv,
    voiceTelemetry,
  });
  const options = { publicDir, voiceEnv, voiceFetch, voiceTelemetry };
  return http.createServer((req, res) => {
    route(kernel, workbench, req, res, options).catch((e) => {
      if (!(e instanceof Refusal) && !(e instanceof SoxGuardrailError)) console.error('[sor_3panel_server]', e);
      if (!res.headersSent) send(res, e.status ?? e.statusCode ?? 500, { ok: false, code: e.code ?? 'INTERNAL_ERROR', message: e instanceof Refusal ? e.message : 'internal error', bookImpactUsd: 0 });
      if (e.status === 413) req.destroy();
    });
  });
}

/** Boots kernel + server. Options: port, host, sandboxDir, seedsDir, offline, fresh, hledgerBin, fetchImpl, publicDir, ocrUrl (env OCR_URL), voiceEnv, voiceFetch. */
export async function startServer({ port = Number(process.env.PORT || 3590), host = '127.0.0.1', publicDir, voiceEnv, voiceFetch, ...kernelOpts } = {}) {
  const kernel = openKernel({ fresh: process.env.SOR_KEEP_SANDBOX !== '1', ...kernelOpts });
  const server = createAppServer(kernel, { publicDir, voiceEnv, voiceFetch, hledgerBin: kernelOpts.hledgerBin });
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
  console.log(`[sor_3panel_server] ${url} · sandbox ${kernel.dir} · sources ${JSON.stringify(kernel.sources)} · hledger ${kernel.hledgerBin ?? 'absent'} · ocr ${kernel.ocrUrl ?? 'default :3591'} · voice ${process.env.ELEVENLABS_API_KEY?.trim() ? 'ElevenLabs proxy' : 'off (browser speech)'}`);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => server.close(() => process.exit(0)));
}
