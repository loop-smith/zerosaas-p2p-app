import test from "node:test";
import assert from "node:assert/strict";
// ZeroSaaS P2P workbench client suite (SF WO-13, WO-14). File name kept: the task card runs it by this path.
import { validateState, safeDocumentUrl, request, speak, refresh, runStep, render, trialBalance, REELS, REFUSALS, startRecording, stopRecording,
  stewardIntent, stewardReply, parseReelScan, tagOcrFields, checkWords, achLabel } from "./app.js";

const snapshot = {
  steps: Array.from({length: 8}, (_, index) => ({n: index + 1, status: index === 0 ? 'complete' : 'pending'})),
  item: {onHandFt: 0, stdTotalUsd: 23120}, scans: [],
  sandbox: {sources: {wms: 'seed', crm: 'seed', hrm: 'seed', coa: 'seed'}},
  journal: {balanced: true, debitUsd: 0, creditUsd: 0, entries: []},
};

test("snapshots require a valid server step and validated financial rows", () => {
  assert.equal(validateState({state: snapshot}), snapshot);
  for (const value of [null, {}, {step: 1}, {...snapshot, steps: []}, {...snapshot, journal: []}, {...snapshot, scans: ['unexpected']}]) {
    assert.throws(() => validateState(value));
  }
});

test("document URLs are same-origin HTTP paths only", () => {
  assert.equal(safeDocumentUrl("/docs/PO-25800.pdf"), "/docs/PO-25800.pdf");
  for (const value of ["https://evil.example/a.pdf", "//evil.example/a", "javascript:alert(1)", "data:text/html,x", "/\\evil.example/a", null]) {
    assert.equal(safeDocumentUrl(value), null);
  }
});

test("requests preserve exact refusal codes and send same-origin JSON", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (path, options) => {
      assert.equal(path, "/api/step/3");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(options.body), {actor: "EMP-AI-KAL"});
      return new Response(JSON.stringify({code: "AI_STEWARD_ZERO_AUTHORITY", message: "No signing authority"}), {status: 403, headers: {"Content-Type": "application/json"}});
    };
    await assert.rejects(request("/api/step/3", {method: "POST", body: {actor: "EMP-AI-KAL"}}), error => error.code === "AI_STEWARD_ZERO_AUTHORITY" && error.status === 403);
    assert.equal(REFUSALS.MATCH_VARIANCE_HOLD.status, 409);
  } finally { globalThis.fetch = original; }
});

test("malformed API content never becomes a success snapshot", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("<html>static fallback</html>", {headers: {"Content-Type": "text/html"}});
    await assert.rejects(request("/api/state"), /JSON/);
  } finally { globalThis.fetch = original; }
});

test("disconnected or out-of-order human actions cannot write", async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (path, options) => { calls.push([path, options]); return new Response(JSON.stringify(snapshot), {headers: {"Content-Type": "application/json"}}); };
    await assert.rejects(runStep(3, "EMP-0005"), /Connect/);
    await refresh();
    await assert.rejects(runStep(3, "EMP-0005"), /checkpoint|step/i);
    await assert.rejects(runStep(2, "EMP-AI-KAL"), /human|actor|authority/i);
    assert.equal(calls.filter(([path]) => path.startsWith("/api/step/")).length, 0);
    await runStep(2, "EMP-0021");
    const write = calls.find(([path]) => path.startsWith("/api/step/"));
    assert.deepEqual(JSON.parse(write[1].body), {actor: "EMP-0021"});
  } finally { globalThis.fetch = original; }
});

test("unconfigured TTS instantly uses browser speech with no workflow writes", async () => {
  const originalFetch = globalThis.fetch;
  const originalSpeech = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;
  const spoken = [];
  try {
    globalThis.fetch = async path => { assert.equal(path, "/api/kal/speak"); return new Response(JSON.stringify({code: "VOICE_UNCONFIGURED"}), {status: 503}); };
    globalThis.SpeechSynthesisUtterance = class { constructor(text) {this.text = text;} };
    globalThis.speechSynthesis = {cancel() {}, speak(value) {spoken.push(value.text);} };
    assert.equal(await speak("Awaiting Darius."), "browser");
    assert.deepEqual(spoken, ["Awaiting Darius."]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.speechSynthesis = originalSpeech;
    globalThis.SpeechSynthesisUtterance = originalUtterance;
  }
});

test("cancelling one voice request never aborts the next request", async () => {
  const originalFetch = globalThis.fetch;
  const originalSpeech = globalThis.speechSynthesis;
  const originalUtterance = globalThis.SpeechSynthesisUtterance;
  const signals = [];
  try {
    globalThis.SpeechSynthesisUtterance = class { constructor(text) {this.text = text;} };
    globalThis.speechSynthesis = {cancel() {}, speak() {}};
    globalThis.fetch = async (path, options) => {
      signals.push(options.signal);
      await new Promise(resolve => setTimeout(resolve, signals.length === 1 ? 800 : 50));
      return new Response("", {status: 503});
    };
    const first = speak("First briefing");
    const second = speak("Second briefing");
    await Promise.all([first, second]);
    assert.equal(signals[0].aborted, true);
    assert.equal(signals[1].aborted, false);
  } finally { globalThis.fetch = originalFetch; globalThis.speechSynthesis = originalSpeech; globalThis.SpeechSynthesisUtterance = originalUtterance; }
});

test("trial balance flags an unbalanced server journal and render is inert without a DOM", () => {
  const book = trialBalance({...snapshot, journal: {balanced: true, debitUsd: 1, creditUsd: 0, entries: [{memo: 'x', legs: [{account: 'Assets:121100-Raw-Copper', debitUsd: 1, creditUsd: 0}]}]}});
  assert.equal(book.balanced, false);
  assert.equal(book.codes.get('121100').debit, 100);
  assert.equal(render(snapshot), undefined);
});

test("snapshot validation rejects malformed status, documents and out-of-image OCR", () => {
  for (const extra of [
    {sandbox: {sources: []}}, {item: {onHandFt: NaN}}, {po: {unitUsd: 2.7, totalUsd: -1}}, {payment: {stamp: 'PAID'}},
    {documents: [{}]}, {scans: [{barcode: REELS[0], ft: 2000}, {barcode: REELS[0], ft: 2000}]},
    {scans: [{barcode: REELS[0], ft: 1}]},
    {steps: snapshot.steps.map(step => ({...step, status: step.n === 3 ? 'complete' : step.status}))},
    {journal: {...snapshot.journal, entries: [{legs: [{account: '121100', debitUsd: -1, creditUsd: 0}]}]}},
    {ocr: {imageUrl: "/invoice.png", width: 100, height: 100, boxes: [{x: 95, y: 0, width: 10, height: 5, text: "outside"}]}}
  ]) assert.throws(() => validateState({...snapshot, ...extra}));
});

const atStep = (done, extra = {}) => ({...snapshot, steps: snapshot.steps.map(step => ({...step, status: step.n <= done ? 'complete' : 'pending'})), ...extra});

test("KAL voice intents are read-only: write verbs get the $0 refusal and never reach the network", async () => {
  for (const [text, intent] of [
    ["Approve payment now", "refuse"], ["Sign check 10045", "refuse"], ["Pay the invoice", "refuse"], ["Reset the queue", "refuse"], ["Scan reel two", "refuse"], ["Issue the PO", "refuse"],
    ["Is there any issue with the reset?", "status"],
    ["Show me the check", "check"], ["Was the CFO payment made?", "check"], ["Open the invoice OCR boxes", "invoice"],
    ["How many reels were received at the dock?", "dock"], ["Is the ledger balanced?", "ledger"], ["Which SOX guardrails apply?", "governance"],
    ["What happens next?", "status"], ["", "status"],
    // The vendor's name is not the write verb "wire"; wiring money still is.
    ["Tell me about Encore Wire", "check"], ["Who is the payee?", "check"], ["Show the Encore Wire invoice", "invoice"],
    ["How many Encore-Wire reels arrived?", "dock"], ["Wire the money to Encore Wire", "refuse"], ["Wire funds", "refuse"],
  ]) assert.equal(stewardIntent(text), intent, text);
  const original = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; throw new Error("no network"); };
    assert.match(stewardReply("refuse", atStep(7)), /zero dollars.*Step 8 needs Meredith Hale at the step card\. Human officers authorize every checkpoint\.$/);
    assert.match(stewardReply("refuse", atStep(0)), /Step 1 needs the system stock query/);
    assert.match(stewardReply("refuse", atStep(8)), /All eight steps are already complete/);
    assert.match(stewardReply("status", null), /disconnected/);
    assert.match(stewardReply("status", atStep(2)), /^2 of 8 steps confirmed\. VP Devon must approve the request\./);
    assert.match(stewardReply("check", atStep(5)), /only after the three-way match/);
    assert.equal(stewardReply("dock", atStep(5, {scans: [{barcode: REELS[1], ft: 2000}]})), "1 of 4 reels received, 2,000 of 8,000 feet. Marcus Vance must scan R01, R03, R04.");
    assert.match(stewardReply("dock", atStep(3)), /Dock scanning opens at step 6/);
    assert.match(stewardReply("invoice", atStep(6)), /not matched yet/);
    assert.equal(stewardReply("ledger", snapshot), "The journal is balanced. Debits $0.00 equal credits $0.00 across 0 postings.");
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

test("RF wedge reads drop AIM prefixes and terminators and mirror the server scan refusals", () => {
  assert.deepEqual(parseReelScan(`]C1${REELS[0]}\r\n`), {code: REELS[0], error: null});
  assert.deepEqual(parseReelScan(" enc-gs1-884192-r02\t"), {code: REELS[1], error: null});
  assert.equal(parseReelScan(`${REELS[3]}\x1d`).code, REELS[3]);
  assert.deepEqual(parseReelScan("ENC-GS1-884192-R05"), {code: "ENC-GS1-884192-R05", error: "UNKNOWN_REEL"});
  assert.equal(parseReelScan("\r\n").error, "NO_BARCODE");
  assert.equal(parseReelScan(undefined).error, "NO_BARCODE");
  assert.equal(parseReelScan(REELS[2], [{barcode: REELS[2], ft: 2000}]).error, "DUPLICATE_SCAN");
});

test("OCR field tagging finds the five match fields on single-line and split RapidOCR boxes", () => {
  const line = (text, y, x = 36, width = 300) => ({text, x, y, width, height: 14});
  const boxes = [line("VENDOR OA: ENC-OA-2026-884192", 60), line("VENDOR: Encore Wire Corporation", 40), line("PURCHASE ORDER: PO-25800", 50),
    line("QUANTITY FT: 8000", 70), line("UNIT PRICE USD: 2.70", 80), line("TOTAL DUE USD: 21600.00", 90)];
  assert.deepEqual(tagOcrFields({boxes}).map(field => [field.key, field.value, field.indices]),
    [["vendor", "Encore Wire Corporation", [1]], ["po", "PO-25800", [2]], ["quantity", "8000", [3]], ["unit", "2.70", [4]], ["total", "21600.00", [5]]]);
  // Label and value split into two boxes: the nearest box to the right on the same line is the value.
  const split = tagOcrFields({boxes: [line("TOTAL DUE USD:", 90, 36, 110), line("99.00", 300, 200, 60), line("21599.00", 91, 400, 70), line("21600.00", 91, 160, 70)]});
  assert.deepEqual(split.find(field => field.key === "total"), {key: "total", label: "Total due USD", indices: [0, 3], value: "21600.00"});
  assert.deepEqual(split.find(field => field.key === "vendor"), {key: "vendor", label: "Vendor", indices: [], value: null});
  // Real RapidOCR drops inter-word spaces; the sidecar parser also accepts a full-width colon.
  const squeezed = tagOcrFields({boxes: [line("VENDOROA:ENC-OA-2026-884192", 30), line("VENDOR:EncoreWireCorporation", 40), line("PURCHASEORDER:PO-25800", 50),
    line("QUANTITYFT:8000", 70), line("UNITPRICEUSD：2.70", 80), line("TOTALDUEUSD:21600.00", 90)]});
  assert.deepEqual(squeezed.map(field => field.value), ["EncoreWireCorporation", "PO-25800", "8000", "2.70", "21600.00"]);
  assert.deepEqual(tagOcrFields(null).map(field => field.indices.length), [0, 0, 0, 0, 0]);
});

test("check amounts print as legal words with cents over 100", () => {
  assert.equal(checkWords(21600), "Twenty-one thousand six hundred and 00/100 dollars");
  assert.equal(checkWords(23120.5), "Twenty-three thousand one hundred twenty and 50/100 dollars");
  assert.equal(checkWords(1000001.07), "One million one and 07/100 dollars");
  assert.equal(checkWords(0.99), "Zero and 99/100 dollars");
  for (const bad of [-1, NaN, 1e12, undefined]) assert.equal(checkWords(bad), "—");
});

test("the check face prints the ACH trace with one ACH prefix", () => {
  assert.equal(achLabel("ACH-000582"), "ACH-000582");
  assert.equal(achLabel("ach 000582"), "ach 000582");
  assert.equal(achLabel("000582"), "ACH 000582");
  assert.equal(achLabel("ACHE-1"), "ACH ACHE-1");
  for (const missing of [undefined, null, "", 582]) assert.equal(achLabel(missing), "ACH —");
});

test("a cancelled pending display permission cannot restart capture", async () => {
  const saved = new Map(['navigator', 'isSecureContext', 'MediaRecorder', 'MediaStream'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  let resolveCapture;
  const track = {kind: 'video', readyState: 'live', stop() { this.readyState = 'ended'; }, addEventListener() {}, getSettings() { return {frameRate: 60}; }};
  const screen = {getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => []};
  let starts = 0;
  try {
    Object.defineProperty(globalThis, 'navigator', {value: {mediaDevices: {getDisplayMedia: () => new Promise(resolve => {resolveCapture = resolve;}), getUserMedia: async () => {throw new Error('No microphone');}}}, configurable: true});
    Object.defineProperty(globalThis, 'isSecureContext', {value: true, configurable: true});
    globalThis.MediaRecorder = class { static isTypeSupported() {return true;} constructor() {this.state = 'inactive';} start() {this.state = 'recording'; starts++;} stop() {this.state = 'inactive'; this.onstop?.();} };
    globalThis.MediaStream = class {constructor(tracks) {this.tracks = tracks;} };
    const pending = startRecording();
    stopRecording();
    resolveCapture(screen);
    const started = await pending;
    stopRecording();
    assert.equal(started, false);
    assert.equal(starts, 0);
    assert.equal(track.readyState, 'ended');
  } finally {
    stopRecording();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});


test("real server snapshots and client actions share the kernel contract", async () => {
  const {startServer} = await import('../src/sor_3panel_server.mjs');
  const {mkdtempSync, rmSync} = await import('node:fs');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'wo04-client-'));
  const original = globalThis.fetch;
  let service;
  try {
    service = await startServer({port: 0, offline: true, sandboxDir: join(dir, 'sandbox'), seedsDir: join(dir, 'missing-seeds'), hledgerBin: false, voiceEnv: {}});
    const writes = [];
    // Resolve browser-relative URLs at the network boundary; the app and kernel remain real.
    globalThis.fetch = (route, options) => {
      if (options?.method === 'POST') writes.push([route, JSON.parse(options.body)]);
      return original(new URL(route, service.url), options);
    };
    const read = async () => validateState(await request('/api/state'));
    const initial = await read();
    assert.equal(initial.steps.filter(step => step.status === 'complete').length, 0);
    assert.equal(initial.item.onHandFt, 0);
    assert.deepEqual(initial.journal.entries, []);
    await refresh();
    for (const [step, actor] of [[1, 'SYSTEM'], [2, 'EMP-0021'], [3, 'EMP-0005'], [4, 'EMP-0002'], [5, 'EMP-0002']]) await runStep(step, actor);
    assert.deepEqual(writes[0], ['/api/step/1', {actor: 'SYSTEM'}]);
    await assert.rejects(request('/api/step/6', {method: 'POST', body: {actor: 'EMP-0002', barcode: REELS[0]}}), error => error.code === 'SOX_SOD_VIOLATION' && error.status === 403);
    for (const [index, barcode] of REELS.entries()) {
      await runStep(6, 'EMP-0003', {barcode});
      const snapshot = await read();
      assert.deepEqual(snapshot.scans.map(scan => scan.barcode), REELS.slice(0, index + 1));
      assert.equal(snapshot.steps[5].status, index < 3 ? 'in_progress' : 'complete');
      if (index === 0) await assert.rejects(runStep(6, 'EMP-0003', {barcode}), /already scanned/);
    }
    const received = await read();
    assert.equal(received.item.onHandFt, 8000);
    // WO-14 RF scanner and voice steward read the same server scans.
    assert.equal(parseReelScan(`]C1${REELS[0]}\r`, received.scans).error, "DUPLICATE_SCAN");
    assert.equal(stewardReply("dock", received), "4 of 4 reels received, 8,000 of 8,000 feet. The dock receipt is complete.");
    assert.match(stewardReply("check", received), /only after the three-way match/);
    assert.equal(received.journal.entries.length, 1);
    assert.equal(received.journal.balanced, true);
    assert.equal(received.journal.debitUsd, 23120);
    await assert.rejects(request('/api/step/7', {method: 'POST', body: {actor: 'EMP-0001', invoice: {totalUsd: received.po.totalUsd + 500}}}), error => error.code === 'MATCH_VARIANCE_HOLD' && error.status === 409);
    await runStep(7, 'EMP-0001');
    await assert.rejects(request('/api/step/8', {method: 'POST', body: {actor: 'EMP-0007', bankAccount: '101200'}}), error => error.code === 'BANK_POLICY_VIOLATION' && error.status === 403);
    await runStep(8, 'EMP-0007');
    const paid = await read();
    assert.equal(paid.payment.stamp, 'PAID');
    assert.equal(paid.payment.check, 'Check #10045');
    assert.equal(paid.steps.filter(step => step.status === 'complete').length, 8);
    assert.equal(paid.journal.entries.length, 3);
    assert.deepEqual(writes.at(-1), ['/api/step/8', {actor: 'EMP-0007', bankAccount: '101100'}]);
    // WO-14 CFO check view and voice steward read the real payment and match records.
    assert.equal(stewardReply("check", paid), "Check #10045 paid $21,600.00 to Encore Wire Corporation from Operating Checking #8801.");
    assert.equal(paid.payment.approvedBy, "EMP-0007");
    assert.equal(paid.match.varianceUsd, 0);
    assert.match(stewardReply("invoice", paid), /^Three-way match cleared at \$0\.00 variance\. This run matched PO-derived invoice fields/);
    assert.equal(checkWords(paid.payment.amountUsd), "Twenty-one thousand six hundred and 00/100 dollars");
    assert.equal(achLabel(paid.payment.ach), "ACH-000582");
    // Right-rail trial balance: the six WO-13 accounts net from the real kernel journal, DR == CR.
    const book = trialBalance(paid);
    const net = code => { const sum = book.codes.get(code); return sum ? sum.debit - sum.credit : 0; };
    assert.deepEqual(Object.fromEntries(['121100', '201200', '201100', '501900', '101100', '101200'].map(code => [code, net(code)])),
      {121100: 2312000, 201200: 0, 201100: 0, 501900: -152000, 101100: -2160000, 101200: 0});
    assert.deepEqual([...book.codes.keys()].sort(), ['101100', '121100', '201100', '201200', '501900']);
    assert.equal(book.balanced, true);
    assert.equal(book.debit, book.credit);
    assert.equal(trialBalance(null), null);
    const reset = validateState(await request('/api/reset', {method: 'POST', body: {}}));
    assert.equal(reset.steps.filter(step => step.status === 'complete').length, 0);
    assert.deepEqual(reset.scans, []);
    assert.deepEqual(reset.journal.entries, []);
    assert.equal(reset.payment, null);
    // The real /api/kal/speak route with no ElevenLabs key answers 503 at once, and KAL falls back to browser speech.
    const spoken = [];
    globalThis.SpeechSynthesisUtterance = class { constructor(text) {this.text = text;} };
    globalThis.speechSynthesis = {cancel() {}, speak(value) {spoken.push(value.text);}};
    assert.equal(await speak("Queue reset."), "browser");
    assert.deepEqual(spoken, ["Queue reset."]);
    assert.deepEqual(writes.at(-1), ['/api/kal/speak', {text: 'Queue reset.'}]);
    const voice = await original(new URL('/api/kal/speak', service.url), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"text":"x"}'});
    assert.equal(voice.status, 503);
    assert.equal((await voice.json()).code, 'KAL_VOICE_UNCONFIGURED');
    assert.equal(validateState(await request('/api/state')).journal.entries.length, 0);
  } finally {
    globalThis.fetch = original;
    delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
    if (service) await new Promise(resolve => service.server.close(resolve));
    rmSync(dir, {recursive: true, force: true});
  }
});
