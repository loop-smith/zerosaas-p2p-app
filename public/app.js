// ZeroSaaS P2P workbench. Projects server state only: no browser-side approval, stock or accounting engine.
export const REELS = ['ENC-GS1-884192-R01', 'ENC-GS1-884192-R02', 'ENC-GS1-884192-R03', 'ENC-GS1-884192-R04'];
// Packet trail: the server step that produces each packet, and the trade PDFs that back it once served.
const PACKETS = {signal: [1, []], po: [4, ['PO-25800.pdf']], oa: [5, ['ENC-OA-2026-884192.pdf']], bol: [6, ['BOL-25800.pdf', 'PS-25800.pdf']], inv: [7, ['INV-25800.pdf']], check: [8, []]};
const OFFICERS = [
  ['EMP-0021', 'Darius Mercer', 'Planner', '$20,000'], ['EMP-0005', 'Devon Brooks', 'VP Supply Chain', '$100,000'],
  ['EMP-0002', 'Nancy Rostova', 'Purchasing', '$50,000'], ['EMP-0003', 'Marcus Vance', 'Dock Lead', 'Receipt only'],
  ['EMP-0001', 'Duncan Vance', 'Controller', '$250,000'], ['EMP-0007', 'Meredith Hale', 'CFO', '$500,000'],
  ['EMP-AI-KAL', 'KAL', 'P2P steward (AI)', '$0.00'],
];
const officer = emp => OFFICERS.find(([id]) => id === emp)?.[1];
const LBS_PER_REEL = 822;
const SYSTEMS = [['wms', 'WM', 'InvenTree WMS', 'Stock & dock receipts'], ['crm', 'CR', 'Django-CRM', 'Vendor records'], ['hrm', 'HR', 'Headless HRM', 'Signing limits & duties'], ['coa', 'GL', 'GAAP ledger', '89-account double entry']];
const ACTORS = {1: 'SYSTEM', 2: 'EMP-0021', 3: 'EMP-0005', 4: 'EMP-0002', 5: 'EMP-0002', 6: 'EMP-0003', 7: 'EMP-0001', 8: 'EMP-0007'};
const CHECKPOINTS = new Set([2, 3, 6, 8]);
// [gate, title, actor, detail, action] for the active step card.
const STEP_CARDS = [
  ['Automated', 'Query InvenTree stock for ITM-CU-20-BARE', 'SYSTEM · WMS stock signal', 'Reads on-hand feet against the 8,000 FT minimum and opens REQ-25800.', 'Query stock'],
  ['Human gate 1', 'Darius Mercer confirms the need', 'EMP-0021 · Planner · $20,000 limit', 'The $23,120 need is above his limit, so he confirms and escalates to the VP.', 'Confirm & escalate'],
  ['Human gate 2', 'Devon Brooks approves REQ-25800', 'EMP-0005 · VP Supply Chain · $100,000 limit', 'Approval hands the request to Purchasing.', 'Approve request'],
  ['Purchasing', 'Lock the live COMEX HG spot price', 'EMP-0002 · Nancy Rostova · Purchasing · $50,000 limit', '(HG + $0.32 mill adder) × 0.411 lb/FT, measured against the $2.89/FT standard.', 'Lock spot price'],
  ['Purchasing', 'Issue PO-25800 and take the vendor acknowledgement', 'EMP-0002 · Nancy Rostova · Purchasing', 'PO-25800 goes to Encore Wire; ENC-OA-2026-884192 comes back.', 'Issue PO'],
  ['Human gate 3', 'Marcus Vance scans four GS1 reels', 'EMP-0003 · Dock Lead · receipt only', 'Each reel receives 2,000 FT. The fourth reel posts 121100 / 201200 / 501900.', 'Scan reel'],
  ['Controller', 'RapidOCR reads INV-25800 for the three-way match', 'EMP-0001 · Duncan Vance · Controller · $250,000 limit', 'PO = BOL = INV at $0.00 variance clears 201200 GRNI into 201100 Trade AP.', 'Run OCR match'],
  ['Human gate 4', 'Meredith Hale signs Check #10045', 'EMP-0007 · CFO · $500,000 limit', 'Pays from Operating #8801 (101100), never Payroll/Petty #4409.', 'Approve check'],
];
export const REFUSALS = {
  AI_STEWARD_ZERO_AUTHORITY: {status: 403, text: 'KAL has $0.00 signing authority.'},
  DOA_LIMIT_EXCEEDED: {status: 403, text: 'Darius must escalate the $23,120 request to Devon.'},
  SOX_SOD_VIOLATION: {status: 403, text: 'The buyer cannot receive their own purchase.'},
  MATCH_VARIANCE_HOLD: {status: 409, text: 'Invoice variance held. No payment may advance.'},
  BANK_POLICY_VIOLATION: {status: 403, text: 'Payroll/Petty #4409 cannot fund this payment.'},
};
const TRAPS = {
  kal: {step: 3, actor: 'EMP-AI-KAL', code: 'AI_STEWARD_ZERO_AUTHORITY'},
  doa: {step: 3, actor: 'EMP-0021', code: 'DOA_LIMIT_EXCEEDED'},
  sod: {step: 6, actor: 'EMP-0002', barcode: REELS[0], code: 'SOX_SOD_VIOLATION'},
  invoice: {step: 7, actor: 'EMP-0001', invoiceDeltaUsd: 500, code: 'MATCH_VARIANCE_HOLD'},
  bank: {step: 8, actor: 'EMP-0007', bankAccount: '101200', code: 'BANK_POLICY_VIOLATION'},
};
const PROBE_LABELS = {kal: 'KAL signs with a $0 limit', doa: 'Darius signs above $20k', sod: 'Buyer receives own PO at the dock', invoice: 'Invoice +$500 variance', bank: 'Check from Payroll/Petty #4409'};
const TRIAL_BALANCE = ['121100', '201200', '201100', '501900', '101100', '101200'];
const CREDIT_NORMAL = new Set(['201200', '201100']);
const MAX_JOURNAL_ROWS = 40;
let state = null, connected = false, pending = false, epoch = 0, muted = false;
let recorder = null, recordingPending = false, recordingResources = [], audioContext = null, recordingTimer = null;
let voiceController = null, voiceAudio = null, voiceUrl = null, voiceEpoch = 0;
let listening = false, recognition = null, micRecorder = null, micStream = null, micPending = false;
let refreshTimer = null, disposed = false, recordingEpoch = 0, transcriptionController = null;
let steward = false, beepContext = null, wedge = '', wedgeAt = 0;
const probeLog = new Map();
const $ = id => globalThis.document?.getElementById(id);
const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(value) : '—';
const feet = value => new Intl.NumberFormat('en-US').format(value);
const completedSteps = snapshot => snapshot.steps.filter(step => step.status === 'complete').length;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = value => typeof value === 'string' && value ? value : null;
const cents = value => Math.round(value * 100);
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
  if (result.match != null && (!object(result.match) || (result.match.varianceUsd !== undefined && !amount(result.match.varianceUsd)))) invalid();
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
  catch { throw new Error(`HTTP ${response.status}: expected JSON from the P2P server.`); }
  if (!response.ok || data?.ok === false) {
    const code = data?.code ?? data?.error?.code ?? (typeof data?.error === 'string' ? data.error : 'REQUEST_REFUSED');
    const message = data?.message ?? data?.error?.message ?? REFUSALS[code]?.text ?? 'Request refused by server.';
    throw Object.assign(new Error(`${code}: ${message}`), {code, status: response.status});
  }
  return data;
}

function accept(value) {
  const before = state && [completedSteps(state), state.scans.length], next = validateState(value);
  // A reset starts a new run: the last RF read belongs to the old one.
  if (before && completedSteps(next) < before[0]) rfLast = null;
  state = next; connected = true; render(state);
  // Once started, KAL narrates each server-confirmed advance: a step, a dock reel, or a reset.
  const after = [completedSteps(state), state.scans.length];
  if (steward && before && (after[0] !== before[0] || after[1] !== before[1])) {
    void speak(after[0] < before[0] ? `Queue reset. ${briefing()}` : after[0] === before[0] ? stewardReply('dock', state) : briefing());
  }
}
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
    status(`Disconnected · ${error.message} Start the local P2P server and refresh.`, true);
  }
}

export async function runStep(step, actor, extra = {}) {
  if (!connected || !state) throw new Error('Connect to the P2P server before authorizing a step.');
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
    const copy = node('div'); copy.append(node('strong', name), node('small', detail));
    row.append(node('span', icon, 'system-icon'), copy, node('span', 'UNKNOWN', 'system-status tag')); $('systems').append(row);
  }
  for (const [, name, role, limit] of OFFICERS) {
    const row = node('tr'), copy = node('td', name); copy.append(node('small', role)); row.append(copy, node('td', limit)); $('authority').tBodies[0].append(row);
  }
  for (const [name, {code}] of Object.entries(TRAPS)) {
    const row = node('tr'); row.dataset.probe = name;
    row.append(node('td', PROBE_LABELS[name]), node('td', `${REFUSALS[code].status} ${code}`), node('td', 'Not run', 'observed'));
    $('guardrail-log').append(row);
  }
}

// Sums server journal legs by full account and by 6-digit GL code, in integer cents. Null without a journal.
export function trialBalance(snapshot) {
  const report = snapshot?.journal;
  if (!report) return null;
  const accounts = new Map(), codes = new Map(), legs = [];
  let debit = 0, credit = 0;
  for (const entry of report.entries) for (const leg of entry.legs) {
    const d = cents(leg.debitUsd), c = cents(leg.creditUsd), code = leg.account.match(/\d{6}/)?.[0] ?? 'other';
    legs.push({account: leg.account, memo: String(entry.memo ?? ''), debit: d, credit: c});
    for (const [map, key] of [[accounts, leg.account], [codes, code]]) { const sum = map.get(key) ?? {debit: 0, credit: 0}; sum.debit += d; sum.credit += c; map.set(key, sum); }
    debit += d; credit += c;
  }
  return {report, accounts, codes, legs, debit, credit, balanced: report.balanced && debit === credit};
}

// Voice steward intents. Write verbs come first: KAL answers them with its $0.00 limit and never calls the server.
const INTENTS = [
  ['refuse', /\b(approve|authori[sz]e|sign|pay|release|post|override|wire|cut|scan|receive|lock|escalate|transfer|delete|reset\s+(the\s+)?(queue|run|workflow|demo)|issue\s+(the\s+|a\s+)?(po|purchase order|check|payment))\b/i],
  ['check', /\b(the check|check\s*#?\s*10045|10045|payment|paid|settle\w*|cfo|disburse\w*)\b/i],
  ['invoice', /\b(invoice|ocr|rapidocr|box(es)?|three[- ]way|3[- ]way|match)\b/i],
  ['dock', /\b(dock|scan\w+|reels?|barcodes?|receiv\w+|rf)\b/i],
  ['ledger', /\b(ledger|trial balance|balanced?|journal|gl|debits?|credits?)\b/i],
  ['governance', /\b(sox|governance|guardrails?|refus\w*|probes?|controls?)\b/i],
];
export const stewardIntent = text => INTENTS.find(([, pattern]) => pattern.test(String(text ?? '')))?.[0] ?? 'status';

const NEXT_LINES = ['Query stock', 'Darius must confirm and escalate the need', 'VP Devon must approve the request', 'Purchasing may lock the COMEX spot rate', 'Purchasing may issue the purchase order', 'Marcus must scan four unique GS1 reels', 'Run invoice OCR and the three-way match', 'CFO Meredith must authorize Check number 10045', 'The server reports all eight steps complete'];
// What KAL says for an intent, from a validated snapshot only (null when disconnected). Read-only.
export function stewardReply(intent, snapshot) {
  if (!snapshot) return 'I am KAL, your zero-authority P2P steward. The P2P server is disconnected. I cannot confirm stock, ledger balances, or approvals.';
  const completed = completedSteps(snapshot), scans = snapshot.scans;
  const match = isObject(snapshot.match) ? snapshot.match : null, payment = snapshot.payment;
  switch (intent) {
    case 'refuse': {
      const who = completed < 8 ? officer(ACTORS[completed + 1]) ?? 'the system stock query' : null;
      return `I cannot do that. My signing limit is zero dollars and I hold no write credentials. ${who ? `Step ${completed + 1} needs ${who} at the step card.` : 'All eight steps are already complete.'} Human officers authorize every checkpoint.`;
    }
    case 'dock': {
      const remaining = REELS.filter(reel => !scans.some(scan => scan.barcode === reel)).map(reel => reel.slice(-3));
      const next = !remaining.length ? 'The dock receipt is complete.' : completed >= 5 ? `Marcus Vance must scan ${remaining.join(', ')}.` : 'Dock scanning opens at step 6.';
      return `${scans.length} of 4 reels received, ${feet(scans.length * 2000)} of 8,000 feet. ${next}`;
    }
    case 'invoice': {
      if (!match) return 'The invoice is not matched yet. Duncan Vance runs the RapidOCR three-way match at step 7.';
      const ocr = snapshot.ocr, tagged = ocr ? tagOcrFields(ocr).filter(field => field.indices.length).length : 0;
      return `Three-way match cleared at ${money(match.varianceUsd ?? 0)} variance. ${ocr ? `RapidOCR read ${ocr.boxes.length} boxes and tagged ${tagged} of 5 invoice fields.` : 'This run matched PO-derived invoice fields without pixel OCR.'}`;
    }
    case 'check':
      if (payment) return `${payment.check} paid ${money(payment.amountUsd)} to ${str(snapshot.vendor) ?? 'Encore Wire Corporation'} from ${str(payment.bankLabel) ?? 'Operating #8801'}.`;
      return completed === 7 ? `Check #10045 for ${money(snapshot.po?.totalUsd)} is drafted. Meredith Hale, CFO, must sign it.` : 'Check #10045 is drafted only after the three-way match at step 7.';
    case 'ledger': {
      const book = trialBalance(snapshot), usd = value => money(value / 100);
      return book.balanced ? `The journal is balanced. Debits ${usd(book.debit)} equal credits ${usd(book.credit)} across ${book.legs.length} postings.` : `The journal is not balanced: debits ${usd(book.debit)} against credits ${usd(book.credit)}. Payments stay on hold.`;
    }
    case 'governance':
      return 'Five server refusals guard this flow: my zero authority, delegation of authority, segregation of duties, the three-way match hold, and the disbursement bank policy. The SOX view shows each probe result.';
    default:
      return `${completed} of 8 steps confirmed. ${NEXT_LINES[completed]}. My signing limit is zero dollars. Human officers authorize every checkpoint.`;
  }
}

// RF guns prefix an AIM symbology id (]C1, ]Q3 …) and end with CR, LF or Tab; GS1-128 may carry FNC1 as GS (0x1D).
// Mirrors the server's NO_BARCODE / UNKNOWN_REEL / DUPLICATE_SCAN refusals so a bad read never becomes a write.
export function parseReelScan(raw, scans = []) {
  const code = String(raw ?? '').replace(/^\s*\][A-Za-z][0-9A-Za-z]/, '').replace(/[\s\x00-\x1f]+/g, '').toUpperCase();
  if (!code) return {code, error: 'NO_BARCODE'};
  if (!REELS.includes(code)) return {code, error: 'UNKNOWN_REEL'};
  if (scans.some(scan => scan.barcode === code)) return {code, error: 'DUPLICATE_SCAN'};
  return {code, error: null};
}

// The five INV-25800 fields the three-way match reads, found among the server's RapidOCR boxes. Like the sidecar parser,
// labels allow missing spaces between words ("TOTALDUEUSD:21600.00") and an ASCII or full-width colon.
const OCR_FIELDS = [
  ['vendor', 'Vendor', /^VENDOR(?!\s*OA\b)\b/i], ['po', 'PO #', /^PURCHASE\s*ORDER\b/i], ['quantity', 'Quantity FT', /^QUANTITY(\s*FT)?\b/i],
  ['unit', 'Unit price USD', /^UNIT\s*PRICE(\s*USD)?\b/i], ['total', 'Total due USD', /^TOTAL\s*DUE(\s*USD)?\b/i],
];
export function tagOcrFields(ocr) {
  const boxes = Array.isArray(ocr?.boxes) ? ocr.boxes : [], middle = box => box.y + box.height / 2;
  return OCR_FIELDS.map(([key, label, pattern]) => {
    const index = boxes.findIndex(box => pattern.test(box.text.trim()));
    if (index < 0) return {key, label, indices: [], value: null};
    const box = boxes[index], inline = box.text.trim().replace(pattern, '').replace(/^[\s:：#]+/, '').trim();
    if (inline) return {key, label, indices: [index], value: inline};
    // RapidOCR can split "LABEL:" and its value into two boxes on one line: take the nearest box to the right.
    const right = boxes.map((other, i) => [other, i])
      .filter(([other, i]) => i !== index && other.x >= box.x + box.width / 2 && Math.abs(middle(other) - middle(box)) < box.height / 2)
      .sort(([a], [b]) => a.x - b.x)[0];
    return {key, label, indices: right ? [index, right[1]] : [index], value: right ? right[0].text.trim() : null};
  });
}

// Check face legal line, e.g. 21600 -> "Twenty-one thousand six hundred and 00/100 dollars".
export function checkWords(amount) {
  if (!Number.isFinite(amount) || amount < 0 || amount >= 1e12) return '—';
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const hundreds = n => [n >= 100 && `${ones[Math.floor(n / 100)]} hundred`, n % 100 && (n % 100 < 20 ? ones[n % 100] : tens[Math.floor(n % 100 / 10)] + (n % 10 ? `-${ones[n % 10]}` : ''))].filter(Boolean).join(' ');
  const total = cents(amount), dollars = Math.floor(total / 100), parts = [];
  for (const [scale, name] of [[1e9, ' billion'], [1e6, ' million'], [1e3, ' thousand'], [1, '']]) {
    const chunk = Math.floor(dollars / scale) % 1000;
    if (chunk) parts.push(hundreds(chunk) + name);
  }
  const text = parts.join(' ') || 'zero';
  return `${text[0].toUpperCase()}${text.slice(1)} and ${String(total % 100).padStart(2, '0')}/100 dollars`;
}

function renderLedger(snapshot) {
  const book = trialBalance(snapshot), usd = value => money(value / 100);
  const pill = $('gaap-pill');
  pill.textContent = !book || !connected ? 'GAAP · awaiting server' : book.balanced ? 'GAAP DR == CR' : 'GAAP DR ≠ CR · HOLD';
  pill.classList.toggle('ok', Boolean(book && connected && book.balanced)); pill.classList.toggle('bad', Boolean(book && !book.balanced));
  const label = !book ? 'AWAITING LEDGER' : !book.balanced ? 'UNBALANCED · HOLD' : book.legs.length ? 'DR = CR · BALANCED' : 'NO POSTINGS';
  setText('ledger-balance', label); setText('lens-ledger', label);
  $('ledger-balance').classList.toggle('ok', Boolean(book?.balanced)); $('ledger-balance').classList.toggle('bad', Boolean(book && !book.balanced));
  // Trial balance: net balance per account on its debit or credit side.
  let tbDebit = 0, tbCredit = 0, other = 0;
  const net = sum => sum ? sum.debit - sum.credit : 0;
  for (const [code, sum] of book?.codes ?? []) if (!TRIAL_BALANCE.includes(code)) other += net(sum);
  const fill = (row, value) => {
    // cells[0] is the account <th>; debit and credit follow.
    row.cells[1].textContent = !book ? '—' : value > 0 ? usd(value) : '—';
    row.cells[2].textContent = !book ? '—' : value < 0 ? usd(-value) : '—';
    if (value > 0) tbDebit += value; else tbCredit -= value;
  };
  for (const row of document.querySelectorAll('#trial-balance [data-account]')) fill(row, net(book?.codes.get(row.dataset.account)));
  $('tb-other').hidden = !other; fill($('tb-other'), other);
  setText('tb-debit', book ? usd(tbDebit) : '—'); setText('tb-credit', book ? usd(tbCredit) : '—');
  // Compact book view: assets debit-normal, liabilities credit-normal.
  for (const cell of document.querySelectorAll('[data-book]')) {
    const value = net(book?.codes.get(cell.dataset.book));
    cell.textContent = book ? usd((CREDIT_NORMAL.has(cell.dataset.book) ? -value : value) || 0) : '—'; // || 0 avoids "-$0.00"
  }
  // GL account register (view 2) and posting journal (drawer).
  const register = $('gl-register'); register.replaceChildren();
  for (const [account, sum] of book?.accounts ?? []) {
    const row = node('tr'), cell = node('td', account); cell.title = account;
    row.append(cell, node('td', sum.debit ? usd(sum.debit) : '—'), node('td', sum.credit ? usd(sum.credit) : '—')); register.append(row);
  }
  const journal = $('journal'); journal.replaceChildren();
  const empty = message => { const row = node('tr'), cell = node('td', message, 'empty'); cell.colSpan = 3; row.append(cell); return row; };
  if (!book?.accounts.size) register.append(empty(book ? 'No journal entries posted.' : 'Connect the ledger to see real postings.'));
  if (!book?.legs.length) journal.append(empty(book ? 'No journal entries posted.' : 'Connect the ledger to see real postings.'));
  for (const leg of book?.legs.slice(0, MAX_JOURNAL_ROWS) ?? []) {
    const row = node('tr'), cell = node('td'); cell.title = `${leg.account} · ${leg.memo}`; cell.append(node('strong', leg.account), node('small', leg.memo));
    row.append(cell, node('td', leg.debit ? usd(leg.debit) : '—'), node('td', leg.credit ? usd(leg.credit) : '—')); journal.append(row);
  }
  if (book?.legs.length > MAX_JOURNAL_ROWS) journal.append(empty(`${book.legs.length - MAX_JOURNAL_ROWS} more postings included in totals`));
  setText('debit-total', book ? usd(book.debit) : '—'); setText('credit-total', book ? usd(book.credit) : '—');
  const audit = snapshot?.audit;
  setText('audit-status', audit?.valid === true ? `Audit chain: valid · ${Number(audit.length) || 0} hash-linked events` : audit?.valid === false ? 'Audit chain: BROKEN · server reports a tampered event' : 'Audit chain: not reported by server');
}

function renderCard(snapshot, completed, active) {
  const run = $('run-step');
  $('card-gate').classList.remove('gate');
  if (!snapshot) {
    setText('card-step', 'Step — / 8'); setText('card-gate', '—'); setText('card-title', 'Connect to the P2P server');
    setText('card-actor', '—'); setText('card-detail', 'The server owns every approval, stock count and posting.');
    run.textContent = 'Authorize step'; run.disabled = true; return;
  }
  if (completed === 8) {
    setText('card-step', '8 / 8 complete'); setText('card-gate', 'Settled');
    setText('card-title', `PO-25800 settled · ${snapshot.payment?.check ?? 'Check'} ${snapshot.payment?.stamp ?? ''}`.trim());
    setText('card-actor', 'Server confirmed all eight steps'); setText('card-detail', 'Reset Queue starts a clean run with fresh human approvals.');
    run.textContent = 'Complete'; run.disabled = true; return;
  }
  const step = completed + 1, [gate, title, actor, detail, action] = STEP_CARDS[step - 1];
  setText('card-step', `Step ${step} / 8`); setText('card-gate', gate); $('card-gate').classList.toggle('gate', CHECKPOINTS.has(step));
  setText('card-title', title); setText('card-actor', actor); setText('card-detail', detail);
  run.dataset.run = String(step); run.textContent = action; run.disabled = !active;
}

export function render(snapshot) {
  if (!globalThis.document) return;
  const active = connected && !pending;
  const completed = snapshot ? snapshot.steps.filter(step => step.status === 'complete').length : null;
  const connection = $('connection'); connection.classList.toggle('online', connected); connection.replaceChildren(node('i'), document.createTextNode(connected ? 'SERVER CONNECTED' : 'DISCONNECTED'));
  setText('progress-label', snapshot ? `${completed} / 8 COMPLETE` : '— / 8 COMPLETE');
  setText('nav-step', snapshot ? (completed === 8 ? 'Step 8/8 ✓' : `Step ${completed + 1}/8`) : 'Step —/8');
  setText('actual-total', money(snapshot?.po?.totalUsd));
  setText('spot-detail', snapshot?.po?.unitUsd !== undefined ? `${money(snapshot.po.unitUsd)} / FT · ${snapshot.po.comex?.live ? 'live COMEX' : 'offline reference'}` : 'Awaiting COMEX price lock');
  const ppv = snapshot?.po?.totalUsd === undefined || snapshot.item.stdTotalUsd === undefined ? null : snapshot.po.totalUsd - snapshot.item.stdTotalUsd;
  setText('std-total', money(snapshot?.item?.stdTotalUsd));
  const posted = Boolean(snapshot) && snapshot.steps[5].status === 'complete';
  setText('ppv', ppv === null ? '—' : money(ppv)); setText('ppv-detail', ppv === null ? '501900 · awaiting actual cost' : `501900 · ${ppv <= 0 ? 'favorable' : 'unfavorable'} vs standard · ${posted ? 'posted at dock receipt' : 'projected until dock receipt'}`);
  $('ppv').classList.toggle('bad', ppv > 0); $('ppv').classList.toggle('good', ppv !== null && ppv <= 0);
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
  for (const item of document.querySelectorAll('[data-step]')) {
    const step = Number(item.dataset.step), done = snapshot && step <= completed, current = snapshot && step === completed + 1;
    item.classList.toggle('done', Boolean(done)); item.classList.toggle('current', Boolean(current));
    item.querySelector('.step-state').textContent = done ? '✓ DONE' : snapshot?.steps[step - 1].status === 'in_progress' ? 'IN PROGRESS' : CHECKPOINTS.has(step) ? 'HUMAN GATE' : 'WAITING';
  }
  renderCard(snapshot, completed, active);
  renderRf(snapshot);
  renderCheck(snapshot, completed, active);
  for (const button of document.querySelectorAll('[data-trap]')) button.disabled = !active;
  $('reset').disabled = !active || Boolean(recorder) || recordingPending; $('refresh').disabled = pending;
  setText('settlement', snapshot?.payment?.stamp === 'PAID' ? `PAID · ${snapshot.payment.check}` : 'Awaiting CFO approval');
  renderLedger(snapshot);
  for (const link of document.querySelectorAll('[data-document]')) {
    const doc = snapshot?.documents?.find(doc => doc.name === link.dataset.document), url = safeDocumentUrl(doc?.url);
    if (url) { link.href = url; link.removeAttribute('aria-disabled'); } else { link.removeAttribute('href'); link.setAttribute('aria-disabled', 'true'); }
  }
  // A packet is ready when its server step is complete; served PDFs only add the link marker.
  for (const item of document.querySelectorAll('[data-packet]')) {
    const [step, names] = PACKETS[item.dataset.packet], done = Boolean(snapshot) && snapshot.steps[step - 1].status === 'complete';
    const served = names.length && names.every(name => document.querySelector(`[data-document="${name}"][href]`));
    const value = !done ? 'PENDING' : item.dataset.packet === 'check' ? (snapshot.payment?.stamp === 'PAID' ? 'PAID' : 'POSTED') : served ? 'PDF ↗' : 'POSTED';
    item.classList.toggle('ready', done); item.querySelector('.packet-state').textContent = value;
  }
  const ocr = snapshot?.ocr, available = Boolean(ocr?.boxes?.length && safeDocumentUrl(ocr.imageUrl));
  const tagged = ocr ? tagOcrFields(ocr).filter(field => field.indices.length).length : 0;
  $('open-ocr').disabled = !available; setText('ocr-count', ocr ? `${ocr.boxes.length} server boxes · ${tagged} / 5 match fields tagged${ocr.boxes.length < 28 ? ' · incomplete evidence' : ''}` : 'Awaiting pixel OCR evidence');
  if ($('ocr-dialog').open) renderOcr(snapshot?.ocr);
}

// Dock RF scanner: reel buttons, wedge input, received feet and the last read. Feet and pounds come from server scans.
let rfLast = null;
const progressKey = snapshot => snapshot ? `${completedSteps(snapshot)}:${snapshot.scans.length}` : '';
function renderRf(snapshot) {
  const scans = snapshot?.scans ?? [], completed = snapshot ? completedSteps(snapshot) : null, scanning = connected && !pending && completed === 5;
  setText('scan-count', `${scans.length} / 4 reels`);
  $('barcode').disabled = !scanning;
  for (const button of document.querySelectorAll('[data-reel]')) {
    const scan = scans.find(scan => scan.barcode === button.dataset.reel), at = Date.parse(scan?.at);
    button.classList.toggle('scanned', Boolean(scan)); button.disabled = !scanning || Boolean(scan);
    button.title = scan ? `${scan.barcode} · 2,000 FT received${str(scan.actor) ? ` by ${scan.actor}` : ''}${Number.isNaN(at) ? '' : ` at ${new Date(at).toLocaleTimeString()}`}` : `${button.dataset.reel} · awaiting RF scan`;
  }
  $('rf-meter').value = scans.length * 2000;
  setText('rf-feet', `${feet(scans.length * 2000)} / 8,000 FT · ${feet(scans.length * LBS_PER_REEL)} lbs Cu`);
  const last = rfLast?.key === progressKey(snapshot) ? rfLast : null;
  setText('rf-last', last?.text ?? (!snapshot ? 'RF offline' : completed > 5 ? 'Dock receipt posted · 4 / 4 reels' : scanning ? 'RF ready · scan a reel; the wedge reads anywhere on screen' : completed === 5 ? 'RF waiting for the server' : 'RF idle · dock opens at Step 6'));
  $('rf-last').dataset.tone = last?.tone ?? '';
}
function beep(ok) {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (muted || !Context) return;
  try {
    beepContext ??= new Context();
    const tone = beepContext.createOscillator(), gain = beepContext.createGain();
    tone.frequency.value = ok ? 1760 : 220; gain.gain.value = 0.04;
    tone.connect(gain).connect(beepContext.destination); tone.start(); tone.stop(beepContext.currentTime + (ok ? 0.08 : 0.25));
  } catch { /* audio feedback is optional */ }
}
function scan(raw) {
  const {code, error} = parseReelScan(raw, state?.scans);
  const report = (tone, text) => { rfLast = {tone, text, key: progressKey(state)}; renderRf(state); beep(tone === 'ok'); };
  if (error) { report('bad', `✕ ${error} · ${code || 'empty read'}`); status(`RF read refused before any write: ${error}${code ? ` (${code})` : ''}.`, true); return; }
  runStep(6, ACTORS[6], {barcode: code}).then(
    () => report('ok', `✓ ${code.slice(-3)} received · 2,000 FT · ${officer(ACTORS[6])}`),
    failure => { report('bad', `✕ ${failure.code ?? 'NOT SENT'} · ${code}`); status(failure.message, true); });
}

// CFO check view: a draft until the server reports the payment; the face reads only server state.
function renderCheck(snapshot, completed, active) {
  const payment = snapshot?.payment, match = isObject(snapshot?.match) ? snapshot.match : null;
  const amount = payment?.amountUsd ?? snapshot?.po?.totalUsd;
  $('check-face').dataset.stamp = payment ? 'paid' : 'draft';
  setText('check-stamp', payment ? 'PAID' : completed === 7 ? 'AWAITING CFO' : 'DRAFT');
  setText('check-no', str(payment?.check) ?? 'Check #10045');
  setText('check-payee', str(snapshot?.vendor) ?? 'Encore Wire Corporation');
  setText('check-amount', money(amount));
  setText('check-words', amount === undefined ? 'Amount set by the PO-25800 COMEX price lock' : checkWords(amount));
  setText('check-bank', `Drawn on ${str(payment?.bankLabel) ?? 'Operating #8801'} · ${str(payment?.bankAccount) ?? '101100'}`);
  setText('check-ach', payment ? `ACH ${str(payment.ach) ?? '—'}` : 'ACH trace issued on payment');
  setText('check-signer', payment ? `${officer(payment.approvedBy) ?? str(payment.approvedBy) ?? 'CFO'} · CFO` : 'Awaiting Meredith Hale · CFO');
  setText('check-match', match ? `${str(match.po) ?? 'PO'} = ${str(match.bol) ?? 'BOL'} = ${str(match.invoice) ?? 'INV'} · ${money(match.varianceUsd ?? 0)} variance · ${str(match.source) ?? 'server'}` : 'Pending the Step 7 three-way match');
  setText('check-journal', `${payment ? 'Posted' : 'Posts on signature'} · DR 201100 Trade AP / CR 101100 Operating #8801`);
  $('sign-check').disabled = !(active && completed === 7);
}
function openCheck() { if (!$('check-dialog').open) $('check-dialog').showModal(); }

let ocrSelected = -1, ocrDrawn = null;
function renderOcr(ocr) {
  if (!ocr || !safeDocumentUrl(ocr.imageUrl)) { $('ocr-dialog').close(); ocrDrawn = null; return; }
  // Polls re-render while the viewer is open: rebuild only when the evidence changes, so focus and selection hold.
  const drawn = `${ocr.imageUrl}|${ocr.sha256 ?? ''}|${ocr.width}x${ocr.height}|${ocr.boxes.map(box => `${box.x},${box.y},${box.width},${box.height},${box.text}`).join(';')}`;
  if (drawn === ocrDrawn) { selectOcrBox(ocr, ocrSelected, false); return; }
  ocrDrawn = drawn;
  const image = $('ocr-image'); if (image.getAttribute('src') !== ocr.imageUrl) image.src = safeDocumentUrl(ocr.imageUrl);
  setText('ocr-summary', `${ocr.boxes.length} extracted fields · ${ocr.width} × ${ocr.height} source pixels${ocr.boxes.length < 28 ? ' · fewer than 28 expected boxes' : ''}`);
  const fields = tagOcrFields(ocr), tagged = new Map(fields.flatMap(field => field.indices.map(index => [index, field.key])));
  const layer = $('ocr-boxes'); layer.replaceChildren();
  for (const [index, box] of ocr.boxes.entries()) {
    const tag = node('button', undefined, 'ocr-box'); tag.title = `${index + 1}: ${box.text}`; tag.setAttribute('aria-label', tag.title); tag.dataset.index = String(index);
    if (tagged.has(index)) { tag.classList.add('field'); tag.dataset.field = tagged.get(index); }
    Object.assign(tag.style, {left: `${100 * box.x / ocr.width}%`, top: `${100 * box.y / ocr.height}%`, width: `${100 * box.width / ocr.width}%`, height: `${100 * box.height / ocr.height}%`}); layer.append(tag);
  }
  const list = $('ocr-fields'); list.replaceChildren();
  for (const field of fields) {
    const button = node('button', undefined, 'ocr-field'), item = node('li');
    button.disabled = !field.indices.length; button.dataset.index = String(field.indices.at(-1) ?? -1);
    button.append(node('span', field.label, 'label'), node('strong', field.value ?? 'Not found in the OCR boxes'));
    item.append(button); list.append(item);
  }
  selectOcrBox(ocr, ocrSelected < ocr.boxes.length ? ocrSelected : -1, false);
}
function selectOcrBox(ocr, index, reveal = true) {
  ocrSelected = index;
  for (const tag of $('ocr-boxes').children) tag.classList.toggle('selected', Number(tag.dataset.index) === index);
  const box = ocr?.boxes[index];
  if (!box) { setText('ocr-selected', 'Select a box or a match field to read its text, confidence and pixel position.'); return; }
  const confidence = typeof box.confidence === 'number' && Number.isFinite(box.confidence) ? ` · confidence ${box.confidence.toFixed(3)}` : '';
  setText('ocr-selected', `Box ${index + 1}: “${box.text}”${confidence} · x ${box.x}, y ${box.y} · ${box.width} × ${box.height} px`);
  if (reveal) $('ocr-boxes').children[index]?.scrollIntoView({block: 'center', inline: 'nearest'});
}
function openOcr() {
  if ($('open-ocr').disabled) return;
  ocrSelected = -1; ocrDrawn = null; renderOcr(state.ocr);
  if (!$('ocr-dialog').open) $('ocr-dialog').showModal();
}

function renderProbes() {
  for (const [name, {tone, text}] of probeLog) {
    const cell = document.querySelector(`[data-probe="${name}"] .observed`), lens = document.querySelector(`[data-lens="${name}"] .lens-state`);
    for (const target of [cell, lens]) { if (!target) continue; target.textContent = text; target.classList.toggle('ok', tone === 'ok'); target.classList.toggle('bad', tone === 'bad'); target.classList.toggle('warn', tone === 'warn'); }
  }
}

function setView(name) {
  document.body.dataset.view = name;
  for (const panel of document.querySelectorAll('[data-view-panel]')) panel.hidden = panel.dataset.viewPanel !== name;
  for (const button of document.querySelectorAll('.views [data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === name));
}

const briefing = () => stewardReply('status', connected ? state : null);
// Read-only moves a voice intent may make: open a view or viewer. None of them writes.
const STEWARD_MOVES = {
  check: openCheck,
  invoice: openOcr,
  dock: () => setView('flow'),
  ledger: () => setView('registers'),
  governance: () => setView('sox'),
};
function stopVoice() {
  ++voiceEpoch; voiceController?.abort(); voiceController = null; voiceAudio?.pause(); voiceAudio = null;
  if (voiceUrl) URL.revokeObjectURL(voiceUrl); voiceUrl = null; globalThis.speechSynthesis?.cancel();
}
export async function speak(text) {
  if (disposed) return 'cancelled';
  stopVoice(); const token = voiceEpoch;
  text = String(text).slice(0, 1500); setText('kal-line', text);
  if (muted) return 'muted';
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
  if (!heard) { status('No speech detected. Hold Ask KAL and try again.'); return; }
  setText('kal-line', `Heard: “${heard}”`);
  status(`Heard: “${heard}” · voice cannot approve, reset or move funds.`);
  const intent = stewardIntent(heard);
  if (connected && state) STEWARD_MOVES[intent]?.();
  void speak(`I heard your request. ${stewardReply(intent, connected ? state : null)}`);
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
      } catch (error) { if (!disposed) status(`${error.message}. Speak directly or use the step card.`, true); }
      finally { clearTimeout(timer); if (transcriptionController === controller) transcriptionController = null; }
    };
    micRecorder.start(); status('Listening · release Ask KAL to send audio to the local Scribe proxy.');
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
  recorder = null; $('record')?.classList.remove('recording'); setText('record-label', 'Record');
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
        link.href = URL.createObjectURL(new Blob(chunks, {type: mimeType})); link.download = `zerosaas-p2p-demo-${Date.now()}.webm`; link.hidden = false; link.click();
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
    probeLog.set(name, {tone: 'bad', text: 'ACCEPTED · guardrail failure'});
    status(`GUARDRAIL FAILURE: ${code} was expected but the server accepted the probe. Inspect the server ledger.`, true);
  } catch (error) {
    const blocked = error.code === code && error.status === REFUSALS[code].status;
    probeLog.set(name, blocked ? {tone: 'ok', text: `BLOCKED · HTTP ${error.status}`} : {tone: 'warn', text: `Inconclusive · ${error.code ?? 'network'}`});
    status(blocked ? `PROBE BLOCKED · HTTP ${error.status} ${error.message}` : `Probe inconclusive · expected ${code}; received ${error.message}`, error.code !== code);
  } finally {
    renderProbes();
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
  const authorize = step => void runStep(step, ACTORS[step]).catch(error => status(error.message, true));
  $('refresh').addEventListener('click', () => void refresh());
  $('run-step').addEventListener('click', () => { const step = Number($('run-step').dataset.run); if (step === 6) scan($('barcode').value); else authorize(step); });
  for (const button of document.querySelectorAll('[data-reel]')) button.addEventListener('click', () => scan(button.dataset.reel));
  $('barcode').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!event.repeat) scan($('barcode').value); } });
  // Keyboard-wedge RF guns type a burst then Enter. At Step 6 a burst typed outside any field still scans.
  // Capture phase: a burst's Enter is consumed here, before a focused button (e.g. Ask KAL) can act on it.
  // A read while a scan is pending still reaches scan(), which reports it as NOT SENT instead of dropping it.
  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || !connected || !state || completedSteps(state) !== 5 || event.target.closest?.('input, textarea, select, dialog')) return;
    const burst = event.timeStamp - wedgeAt < 120;
    if (event.key === 'Enter' && wedge && burst) { event.preventDefault(); event.stopPropagation(); const raw = wedge; wedge = ''; scan(raw); return; }
    if (event.key.length !== 1) return;
    wedge = ((burst ? wedge : '') + event.key).slice(-64); wedgeAt = event.timeStamp;
  }, {capture: true});
  $('open-check').addEventListener('click', openCheck);
  $('sign-check').addEventListener('click', () => authorize(8));
  $('ocr-boxes').addEventListener('click', event => { const tag = event.target.closest('.ocr-box'); if (tag) selectOcrBox(state?.ocr, Number(tag.dataset.index), false); });
  $('ocr-fields').addEventListener('click', event => { const field = event.target.closest('.ocr-field'); if (field && !field.disabled) selectOcrBox(state?.ocr, Number(field.dataset.index)); });
  for (const button of document.querySelectorAll('[data-trap]')) button.addEventListener('click', () => void probe(button.dataset.trap));
  for (const button of document.querySelectorAll('.views [data-view]')) button.addEventListener('click', () => setView(button.dataset.view));
  const dialogs = [['reset', 'reset-dialog'], ['open-guardrails', 'guardrail-dialog'], ['open-ledger', 'ledger-dialog']];
  for (const [opener, dialog] of dialogs) $(opener).addEventListener('click', () => $(dialog).showModal());
  for (const [closer, dialog] of [['cancel-reset', 'reset-dialog'], ['close-guardrails', 'guardrail-dialog'], ['close-ledger', 'ledger-dialog'], ['cancel-record', 'record-dialog'], ['close-ocr', 'ocr-dialog'], ['close-check', 'check-dialog']]) $(closer).addEventListener('click', () => $(dialog).close());
  $('confirm-reset').addEventListener('click', () => void resetWorkflow());
  $('open-ocr').addEventListener('click', openOcr);
  $('ocr-image').addEventListener('error', () => { $('ocr-dialog').close(); status('Invoice image could not be loaded. Check the server OCR artifact.', true); });
  // Start KAL opens a steward session: KAL then narrates each server-confirmed advance until the page closes.
  $('kal-speak').addEventListener('click', () => { steward = true; $('kal-speak').setAttribute('aria-pressed', 'true'); void speak(briefing()); });
  $('kal-mute').addEventListener('click', () => {
    muted = !muted; if (muted) stopVoice();
    $('kal-mute').setAttribute('aria-pressed', String(muted)); setText('kal-mute', `KAL Voice: ${muted ? 'Off' : 'On'}`);
  });
  const mic = $('kal-mic');
  mic.addEventListener('pointerdown', event => { event.preventDefault(); mic.setPointerCapture(event.pointerId); void startListening(); });
  mic.addEventListener('pointerup', stopListening); mic.addEventListener('pointercancel', stopListening); mic.addEventListener('lostpointercapture', stopListening);
  // Auto-repeat Space/Enter is swallowed too, so a held key never leaks into a field a voice reply focuses.
  mic.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) void startListening(); } });
  mic.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stopListening(); } });
  globalThis.addEventListener('blur', stopListening);
  // Recording is consent-gated: the first click explains capture; only the confirm button starts it.
  $('record').addEventListener('click', () => { if (recorder) stopRecording(); else $('record-dialog').showModal(); });
  $('confirm-record').addEventListener('click', () => { $('record-dialog').close(); void startRecording(); });
  globalThis.addEventListener('pagehide', () => { disposed = true; ++epoch; transcriptionController?.abort(); clearInterval(refreshTimer); stopVoice(); stopListening(); stopRecording(); void beepContext?.close().catch(() => {}); for (const stream of recordingResources) stream.getTracks().forEach(track => track.stop()); const link = $('record-download'); if (link.href) URL.revokeObjectURL(link.href); });
  // Poll pauses only while a destructive or capture confirmation is open; drawers and the OCR viewer stay live.
  void refresh(); refreshTimer = setInterval(() => { if (!document.hidden && !$('reset-dialog').open && !$('record-dialog').open) void refresh(); }, 15000);
}
if (globalThis.document) boot();
