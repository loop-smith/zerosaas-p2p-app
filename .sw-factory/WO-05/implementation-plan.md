<!--lint disable no-undefined-references strong-marker-->

# Implementation Plan: WO-05

**Work Order:** WO-05 — Wire 16-Assertion End-to-End Deterministic & Guardrail Verification Suite (tests/test-copper-e2e.mjs)
**Created At (UTC):** 2026-11-14T02:48:08Z

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
- Implement tests/test-copper-e2e.mjs and wire package.json 'test': 'node tests/test-copper-e2e.mjs' so npm test boots the live server on an ephemeral port in an isolated temp sandbox and proves >=16 end-to-end assertions.
- Must verify all 4 governance/accounting tracers end-to-end against real SQLite seeds + RapidOCR + hledger/GAAP ledger: (1) TRACER-DOA-KAL (KAL write -> 403 AI_STEWARD_ZERO_AUTHORITY, Darius $20k self-sign -> 403, Nancy dock scan -> 403), (2) TRACER-PPV-501900 ($23,120 Std Cost vs locked COMEX spot & balanced 501900 PPV), (3) TRACER-OCR-TRAP (mutated invoice -> 409 MATCH_VARIANCE_HOLD, clean 28-box 3-way match -> 200), (4) TRACER-BANK-4409 (101200 #4409 >$5k -> 403, 101100 #8801 Check #10045 -> PAID & DR==CR).

## Required Verification Commands
- `npm test`
