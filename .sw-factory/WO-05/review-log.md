<!--lint disable strong-marker-->

# Review Log: WO-05

**Work Order:** WO-05 — Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs)
**Initialized At (UTC):** 2026-11-14T02:48:08Z

This file records review and verification rounds. Append new rounds; do not overwrite prior rounds.

---

## Round 1

Reviewed in the WO-06 seat. No nested review subagent. The suite was red once (`actor` missing on the HTTP-layer KAL `PUT`, which never reaches the kernel) and the assertion was corrected to that adapter shape before the green run. Production code was not changed.

### Requirements Alignment

The four tracers run inside `src/selfcheck.mjs`, which `tests/test-copper-e2e.mjs` executes first:

1. TRACER-DOA-KAL — KAL write 403 `AI_STEWARD_ZERO_AUTHORITY`, Darius self-approval 403 `DOA_LIMIT_EXCEEDED`, Nancy dock scan 403 `SOX_SOD_VIOLATION`.
2. TRACER-PPV-501900 — offline COMEX $2.70/FT = $21,600.00, standard $2.89 locked, balanced 121100 / 201200 / 501900.
3. TRACER-OCR-TRAP — tampered invoice 409 `MATCH_VARIANCE_HOLD`; clean match 200. Pixel OCR boxes are the sidecar suite, not this file.
4. TRACER-BANK-4409 — 101200 over $5,000 is 403 `BANK_POLICY_VIOLATION`; 101100 Check #10045 is PAID and DR equals CR.

Self-check reports 26 checks. That is the ">=16 assertions" bar. `package.json` already imported this path; it was not modified.

**Blocking:** none.

**Advisory:** `hledger --strict` is asserted only when the binary is on `PATH` (self-check does this). This run did not print a missing-hledger failure.

### Blueprint Alignment

No blueprint document or MCP connector was available.

**Blocking:** none.

**Advisory:** contract alignment only.

### Architecture And Conventions

One ESM file. It boots the real server twice (self-check process, then `startServer` on real seeds). Temp directory is removed in `finally`. No mock of the kernel.

**Blocking:** none.

**Advisory:** none.

### Tests And Build

**Commands run:**

- `npm test` through `python3` subprocess → exit 0. Self-check 26/26. Red-team 10/10.
- `python3 -m pytest seeds -q -p no:cacheprovider` → 23 passed in 0.61s.
- `python3 -m hara.blocks.configurator.manifest check --repo .` → exit 1, `No module named 'hara'`.
- `python3 -m pytest hara/blocks -q -p no:cacheprovider` → exit 4, `hara/blocks` not found, no tests ran.

**Blocking:** none inside this work order. The HARA commands cannot pass until that package exists. They are not claimed green.

**Advisory:** none.

### User-Facing Verification

**Skipped:** browser console and the HARA hash routes — this app has no `/#/helm`, `/#/living-plan`, `/#/riff-room`, or `app_server.py`.

**Evidence:** the suite `GET /` returned HTTP 200 and the command-desk title, and `GET /api/health` returned `ok` with a valid audit chain.

**Blocking:** none.

**Advisory:** no browser console log was captured.

### Security, Privacy, And Data Safety

**Skipped:** no.

**Blocking:** none.

**Advisory:** a KAL `PUT` is refused in the HTTP adapter (403, `$0.00`) and is not copied onto the kernel audit chain, because the adapter rejects it before `act()`. Kernel-path spoofs are chained as `EMP-AI-KAL`.

### Round 1 Verdict

- Total blocking: 0
- Total advisory: 3
- Files reviewed: `tests/test-copper-e2e.mjs`, `src/selfcheck.mjs`, `src/sor_3panel_server.mjs`, `src/lineage_core.mjs`, `package.json` (read only)
- **Verdict:** APPROVED

---

## Round 2

HARA-06.T19 (cc2) integration seat. No nested review subagent. The fence now includes `src/`, `sidecar/`, `public/`, `seeds/`, `tests/` and `package.json`, so the Round 1 gaps were closed in code:

- RapidOCR was outside the suite.
- `package.json` was a presence check.

One assertion was wrong on the first red run and was corrected. `/docs/%2E%2E` returned 200 because the URL parser normalizes it to `/`, the command desk. That is not a leak. The probe became `/docs/%2E%2E%2Fwms_seed.sqlite3`, which the server's decode-and-contain check refuses.

### Requirements Alignment

1. TRACER-DOA-KAL, TRACER-PPV-501900, TRACER-BANK-4409 — unchanged in `src/selfcheck.mjs`; 26/26.
2. TRACER-OCR-TRAP — now against real RapidOCR.
   - A same-length forgery of `INV-25800.pdf` ($2.89 / $23,120.00) is read by the model and held 409 `MATCH_VARIANCE_HOLD` with `variances` `invoiceSha256`, `unitPrice`, `totalDue`. No journal entry is posted.
   - The restored invoice matches 200 with 35 boxes (≥28) and posts the balanced GRNI → Trade AP entry.
3. `package.json` `test` is `node tests/test-copper-e2e.mjs`.

**Blocking:** none.

**Advisory:**

- Step 7 holds the kernel write queue during OCR (about 5–10 s). Reads are not queued.
- With live COMEX, an invoice priced at the contract rate is held whenever spot moves the PO rate. That is correct three-way-match behaviour, but it will stop a live demo at Step 7.

### Architecture And Conventions

The sidecar stays a proposal engine. It renders, OCRs and returns fields. The kernel decides everything else:

- It re-hashes every PDF on its own disk at Step 5, which binds the sidecar's `--docs-dir` to `<sandbox>/docs`.
- It binds the OCR hash to the Step 5 hash.
- It matches amounts, posts, and audit-chains every refusal.

`ocrUrl` is opt-in (`OCR_URL`). Without it the kernel behaves exactly as before.

**Blocking:** none.

**Advisory:** none.

### Tests And Build

**Commands run:**

- `npm test` through a `python3` subprocess → exit 0. Self-check 26/26. Integrated red-team 12/12. About 17 s.
- `python3 -m pytest sidecar seeds public/test_command_desk.py -q -p no:cacheprovider` → 66 passed. This includes real RapidOCR, the PNG output and the `serve --port 0` ready line.
- `node --test public/command-desk.test.mjs` → 10/10.
- `python3 -m pytest public/test_browser_command_desk.py` → 1 skipped (Playwright not installed).
- Default-port smoke: `npm run sidecar` (:3591) + `npm run start:ocr` (:3590). Steps 1-8 all returned 200. Step 7 source was `ocr:rapidocr-onnxruntime` with 35 boxes. `/docs/INV-25800.pdf` and `.png` returned 200. Journal balanced; payment PAID. `sor-sandbox/` was removed afterwards.
- `python3 -m hara.blocks.configurator.manifest check --repo .` → exit 1, `No module named 'hara'`.
- `python3 -m pytest hara/blocks -q -p no:cacheprovider` → exit 4, `hara/blocks` not found.

**Blocking:** none inside this work order. The HARA commands cannot pass until that package exists. They are not claimed green.

### User-Facing Verification

**Evidence:**

- The desk's own `validateState` accepts the live integrated snapshot (`documents`, `ocr`).
- The OCR box space equals the served PNG's IHDR width/height.
- All five trade PDFs are served byte-identical to the sandbox files.

**Skipped:** browser console capture (no Playwright in this lane).

### Security, Privacy, And Data Safety

- `/docs/<file>` reuses `serveStatic`'s decode-and-contain check. Probes `..%2Fp2p_kernel.sqlite3`, `%2E%2E%2Fwms_seed.sqlite3` and `../package.json` all fail to return 200.
- The kernel only accepts sidecar document names matching `^[A-Za-z0-9][A-Za-z0-9.-]{0,80}$` with the expected extension, and only the five contract PDFs.
- A malformed sidecar reply is 503 `OCR_UNAVAILABLE`, not a 500.

**Blocking:** none.

### Round 2 Verdict

- Total blocking: 0
- Total advisory: 2
- Files reviewed: `src/lineage_core.mjs`, `src/sor_3panel_server.mjs`, `src/selfcheck.mjs`, `sidecar/invoice_ocr_engine.py`, `sidecar/test_invoice_ocr_engine.py`, `sidecar/README.md`, `tests/test-copper-e2e.mjs`, `package.json`, `public/app.js` (read only)
- **Verdict:** APPROVED

---

<!-- Subsequent rounds: copy the structure above and increment the round number. -->
