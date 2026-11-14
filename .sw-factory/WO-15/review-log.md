<!--lint disable strong-marker-->

# Review Log: WO-15 .. WO-18

**Work Orders:**
- `SF WO-15` (`3988d7f2-c356-487d-9ed2-9a1c045d3ee1`) — Streaming female KAL voice, controller phonetic lexicon, and 28-box RapidOCR `/mint` + `/scan` parity
- `SF WO-16` (`bd3f7822-1571-4b81-80ca-6a32215a25aa`) — 1:1 3-panel workbench glass, RF laser scan, inline OCR invoice, and Check `#10045`
- `SF WO-17` (`78e025ce-ac9b-4714-a769-4b38767baa9d`) — 275-table brownfield SQLite explorer, live COMEX spot subview, cross-platform `hledger`, and 13-route workbench engine
- `SF WO-18` (`346dd5b4-37e7-45ed-bca0-6d36528bd0c6`) — Internal task prefix scrub, EO 14434 × KYSI governance documentation, and Round 4 Software Factory trace

**Initialized At (UTC):** 2026-11-14T10:15Z

---

## Round 1 (In-Fence Verification Gate)

### Defects Found & Fixed Before Commit

1. **Sandbox wipe across `POST /api/reset` (`src/workbench_engine.mjs`):** `kernel.reset()` clears `sandboxDir`, removing `workbench/lineage_core.sqlite3` on disk while `lineageCore` held an initialized handle. Fixed by invoking `lineageCore.ensureSchema()` when re-seeding an existing `LineageCoreEngine` instance (`selfcheck.mjs` 26/26 green).
2. **Headless Node `refresh()` guard (`public/app.js`):** Merging `workbench.getFullState()` into `GET /api/state` populated `snapshot.deals` during Node-only `command-desk.test.mjs` runs, triggering DOM `renderAll()` without `globalThis.document`. Guarded with `if (globalThis.document && snapshot && snapshot.deals)` (`command-desk.test.mjs` 16/16 green).
3. **Synthetic journal `hledger` stderr suppression (`src/workbench_engine.mjs`):** Added `stdio: ['ignore', 'pipe', 'pipe']` on `execFileSync` calls so minimal synthetic test journals without commodity headers fall back silently.

### Verification Evidence

| Check | Result |
| --- | --- |
| `npm test` | **PASS** — 4 sidecar-reply + 26 kernel self-checks + 13 red-team checks + full 8-step & 275-table workbench E2E |
| `node --test public/command-desk.test.mjs` | **PASS** — 16/16 client & real-server contract tests |
| `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py` | **PASS** — 71 passed (`24` seed + `40` sidecar + `7` static/DOM workbench) |
| `python3 seeds/build_seeds.py --check` | **PASS** — `seeds OK` (`drift() == []`) |
| Forbidden strings & secrets scan | **PASS** — 0 matches across all tracked files |

**Verdict:** Ready for independent cross-family Qualify Review prior to fast-forwarding `main`.

---

## Round 2 (Independent Cross-Platform & Security Review)

1. **Steward header-spoof hardening on `POST /api/step` (`src/sor_3panel_server.mjs`, `tests/test-golden-master-e2e.mjs`):** Updated `effectiveBody` on `/api/step` to evaluate `isStewardIdentity([body.actingEmpId, body.actor, ...headerIds])` so a request combining `x-actor: EMP-AI-KAL` with a human `actingEmpId` is always caught and audit-chained (`403 AI_STEWARD_ZERO_AUTHORITY`, `$0.00` impact).
2. **Per-Work-Order `.sw-factory/WO-16..WO-18` execution artifacts:** Added individual `checklist.md`, `context.md`, `implementation-plan.md`, and `review-log.md` packets for `WO-16` (`bd3f7822-1571-4b81-80ca-6a32215a25aa`), `WO-17` (`78e025ce-ac9b-4714-a769-4b38767baa9d`), and `WO-18` (`346dd5b4-37e7-45ed-bca0-6d36528bd0c6`), and verified the full Windows + Linux test matrix (`npm test`, `node --test public/command-desk.test.mjs`, and `pytest`).

**Verdict:** `APPROVED`
