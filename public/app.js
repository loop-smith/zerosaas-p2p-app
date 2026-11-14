// Copper projects server state. No browser-side approval or accounting engine.
export const REELS = ['ENC-GS1-884192-R01', 'ENC-GS1-884192-R02', 'ENC-GS1-884192-R03', 'ENC-GS1-884192-R04'];
const DOCUMENTS = [
  ['PO-25800.pdf', 'Purchase order', '01 / Purchasing'],
  ['ENC-OA-2026-884192.pdf', 'Vendor acknowledgement', '02 / Encore Wire'],
  ['BOL-25800.pdf', 'Bill of lading', '03 / Dock receipt'],
  ['PS-25800.pdf', 'Packing slip & mill cert', '04 / ASTM B8'],
  ['INV-25800.pdf', 'Vendor invoice', '05 / Accounts payable'],
];
const OFFICERS = [
  ['Darius Mercer', 'Planner', '$20,000'], ['Devon Brooks', 'VP Supply Chain', '$100,000'],
  ['Nancy Rostova', 'Purchasing', '$50,000'], ['Marcus Vance', 'Dock Lead', 'Receipt only'],
  ['Duncan Vance', 'Controller', '$250,000'], ['Meredith Hale', 'CFO', '$500,000'],
  ['KAL', 'Voice steward', '$0.00'],
];
const SYSTEMS = [['wms', 'WM', 'InvenTree', 'Inventory & dock receipts'], ['crm', 'CR', 'Django-CRM', 'Vendor & customer records'], ['hrm', 'HR', 'Headless HRM', 'Authority & duty separation'], ['coa', 'GL', 'GAAP ledger', 'Double-entry journal']];
const ACTORS = {1: 'SYSTEM', 2: 'EMP-0021', 3: 'EMP-0005', 4: 'EMP-0002', 5: 'EMP-0002', 6: 'EMP-0003', 7: 'EMP-0001', 8: 'EMP-0007'};
export const REFUSALS = {
  AI_STEWARD_ZERO_AUTHORITY: {status: 403, text: 'KAL has $0.00 signing authority.'},
  DOA_LIMIT_EXCEEDED: {status: 403, text: 'Darius must escalate the $23,120 request to Devon.'},
  SOX_SOD_VIOLATION: {status: 403, text: 'The buyer cannot receive their own purchase.'},
  MATCH_VARIANCE_HOLD: {status: 409, text: 'Invoice variance held. No payment may advance.'},
  BANK_POLICY_VIOLATION: {status: 403, text: 'Payroll #4409 cannot fund this payment.'},
};
const TRAPS = {
  kal: {step: 3, actor: 'EMP-AI-KAL', code: 'AI_STEWARD_ZERO_AUTHORITY'},
  doa: {step: 3, actor: 'EMP-0021', code: 'DOA_LIMIT_EXCEEDED'},
  sod: {step: 6, actor: 'EMP-0002', barcode: REELS[0], code: 'SOX_SOD_VIOLATION'},
  invoice: {step: 7, actor: 'EMP-0001', invoiceDeltaUsd: 500, code: 'MATCH_VARIANCE_HOLD'},
  bank: {step: 8, actor: 'EMP-0007', bankAccount: '101200', code: 'BANK_POLICY_VIOLATION'},
};
let state = null, connected = false, pending = false, epoch = 0;
let recorder = null, recordingPending = false, recordingResources = [], audioContext = null, recordingTimer = null;
let voiceController = null, voiceAudio = null, voiceUrl = null, voiceEpoch = 0;
let listening = false, recognition = null, micRecorder = null, micStream = null, micPending = false;
let refreshTimer = null, disposed = false, recordingEpoch = 0, transcriptionController = null;
const $ = id => globalThis.document?.getElementById(id);
const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(value) : '—';
const setText = (id, value) => { const node = $(id); if (node) node.textContent = value; };
function status(message, error = false) { setText('status', message); $('status')?.classList.toggle('error', error); }
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export function validateState(value) {
  const result = value?.state ?? value;
  const invalid = () => { throw new Error('Invalid server snapshot; previous evidence retained.'); };
  if (!result || typeof result !== 'object' || Array.isArray(result)) invalid();
  const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!Array.isArray(result.steps) || result.steps.length !== 8) invalid();
  let incomplete = false;
  for (const [index, step] of result.steps.entries()) {
    if (!step || step.n !== index + 1 || !['pending', 'in_progress', 'complete'].includes(step.status)) invalid();
    if (incomplete && step.status !== 'pending') invalid();
    if (step.status !== 'complete') incomplete = true;
  }
  if (!object(result.item) || !amount(result.item.onHandFt)) invalid();
  for (const key of ['stdUnitUsd', 'stdTotalUsd']) if (result.item[key] !== undefined && !amount(result.item[key])) invalid();
  if (result.po != null && (!object(result.po) || !amount(result.po.unitUsd) || !amount(result.po.totalUsd))) invalid();
  if (result.payment != null && (!object(result.payment) || result.payment.stamp !== 'PAID' || typeof result.payment.check !== 'string' || !amount(result.payment.amountUsd))) invalid();
  const journal = result.journal;
  if (!object(journal) || typeof journal.balanced !== 'boolean' || !amount(journal.debitUsd) || !amount(journal.creditUsd) || !Array.isArray(journal.entries) || journal.entries.length > 10000) invalid();
  if (journal.entries.some(entry => !entry || !Array.isArray(entry.legs) || entry.legs.length > 1000 || entry.legs.some(leg => !leg || typeof leg.account !== 'string' || !amount(leg.debitUsd) || !amount(leg.creditUsd)))) invalid();
  if (!Array.isArray(result.scans) || result.scans.some(scan => !scan || !REELS.includes(scan.barcode) || scan.ft !== 2000) || new Set(result.scans.map(scan => scan.barcode)).size !== result.scans.length) invalid();
  if (result.sandbox !== undefined && (!object(result.sandbox) || (result.sandbox.sources !== undefined && !object(result.sandbox.sources)))) invalid();
  if (result.documents !== undefined && (!Array.isArray(result.documents) || result.documents.some(doc => !doc || typeof doc.name !== 'string' || typeof doc.url !== 'string'))) invalid();
  if (result.ocr !== undefined && result.ocr !== null) {
    const ocr = result.ocr;
    if (!ocr || !amount(ocr.width) || !amount(ocr.height) || !ocr.width || !ocr.height || typeof ocr.imageUrl !== 'string' || !Array.isArray(ocr.boxes) || ocr.boxes.length > 1000) invalid();
    if (ocr.boxes.some(box => !box || !['x', 'y', 'width', 'height'].every(key => amount(box[key])) || !box.width || !box.height || box.x + box.width > ocr.width || box.y + box.height > ocr.height || typeof box.text !== 'string')) invalid();
  }
  return result;
}

export function safeDocumentUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  const origin = globalThis.location?.origin ?? 'http://localhost';
  try {
    const url = new URL(value, origin);
    return url.origin === origin && ['http:', 'https:'].includes(url.protocol) ? url.pathname + url.search : null;
  } catch { return null; }
}

export async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin', cache: 'no-store', ...options,
    signal: options.signal ?? AbortSignal.timeout(12000),
    headers: {'Content-Type': 'application/json', ...options.headers},
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`HTTP ${response.status}: expected JSON from the command server.`); }
  if (!response.ok || data?.ok === false) {
    const code = data?.code ?? data?.error?.code ?? (typeof data?.error === 'string' ? data.error : 'REQUEST_REFUSED');
    const message = data?.message ?? data?.error?.message ?? REFUSALS[code]?.text ?? 'Request refused by server.';
    throw Object.assign(new Error(`${code}: ${message}`), {code, status: response.status});
  }
  return data;
}

function accept(value) { state = validateState(value); connected = true; render(state); }
export async function refresh() {
  if (pending) return;
  const revision = ++epoch;
  try {
    const snapshot = await request('/api/state');
    if (revision !== epoch) return;
    accept(snapshot);
    status('Server connected · financial state and checkpoint authority remain on the server.');
  } catch (error) {
    if (revision !== epoch) return;
    connected = false;
    render(state);
    status(`Disconnected · ${error.message} Start the local command server and refresh.`, true);
  }
}

export async function runStep(step, actor, extra = {}) {
  if (!connected || !state) throw new Error('Connect to the command server before authorizing a step.');
  if (pending) throw new Error('A server action is already pending.');
  if (step !== state.steps.filter(step => step.status === 'complete').length + 1 || !ACTORS[step]) throw new Error('This checkpoint is not the next server step.');
  if (actor !== ACTORS[step]) throw new Error('The required human actor must authorize this step.');
  const payload = {actor};
  if (step === 6) {
    if (!REELS.includes(extra.barcode)) throw new Error('Scan one of the four exact ENC-GS1-884192-R01…R04 barcodes.');
    if (state.scans.some(scan => scan.barcode === extra.barcode)) throw new Error('This reel was already scanned. Scan the next unique reel.');
    payload.barcode = extra.barcode;
  }
  if (step === 8) payload.bankAccount = '101100';
  pending = true; ++epoch; render(state);
  status(`Step ${step} submitted · waiting for authoritative server confirmation.`);
  try {
    accept(await request(`/api/step/${step}`, {method: 'POST', body: payload}));
    if (step === 6 && $('barcode')) $('barcode').value = '';
    status(`Step ${step} response received · ${state.payment?.stamp === 'PAID' ? `${state.payment.check} released by server.` : 'next human gate remains explicit.'}`);
  } catch (error) {
    if (!error.status) connected = false;
    status(error.message, true);
    throw error;
  } finally { pending = false; render(state); }
}

function buildStaticRows() {
  for (const [key, icon, name, detail] of SYSTEMS) {
    const row = node('div', undefined, 'system'); row.dataset.system = key;
    row.append(node('span', icon, 'system-icon'));
    const copy = node('div'); copy.append(node('strong', name), node('p', detail));
    row.append(copy, node('span', 'UNKNOWN', 'system-status')); $('systems').append(row);
  }
  for (const [name, role, limit] of OFFICERS) {
    const row = node('tr'), copy = node('td', name); copy.append(node('small', role)); row.append(copy, node('td', limit)); $('authority').tBodies[0].append(row);
  }
  for (const [name, label, detail] of DOCUMENTS) {
    const link = node('a', undefined, 'document'); link.dataset.document = name; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-disabled', 'true');
    const copy = node('span', undefined, 'doc-copy'); copy.append(node('strong', label), node('small', name));
    link.append(node('span', 'PDF', 'pdf'), copy, node('span', 'PENDING', 'doc-state')); link.title = detail; $('documents').append(link);
  }
}

function renderJournal(snapshot) {
  const report = snapshot?.journal;
  const rows = report?.entries.flatMap(entry => entry.legs.map(leg => ({account: leg.account, description: entry.memo, debit: leg.debitUsd, credit: leg.creditUsd})));
  const journal = $('journal'); journal.replaceChildren();
  if (!rows?.length) {
    const row = node('tr'), cell = node('td', rows ? 'No journal entries posted.' : 'Connect the ledger to see real postings.', 'empty');
    cell.colSpan = 3; row.append(cell); journal.append(row);
  }
  const accounts = new Map(); let debit = 0, credit = 0;
  for (const row of rows ?? []) {
    const key = String(row.account ?? 'Unspecified account');
    const group = accounts.get(key) ?? {description: String(row.description ?? ''), debit: 0, credit: 0};
    group.debit += Math.round(row.debit * 100); group.credit += Math.round(row.credit * 100);
    debit += Math.round(row.debit * 100); credit += Math.round(row.credit * 100); accounts.set(key, group);
  }
  for (const [account, group] of [...accounts].slice(0, 6)) {
    const row = node('tr'), cell = node('td'); cell.title = `${account} · ${group.description}`; cell.append(node('strong', account), node('small', group.description));
    row.append(cell, node('td', group.debit ? money(group.debit / 100) : '—'), node('td', group.credit ? money(group.credit / 100) : '—')); journal.append(row);
  }
  if (accounts.size > 6) { const row = node('tr'), cell = node('td', `${accounts.size - 6} additional accounts included in totals`); cell.colSpan = 3; row.append(cell); journal.append(row); }
  setText('debit-total', rows ? money(debit / 100) : '—'); setText('credit-total', rows ? money(credit / 100) : '—');
  setText('ledger-balance', !rows ? 'AWAITING LEDGER' : !report.balanced || debit !== credit ? 'UNBALANCED · HOLD' : rows.length ? 'DR = CR · BALANCED' : 'NO POSTINGS');
}

export function render(snapshot) {
  if (!globalThis.document) return;
  const active = connected && !pending;
  const completed = snapshot?.steps.filter(step => step.status === 'complete').length;
  const connection = $('connection'); connection.classList.toggle('online', connected); connection.replaceChildren(node('i'), document.createTextNode(connected ? 'SERVER CONNECTED' : 'DISCONNECTED'));
  setText('progress-label', snapshot ? `${completed} / 8 COMPLETE` : '— / 8 COMPLETE');
  setText('actual-total', money(snapshot?.po?.totalUsd));
  setText('spot-detail', snapshot?.po?.unitUsd !== undefined ? `${money(snapshot.po.unitUsd)} / FT · ${snapshot.po.comex?.live ? 'live COMEX' : 'offline reference'}` : 'Awaiting COMEX price lock');
  const ppv = snapshot?.po?.totalUsd === undefined ? null : snapshot.po.totalUsd - snapshot.item.stdTotalUsd;
  setText('ppv', ppv === null ? '—' : money(ppv)); setText('ppv-detail', ppv === null ? '501900 · awaiting actual cost' : `501900 · ${ppv <= 0 ? 'favorable' : 'unfavorable'} vs standard`);
  $('ppv').style.color = ppv > 0 ? 'var(--red)' : 'var(--green)';
  setText('stock', snapshot?.item?.onHandFt === undefined ? '—' : new Intl.NumberFormat('en-US').format(snapshot.item.onHandFt));
  let live = 0;
  for (const [key] of SYSTEMS) {
    const source = snapshot?.sandbox?.sources?.[key], row = document.querySelector(`[data-system="${key}"]`);
    const indicator = row.querySelector('.system-status');
    const available = connected && ['seed', 'contract-bootstrap'].includes(source);
    indicator.textContent = !connected ? 'OFFLINE' : source === 'seed' ? 'SEED' : source === 'contract-bootstrap' ? 'BOOTSTRAP' : 'ABSENT';
    indicator.classList.toggle('ok', available);
    row.title = available ? `${source} · local sandbox source; live service health is not reported${key === 'coa' ? `; hledger ${snapshot.sandbox.hledger ? 'available' : 'absent'}` : ''}` : 'SoR source/health absent from server snapshot';
    if (available) live++;
  }
  setText('system-count', `${live} / 4 LOCAL`);
  for (const row of document.querySelectorAll('[data-step]')) {
    const step = Number(row.dataset.step), done = snapshot && step <= completed, current = snapshot && step === completed + 1;
    row.classList.toggle('done', Boolean(done)); row.classList.toggle('current', Boolean(current));
    row.querySelector('button').disabled = !active || !current;
    row.querySelector('.step-state').textContent = done ? '✓ CONFIRMED' : snapshot?.steps[step - 1].status === 'in_progress' ? 'IN PROGRESS' : row.hasAttribute('data-checkpoint') ? 'HUMAN REQUIRED' : 'WAITING';
  }
  const scans = snapshot?.scans ?? [];
  setText('scan-count', `${scans.length} / 4 reels`); setText('reels', REELS.map(code => scans.some(scan => scan.barcode === code) ? '●' : '○').join(' '));
  $('barcode').disabled = !active || completed !== 5;
  for (const button of document.querySelectorAll('[data-trap]')) button.disabled = !active;
  $('reset').disabled = !active || Boolean(recorder) || recordingPending; $('refresh').disabled = pending;
  setText('settlement', snapshot?.payment?.stamp === 'PAID' ? `PAID · ${snapshot.payment.check}` : 'Awaiting CFO approval');
  renderJournal(snapshot);
  for (const link of document.querySelectorAll('[data-document]')) {
    const doc = snapshot?.documents?.find(doc => doc.name === link.dataset.document), url = safeDocumentUrl(doc?.url);
    if (url) { link.href = url; link.removeAttribute('aria-disabled'); } else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
    link.querySelector('.doc-state').textContent = url ? '↗' : 'PENDING';
  }
  const ocr = snapshot?.ocr, available = Boolean(ocr?.boxes?.length && safeDocumentUrl(ocr.imageUrl));
  $('open-ocr').disabled = !available; setText('ocr-count', ocr ? `${ocr.boxes.length} server field boxes${ocr.boxes.length < 28 ? ' · incomplete evidence' : ''}` : 'Awaiting pixel OCR evidence');
  if ($('ocr-dialog').open) renderOcr(snapshot?.ocr);
}

function renderOcr(ocr) {
  if (!ocr || !safeDocumentUrl(ocr.imageUrl)) { $('ocr-dialog').close(); return; }
  const image = $('ocr-image'); if (image.getAttribute('src') !== ocr.imageUrl) image.src = safeDocumentUrl(ocr.imageUrl);
  setText('ocr-summary', `${ocr.boxes.length} extracted fields · ${ocr.width} × ${ocr.height} source pixels${ocr.boxes.length < 28 ? ' · fewer than 28 expected boxes' : ''}`);
  const layer = $('ocr-boxes'); layer.replaceChildren();
  for (const [index, box] of ocr.boxes.entries()) {
    const tag = node('button', undefined, 'ocr-box'); tag.title = `${index + 1}: ${box.text}`; tag.setAttribute('aria-label', tag.title);
    Object.assign(tag.style, {left: `${100 * box.x / ocr.width}%`, top: `${100 * box.y / ocr.height}%`, width: `${100 * box.width / ocr.width}%`, height: `${100 * box.height / ocr.height}%`}); layer.append(tag);
  }
}

function briefing() {
  if (!connected || !state) return 'I am KAL, your zero-authority voice steward. The command server is disconnected. I cannot confirm stock, ledger balances, or approvals.';
  const completed = state.steps.filter(step => step.status === 'complete').length;
  const next = ['Query stock', 'Darius must confirm and escalate the need', 'VP Devon must approve the request', 'Purchasing may lock the COMEX spot rate', 'Purchasing may issue the purchase order', 'Marcus must scan four unique GS1 reels', 'Run invoice OCR and the three-way match', 'CFO Meredith must authorize Check number 10045', 'The server reports all eight steps complete'][completed];
  return `${completed} of 8 steps confirmed. ${next}. My signing limit is zero dollars. Human officers authorize every checkpoint.`;
}
function stopVoice() {
  ++voiceEpoch; voiceController?.abort(); voiceController = null; voiceAudio?.pause(); voiceAudio = null;
  if (voiceUrl) URL.revokeObjectURL(voiceUrl); voiceUrl = null; globalThis.speechSynthesis?.cancel();
}
export async function speak(text) {
  if (disposed) return 'cancelled';
  stopVoice(); const token = voiceEpoch;
  text = String(text).slice(0, 1500); setText('kal-line', text);
  const controller = new AbortController(); voiceController = controller;
  const timer = setTimeout(() => controller.abort(), 700);
  try {
    const response = await fetch('/api/kal/speak', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({text}), signal: controller.signal});
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('audio/')) throw new Error('Voice proxy unavailable');
    const blob = await response.blob(); clearTimeout(timer);
    if (token !== voiceEpoch) return 'cancelled';
    voiceUrl = URL.createObjectURL(blob); voiceAudio = new Audio(voiceUrl);
    voiceAudio.onended = () => { if (token === voiceEpoch) stopVoice(); };
    await voiceAudio.play(); return 'proxy';
  } catch {
    if (token !== voiceEpoch) return 'cancelled';
    if (globalThis.speechSynthesis && globalThis.SpeechSynthesisUtterance) {
      globalThis.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); return 'browser';
    }
    status('Voice unavailable in this browser. KAL briefing remains visible as text.'); return 'text';
  } finally { clearTimeout(timer); }
}
function transcript(text) {
  if (disposed) return;
  const heard = String(text).trim().slice(0, 500);
  if (!heard) { status('No speech detected. Hold MIC and try again.'); return; }
  setText('kal-line', `Heard: “${heard}”`);
  status(`Heard: “${heard}” · voice cannot approve, reset or move funds.`);
  void speak(`I heard your request. ${briefing()}`);
}
function micType() { return ['audio/webm;codecs=opus', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)); }
async function startListening() {
  if (disposed || listening || micPending || micRecorder) return;
  stopVoice(); listening = true; $('kal-mic').classList.add('listening');
  const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;
  if (Recognition) {
    recognition = new Recognition(); recognition.lang = 'en-US'; recognition.interimResults = false;
    recognition.onresult = event => transcript(event.results[0][0].transcript);
    recognition.onerror = event => { status(`Microphone: ${event.error}. Check permission and try again.`, true); stopListening(); };
    recognition.onend = () => { listening = false; $('kal-mic')?.classList.remove('listening'); };
    try { recognition.start(); } catch (error) { stopListening(); status(error.message, true); }
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder || !micType()) { stopListening(); status('Push-to-talk needs speech recognition or WebM microphone support.', true); return; }
  micPending = true;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({audio: true});
    if (disposed || !listening) { micStream.getTracks().forEach(track => track.stop()); micStream = null; return; }
    const stream = micStream, chunks = []; micRecorder = new MediaRecorder(stream, {mimeType: micType()});
    micRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    micRecorder.onerror = () => { status('Microphone capture failed. Please try again.', true); stopListening(); };
    micRecorder.onstop = async () => {
      stream.getTracks().forEach(track => track.stop()); micStream = null; micRecorder = null;
      if (disposed || !chunks.length) return;
      const controller = new AbortController(); transcriptionController = controller;
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch('/api/kal/transcribe', {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'audio/webm'}, body: new Blob(chunks, {type: 'audio/webm'}), signal: controller.signal});
        if (!response.ok) throw new Error(`Scribe proxy returned HTTP ${response.status}`);
        const data = await response.json(); if (typeof data.text !== 'string') throw new Error('Scribe returned no transcript'); if (!disposed) transcript(data.text);
      } catch (error) { if (!disposed) status(`${error.message}. Speak directly or use the checkpoint buttons.`, true); }
      finally { clearTimeout(timer); if (transcriptionController === controller) transcriptionController = null; }
    };
    micRecorder.start(); status('Listening · release MIC to send audio to the local Scribe proxy.');
  } catch (error) { stopListening(); status(`Microphone permission: ${error.message}`, true); }
  finally { micPending = false; }
}
function stopListening() {
  listening = false; $('kal-mic')?.classList.remove('listening'); recognition?.stop(); recognition = null;
  if (micRecorder?.state === 'recording') micRecorder.stop();
  else if (micStream) { micStream.getTracks().forEach(track => track.stop()); micStream = null; }
}

function cleanupRecording() {
  clearInterval(recordingTimer); recordingTimer = null;
  for (const stream of recordingResources) stream.getTracks().forEach(track => track.stop()); recordingResources = [];
  if (audioContext) { void audioContext.close().catch(() => {}); audioContext = null; }
  recorder = null; $('record')?.classList.remove('recording'); setText('record-label', 'Record demo');
  if ($('record')) $('record').disabled = false;
  if (state) render(state);
}
export async function startRecording() {
  if (disposed || recorder || recordingPending) return;
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || !globalThis.MediaRecorder) { status('Recording needs a secure desktop browser with screen capture and WebM support.', true); return false; }
  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) { status('This browser cannot record WebM. Use a Chromium desktop browser.', true); return false; }
  const token = ++recordingEpoch;
  recordingPending = true; if ($('record')) $('record').disabled = true;
  try {
    const screen = await navigator.mediaDevices.getDisplayMedia({video: {frameRate: {ideal: 60, max: 60}}, audio: true});
    if (disposed || token !== recordingEpoch) { screen.getTracks().forEach(track => track.stop()); return false; }
    recordingResources.push(screen);
    if (!screen.getVideoTracks().length) throw new Error('No display video track selected');
    screen.getVideoTracks()[0].addEventListener('ended', stopRecording, {once: true});
    let mic = null;
    try {
      mic = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true}});
      if (disposed || token !== recordingEpoch) { mic.getTracks().forEach(track => track.stop()); cleanupRecording(); return false; }
      recordingResources.push(mic);
    }
    catch { status('Recording screen with available system audio. Microphone permission was not granted.'); }
    if (disposed || token !== recordingEpoch) { cleanupRecording(); return false; }
    if (screen.getVideoTracks()[0].readyState === 'ended') throw new Error('Screen sharing ended before recording started');
    const tracks = [...screen.getVideoTracks()];
    const sources = [screen, mic].filter(stream => stream?.getAudioTracks().length);
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (sources.length && Context) {
      const context = new Context(); audioContext = context; await context.resume();
      if (disposed || token !== recordingEpoch) { cleanupRecording(); return false; }
      const output = context.createMediaStreamDestination();
      for (const source of sources) context.createMediaStreamSource(source).connect(output);
      tracks.push(...output.stream.getAudioTracks()); recordingResources.push(output.stream);
    } else if (sources.length) tracks.push(...sources[0].getAudioTracks());
    const combined = new MediaStream(tracks); const chunks = [];
    recorder = new MediaRecorder(combined, {mimeType, videoBitsPerSecond: 8000000});
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      if (!disposed && chunks.length && globalThis.document) {
        const link = $('record-download'); if (link.href) URL.revokeObjectURL(link.href);
        link.href = URL.createObjectURL(new Blob(chunks, {type: mimeType})); link.download = `copper-demo-${Date.now()}.webm`; link.hidden = false; link.click();
        status('WebM ready · use Save WebM if the download did not start.');
      }
      cleanupRecording();
    };
    recorder.onerror = () => { status('Recording failed. All capture tracks have been stopped.', true); stopRecording(); };
    recorder.start(1000); const started = Date.now();
    $('record')?.classList.add('recording');
    recordingTimer = setInterval(() => setText('record-label', `Stop · ${Math.floor((Date.now() - started) / 60000)}:${String(Math.floor((Date.now() - started) / 1000) % 60).padStart(2, '0')}`), 1000);
    setText('record-label', 'Stop · 0:00');
    const fps = screen.getVideoTracks()[0].getSettings().frameRate;
    status(`Recording WebM · requested 60fps${fps ? `, capture ${fps}fps` : ''} · ${tracks.some(track => track.kind === 'audio') ? 'audio included' : 'no audio track available'}.`);
    return true;
  } catch (error) { cleanupRecording(); status(`Recording not started: ${error.message}`, true); return false; }
  finally { recordingPending = false; if ($('record')) $('record').disabled = false; if (state) render(state); }
}
export function stopRecording() {
  ++recordingEpoch;
  if (recorder && recorder.state !== 'inactive') recorder.stop(); else cleanupRecording();
}

async function probe(name) {
  if (!connected || pending) return;
  const {code, step, invoiceDeltaUsd, ...body} = TRAPS[name];
  if (invoiceDeltaUsd !== undefined) {
    if (!state.po || state.steps[5].status !== 'complete' || state.steps[6].status === 'complete') { status('Invoice probe needs completed dock receipt and an unmatched invoice.', true); return; }
    body.invoice = {totalUsd: state.po.totalUsd + invoiceDeltaUsd};
  }
  pending = true; ++epoch; render(state);
  try {
    await request(`/api/step/${step}`, {method: 'POST', body});
    status(`GUARDRAIL FAILURE: ${code} was expected but the server accepted the probe. Inspect the server ledger.`, true);
  } catch (error) {
    status(error.code === code && error.status === REFUSALS[code].status ? `PROBE BLOCKED · HTTP ${error.status} ${error.message}` : `Probe inconclusive · expected ${code}; received ${error.message}`, error.code !== code);
  } finally {
    // Preserve probe outcome in the status bar while reconciling authoritative state.
    try { accept(await request('/api/state')); } catch { connected = false; }
    pending = false; render(state);
  }
}
async function resetWorkflow() {
  if (!connected || pending || recorder || recordingPending) return;
  pending = true; ++epoch; render(state); $('reset-dialog').close();
  try { accept(await request('/api/reset', {method: 'POST', body: {}})); status('Server reset confirmed. A new workflow requires fresh human approvals.'); }
  catch (error) { if (!error.status) connected = false; status(error.message, true); }
  finally { pending = false; render(state); }
}
function boot() {
  buildStaticRows(); render(null);
  $('refresh').addEventListener('click', () => void refresh());
  for (const button of document.querySelectorAll('[data-run]')) button.addEventListener('click', () => {
    const step = Number(button.dataset.run);
    void runStep(step, ACTORS[step], {barcode: $('barcode').value.trim()}).catch(error => status(error.message, true));
  });
  $('barcode').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); document.querySelector('[data-run="6"]').click(); } });
  for (const button of document.querySelectorAll('[data-trap]')) button.addEventListener('click', () => void probe(button.dataset.trap));
  $('reset').addEventListener('click', () => $('reset-dialog').showModal());
  $('cancel-reset').addEventListener('click', () => $('reset-dialog').close()); $('confirm-reset').addEventListener('click', () => void resetWorkflow());
  $('open-ocr').addEventListener('click', () => { renderOcr(state?.ocr); $('ocr-dialog').showModal(); }); $('close-ocr').addEventListener('click', () => $('ocr-dialog').close());
  $('ocr-image').addEventListener('error', () => { $('ocr-dialog').close(); status('Invoice image could not be loaded. Check the server OCR artifact.', true); });
  $('kal-speak').addEventListener('click', () => void speak(briefing()));
  const mic = $('kal-mic');
  mic.addEventListener('pointerdown', event => { event.preventDefault(); mic.setPointerCapture(event.pointerId); void startListening(); });
  mic.addEventListener('pointerup', stopListening); mic.addEventListener('pointercancel', stopListening); mic.addEventListener('lostpointercapture', stopListening);
  mic.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key) && !event.repeat) { event.preventDefault(); void startListening(); } });
  mic.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stopListening(); } });
  globalThis.addEventListener('blur', stopListening);
  $('record').addEventListener('click', () => { if (recorder) stopRecording(); else void startRecording(); });
  for (const tab of document.querySelectorAll('.mobile-tabs button')) tab.addEventListener('click', () => {
    document.body.dataset.panel = tab.dataset.panel;
    for (const button of document.querySelectorAll('.mobile-tabs button')) button.setAttribute('aria-pressed', String(button === tab));
  });
  globalThis.addEventListener('pagehide', () => { disposed = true; ++epoch; transcriptionController?.abort(); clearInterval(refreshTimer); stopVoice(); stopListening(); stopRecording(); for (const stream of recordingResources) stream.getTracks().forEach(track => track.stop()); const link = $('record-download'); if (link.href) URL.revokeObjectURL(link.href); });
  void refresh(); refreshTimer = setInterval(() => { if (!document.hidden && !$('reset-dialog').open) void refresh(); }, 15000);
}
if (globalThis.document) boot();
