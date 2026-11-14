import test from "node:test";
import assert from "node:assert/strict";
import { validateState, safeDocumentUrl, request, speak, refresh, runStep, REFUSALS, startRecording, stopRecording } from "./app.js";

const snapshot = {step: 1, systems: {wms: {ok: true}}, journal: [], scans: []};

test("snapshots require a valid server step and validated financial rows", () => {
  assert.equal(validateState({state: snapshot}).step, 1);
  for (const value of [null, {}, {step: -1}, {step: 9}, {step: 1.5}, {step: "1"}, {step: 1, journal: [{debit: -1, credit: 0}]}, {step: 1, journal: [{debit: 1, credit: "bad"}]}, {step: 1, scans: ["unexpected"]}]) {
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
      assert.equal(path, "/api/step");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.deepEqual(JSON.parse(options.body), {step: 3, actor: "EMP-AI-KAL"});
      return new Response(JSON.stringify({code: "AI_STEWARD_ZERO_AUTHORITY", message: "No signing authority"}), {status: 403, headers: {"Content-Type": "application/json"}});
    };
    await assert.rejects(request("/api/step", {method: "POST", body: {step: 3, actor: "EMP-AI-KAL"}}), error => error.code === "AI_STEWARD_ZERO_AUTHORITY" && error.status === 403);
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
    assert.equal(calls.filter(([path]) => path === "/api/step").length, 0);
    await runStep(2, "EMP-0021");
    const write = calls.find(([path]) => path === "/api/step");
    assert.deepEqual(JSON.parse(write[1].body), {step: 2, actor: "EMP-0021"});
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

test("snapshot validation rejects malformed status, documents and out-of-image OCR", () => {
  for (const extra of [
    {systems: {wms: {ok: "yes"}}}, {stockFt: NaN}, {totalUsd: -1}, {paid: "yes"},
    {documents: [{}]}, {scans: ["ENC-GS1-884192-R01", "ENC-GS1-884192-R01"]},
    {ocr: {imageUrl: "/invoice.png", width: 100, height: 100, boxes: [{x: 95, y: 0, width: 10, height: 5, text: "outside"}]}}
  ]) assert.throws(() => validateState({step: 1, ...extra}));
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
