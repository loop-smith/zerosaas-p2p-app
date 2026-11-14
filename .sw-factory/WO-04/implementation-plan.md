<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-04

**Work Order:** WO-04 — Deliver One-Screen (100vh Zero-Scroll) Copper Command Desk (:3590 public/index.html), KAL ElevenLabs Voice Steward & WebM Recorder
**Created At (UTC):** 2026-11-14T02:48:07Z

## Summary

_1-3 sentences: what this work order delivers and the high-level approach._

## Code Reuse And Package Structure

_List critical existing files/components/services/hooks/utilities/schemas/tests to reuse or import as dependencies. Note reuse/extract/follow-pattern decisions. Then list files/packages/directories intentionally created or modified by this plan, grouped by module or layer. Do not list incidental import-order, barrel export, formatting, generated-code, or mechanical follow-on edits._

## Components And Flow

_Name Blueprint-defined components, supporting components, important interfaces/signatures, and call/data flow._

## Steps

_Ordered implementation steps. Each step should produce a reviewable, preferably compilable intermediate state. Note parallelizable steps (touch different files, no dependency)._

1. **[title]** - _what to do, where_
2. **[title]** - _what to do, where_

## Testing

_Automated and manual tests: suites, new/changed test files, scenarios, and commands. Not for requirements/blueprint conformance—that belongs in review._

## Concrete Acceptance Criteria
- Build public/index.html served at GET / on :3590: industrial zero-scroll 100vh (overflow: hidden) 3-panel Copper Command Desk — Left Rail (4 Headless SoR live status + Officer DOA table + Reset/Red-Team trap triggers), Center Stage (Steps 1-8 interactive pipeline + 4 distinct Human Checkpoint Approve cards for Darius, VP Devon, Marcus 4-Reel GS1 Scanner, CFO Meredith Check #10045), and Right Panel (live GAAP Journal Ledger + 5 Trade PDFs + Tagged 28-Box OCR Invoice overlay).
- Wire KAL Zero-Authority Voice Steward (/api/kal/speak proxying ElevenLabs eleven_turbo_v2_5 when ELEVENLABS_API_KEY env is set with instant browser Web Speech synthesis fallback when unset, plus Scribe/mic push-to-talk) and built-in 60fps MediaRecorder WebM screen+audio demo recorder button.

## Required Verification Commands
- `node --check src/sor_3panel_server.mjs`
- `test -f public/index.html`
- `npm test`
