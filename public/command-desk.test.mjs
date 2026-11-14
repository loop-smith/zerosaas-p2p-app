import test from "node:test";
import assert from "node:assert/strict";
// ZeroSaaS P2P workbench client suite (SF WO-13). File name kept: the task card runs it by this path.
import { validateState, safeDocumentUrl, request, speak, refresh, runStep, render, trialBalance, REELS, REFUSALS, startRecording, stopRecording } from "./app.js";

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
    service = await startServer({port: 0, offline: true, sandboxDir: join(dir, 'sandbox'), seedsDir: join(dir, 'missing-seeds'), hledgerBin: false});
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
  } finally {
    globalThis.fetch = original;
    if (service) await new Promise(resolve => service.server.close(resolve));
    rmSync(dir, {recursive: true, force: true});
  }
});
