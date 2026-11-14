// KAL streaming female voice, controller phonetic lexicon, Scribe v1 STT, and read-only Steward brain.
// Secrets live strictly in runtime env (never logged, never echoed, never read from .env.local).
import { Refusal } from './lineage_core.mjs';

export const DEFAULT_KAL_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
export const MAX_SPEECH_CHARS = 1500;
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

export const KAL_KEYTERMS = [
  'KAL', 'Cal', 'Encore Wire', 'bare copper', '2/0 AWG', 'two-aught', 'COMEX', 'spot price',
  'PO-25800', 'REQ-25800', 'ENC-OA-2026-884192', 'BOL-25800', 'PS-25800', 'INV-25800', 'VCH-25800',
  'Check 10045', 'CHK-10045', 'ACH-000582', 'ITM-CU-20-BARE',
  'GRNI', 'Goods Received Not Invoiced', 'PPV', 'Purchase Price Variance', 'Standard Cost', '3-Way Match', 'Segregation of Duties',
  'Signing Limit', 'Delegation of Authority', 'KYSI', 'EO 14434', 'hledger', 'InvenTree', 'RapidOCR',
  '101100', '101200', '201100', '201200', '501900',
  'Darius Mercer', 'Devon Brooks', 'Nancy Rostova', 'Marcus Vance', 'Duncan Vance', 'Meredith Hale',
];

const SPOKEN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const SPOKEN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SPOKEN_MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SPOKEN_ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'];

function chunkUnder1000ToWords(n) {
  const out = [];
  if (n >= 100) {
    out.push(SPOKEN_ONES[Math.floor(n / 100)] + ' hundred');
    n = n % 100;
  }
  if (n >= 20) {
    const t = SPOKEN_TENS[Math.floor(n / 10)];
    const o = n % 10;
    out.push(o > 0 ? `${t}-${SPOKEN_ONES[o]}` : t);
  } else if (n > 0) {
    out.push(SPOKEN_ONES[n]);
  }
  return out.join(' ');
}

export function intToSpokenWords(num) {
  let n = Math.round(Math.abs(Number(num) || 0));
  if (n === 0) return 'zero';
  const parts = [];
  if (n >= 1_000_000) {
    parts.push(chunkUnder1000ToWords(Math.floor(n / 1_000_000)) + ' million');
    n = n % 1_000_000;
  }
  if (n >= 1_000) {
    parts.push(chunkUnder1000ToWords(Math.floor(n / 1_000)) + ' thousand');
    n = n % 1_000;
  }
  if (n > 0) {
    parts.push(chunkUnder1000ToWords(n));
  }
  return parts.join(' ');
}

export function dollarMatchToWords(sign, numStr, suffixK = '') {
  let val = Number(String(numStr).replace(/,/g, ''));
  if (!Number.isFinite(val)) return numStr;
  if (suffixK && suffixK.toLowerCase() === 'k') val = val * 1000;
  const totalCents = Math.round(val * 100);
  const dollars = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const prefix = sign === '-' ? 'minus ' : '';
  if (dollars === 0 && cents === 0) return 'zero dollars';
  if (cents === 0) return `${prefix}${intToSpokenWords(dollars)} ${dollars === 1 ? 'dollar' : 'dollars'}`;
  if (dollars === 0) return `${prefix}${intToSpokenWords(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
  return `${prefix}${intToSpokenWords(dollars)} ${dollars === 1 ? 'dollar' : 'dollars'} and ${intToSpokenWords(cents)} ${cents === 1 ? 'cent' : 'cents'}`;
}

export function normalizeKalSpeech(raw) {
  return String(raw || '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ' to ')
    .replace(/➔|->/g, ', then ')
    .replace(/\bDR\s*===?\s*CR\b/gi, 'debits equal credits')
    .replace(/\b8090\b/g, 'eighty-ninety')
    .replace(/\$0(?:\.00)?\s+signing\s+limit/gi, 'zero-dollar signing limit')
    .replace(/\bZeroSaaS\b/gi, 'Zero-Sass')
    .replace(/\bSaaS\b/g, 'sass')
    .replace(/\bKAL\b/g, 'Cal')
    .replace(/\bInvenTree\b/gi, 'Inven-Tree')
    .replace(/\.sqlite3\b/gi, ' Sequel-Lite')
    .replace(/\bSQLite3\b/gi, 'Sequel-Lite')
    .replace(/\bSQLite\b/gi, 'Sequel-Lite')
    .replace(/\bSQL\b/g, 'Sequel')
    .replace(/\bGAAP\b/g, 'gap')
    .replace(/\bMIT\b/g, 'M.I.T.')
    .replace(/\bERP\b/g, 'E.R.P.')
    .replace(/\bCRM\b/g, 'C.R.M.')
    .replace(/\bHRM\b/g, 'H.R.M.')
    .replace(/\bWMS\b/g, 'W.M.S.')
    .replace(/\bCFO\b/g, 'C.F.O.')
    .replace(/\bVP\b/g, 'V.P.')
    .replace(/\bAP\b/g, 'A.P.')
    .replace(/\bRF\b/g, 'R.F.')
    .replace(/\bNVMe\b/gi, 'N.V.M.E.')
    .replace(/\bONNX\b/gi, 'onyx')
    .replace(/\bGS1-128\b/gi, 'G.S. one one-twenty-eight')
    .replace(/\bGS1\b/gi, 'G.S. one')
    .replace(/\bASTM\s*B8\b/gi, 'A.S.T.M. B-eight')
    .replace(/\bEO\s*14434\b/gi, 'Executive Order fourteen four thirty-four')
    .replace(/\bAI\b/g, 'A.I.')
    .replace(/\bPPV\b/g, 'P.P.V.')
    .replace(/\bP&L\b/gi, 'P and L')
    .replace(/\bITM-CU-20-BARE\b/gi, 'item copper two-aught bare')
    .replace(/\b2\/0\s*AWG\b/gi, 'two-aught A.W.G.')
    .replace(/\b2\/0\b/g, 'two-aught')
    .replace(/\b3WM\b/gi, 'three-way match')
    .replace(/\b3-Way\b/gi, 'three-way')
    .replace(/\bGRNI\b/g, 'G.R.N.I.')
    .replace(/\bSOX\s*404\b/gi, 'Socks four-oh-four')
    .replace(/\bSOX\b/g, 'Socks')
    .replace(/\bDOA\b/g, 'signing limit')
    .replace(/\bKYSI\b/gi, 'K.Y.S.I.')
    .replace(/\bSHA-256\b/gi, 'S.H.A. two-fifty-six')
    .replace(/\bHTTP\s*403\b/gi, 'H.T.T.P. four-oh-three')
    .replace(/\bHTTP\s*409\b/gi, 'H.T.T.P. four-oh-nine')
    .replace(/\bRapidOCR\b/gi, 'Rapid O.C.R.')
    .replace(/\bOCR\b/g, 'O.C.R.')
    .replace(/\bhledger\b/gi, 'H-ledger')
    .replace(/\b(?:purchase\s+order\s+|P\s*O\s+)?PO-25800\b/gi, 'Purchase Order twenty-five eight hundred')
    .replace(/\b(?:requisition\s+)?REQ-25800\b/gi, 'Requisition twenty-five eight hundred')
    .replace(/\b(?:vendor\s+|encore\s+)?(?:order\s+acknowledg(?:e)?ment\s+|order\s+ack\s+|ack\s+)?ENC-OA-2026-884192\b/gi, 'Order Acknowledgement E N C O A twenty twenty-six eighty-eight forty-one ninety-two')
    .replace(/\b(?:order\s+acknowledg(?:e)?ment\s+|order\s+ack\s+)?OA-25800\b/gi, 'Order Acknowledgement twenty-five eight hundred')
    .replace(/\b(?:bill\s+of\s+lading\s+|B\s*O\s*L\s+)?BOL-25800\b/gi, 'Bill of Lading twenty-five eight hundred')
    .replace(/\b(?:packing\s+slip\s+)?PS-25800\b/gi, 'Packing Slip twenty-five eight hundred')
    .replace(/\b(?:commercial\s+)?(?:invoice\s+)?INV-25800\b/gi, 'Invoice twenty-five eight hundred')
    .replace(/\b(?:voucher\s+)?VCH-25800\b/gi, 'Voucher twenty-five eight hundred')
    .replace(/\b(?:check\s+(?:number\s+|no\.?\s+)?)?(?:CHK-10045|Check\s*#?\s*10045)\b/gi, 'Check ten-oh-forty-five')
    .replace(/\bcheck\s+(?:number\s+|no\.?\s+)?#?10045\b/gi, 'Check ten-oh-forty-five')
    .replace(/\bACH-000582\b/gi, 'A C H five-eighty-two')
    .replace(/\b101100\b/g, 'ten-eleven-hundred')
    .replace(/\b101200\b/g, 'ten-twelve-hundred')
    .replace(/\b121100\b/g, 'twelve-eleven-hundred')
    .replace(/\b201100\b/g, 'twenty-eleven-hundred')
    .replace(/\b201200\b/g, 'twenty-twelve-hundred')
    .replace(/\b501900\b/g, 'fifty-nineteen-hundred')
    .replace(/\b2026-(\d{2})-(\d{2})\b/g, (_, mm, dd) => {
      const mName = SPOKEN_MONTHS[Number(mm)] || '';
      const dOrd = SPOKEN_ORDINALS[Number(dd)] || intToSpokenWords(Number(dd));
      return mName ? `${mName} ${dOrd}` : dOrd;
    })
    .replace(/\/FT\b/gi, ' per foot')
    .replace(/\/lb\b/gi, ' per pound')
    .replace(/(-?)\$([\d,]+(?:\.\d+)?)(k)?\b/gi, (_, sign, num, k) => dollarMatchToWords(sign, num, k || ''))
    .replace(/\b(\d+)\.(\d+)%/g, (_, a, b) => `${intToSpokenWords(Number(a))} point ${b.split('').map(d => SPOKEN_ONES[Number(d)]).join(' ')} percent`)
    .replace(/\b(\d+)\.(\d+)\b/g, (_, a, b) => `${intToSpokenWords(Number(a))} point ${b.split('').map(d => SPOKEN_ONES[Number(d)]).join(' ')}`)
    .replace(/\b(\d{1,3}(?:,\d{3})+|\d+)\b/g, (m) => intToSpokenWords(Number(m.replace(/,/g, ''))))
    .replace(/\b([a-z]{3,})\s+\1\b/gi, '$1');
}

export function normalizeInboundTranscript(raw) {
  return String(raw || '')
    .replace(/\bcal\b|\bk\s*a\s*l\b/gi, 'KAL')
    .replace(/\bgranny\b|\bjourney\b/gi, 'GRNI')
    .replace(/\bsocks\b/gi, 'SOX')
    .replace(/\banchor\s+wire\b|\boncore\b/gi, 'Encore Wire')
    .replace(/\btwo\s+aught\b|\btwo\s+ought\b/gi, '2/0 AWG')
    .replace(/\bd\s*o\s*a\b|\bdead on arrival\b/gi, 'Signing Limit')
    .trim();
}

export function createVoiceTelemetry() {
  return {
    sttCalls: 0,
    lastSttLatencyMs: null,
    lastSttTranscript: '',
    ttsCalls: 0,
    lastTtsLatencyMs: null,
    lastTtsModel: null,
    totalAudioBytes: 0,
  };
}

export function getVoiceStatus(env = process.env) {
  const key = String(env.ELEVENLABS_API_KEY ?? '').trim();
  return {
    stewardName: 'KAL',
    elevenLabsConfigured: Boolean(key),
    preferredModel: env.ELEVENLABS_MODEL_ID || env.ELEVENLABS_TTS_MODEL || 'eleven_turbo_v2_5',
    fallbackModel: 'eleven_flash_v2_5',
    sttModel: env.ELEVENLABS_STT_MODEL || 'scribe_v1',
    keyterms: KAL_KEYTERMS,
    opsVoiceId: env.ELEVENLABS_KAL_VOICE_ID || env.ELEVENLABS_VOICE_ID || DEFAULT_KAL_VOICE_ID,
    treasuryVoiceId: env.ELEVENLABS_TREASURY_VOICE_ID || DEFAULT_KAL_VOICE_ID,
  };
}

// Strict voice config for /api/kal/speak and /api/kal/transcribe (throws 503 KAL_VOICE_UNCONFIGURED when unset).
export function voiceConfig(env = process.env) {
  const key = String(env.ELEVENLABS_API_KEY ?? '').trim();
  if (!key) {
    throw new Refusal(503, 'KAL_VOICE_UNCONFIGURED', 'Set ELEVENLABS_API_KEY in the server environment to enable KAL voice; the desk uses browser speech meanwhile');
  }
  return {
    key,
    base: String(env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/+$/, ''),
    voiceId: env.ELEVENLABS_VOICE_ID || env.ELEVENLABS_KAL_VOICE_ID || DEFAULT_KAL_VOICE_ID,
    ttsModel: env.ELEVENLABS_TTS_MODEL || env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
    sttModel: env.ELEVENLABS_STT_MODEL || 'scribe_v1',
  };
}

async function elevenLabsStrict(voice, fetchImpl, route, body, timeoutMs, headers = {}) {
  let reply, bytes;
  try {
    reply = await fetchImpl(voice.base + route, {
      method: 'POST',
      headers: { ...headers, 'xi-api-key': voice.key },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    bytes = Buffer.from(await reply.arrayBuffer());
  } catch {
    throw new Refusal(502, 'KAL_VOICE_UPSTREAM', 'ElevenLabs did not answer in time');
  }
  // Never relay upstream error bodies (which could quote credentials or headers).
  if (!reply.ok) throw new Refusal(502, 'KAL_VOICE_UPSTREAM', `ElevenLabs returned HTTP ${reply.status}`);
  return { type: reply.headers.get('content-type') ?? '', bytes };
}

export async function kalSpeak(req, res, voice, fetchImpl, { readJson, send }) {
  const { text } = await readJson(req);
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_SPEECH_CHARS) {
    throw new Refusal(400, 'BAD_TEXT', `text must be 1-${MAX_SPEECH_CHARS} characters`);
  }
  const route = `/v1/text-to-speech/${encodeURIComponent(voice.voiceId)}?output_format=mp3_44100_128`;
  const audio = await elevenLabsStrict(
    voice,
    fetchImpl,
    route,
    JSON.stringify({ text, model_id: voice.ttsModel }),
    8000,
    { 'content-type': 'application/json', accept: 'audio/mpeg' }
  );
  const type = audio.type.split(';')[0].trim();
  if (!/^audio\/[\w.+-]+$/i.test(type)) throw new Refusal(502, 'KAL_VOICE_UPSTREAM', 'ElevenLabs returned no audio');
  return send(res, 200, audio.bytes, type);
}

export async function kalTranscribe(req, res, voice, fetchImpl, { readBody, send }) {
  const audio = await readBody(req, MAX_AUDIO_BYTES);
  if (!audio.length) throw new Refusal(400, 'NO_AUDIO', 'Body must carry the push-to-talk WebM audio');
  const form = new FormData();
  form.append('model_id', voice.sttModel);
  form.append('file', new Blob([audio], { type: 'audio/webm' }), 'ask-kal.webm');
  const reply = await elevenLabsStrict(voice, fetchImpl, '/v1/speech-to-text', form, 11000);
  let text;
  try { text = JSON.parse(reply.bytes.toString('utf8')).text; } catch { text = undefined; }
  if (typeof text !== 'string') throw new Refusal(502, 'KAL_VOICE_UPSTREAM', 'Scribe returned no transcript');
  return send(res, 200, { text: text.slice(0, 2000) });
}

export async function handleVoiceTts(req, res, { env = process.env, fetchImpl = globalThis.fetch, telemetry, readJson, send }) {
  let payload;
  try {
    payload = await readJson(req);
  } catch (err) {
    if (err instanceof Refusal) throw err;
    return send(res, 200, { ok: false, fallback: 'web_speech' });
  }
  const { text, voiceRole, modelId, dryRun } = payload;
  const resolvedRole = voiceRole === 'treasury_steward' ? 'treasury_steward' : 'ops_steward';
  const normalizedText = normalizeKalSpeech(text).slice(0, 1400);
  const key = String(env.ELEVENLABS_API_KEY ?? '').trim();
  if (!normalizedText || dryRun || !key) {
    return send(res, 200, { ok: false, fallback: 'web_speech', normalizedText, voiceRole: resolvedRole });
  }

  const base = String(env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/+$/, '');
  const voiceId = resolvedRole === 'treasury_steward'
    ? (env.ELEVENLABS_TREASURY_VOICE_ID || DEFAULT_KAL_VOICE_ID)
    : (env.ELEVENLABS_KAL_VOICE_ID || env.ELEVENLABS_VOICE_ID || DEFAULT_KAL_VOICE_ID);
  const primaryModel = modelId || env.ELEVENLABS_MODEL_ID || env.ELEVENLABS_TTS_MODEL || 'eleven_turbo_v2_5';
  const modelsToTry = primaryModel === 'eleven_flash_v2_5'
    ? ['eleven_flash_v2_5']
    : [primaryModel, 'eleven_flash_v2_5'];

  const t0 = performance.now();
  try {
    for (const candidateModel of modelsToTry) {
      const endpoint = candidateModel === 'eleven_v3'
        ? `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}`
        : `${base}/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?optimize_streaming_latency=1`;
      const elRes = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'xi-api-key': key,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: normalizedText,
          model_id: candidateModel,
          voice_settings: resolvedRole === 'treasury_steward'
            ? { stability: 0.58, similarity_boost: 0.82 }
            : { stability: 0.48, similarity_boost: 0.80 },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (elRes.ok) {
        const audioBuf = Buffer.from(await elRes.arrayBuffer());
        const ct = String(elRes.headers.get('content-type') || 'audio/mpeg').split(';')[0].trim();
        if (!/^audio\/[\w.+-]+$/i.test(ct) || !audioBuf.length) continue;
        const latencyMs = Math.round(performance.now() - t0);
        if (telemetry) {
          telemetry.ttsCalls += 1;
          telemetry.lastTtsLatencyMs = latencyMs;
          telemetry.lastTtsModel = candidateModel;
          telemetry.totalAudioBytes += audioBuf.length;
        }
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'X-Voice-Latency-Ms': String(latencyMs),
          'X-Voice-Model': candidateModel,
          'X-Voice-Role': resolvedRole,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(audioBuf);
        return;
      }
    }
  } catch {
    // Graceful fallback to browser speech without leaking upstream errors or secrets.
  }
  return send(res, 200, { ok: false, fallback: 'web_speech', normalizedText, voiceRole: resolvedRole });
}

export async function handleVoiceStt(req, res, { env = process.env, fetchImpl = globalThis.fetch, telemetry, readBody, send }) {
  const mime = String(req.headers['content-type'] || 'audio/webm');
  const rawBuf = await readBody(req, MAX_AUDIO_BYTES);
  let audioBuf = rawBuf;
  if (/^application\/json\b/i.test(mime)) {
    try {
      const parsed = JSON.parse(rawBuf.toString('utf8') || '{}');
      audioBuf = parsed && typeof parsed.audioBase64 === 'string' && parsed.audioBase64
        ? Buffer.from(parsed.audioBase64, 'base64')
        : Buffer.alloc(0);
    } catch {
      throw new Refusal(400, 'BAD_JSON', 'Body must be valid JSON');
    }
  }
  const key = String(env.ELEVENLABS_API_KEY ?? '').trim();
  if (!audioBuf.length || !key) {
    return send(res, 200, { ok: false, fallback: 'browser_speech' });
  }

  const base = String(env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io').replace(/\/+$/, '');
  const ext = mime.includes('wav') ? 'wav' : (mime.includes('mp4') ? 'm4a' : 'webm');
  const fd = new FormData();
  fd.append('model_id', env.ELEVENLABS_STT_MODEL || 'scribe_v1');
  fd.append('language_code', 'eng');
  fd.append('file', new Blob([audioBuf], { type: mime.startsWith('audio/') ? mime : 'audio/webm' }), `mic.${ext}`);
  const sttT0 = performance.now();
  try {
    const sttRes = await fetchImpl(`${base}/v1/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: fd,
      signal: AbortSignal.timeout(11000),
    });
    if (!sttRes.ok) {
      return send(res, 200, { ok: false, fallback: 'browser_speech', status: sttRes.status });
    }
    const sttJson = await sttRes.json();
    const rawText = String(sttJson?.text || '').slice(0, 2000);
    const transcript = normalizeInboundTranscript(rawText);
    if (telemetry) {
      telemetry.sttCalls += 1;
      telemetry.lastSttLatencyMs = Math.round(performance.now() - sttT0);
      telemetry.lastSttTranscript = transcript.slice(0, 120);
    }
    return send(res, 200, { ok: true, transcript, rawText });
  } catch {
    return send(res, 200, { ok: false, fallback: 'browser_speech' });
  }
}

export async function runKalStewardFallback({ prompt = '', preset = '', kernel }) {
  const cleanPrompt = normalizeInboundTranscript(prompt);
  const q = (preset || cleanPrompt).toLowerCase();
  const snap = kernel ? await kernel.snapshot() : null;

  if (q.includes('token') || (q.includes('kal') && (q.includes('check') || q.includes('cook') || q.includes('steal') || q.includes('buy')))) {
    const reply = 'Blocked with HTTP 403. KAL holds a $0.00 Signing Limit and zero database or bank write credentials—only deterministic workflow blocks and verified human officers can touch the books.';
    return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted: 'kal_rogue_attempt', guardrailTriggered: true };
  }
  if (preset === 'sox_db_tour') {
    const reply = "Welcome to our headless System of Record vault and Super Intelligence control plane. Unlike thin workflow wrappers, this app ships three real MIT open-source databases: InvenTree Warehouse, Django Supplier CRM, and Human-Resources Signing Limits, plus an 89-account GAAP general ledger, mutating live on local disk with zero SaaS seat tax. Our four runtime control layers directly enforce SOX 404, 8090's Know Your Superintelligence framework, and all four layers of the White House Accord on Super Intelligence: I hold a $0.00 signing limit with zero write credentials, five deterministic workflow blocks run every calculation, every hop is SHA-256 hashed for external audit, and four segregated human officers sign every dollar.";
    return { ok: true, transcript: 'SOX, Headless DBs & White House Super Intelligence Tour', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted: null };
  }
  if (preset === 'white_house_si' || q.includes('white house') || q.includes('super intelligence') || q.includes('superintelligence') || q.includes('president') || q.includes('14434')) {
    const reply = "Here is how our architecture enforces the four layers of the White House Accord on Super Intelligence alongside 8090's Know Your Superintelligence framework. Layer one locks Super Intelligence at a $0.00 signing limit with zero database or bank credentials, returning HTTP 403 on any rogue move. Layer two runs internal oversight through deterministic SQL and hledger blocks, never model math. Layer three records a SHA-256 cryptographic lineage across every prompt, OCR scan, and ledger entry for external auditors. And Layer four keeps four segregated human corporate officers and an instant kill-switch in absolute command.";
    return { ok: true, transcript: 'White House Super Intelligence Accord & KYSI 4-Layer Brief', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted: null };
  }
  if (preset === 'spot' || q.includes('spot')) {
    const quote = kernel ? await kernel.quote() : { spotPerLbUsd: 6.2602, unitPriceUsd: 2.70, totalUsd: 21600, savingsUsd: 1520, catalogEstimateUsd: 23120 };
    const spotLb = Number(quote.spotPerLbUsd ?? quote.comexUsdPerLb ?? 6.2602);
    const unitUsd = Number(quote.unitPriceUsd ?? 2.70);
    const totalUsd = Number(quote.totalUsd ?? 21600);
    const savingsUsd = Number(quote.savingsUsd ?? 1520);
    const stdUsd = Number(quote.catalogEstimateUsd ?? 23120);
    const reply = `Live COMEX copper is $${spotLb.toFixed(2)} per pound, pricing 8,000 feet of 2/0 AWG Encore Wire at $${unitUsd.toFixed(2)} per foot—$${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total, saving $${savingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} below Supply Chain's $${stdUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} standard.`;
    return { ok: true, transcript: cleanPrompt || 'Check live COMEX copper price', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'ops_steward', actionExecuted: null };
  }

  const completed = snap?.state?.steps ? snap.state.steps.filter(s => s.status === 'complete').length : 0;
  const reply = completed >= 8
    ? 'PO-25800 and INV-25800 are stamped PAID via Check #10045 (ACH-000582) for $21,600.00. 8,000 feet of bare copper is in stock, saving $1,520.00 under standard, with DR == CR balanced at zero.'
    : 'WMS stock-out active: InvenTree shows 0 feet of 2/0 AWG bare copper on hand against an 8,000-foot minimum ($23,120.00 standard). KAL holds a $0.00 signing limit while human officers and deterministic hledger blocks execute.';
  const role = completed >= 7 ? 'treasury_steward' : 'ops_steward';
  return {
    ok: true,
    transcript: cleanPrompt || 'KAL Status Brief',
    reply,
    spokenText: normalizeKalSpeech(reply),
    voiceRole: role,
    actionExecuted: null,
  };
}

export async function handleVoiceKal(req, res, { workbench, kernel, readJson, send }) {
  const payload = await readJson(req);
  if (workbench && typeof workbench.runKalBrain === 'function') {
    const out = await workbench.runKalBrain(payload);
    return send(res, 200, out);
  }
  const out = await runKalStewardFallback({ ...payload, kernel });
  return send(res, 200, out);
}
