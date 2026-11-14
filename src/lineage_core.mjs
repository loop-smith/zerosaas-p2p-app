// ZeroSaaS P2P state kernel — Steps 1-8 of the PO-25800 copper stock-to-pay stream.
// Every business constant derives from contracts/p2p-lineage-contract.json. Node 22+ built-ins only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'contracts', 'p2p-lineage-contract.json'), 'utf8'));

const ITEM = CONTRACT.primaryItem;
const LOW = ITEM.lowStockTrigger;
const SPOT = ITEM.liveSpotPriceApi;
const DOCS = ITEM.tradeDocuments;
const AI = CONTRACT.provenance.aiSteward;
const BUYER = CONTRACT.provenance.purviewSeat;
const docId = (file) => file.replace(/\.pdf$/, '');

const contractAccount = (code) => {
  const name = JSON.stringify(CONTRACT).match(new RegExp(`(?:Assets|Liabilities|Expenses):${code}-[A-Za-z-]+`))?.[0];
  if (!name) throw new Error(`contract is missing GAAP account ${code}`);
  return name;
};
export const ACCOUNTS = Object.freeze({
  operatingCash: contractAccount('101100'),
  payrollCash: 'Assets:101200-Payroll-Checking',
  inventory: contractAccount('121100'),
  tradeAp: contractAccount('201100'),
  grni: contractAccount('201200'),
  ppv: contractAccount('501900'),
});
const BANKS = {
  101100: { account: ACCOUNTS.operatingCash, label: 'Operating Checking #8801' },
  101200: { account: ACCOUNTS.payrollCash, label: 'Payroll Checking #4409', capCents: 500000 },
};

export const SYSTEM = 'SYSTEM';
const KAL_IDS = new Set([AI.id, AI.bossAgentId, AI.name, AI.phonetic].map((s) => s.toUpperCase()));
export const OFFICERS = Object.freeze({
  [AI.id]: { name: AI.name, title: 'Zero-Authority P2P Workflow Steward', limitUsd: AI.signingLimitUsd },
  'EMP-0021': { name: 'Darius Mercer', title: 'Supply Chain Planner', limitUsd: 20000 },
  'EMP-0005': { name: 'Devon Brooks', title: 'VP Supply Chain', limitUsd: 100000 },
  [BUYER.empId]: { name: BUYER.name, title: 'Centralized Purchasing Lead', limitUsd: BUYER.doaLimitUsd },
  'EMP-0003': { name: 'Marcus Vance', title: 'Warehouse Dock Lead', limitUsd: 0 },
  'EMP-0001': { name: 'Duncan Vance', title: 'Controller', limitUsd: 250000 },
  'EMP-0007': { name: 'Meredith Hale', title: 'Chief Financial Officer', limitUsd: 500000 },
});

export const cents = (usd) => Math.round(Number((Number(usd) * 100).toFixed(6)));
export const astmB8UnitCents = (spotPerLb) => cents((spotPerLb + SPOT.millDrawFabricationPerLbUsd) * SPOT.astmB8LbPerFt);
export const ASTM_B8_FORMULA = `round((spotPerLb + ${SPOT.millDrawFabricationPerLbUsd}) * ${SPOT.astmB8LbPerFt}, 2)`;
const STD_UNIT_CENTS = cents(LOW.catalogUnitPriceUsd);
const QTY_FT = ITEM.quantityFt;
const REELS = LOW.reelBarcodes;
const FT_PER_REEL = LOW.ftPerReel;
const STOCK_SQL = 'SELECT COALESCE(SUM(quantity), 0) FROM stock_stockitem WHERE part_id = ?';
const GENESIS = '0'.repeat(64);
const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
const fmtUsd = (c) => `${c < 0 ? '-' : ''}$${(Math.abs(c) / 100).toFixed(2)}`;
const sumCents = (legs) => legs.reduce((a, l) => a + l.amountCents, 0);

/** Converts every numeric `*Cents` key into a `*Usd` dollar value for API consumers. */
export const usdView = (v) => (Array.isArray(v) ? v.map(usdView)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => (k.endsWith('Cents') && typeof x === 'number'
    ? [`${k.slice(0, -5)}Usd`, x / 100] : [k, usdView(x)])))
    : v);

export class Refusal extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    Object.assign(this, { status, code, extra });
  }
}

/** Live COMEX HG spot: gold-api.com -> Yahoo HG=F -> deterministic contract reference. */
export async function fetchComexSpot({ offline = false, fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  const sources = offline ? [] : [
    ['gold-api.com', SPOT.primaryEndpoint, (j) => j?.price],
    ['yahoo-finance HG=F', SPOT.fallbackEndpoint, (j) => j?.chart?.result?.[0]?.meta?.regularMarketPrice],
  ];
  const attempts = [];
  for (const [source, url, pick] of sources) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: 'application/json', 'user-agent': '8090-p2p-app/0.1' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const spotPerLb = Number(pick(await res.json()));
      if (!(spotPerLb > 0.5 && spotPerLb < 50)) throw new Error(`implausible spot ${spotPerLb}`);
      return { source, url, live: true, spotPerLb, attempts };
    } catch (e) {
      attempts.push({ source, error: String(e?.message ?? e) });
    }
  }
  return { source: 'offline-reference', url: null, live: false, spotPerLb: SPOT.referenceSpotPerLbUsd, attempts };
}

// ---------- sandbox provisioning (seeds/* copy, contract fallback) ----------

function bootstrapWms(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE company_company(id INTEGER PRIMARY KEY, name TEXT NOT NULL, is_supplier INTEGER DEFAULT 1);
    CREATE TABLE part_part(id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT, units TEXT, minimum_stock REAL);
    CREATE TABLE part_partpricing(id INTEGER PRIMARY KEY, part_id INTEGER NOT NULL REFERENCES part_part(id), internal_cost_min REAL NOT NULL);
    CREATE TABLE part_supplierpart(id INTEGER PRIMARY KEY, part_id INTEGER REFERENCES part_part(id), supplier_id INTEGER REFERENCES company_company(id), SKU TEXT);
    CREATE TABLE stock_stocklocation(id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER REFERENCES stock_stocklocation(id));
    CREATE TABLE order_purchaseorder(id INTEGER PRIMARY KEY, reference TEXT UNIQUE NOT NULL, supplier_id INTEGER REFERENCES company_company(id), supplier_reference TEXT, status INTEGER, total_price REAL);
    CREATE TABLE order_purchaseorderlineitem(id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES order_purchaseorder(id), part_id INTEGER REFERENCES part_supplierpart(id), quantity REAL NOT NULL, purchase_price REAL);
    CREATE TABLE stock_stockitem(id INTEGER PRIMARY KEY, part_id INTEGER NOT NULL REFERENCES part_part(id), location_id INTEGER REFERENCES stock_stocklocation(id), purchase_order_id INTEGER REFERENCES order_purchaseorder(id), quantity REAL NOT NULL DEFAULT 0, batch TEXT);`);
  db.prepare('INSERT INTO company_company(id, name) VALUES (?, ?)').run(ITEM.wmsSupplierId, ITEM.vendorName);
  db.prepare('INSERT INTO part_part(id, name, description, units, minimum_stock) VALUES (?, ?, ?, ?, ?)').run(ITEM.wmsPartId, ITEM.sku, ITEM.description, ITEM.uom, LOW.minThresholdFt);
  db.prepare('INSERT INTO part_partpricing(part_id, internal_cost_min) VALUES (?, ?)').run(ITEM.wmsPartId, LOW.catalogUnitPriceUsd);
  db.prepare('INSERT INTO part_supplierpart(id, part_id, supplier_id, SKU) VALUES (?, ?, ?, ?)').run(ITEM.wmsSupplierPartId, ITEM.wmsPartId, ITEM.wmsSupplierId, ITEM.sku);
  db.prepare('INSERT INTO stock_stocklocation(id, name) VALUES (?, ?)').run(ITEM.wmsLocationId, 'WH-TX-NORTH');
  db.prepare('INSERT INTO stock_stockitem(part_id, location_id, quantity) VALUES (?, ?, ?)').run(ITEM.wmsPartId, ITEM.wmsLocationId, LOW.onHandStockFt);
  db.close();
}

function bootstrapHrm(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    CREATE TABLE hrm_beehive_department(beehive_fg_id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE hrm_employee(emp_id TEXT PRIMARY KEY, full_name TEXT NOT NULL, title TEXT, beehive_fg_id TEXT REFERENCES hrm_beehive_department(beehive_fg_id));
    CREATE TABLE hrm_doa_authority_seat(emp_id TEXT PRIMARY KEY REFERENCES hrm_employee(emp_id), approval_limit_usd REAL NOT NULL);`);
  db.prepare('INSERT INTO hrm_beehive_department VALUES (?, ?)').run('FG-11', 'Warehouse & Central Receiving Hub');
  for (const [id, o] of Object.entries(OFFICERS)) {
    db.prepare('INSERT INTO hrm_employee VALUES (?, ?, ?, ?)').run(id, o.name, o.title, 'FG-11');
    db.prepare('INSERT INTO hrm_doa_authority_seat VALUES (?, ?)').run(id, o.limitUsd);
  }
  db.close();
}

function bootstrapCrm(file) {
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE crm_vendor_account(id INTEGER PRIMARY KEY, name TEXT NOT NULL, wms_supplier_id INTEGER NOT NULL);');
  db.prepare('INSERT INTO crm_vendor_account VALUES (1, ?, ?)').run(ITEM.vendorName, ITEM.wmsSupplierId);
  db.close();
}

const accountDirectives = () => ['commodity $1000.00', ...Object.values(ACCOUNTS).map((a) => `account ${a}`)];
const bootstrapCoa = (file) => fs.writeFileSync(file, ['; contract-bootstrapped chart of accounts (WO-01 seeds absent)', ...accountDirectives(), ''].join('\n'));

const SOR_FILES = [
  ['wms', 'wms_seed.sqlite3', bootstrapWms],
  ['hrm', 'hrm_seed.sqlite3', bootstrapHrm],
  ['crm', 'crm_seed.sqlite3', bootstrapCrm],
  ['coa', 'coa_seed.journal', bootstrapCoa],
];

function provisionSandbox(seedsDir, dir) {
  if (fs.existsSync(seedsDir)) fs.cpSync(seedsDir, dir, { recursive: true });
  return Object.fromEntries(SOR_FILES.map(([key, file, build]) => {
    if (fs.existsSync(path.join(seedsDir, file))) return [key, 'seed'];
    build(path.join(dir, file));
    return [key, 'contract-bootstrap'];
  }));
}

const KERNEL_DB = 'p2p_kernel.sqlite3';
const OCR_TIMEOUT_MS = 60000;
const SAFE_DOC = /^[A-Za-z0-9][A-Za-z0-9.-]{0,80}$/;

/** Wipes only a directory that is absent, empty, or already a kernel sandbox (holds p2p_kernel.sqlite3). */
function safeRemove(abs) {
  if (!fs.existsSync(abs)) return;
  if (abs === path.parse(abs).root || ROOT.startsWith(abs + path.sep) || abs === path.resolve(ROOT)
    || (fs.readdirSync(abs).length && !fs.existsSync(path.join(abs, KERNEL_DB)))) {
    throw new Error(`refusing to wipe ${abs}: not an empty dir or a p2p kernel sandbox`);
  }
  fs.rmSync(abs, { recursive: true, force: true });
}

/** Insert into a SoR table using only the columns it actually has; NOT NULL gaps get neutral defaults. */
function adaptiveInsert(db, table, values) {
  try {
    const row = {};
    for (const c of db.prepare(`PRAGMA table_info("${table}")`).all()) {
      if (values[c.name] != null) row[c.name] = values[c.name];
      else if (c.notnull && c.dflt_value == null && !c.pk) row[c.name] = /INT|REAL|NUM|DEC|BOOL/i.test(c.type) ? 0 : '';
    }
    const cols = Object.keys(row);
    if (!cols.length) return { ok: false, error: `table ${table} absent` };
    const r = db.prepare(`INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(row));
    return { ok: true, id: Number(r.lastInsertRowid) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function adaptiveUpdate(db, table, values, keyCol, keyVal) {
  try {
    const have = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name));
    const cols = Object.keys(values).filter((c) => have.has(c));
    if (!cols.length || !have.has(keyCol)) return { ok: false, error: `table ${table} lacks columns` };
    const r = db.prepare(`UPDATE "${table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')} WHERE "${keyCol}" = ?`).run(...cols.map((c) => values[c]), keyVal);
    return { ok: r.changes > 0, changes: Number(r.changes) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const ledgerText = (txns) => [
  '; company.journal — generated by src/lineage_core.mjs (hledger --strict compatible)',
  ...accountDirectives(),
  '',
  ...txns.flatMap((t) => [
    `${t.date} * ${t.id} | ${t.memo}`,
    ...t.legs.map((l) => `    ${l.account.padEnd(56)}  ${fmtUsd(l.amountCents)}`),
    '',
  ]),
].join('\n');

function findHledger(explicit) {
  if (explicit === false || process.env.HLEDGER === '0') return null;
  if (explicit || process.env.HLEDGER_BIN) return explicit || process.env.HLEDGER_BIN;
  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    const bin = path.join(dir, 'hledger');
    try {
      fs.accessSync(bin, fs.constants.X_OK);
      return bin;
    } catch { /* not here */ }
  }
  return null;
}

// ---------- Steps 1-8 (each returns { detail, legs?, memo?, complete?, sor? }) ----------

function stockOutSignal(k, d) {
  const onHandFt = k.onHandFt();
  const minimumFt = k.minimumFt();
  if (onHandFt >= minimumFt) throw new Refusal(409, 'NO_STOCK_OUT', `${ITEM.sku} on hand ${onHandFt} FT >= ${minimumFt} FT minimum`);
  const stdUnitCents = k.stdUnitCents();
  d.req = { id: LOW.upstreamRequest, sku: ITEM.sku, partId: ITEM.wmsPartId, quantityFt: QTY_FT, stdUnitCents, stdTotalCents: stdUnitCents * QTY_FT, requester: 'EMP-0021', onHandFt, minimumFt };
  return { detail: { ...d.req, sql: STOCK_SQL } };
}

function plannerConfirm(k, d, body, actor) {
  const limitCents = k.limitCents(actor);
  d.req.confirmedBy = actor;
  d.req.routedTo = d.req.stdTotalCents > limitCents ? 'EMP-0005' : null;
  return { detail: { confirmed: true, request: d.req.id, stdTotalCents: d.req.stdTotalCents, plannerLimitCents: limitCents, escalatedTo: d.req.routedTo } };
}

function vpApprove(k, d, body, actor) {
  d.req.approvedBy = actor;
  return { detail: { approved: true, request: d.req.id, approver: actor, limitCents: k.limitCents(actor), stdTotalCents: d.req.stdTotalCents, handoff: CONTRACT.provenance.constellationHandoff } };
}

async function comexSpotBuy(k, d) {
  const quote = await fetchComexSpot({ offline: k.offline, fetchImpl: k.fetchImpl });
  const unitCents = astmB8UnitCents(quote.spotPerLb);
  const totalCents = unitCents * QTY_FT;
  if (totalCents > k.limitCents(BUYER.empId)) {
    throw new Refusal(403, 'DOA_LIMIT_EXCEEDED', `PO total ${fmtUsd(totalCents)} exceeds ${BUYER.name} ${fmtUsd(k.limitCents(BUYER.empId))} purchasing limit`);
  }
  const stdUnitCents = k.stdUnitCents();
  if (stdUnitCents !== d.req.stdUnitCents) throw new Refusal(409, 'STANDARD_COST_DRIFT', `Annual standard cost moved ${fmtUsd(d.req.stdUnitCents)} -> ${fmtUsd(stdUnitCents)}/FT`);
  d.po = {
    id: ITEM.dealId, document: DOCS.purchaseOrder, vendor: ITEM.vendorName, supplierId: ITEM.wmsSupplierId, buyer: BUYER.empId,
    quantityFt: QTY_FT, unitCents, totalCents, ppvFavorableCents: d.req.stdTotalCents - totalCents,
    comex: { ...quote, formula: ASTM_B8_FORMULA, millAdderPerLbUsd: SPOT.millDrawFabricationPerLbUsd, lbPerFt: SPOT.astmB8LbPerFt },
  };
  return { detail: { ...d.po, stdUnitCents, stdCostLocked: true }, sor: () => { d.po.wms = k.writePurchaseOrder(d.po); } };
}

async function vendorAcknowledgement(k, d) {
  const oa = { number: DOCS.orderAcknowledgementNumber, document: DOCS.orderAcknowledgement, po: d.po.id, vendor: d.po.vendor, quantityFt: d.po.quantityFt, unitCents: d.po.unitCents, totalCents: d.po.totalCents };
  d.oa = { ...oa, sha256: sha256(JSON.stringify(oa)) };
  if (k.ocrUrl) d.documents = await k.receiveDocuments();
  return { detail: { ...d.oa, glImpactCents: 0, documents: d.documents ?? [] }, sor: () => { d.oa.wms = k.updatePurchaseOrder(d.po, { supplier_reference: oa.number }); } };
}

function dockScan(k, d, body, actor) {
  const barcodes = body.barcodes ?? (body.barcode == null ? [] : [body.barcode]);
  if (!Array.isArray(barcodes) || !barcodes.length) throw new Refusal(422, 'NO_BARCODE', 'Provide barcode or barcodes[]');
  if (body.quantityFt !== undefined && body.quantityFt !== FT_PER_REEL) {
    throw new Refusal(422, 'INVALID_QUANTITY', `Each GS1 master reel is exactly ${FT_PER_REEL} FT; got ${JSON.stringify(body.quantityFt)}`);
  }
  const seen = new Set(d.scans.map((s) => s.barcode));
  for (const b of barcodes) {
    if (!REELS.includes(b)) throw new Refusal(422, 'UNKNOWN_REEL', `${JSON.stringify(b)} is not a ${d.po.id} reel (${REELS.join(', ')})`);
    if (seen.has(b)) throw new Refusal(409, 'DUPLICATE_SCAN', `${b} already received`);
    seen.add(b);
  }
  const at = k.now().toISOString();
  const fresh = barcodes.map((barcode) => ({ barcode, ft: FT_PER_REEL, actor, at }));
  d.scans.push(...fresh);
  const receivedFt = d.scans.length * FT_PER_REEL;
  const out = {
    complete: d.scans.length === REELS.length,
    detail: { scanned: barcodes, receivedFt, remainingReels: REELS.filter((r) => !seen.has(r)) },
    sor: () => fresh.forEach((s) => { s.wms = k.writeStock(s, d.po); }),
  };
  if (out.complete) {
    const ppv = d.req.stdTotalCents - d.po.totalCents;
    d.receipt = { bol: docId(DOCS.billOfLading), packingSlip: docId(DOCS.packingSlipAndMillCert), receivedFt, receivedBy: actor, stdTotalCents: d.req.stdTotalCents, actualCents: d.po.totalCents, ppvFavorableCents: ppv };
    out.detail.receipt = d.receipt;
    out.memo = `${d.po.id} dock receipt ${d.receipt.bol} ${REELS.length}x${FT_PER_REEL}-FT GS1 reels @ ${fmtUsd(d.req.stdUnitCents)}/FT std vs ${fmtUsd(d.po.unitCents)}/FT spot`;
    out.legs = [
      { account: ACCOUNTS.inventory, amountCents: d.req.stdTotalCents },
      { account: ACCOUNTS.grni, amountCents: -d.po.totalCents },
      { account: ACCOUNTS.ppv, amountCents: -ppv },
    ].filter((l) => l.amountCents !== 0);
  }
  return out;
}

function invoiceVariances(d, inv) {
  for (const f of ['quantityFt', 'unitPriceUsd', 'totalUsd']) {
    if (typeof inv[f] !== 'number' || !Number.isFinite(inv[f])) throw new Refusal(422, 'INVALID_INVOICE', `invoice.${f} must be a finite number`);
  }
  const receivedFt = d.scans.reduce((a, s) => a + s.ft, 0);
  const unitCents = cents(inv.unitPriceUsd);
  const totalCents = cents(inv.totalUsd);
  return [
    inv.poNumber !== d.po.id && { field: 'poNumber', ordered: d.po.id, invoiced: inv.poNumber },
    (inv.quantityFt !== d.po.quantityFt || inv.quantityFt !== receivedFt) && { field: 'quantityFt', ordered: d.po.quantityFt, received: receivedFt, invoiced: inv.quantityFt },
    unitCents !== d.po.unitCents && { field: 'unitPrice', orderedCents: d.po.unitCents, invoicedCents: unitCents },
    totalCents !== Math.round(unitCents * inv.quantityFt) && { field: 'pennyMath', expectedCents: Math.round(unitCents * inv.quantityFt), invoicedCents: totalCents },
    totalCents !== d.po.totalCents && { field: 'totalDue', orderedCents: d.po.totalCents, invoicedCents: totalCents },
  ].filter(Boolean);
}

const holdOn = (variances, source) => {
  if (variances.length) throw new Refusal(409, 'MATCH_VARIANCE_HOLD', `3-way match variance on ${variances.map((v) => v.field).join(', ')} (${source})`, { variances });
};

/** Claimed invoice fields must match first; with the OCR sidecar, the pixels on the received invoice must match too. */
async function threeWayMatch(k, d, body) {
  if (body.invoice != null && (typeof body.invoice !== 'object' || Array.isArray(body.invoice))) throw new Refusal(422, 'INVALID_INVOICE', 'invoice must be an object');
  const claimed = { poNumber: d.po.id, quantityFt: d.po.quantityFt, unitPriceUsd: d.po.unitCents / 100, totalUsd: d.po.totalCents / 100, source: 'po-derived', ...(body.invoice ?? {}) };
  holdOn(invoiceVariances(d, claimed), claimed.source);
  let inv = claimed;
  if (k.ocrUrl) {
    const read = await k.readInvoice();
    const received = d.documents?.find((doc) => doc.name === DOCS.vendorInvoice)?.sha256 ?? null;
    inv = { ...read.fields, poNumber: d.po.id, source: `ocr:${read.engine}`, sha256: read.sha256 };
    holdOn([
      read.sha256 !== received && { field: 'invoiceSha256', received, invoiced: read.sha256 },
      ...invoiceVariances(d, inv),
    ].filter(Boolean), inv.source);
    d.ocr = read.ocr;
  }
  const totalCents = cents(inv.totalUsd);
  d.match = { invoice: docId(DOCS.vendorInvoice), po: d.po.id, bol: d.receipt.bol, quantityFt: inv.quantityFt, totalCents, varianceCents: 0, source: inv.source, ...(inv.sha256 && { invoiceSha256: inv.sha256, ocrBoxes: d.ocr.boxes.length }) };
  return {
    detail: d.match,
    memo: `${d.po.id} 3-way match ${d.po.id}==${d.receipt.bol}==${d.match.invoice} GRNI -> Trade AP`,
    legs: [{ account: ACCOUNTS.grni, amountCents: d.po.totalCents }, { account: ACCOUNTS.tradeAp, amountCents: -d.po.totalCents }],
  };
}

function bankPolicy(k, body) {
  const bank = BANKS[String(body.bankAccount ?? '101100')];
  if (!bank) throw new Refusal(422, 'UNKNOWN_BANK_ACCOUNT', `bankAccount must be one of ${Object.keys(BANKS).join(', ')}`);
  const amount = k.amountFor(8);
  if (bank.capCents !== undefined && amount > bank.capCents) {
    throw new Refusal(403, 'BANK_POLICY_VIOLATION', `${bank.label} is blocked above ${fmtUsd(bank.capCents)}; ${fmtUsd(amount)} must clear ${BANKS[101100].label}`);
  }
  return bank;
}

function cfoPayment(k, d, body, actor) {
  const bank = bankPolicy(k, body);
  const amountCents = d.po.totalCents;
  const { checkNumber, achTrace } = ITEM.settlement;
  d.payment = { check: checkNumber, ach: achTrace, bankAccount: String(body.bankAccount ?? '101100'), bankLabel: bank.label, amountCents, approvedBy: actor, stamp: 'PAID', documents: [DOCS.purchaseOrder, DOCS.vendorInvoice] };
  return {
    detail: d.payment,
    memo: `${d.po.id} ${checkNumber} / ${achTrace} ${bank.label}`,
    legs: [{ account: ACCOUNTS.tradeAp, amountCents }, { account: bank.account, amountCents: -amountCents }],
    sor: () => { d.payment.wms = k.updatePurchaseOrder(d.po, { supplier_reference: `${d.oa.number} | PAID ${checkNumber} / ${achTrace}` }); },
  };
}

export const STEPS = [null,
  { name: 'SQL Stock-Out Signal', seats: [SYSTEM], run: stockOutSignal },
  { name: 'Planner Need Confirmation (Checkpoint #1)', seats: ['EMP-0021'], run: plannerConfirm },
  { name: 'VP Signing-Limit Approval (Checkpoint #2)', seats: ['EMP-0005'], approval: true, run: vpApprove },
  { name: 'Live COMEX Spot Buy & PO-25800', seats: [SYSTEM, BUYER.empId], run: comexSpotBuy },
  { name: 'Vendor Order Acknowledgement', seats: [SYSTEM, BUYER.empId], run: vendorAcknowledgement },
  { name: 'GS1 4-Reel Dock Scan, Std Cost & 501900 PPV (Checkpoint #3)', seats: ['EMP-0003'], sod: true, run: dockScan },
  { name: '3-Way Match GRNI -> Trade AP', seats: [SYSTEM, 'EMP-0001'], run: threeWayMatch },
  { name: 'CFO Payment Check #10045 (Checkpoint #4)', seats: ['EMP-0007'], approval: true, policy: bankPolicy, run: cfoPayment },
];

const initialState = () => ({
  steps: Object.fromEntries(STEPS.slice(1).map((_, i) => [i + 1, { status: 'pending' }])),
  req: null, po: null, oa: null, scans: [], receipt: null, match: null, payment: null,
});

const identityList = (identities) => [...new Set(identities
  .filter((v) => v != null && v !== '')
  .flatMap((v) => String(v).split(','))
  .map((v) => v.trim().toUpperCase())
  .filter(Boolean))];
export const stewardRefusal = () => new Refusal(403, 'AI_STEWARD_ZERO_AUTHORITY', `${AI.name} (${AI.id}) holds a $0.00 signing limit and 0 write credentials: read, orchestrate and nudge only`);
export const isStewardIdentity =(identities) => identityList(identities).some((id) => KAL_IDS.has(id));
/** Identity recorded on refusals: KAL wins whenever asserted anywhere, else the first claimed id. */
const claimedActor = (identities) => (isStewardIdentity(identities) ? AI.id
  : identityList(identities)[0]?.replace(/[^A-Z0-9-]/g, '').slice(0, 40) || SYSTEM);

// ---------- kernel ----------

export class P2PKernel {
  constructor({ sandboxDir, seedsDir, offline, fetchImpl, hledgerBin, fresh = true, now, ocrUrl } = {}) {
    this.dir = path.resolve(sandboxDir ?? process.env.SOR_SANDBOX_DIR ?? path.join(ROOT, 'sor-sandbox'));
    this.seedsDir = path.resolve(seedsDir ?? process.env.SOR_SEEDS_DIR ?? path.join(ROOT, 'seeds'));
    this.docsDir = path.join(this.dir, 'docs');
    // OCR sidecar (sidecar/invoice_ocr_engine.py serve, :3591). Must write into this.docsDir. null = PO-derived invoice.
    this.ocrUrl = (ocrUrl === undefined ? process.env.OCR_URL : ocrUrl) || null;
    this.offline = offline ?? process.env.COMEX_OFFLINE === '1';
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
    this.hledgerBin = findHledger(hledgerBin);
    this.now = now ?? (() => new Date());
    if (this.dir === this.seedsDir) throw new Error('sandboxDir must differ from seedsDir');
    this.ledgerPath = path.join(this.dir, 'company.journal');
    this.queue = Promise.resolve();
    this.lastHledger = { available: Boolean(this.hledgerBin), ok: null };
    this.#open(fresh);
  }

  #open(fresh) {
    if (fresh) safeRemove(this.dir);
    fs.mkdirSync(this.dir, { recursive: true });
    const kernelPath = path.join(this.dir, KERNEL_DB);
    const isNew = !fs.existsSync(kernelPath);
    const sources = isNew ? provisionSandbox(this.seedsDir, this.dir) : null;
    this.wms = new DatabaseSync(path.join(this.dir, 'wms_seed.sqlite3'));
    this.hrm = new DatabaseSync(path.join(this.dir, 'hrm_seed.sqlite3'));
    this.db = new DatabaseSync(kernelPath);
    this.wms.exec('PRAGMA foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kernel_state(k TEXT PRIMARY KEY, v TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS journal_leg(id INTEGER PRIMARY KEY, txn_id TEXT NOT NULL, step INTEGER NOT NULL, date TEXT NOT NULL, memo TEXT NOT NULL, account TEXT NOT NULL, amount_cents INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_chain(seq INTEGER PRIMARY KEY, at TEXT NOT NULL, step INTEGER NOT NULL, actor TEXT NOT NULL, event TEXT NOT NULL, payload TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL UNIQUE);
      CREATE TRIGGER IF NOT EXISTS journal_append_only_u BEFORE UPDATE ON journal_leg BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS journal_append_only_d BEFORE DELETE ON journal_leg BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_append_only_u BEFORE UPDATE ON audit_chain BEGIN SELECT RAISE(ABORT, 'audit chain is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_append_only_d BEFORE DELETE ON audit_chain BEGIN SELECT RAISE(ABORT, 'audit chain is append-only'); END;`);
    if (isNew) {
      this.#put('sources', sources);
      this.#put('workflow', initialState());
      this.#chain(0, SYSTEM, 'BOOT', { schema: CONTRACT.schema, sources, seedsDir: this.seedsDir });
      fs.writeFileSync(this.ledgerPath, ledgerText([]));
    }
    this.sources = this.#get('sources');
    this.state = this.#get('workflow');
  }

  #get(k) { return JSON.parse(this.db.prepare('SELECT v FROM kernel_state WHERE k = ?').get(k)?.v ?? 'null'); }

  #put(k, v) { this.db.prepare('INSERT INTO kernel_state(k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').run(k, JSON.stringify(v)); }

  close() {
    for (const db of [this.wms, this.hrm, this.db]) {
      try { db?.close(); } catch { /* already closed */ }
    }
  }

  // ----- SoR reads (contract fallback when a seed lacks the table/column) -----
  #scalar(db, sql, ...params) {
    try {
      const v = Object.values(db.prepare(sql).get(...params) ?? {})[0];
      return v == null ? null : Number(v);
    } catch { return null; }
  }

  onHandFt() { return this.#scalar(this.wms, STOCK_SQL, ITEM.wmsPartId) ?? this.state.scans.reduce((a, s) => a + s.ft, 0); }

  minimumFt() { return this.#scalar(this.wms, 'SELECT minimum_stock FROM part_part WHERE id = ?', ITEM.wmsPartId) ?? LOW.minThresholdFt; }

  stdUnitCents() {
    const v = this.#scalar(this.wms, 'SELECT internal_cost_min FROM part_partpricing WHERE part_id = ?', ITEM.wmsPartId);
    return v == null ? STD_UNIT_CENTS : cents(v);
  }

  officers() {
    const out = structuredClone(OFFICERS);
    try {
      for (const r of this.hrm.prepare('SELECT emp_id, approval_limit_usd FROM hrm_doa_authority_seat').all()) {
        if (out[r.emp_id] && Number.isFinite(Number(r.approval_limit_usd))) out[r.emp_id].limitUsd = Number(r.approval_limit_usd);
      }
    } catch { /* HRM seed without DOA table: contract roster stands */ }
    out[AI.id].limitUsd = 0; // KAL is zero-authority regardless of any seed value
    return out;
  }

  limitCents(empId) { return cents(this.officers()[empId]?.limitUsd ?? 0); }

  amountFor(step) {
    const std = this.state.req?.stdTotalCents ?? STD_UNIT_CENTS * QTY_FT;
    return step === 8 ? (this.state.po?.totalCents ?? std) : std;
  }

  // ----- SoR writes (best effort, outcome recorded on the workflow record) -----
  writePurchaseOrder(po) {
    const order = adaptiveInsert(this.wms, 'order_purchaseorder', { reference: po.id, supplier_id: po.supplierId, status: 20, total_price: po.totalCents / 100 });
    const line = order.ok
      ? adaptiveInsert(this.wms, 'order_purchaseorderlineitem', { order_id: order.id, part_id: ITEM.wmsSupplierPartId, quantity: po.quantityFt, purchase_price: po.unitCents / 100 })
      : { ok: false, error: 'order header not written' };
    return { orderId: order.id ?? null, order: order.ok ? 'ok' : order.error, line: line.ok ? 'ok' : line.error };
  }

  updatePurchaseOrder(po, values) {
    const r = adaptiveUpdate(this.wms, 'order_purchaseorder', values, 'reference', po.id);
    return r.ok ? 'ok' : (r.error ?? 'no matching order row');
  }

  writeStock(scan, po) {
    const r = adaptiveInsert(this.wms, 'stock_stockitem', { part_id: ITEM.wmsPartId, location_id: ITEM.wmsLocationId, quantity: scan.ft, batch: scan.barcode, purchase_order_id: po.wms?.orderId });
    return r.ok ? 'ok' : r.error;
  }

  // ----- OCR sidecar (proposals only; the kernel hashes, matches and posts) -----
  async #sidecar(route) {
    let res;
    let reply;
    try {
      res = await fetch(new URL(route, this.ocrUrl), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(OCR_TIMEOUT_MS) });
      reply = await res.json();
    } catch (e) {
      throw new Refusal(503, 'OCR_UNAVAILABLE', `OCR sidecar ${this.ocrUrl} ${route} failed: ${e?.message ?? e}`);
    }
    if (!res.ok) throw new Refusal(res.status === 409 ? 409 : 503, res.status === 409 ? 'DOCUMENT_INTEGRITY_HOLD' : 'OCR_UNAVAILABLE', `OCR sidecar ${route}: ${reply?.error ?? res.status} ${reply?.message ?? ''}`.trim());
    if (reply === null || typeof reply !== 'object' || Array.isArray(reply)) throw new Refusal(503, 'OCR_UNAVAILABLE', `OCR sidecar ${route} reply must be a JSON object, got ${JSON.stringify(reply)}`);
    return reply;
  }

  #docFile(name, ext) {
    if (typeof name !== 'string' || !SAFE_DOC.test(name) || !name.endsWith(ext)) throw new Refusal(503, 'OCR_UNAVAILABLE', `OCR sidecar returned an unsafe document name ${JSON.stringify(name)}`);
    return path.join(this.docsDir, name);
  }

  /** Sidecar renders the five trade PDFs; the kernel re-hashes each one on its own disk before recording it. */
  async receiveDocuments() {
    const { documents } = await this.#sidecar('/generate');
    const names = new Set(Object.values(DOCS).filter((v) => v.endsWith('.pdf')));
    if (!Array.isArray(documents) || documents.length !== names.size || documents.some((doc) => !names.has(doc?.name))) {
      throw new Refusal(503, 'OCR_UNAVAILABLE', `OCR sidecar must return the contract documents ${[...names].join(', ')}`);
    }
    return documents.map(({ name, sha256: reported }) => {
      let digest = null;
      try { digest = sha256(fs.readFileSync(this.#docFile(name, '.pdf'))); } catch { /* reported below */ }
      if (digest !== reported) throw new Refusal(409, 'DOCUMENT_INTEGRITY_HOLD', `${name} under ${this.docsDir} does not match the sidecar hash; start the sidecar with --docs-dir ${this.docsDir}`);
      return { name, sha256: digest, url: `/docs/${name}` };
    });
  }

  /** OCR of the invoice on disk: amount fields, its hash, and pixel boxes as {x, y, width, height} for the desk overlay. */
  async readInvoice() {
    const r = await this.#sidecar('/ocr');
    this.#docFile(r?.image, '.png');
    const { width, height } = r;
    const point = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
    if (!(width > 0 && height > 0 && /^[0-9a-f]{64}$/.test(r.sha256) && r.fields && Array.isArray(r.boxes)
      && r.boxes.every((b) => typeof b?.text === 'string' && Array.isArray(b.box) && b.box.length === 4 && b.box.every(point)))) {
      throw new Refusal(503, 'OCR_UNAVAILABLE', 'OCR sidecar reply is malformed');
    }
    const clamp = (v, max) => Math.min(Math.max(v, 0), max);
    const boxes = r.boxes.map(({ box, text, confidence }) => {
      const [xs, ys] = [box.map((p) => p[0]), box.map((p) => p[1])];
      const x = clamp(Math.floor(Math.min(...xs)), width);
      const y = clamp(Math.floor(Math.min(...ys)), height);
      return { text, confidence, x, y, width: clamp(Math.ceil(Math.max(...xs)), width) - x, height: clamp(Math.ceil(Math.max(...ys)), height) - y };
    }).filter((b) => b.width > 0 && b.height > 0);
    const fields = { quantityFt: Number(r.fields.quantityFt), unitPriceUsd: Number(r.fields.unitPriceUsd), totalUsd: Number(r.fields.totalUsd) };
    return { engine: r.engine, sha256: r.sha256, fields, ocr: { engine: r.engine, document: DOCS.vendorInvoice, sha256: r.sha256, imageUrl: `/docs/${r.image}`, width, height, boxes } };
  }

  // ----- guardrails -----
  #authorize(n, spec, identities, body) {
    if (isStewardIdentity(identities)) throw stewardRefusal();
    const ids = identityList(identities);
    if (ids.length > 1) throw new Refusal(403, 'ACTOR_MISMATCH', `Conflicting identities ${ids.join(' vs ')}`);
    const actor = ids[0] ?? SYSTEM;
    if (!/^[A-Z0-9-]{1,40}$/.test(actor)) throw new Refusal(400, 'BAD_ACTOR', 'actor must be an employee id such as EMP-0005');
    const officer = this.officers()[actor];
    if (actor !== SYSTEM && !officer) throw new Refusal(403, 'UNKNOWN_ACTOR', `${actor} holds no HRM authority seat`);
    if (!spec) return actor;
    if (officer && (spec.approval || (n === 2 && body.action === 'approve'))) {
      const amount = this.amountFor(n);
      if (cents(officer.limitUsd) < amount) {
        throw new Refusal(403, 'DOA_LIMIT_EXCEEDED', `${actor} ${officer.name} signing limit ${fmtUsd(cents(officer.limitUsd))} < ${this.state.req?.id ?? LOW.upstreamRequest} ${fmtUsd(amount)}; escalate to ${spec.seats.join('/')}${n === 2 ? ' via EMP-0005' : ''}`);
      }
    }
    if (!spec.seats.includes(actor)) {
      if (spec.sod && officer) {
        throw new Refusal(403, 'SOX_SOD_VIOLATION', `SOX 404: ${actor} ${officer.name} (${officer.title}) may not perform Step ${n} dock receipt; seat belongs to ${spec.seats.join('/')}`);
      }
      throw new Refusal(403, 'SEAT_NOT_AUTHORIZED', `Step ${n} requires ${spec.seats.join(' or ')}; ${actor} is not authorized`);
    }
    spec.policy?.(this, body);
    return actor;
  }

  #ensureOrder(n) {
    if (this.state.steps[n].status === 'complete') throw new Refusal(409, 'STEP_ALREADY_COMPLETE', `Step ${n} already complete (replay refused)`);
    if (n > 1 && this.state.steps[n - 1].status !== 'complete') throw new Refusal(409, 'STEP_OUT_OF_ORDER', `Step ${n - 1} must complete before Step ${n}`);
  }

  // ----- ledger -----
  #txns() {
    const txns = new Map();
    for (const r of this.db.prepare('SELECT txn_id, step, date, memo, account, amount_cents FROM journal_leg ORDER BY id').all()) {
      if (!txns.has(r.txn_id)) txns.set(r.txn_id, { id: r.txn_id, step: r.step, date: r.date, memo: r.memo, legs: [] });
      txns.get(r.txn_id).legs.push({ account: r.account, amountCents: r.amount_cents });
    }
    return [...txns.values()];
  }

  #hledgerCheck(file) {
    if (!this.hledgerBin) return { available: false, ok: null, reason: 'hledger not on PATH (JS penny verifier only)' };
    try {
      execFileSync(this.hledgerBin, ['-f', file, '--strict', 'check'], { stdio: 'pipe', timeout: 10000 });
      return { available: true, ok: true, command: 'hledger --strict check' };
    } catch (e) {
      return { available: true, ok: false, error: String(e.stderr || e.message).trim() };
    }
  }

  #gateLedger(txn) {
    const total = sumCents(txn.legs);
    if (total !== 0 || !txn.legs.every((l) => l.account && Number.isInteger(l.amountCents))) {
      throw new Refusal(500, 'UNBALANCED_JOURNAL', `${txn.id} DR-CR = ${fmtUsd(total)}; posting refused`);
    }
    const tmp = path.join(this.dir, 'company.journal.candidate');
    fs.writeFileSync(tmp, ledgerText([...this.#txns(), txn]));
    try {
      this.lastHledger = this.#hledgerCheck(tmp);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
    if (this.lastHledger.ok === false) throw new Refusal(500, 'LEDGER_STRICT_FAILED', this.lastHledger.error);
  }

  verifyJournal({ hledger = false } = {}) {
    const txns = this.#txns();
    const legs = txns.flatMap((t) => t.legs);
    const balances = {};
    for (const l of legs) balances[l.account] = (balances[l.account] ?? 0) + l.amountCents;
    const debitCents = legs.reduce((a, l) => a + Math.max(l.amountCents, 0), 0);
    const creditCents = legs.reduce((a, l) => a + Math.max(-l.amountCents, 0), 0);
    const unbalanced = txns.filter((t) => sumCents(t.legs) !== 0).map((t) => t.id);
    if (hledger) this.lastHledger = this.#hledgerCheck(this.ledgerPath);
    return {
      balanced: debitCents === creditCents && !unbalanced.length,
      debitCents, creditCents, unbalanced,
      entries: txns.map((t) => ({ ...t, legs: t.legs.map((l) => ({ account: l.account, debitCents: Math.max(l.amountCents, 0), creditCents: Math.max(-l.amountCents, 0) })) })),
      balances: Object.entries(balances).map(([account, balanceCents]) => ({ account, balanceCents })),
      hledger: this.lastHledger,
    };
  }

  // ----- audit chain -----
  #chain(step, actor, event, payload) {
    const last = this.db.prepare('SELECT seq, hash FROM audit_chain ORDER BY seq DESC LIMIT 1').get();
    const seq = (last?.seq ?? 0) + 1;
    const prev = last?.hash ?? GENESIS;
    const at = this.now().toISOString();
    const body = JSON.stringify(payload);
    this.db.prepare('INSERT INTO audit_chain VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(seq, at, step, actor, event, body, prev, sha256([prev, seq, at, step, actor, event, body].join('|')));
  }

  verifyChain({ entries = false } = {}) {
    const rows = this.db.prepare('SELECT * FROM audit_chain ORDER BY seq').all();
    let prev = GENESIS;
    for (const r of rows) {
      if (r.prev_hash !== prev || sha256([prev, r.seq, r.at, r.step, r.actor, r.event, r.payload].join('|')) !== r.hash) {
        return { valid: false, brokenAt: r.seq, length: rows.length };
      }
      prev = r.hash;
    }
    return { valid: true, length: rows.length, head: prev, ...(entries && { entries: rows.map((r) => ({ ...r, payload: JSON.parse(r.payload) })) }) };
  }

  // ----- commands -----
  #serial(fn) {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => {});
    return run;
  }

  act(step, request = {}) { return this.#serial(() => this.#act(Number(step), request)); }

  async #act(n, { identities = [], body = {} }) {
    const spec = STEPS[n];
    let actor = claimedActor(identities);
    try {
      actor = this.#authorize(n, spec, identities, body);
      if (!spec) throw new Refusal(404, 'NO_SUCH_STEP', `Step ${n} does not exist (1-8)`);
      this.#ensureOrder(n);
      const draft = structuredClone(this.state);
      const out = await spec.run(this, draft, body, actor);
      const txn = out.legs && { id: `JE-${String(this.#txns().length + 1).padStart(4, '0')}`, step: n, date: this.now().toISOString().slice(0, 10), memo: out.memo, legs: out.legs };
      if (txn) this.#gateLedger(txn);
      out.sor?.();
      draft.steps[n] = { status: out.complete === false ? 'in_progress' : 'complete', actor, at: this.now().toISOString() };
      this.#commit(draft, txn, () => this.#chain(n, actor, 'STEP', { ...out.detail, journal: txn?.id ?? null }));
      return { status: 200, body: usdView({ ok: true, step: n, name: spec.name, actor, status: draft.steps[n].status, detail: out.detail, journal: txn ?? null, state: this.snapshot() }) };
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      this.#chain(spec ? n : 0, actor, 'REFUSED', { code: e.code, message: e.message, bookImpactCents: 0 });
      return { status: e.status, body: usdView({ ok: false, step: n, actor, code: e.code, message: e.message, bookImpactCents: 0, ...e.extra }) };
    }
  }

  #commit(draft, txn, chain) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const ins = this.db.prepare('INSERT INTO journal_leg(txn_id, step, date, memo, account, amount_cents) VALUES (?, ?, ?, ?, ?, ?)');
      for (const l of txn?.legs ?? []) ins.run(txn.id, txn.step, txn.date, txn.memo, l.account, l.amountCents);
      this.#put('workflow', draft);
      chain();
      this.db.exec('COMMIT');
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
    this.state = draft;
    if (txn) fs.writeFileSync(this.ledgerPath, ledgerText(this.#txns()));
  }

  reset(identities = []) {
    return this.#serial(() => {
      let actor;
      try {
        actor = this.#authorize(0, null, identities, {});
      } catch (e) {
        if (!(e instanceof Refusal)) throw e;
        this.#chain(0, claimedActor(identities), 'REFUSED', { code: e.code, message: e.message, bookImpactCents: 0 });
        return { status: e.status, body: { ok: false, actor: claimedActor(identities), code: e.code, message: e.message, bookImpactUsd: 0 } };
      }
      this.close();
      this.#open(true);
      this.#chain(0, actor, 'RESET', { reseededFrom: this.seedsDir });
      return { status: 200, body: { ok: true, reset: true, state: this.snapshot() } };
    });
  }

  // ----- read models -----
  async quote() {
    const q = await fetchComexSpot({ offline: this.offline, fetchImpl: this.fetchImpl });
    const unitCents = astmB8UnitCents(q.spotPerLb);
    const stdTotalCents = this.amountFor(3);
    return usdView({ ...q, formula: ASTM_B8_FORMULA, unitCents, totalCents: unitCents * QTY_FT, stdUnitCents: this.stdUnitCents(), stdTotalCents, ppvFavorableCents: stdTotalCents - unitCents * QTY_FT, lockedPo: this.state.po });
  }

  health() {
    return { ok: true, service: '8090-p2p-app sor_3panel_server', schema: CONTRACT.schema, sandbox: this.dir, sources: this.sources, hledger: Boolean(this.hledgerBin), offlineComex: this.offline, ocrUrl: this.ocrUrl, audit: this.verifyChain() };
  }

  journalReport() { return usdView({ ...this.verifyJournal({ hledger: true }), ledger: fs.readFileSync(this.ledgerPath, 'utf8') }); }

  snapshot() {
    const s = this.state;
    const stdUnitCents = this.stdUnitCents();
    return usdView({
      schema: CONTRACT.schema, dealId: ITEM.dealId, vendor: ITEM.vendorName,
      sandbox: { dir: this.dir, sources: this.sources, offlineComex: this.offline, hledger: Boolean(this.hledgerBin) },
      officers: Object.entries(this.officers()).map(([empId, o]) => ({ empId, name: o.name, title: o.title, limitCents: cents(o.limitUsd) })),
      item: {
        partId: ITEM.wmsPartId, sku: ITEM.sku, description: ITEM.description, uom: ITEM.uom, onHandFt: this.onHandFt(), minimumFt: this.minimumFt(),
        reels: REELS, ftPerReel: FT_PER_REEL, stdUnitCents, stdTotalCents: stdUnitCents * QTY_FT, stdCostLocked: stdUnitCents === STD_UNIT_CENTS,
      },
      steps: STEPS.slice(1).map((spec, i) => ({ n: i + 1, name: spec.name, seats: spec.seats, ...s.steps[i + 1] })),
      req: s.req, po: s.po, oa: s.oa, scans: s.scans, receipt: s.receipt, match: s.match, payment: s.payment,
      documents: s.documents ?? [], ocr: s.ocr ?? null,
      journal: this.verifyJournal(),
      audit: this.verifyChain(),
    });
  }
}

export const openKernel = (opts) => new P2PKernel(opts);
