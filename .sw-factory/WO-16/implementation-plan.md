<!--lint disable strong-marker-->

# Implementation Plan: WO-16

## Summary

Delivers the 1:1 3-panel light enterprise workbench (`1440x900` zero-scroll shell), `▶ Start KAL · P2P Steward` choreography, 1-click sequential 4-reel GS1-128 RF red laser scan (`@keyframes rfLaserFlash`), inline 28-box RapidOCR tagged invoice (`INV-25800.pdf`), corporate voucher `Check #10045` (`ACH-000582`), and all 4 left-rail views while preserving all exported ES-module helpers.

## Touched Files

- `public/index.html`, `public/styles.css`, `public/app.js`, `public/test_command_desk.py`, `public/command-desk.test.mjs`

## Testing

1. `npm test`
2. `node --test public/command-desk.test.mjs`
3. `pytest seeds/test_seeds.py sidecar/test_invoice_ocr_engine.py public/test_command_desk.py`
4. `python3 seeds/build_seeds.py --check`
