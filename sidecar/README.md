# Invoice OCR sidecar

The service binds to `127.0.0.1` and retains one RapidOCR ONNX model for its lifetime. Runtime dependencies are listed in `requirements.txt`; pytest is needed for development. Defaults come from `contracts/p2p-lineage-contract.json`, including the locked spot rate, five document names, four reels, and settlement references. The annual standard cost remains separate from the invoice spot rate.

Run from the repository root:

```sh
python3 sidecar/invoice_ocr_engine.py generate
python3 sidecar/invoice_ocr_engine.py ocr
python3 sidecar/invoice_ocr_engine.py serve
```

Options precede the command. `--docs-dir PATH` changes the default `sor-sandbox/docs`. `--port PORT` overrides `OCR_PORT`, which defaults to 3591. Startup in normal mode loads RapidOCR once; initialization or inference errors never enable synthetic output. `--fast-smoke` explicitly selects deterministic boxes for generated PDFs, still rendering through PDFium/Pillow. Its `engine` label is `deterministic-smoke`; confidence 1.0 denotes exact generated layout, not model confidence. Smoke refuses invoice bytes that differ from the canonical generated PDF. Normal mode reports actual model boxes and confidence.

```sh
python3 sidecar/invoice_ocr_engine.py --docs-dir /tmp/p2p-docs --fast-smoke generate
python3 sidecar/invoice_ocr_engine.py --docs-dir /tmp/p2p-docs --fast-smoke ocr
python3 -m pytest sidecar -q -p no:cacheprovider
```

## HTTP interface

All POST routes accept a JSON object with one Content-Length and a maximum body size of 65,536 bytes. Generation and OCR accept `{}` only; callers cannot select filesystem paths or switch OCR modes. Replies are JSON. Read/write operations on the model and PDFs are serialized; each PDF is replaced atomically. No OCR operation regenerates or overwrites the invoice it is reading.

| Route | Request | Response |
| --- | --- | --- |
| GET /health | none | readiness and engine mode |
| POST /generate | `{}` | five PDF basenames and SHA-256 hashes, locked amount fields |
| POST /ocr | `{}` | invoice hash, rendered width/height, boxes and extracted amount fields |
| POST /match | `{"quantityFt":8000,"unitPriceUsd":"2.70","totalUsd":"21600.00"}` | exact contract comparison and proposed 201200 debit / 201100 credit |
| POST /payment-check | `{"empId":"EMP-0007","accountCode":"101100","accountNumber":"8801","amountUsd":"21600.00"}` | validated payment proposal and Check #10045 / ACH-000582 references |

Each OCR box has `text`, `confidence`, a one-based `page`, and `box: [[x,y],...]` with four pixel corners measured from the rendered page's top left. Normal OCR parses amount fields from recognized text, allowing the model's omitted spaces in labels. It refuses unreadable or duplicate fields, numeric suffixes, and invoices with additional pages so unexamined charges cannot be omitted. The generated invoice currently has 35 text rows. Explicit smoke mode returns 35 layout boxes.

`/match` compares the supplied invoice fields with the immutable contract's ordered quantity, spot rate and total using Decimal. Any discrepancy, including the $2.89 standard rate or a $500 overbill, returns HTTP 409 `MATCH_VARIANCE_HOLD`. It is a validation proposal: the missing application server must supply trusted PO/receipt evidence, bind OCR hashes to the invoice and receipt, and perform the actual three-way match and journal transfer. This endpoint alone does not prove physical receipt or approve an invoice for payment.

`/payment-check` checks the claimed CFO seat EMP-0007, $500,000 ceiling, exact invoice amount, and required Operating Checking 101100/#8801. Other accounts, including Payroll 101200/#4409, return HTTP 403 `BANK_POLICY_VIOLATION`. KAL EMP-AI-KAL returns HTTP 403 `AI_STEWARD_ZERO_AUTHORITY`; other employee IDs or amounts above the CFO ceiling return HTTP 403 `CFO_AUTHORITY_REQUIRED`. This local policy check does not authenticate the human identity. The application must authenticate the CFO, enforce segregation of duties, confirm a matched unpaid voucher and prevent duplicate settlement before posting.

Both policy endpoints return `posted: false`. This sidecar never changes journals, WMS stock, AP balances or bank balances and never marks documents PAID. The application server is absent from this checkout and `src/` is outside this seat's fence; those integration steps require its owning seat.

Other refusals: 409 `DOCUMENT_INTEGRITY_HOLD` for missing, unrenderable or unrecognized smoke invoices; 400 `INVALID_REQUEST`; 404 `NOT_FOUND`; 413 `REQUEST_TOO_LARGE`; 503 `OCR_UNAVAILABLE`. Failed CLI operations emit a JSON refusal and exit nonzero. OCR/model and amount parsing failures are hard failures, not automatic retries or fallback triggers.
