// Golden-Master 8-Step Workbench Engine, 5-Database Runtime Vault, Financial Statements, and KAL Brain.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { LineageCoreEngine, sha256Text } from './workbench_lineage.mjs';
import { listTablesWithCounts, handleTableRoute } from './table_explorer.mjs';
import { resolveHledgerBinary, fetchLiveCopperSpotQuote, serveArtifactRoute } from './documents.mjs';
import { KAL_KEYTERMS, DEFAULT_KAL_VOICE_ID, normalizeKalSpeech, normalizeInboundTranscript } from './voice.mjs';

export class SoxGuardrailError extends Error {
  constructor(message, statusCode = 403, blockMeta = null) {
    super(message);
    this.name = 'SoxGuardrailError';
    this.statusCode = statusCode;
    this.blockMeta = blockMeta;
  }
}

const BASE_SCENARIOS = {
  'PO-25800': {
    id: 'PO-25800',
    upstreamWo: 'REQ-25800',
    upstreamContext: 'WMS Stock-Out Signal (0 FT On Hand < 8,000 FT Minimum Stock) · WH-TX-NORTH',
    navTitle: 'PO-25800 · Encore Bare Copper',
    navSub: '8,000 FT · 4 Master Reels · ASTM B8 2/0 AWG',
    scenarioBadge: 'STOCK REPLENISHMENT (1 ITEM)',
    isNonPo: false,
    refInt: 25800,
    wmsSupplierId: 181,
    wmsSupplierPartId: 124,
    wmsPartId: 218,
    wmsLocationId: 469,
    reqDeptFgId: 'FG-11',
    glInventoryAsset: 'Assets:121100-WMS-Inventory-Stock',
    glGrirClearing: 'Liabilities:201200-GRNI-Goods-Received-Not-Invoiced',
    glPpvAccount: 'Expenses:501900-Purchase-Price-Variance',
    initialStockFt: 0,
    minThresholdFt: 8000,
    minStockValueUsd: 23120.00,
    catalogUnitPrice: 2.89,
    catalogEstimateUsd: 23120.00,
    spotCopperPerLbUsd: 6.2436,
    millDrawAdderPerLbUsd: 0.32,
    copperLbPerFt: 0.411,
    copperWeightLbs: 3288,
    weightLbs: 3288,
    reelCount: 4,
    reelFtEach: 2000,
    reelLbsEach: 822,
    reelBarcodes: [
      { seq: 1, serial: 'REEL-01', barcode: 'ENC-GS1-884192-R01', heatLot: 'HT-2611-884A', qtyFt: 2000, weightLbs: 822 },
      { seq: 2, serial: 'REEL-02', barcode: 'ENC-GS1-884192-R02', heatLot: 'HT-2611-884A', qtyFt: 2000, weightLbs: 822 },
      { seq: 3, serial: 'REEL-03', barcode: 'ENC-GS1-884192-R03', heatLot: 'HT-2611-884B', qtyFt: 2000, weightLbs: 822 },
      { seq: 4, serial: 'REEL-04', barcode: 'ENC-GS1-884192-R04', heatLot: 'HT-2611-884B', qtyFt: 2000, weightLbs: 822 },
    ],
    reelBreakdown: '4 x 2,000-FT Master Wooden Reels (822 lbs/reel = 3,288 lbs Cu · ASTM B8 0.411 lb/FT)',
    promisedDeliveryDate: '2026-11-13',
    unitPrice: 2.70,
    orderedQty: 8000,
    receivedQty: 8000,
    uom: 'FT',
    poFile: 'PO-25800.pdf',
    oaId: 'ENC-OA-2026-884192',
    oaFile: 'ENC-OA-2026-884192.pdf',
    grnId: 'BOL-25800',
    bolFile: 'BOL-25800.pdf',
    psId: 'PS-25800',
    psFile: 'PS-25800.pdf',
    deliveryDate: '2026-11-13',
    invoiceId: 'INV-25800',
    emlFile: 'EMAIL-INV-25800.eml',
    pdfFile: 'INV-25800.pdf',
    pngFile: 'INV-25800.png',
    checkNumber: 'Check #10045',
    achTrace: 'ACH-000582',
  },
};

const WORKFLOW_STEWARDS = [
  {
    id: 'WF-00',
    bossWorkflowId: 'WF-P2M-1A',
    constellation: 'P2M',
    constellationName: 'Plan, Supply Chain & Execute',
    stage: 'BUILD',
    code: 'WMS-SIGNAL',
    name: 'Supply Chain & Signing Limit Block',
    role: 'Squarely in P2M Supply Chain: detects 0 FT stock below 8,000 FT minimum ($23,120 standard), routes Darius ($20k Signing Limit) -> VP Devon ($100k Signing Limit), and hands REQ-25800 across into P2P.',
    purviewOwner: 'EMP-0021 ($20k) -> EMP-0005 ($100k)',
  },
  {
    id: 'WF-01',
    bossWorkflowId: 'WF-P2P-1A',
    constellation: 'P2P',
    constellationName: 'Procure to Pay',
    stage: 'BUILD',
    code: 'CENTRAL-BUY',
    name: 'Centralized Purchasing & Vendor OA Block',
    role: 'Checks live COMEX Copper Spot (~$2.70/FT = ~$21,600 vs $2.89/FT = $23,120 Annual Standard Cost), issues PO-25800 to Encore Wire, logs Vendor Ack ENC-OA-2026-884192, and calculates -$1,520 Favorable Purchase Price Variance (PPV).',
    purviewOwner: 'EMP-0002 · Nancy Rostova (Central Purchasing)',
  },
  {
    id: 'WF-02',
    bossWorkflowId: 'WF-P2P-1B',
    constellation: 'P2P',
    constellationName: 'Procure to Pay',
    stage: 'BUILD',
    code: 'DOCK-SCAN',
    name: 'Warehouse Dock Scan, Standard Cost & PPV Block',
    role: 'Scans 4 barcoded master reels (4 x 2,000 FT = +8,000 FT) into InvenTree stock with BOL-25800 + PS-25800; books 121100 Inventory at $23,120 Annual Standard Cost, 201200 GRNI at ~$21,600 Actual PO, and 501900 PPV at ~-$1,520 Favorable Variance.',
    purviewOwner: 'EMP-0003 · Marcus Vance (Dock Lead)',
  },
  {
    id: 'WF-03',
    bossWorkflowId: 'WF-P2P-1C',
    constellation: 'P2P',
    constellationName: 'Procure to Pay',
    stage: 'BUILD',
    code: 'OCR-3WAY',
    name: 'AP Intake, RapidOCR & 3-Way Match Block',
    role: 'Tags incoming INV-25800.pdf via RapidOCR and verifies PO == Dock Receiver == Invoice ($0.00 invoice variance -> Approved to Pay).',
    purviewOwner: 'EMP-0001 · Duncan Vance (Controller)',
  },
  {
    id: 'WF-04',
    bossWorkflowId: 'WF-P2P-1D',
    constellation: 'P2P',
    constellationName: 'Procure to Pay',
    stage: 'BUILD',
    code: 'CFO-CHECK',
    name: 'CFO Payment & Bank Disbursement Block',
    role: 'Enforces Segregation of Duties and Operating Bank 101100 (#8801) rules (blocking 101200 #4409 >$5k); cuts Check #10045 / ACH-000582 upon CFO Meredith Hale approval.',
    purviewOwner: 'EMP-0007 · Meredith Hale (CFO · $500k Signing Limit)',
  },
  {
    id: 'WF-05',
    bossWorkflowId: 'WF-P2P-2B',
    constellation: 'P2P',
    constellationName: 'Procure to Pay',
    stage: 'DEFINE',
    code: 'STD-COST-PPV',
    name: 'Annual Standard Cost & Purchase Price Variance (PPV) Block',
    role: 'Preserves FY2026 Annual Standard Cost ($2.89/FT) untouched all year and posts the spot-vs-standard variance (~-$1,520 Favorable PPV) to GAAP 501900 Purchase Price Variance.',
    purviewOwner: 'EMP-0001 · Duncan Vance (Controller) & Supply Chain',
  },
];

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256FileSafe(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return sha256Buffer(fs.readFileSync(filePath));
}

function fmtUsd(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

function ensureColumn(db, tableName, colName, colDef) {
  const existing = new Set(db.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name));
  if (!existing.has(colName)) {
    db.exec(`ALTER TABLE "${tableName}" ADD COLUMN ${colName} ${colDef}`);
  }
}

export function createWorkbenchEngine({
  rootDir,
  sandboxDir,
  seedsDir,
  kernelDocsDir,
  ocrUrl,
  offline = false,
  hledgerBin,
  fetchImpl = globalThis.fetch,
  voiceEnv = process.env,
  voiceTelemetry = null,
}) {
  const vaultDir = path.join(sandboxDir, 'workbench');
  const outboxDir = path.join(vaultDir, 'vendor-outbox');
  const apInboxDir = path.join(vaultDir, 'ap-inbox');

  const wmsDbPath = path.join(vaultDir, 'wms_inventree.sqlite3');
  const crmDbPath = path.join(vaultDir, 'crm_django.sqlite3');
  const hrmDbPath = path.join(vaultDir, 'hrm_people.sqlite3');
  const journalPath = path.join(vaultDir, 'company.journal');
  const lineageDbPath = path.join(vaultDir, 'lineage_core.sqlite3');

  const resolvedHledger = resolveHledgerBinary(hledgerBin);
  const ocrBase = typeof ocrUrl === 'string' && ocrUrl
    ? ocrUrl.replace(/\/+$/, '')
    : (ocrUrl === false ? null : `http://127.0.0.1:${Number(process.env.OCR_PORT || 3591)}`);

  const aiTelemetry = {
    ocrScans: 0,
    lastOcrLatencyMs: null,
    lastOcrConfidencePct: null,
    lastOcrBoxes: 0,
    pdfMints: 0,
    spotCalls: 0,
    lastSpotLatencyMs: null,
    lastSpotSource: null,
    lastSpotUsd: null,
    sttCalls: 0,
    lastSttLatencyMs: null,
    lastSttTranscript: '',
    ttsCalls: 0,
    lastTtsLatencyMs: null,
    lastTtsModel: null,
    totalAudioBytes: 0,
    kalBlockedAttempts: 0,
  };

  let activeScenarios = {};
  let runtimeState = {};
  let lineageCore = null;
  let journalAccountsMeta = {
    payrollAcct: 'Assets:101200-Payroll-Checking',
    equityAcct: 'Equity:301100-Common-Stock',
    ppvAcct: 'Expenses:501900-Purchase-Price-Variance',
  };

  function resolveSeedPath(fileName) {
    for (const dir of [seedsDir, path.join(rootDir, 'seeds'), sandboxDir].filter(Boolean)) {
      const cand = path.join(dir, fileName);
      if (fs.existsSync(cand)) return cand;
    }
    return null;
  }

  function sanitizeAndAlignSandboxDbs() {
    const hrm = new DatabaseSync(hrmDbPath);
    try {
      hrm.exec(`
        CREATE TABLE IF NOT EXISTS hrm_beehive_department (
          beehive_fg_id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        );
      `);
      hrm.prepare("INSERT OR IGNORE INTO hrm_beehive_department (beehive_fg_id, name) VALUES ('FG-11', 'Warehouse & Central Receiving Hub')").run();
      ensureColumn(hrm, 'hrm_doa_authority_seat', 'emp_code', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(hrm, 'hrm_doa_authority_seat', 'full_name', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(hrm, 'hrm_doa_authority_seat', 'role_title', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(hrm, 'hrm_doa_authority_seat', 'department', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(hrm, 'hrm_doa_authority_seat', 'p2p_sod_role', "TEXT NOT NULL DEFAULT ''");

      const seatAlignments = [
        ['EMP-0001', 'CTRL-01', 'Duncan Vance', 'Controller ($250k Signing Limit)', 'Finance & Accounting', 250000, 'AP Voucher & 3-Way Match Override ($250k Signing Limit)'],
        ['EMP-0002', 'PROC-01', 'Nancy Rostova', 'Centralized Purchasing Lead ($50k Signing Limit)', 'Centralized Purchasing', 50000, 'Centralized Purchasing: Live Spot Lock & PO Execution ($50k Signing Limit)'],
        ['EMP-0003', 'DOCK-01', 'Marcus Vance', 'Warehouse Dock Lead (Scan Gun)', 'Warehouse & Central Receiving Hub', 0, 'Physical Dock RF Reel Scan & Bay 4 Receipt'],
        ['EMP-0005', 'OPS-01', 'Devon Brooks', 'VP Supply Chain ($100k Signing Limit)', 'Supply Chain & Operations', 100000, 'Supply Chain Escalation Approver ($100k Signing Limit)'],
        ['EMP-0007', 'CFO-01', 'Meredith Hale', 'Chief Financial Officer ($500k Signing Limit)', 'Executive Finance', 500000, 'Treasury Check #10045 & ACH Disbursement ($500k Signing Limit)'],
        ['EMP-0021', 'SC-PLAN-01', 'Darius Mercer', 'Supply Chain Inventory Planner ($20k Signing Limit)', 'Supply Chain & Inventory Planning', 20000, 'Supply Chain Stock-Out Planner ($20k Signing Limit)'],
      ];
      const updSeat = hrm.prepare(`
        UPDATE hrm_doa_authority_seat
        SET emp_code = ?, full_name = ?, role_title = ?, department = ?, approval_limit_usd = ?, p2p_sod_role = ?
        WHERE emp_id = ?
      `);
      for (const [empId, code, name, title, dept, limit, sod] of seatAlignments) {
        updSeat.run(code, name, title, dept, limit, sod, empId);
      }
      hrm.prepare(`
        UPDATE hrm_doa_authority_seat
        SET emp_code = 'KAL-STEWARD',
            full_name = 'KAL',
            role_title = 'Zero-Authority Workflow Steward (Read, Orchestrate & Nudge Only)',
            department = 'AI Workflow Governance',
            p2p_sod_role = 'AI_STEWARD_READ_AND_NUDGE_ONLY ($0.00 Signing Limit · 0 Ledger/Bank Credentials)'
        WHERE emp_id = 'EMP-AI-KAL'
      `).run();
    } finally {
      hrm.close();
    }

    const wms = new DatabaseSync(wmsDbPath);
    try {
      ensureColumn(wms, 'company_company', 'description', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'company_company', 'website', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'company_company', 'is_supplier', 'INTEGER NOT NULL DEFAULT 1');
      ensureColumn(wms, 'part_part', 'description', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'part_partpricing', 'purchase_cost_min', 'NUMERIC');
      ensureColumn(wms, 'part_partpricing', 'overall_min', 'NUMERIC');
      ensureColumn(wms, 'stock_stocklocation', 'description', "TEXT NOT NULL DEFAULT ''");

      ensureColumn(wms, 'order_purchaseorder', 'description', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorder', 'creation_date', 'TEXT');
      ensureColumn(wms, 'order_purchaseorder', 'issue_date', 'TEXT');
      ensureColumn(wms, 'order_purchaseorder', 'link', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorder', 'supplier_reference', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorder', 'reference_int', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(wms, 'order_purchaseorder', 'barcode_data', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorder', 'barcode_hash', "TEXT NOT NULL DEFAULT ''");

      ensureColumn(wms, 'order_purchaseorderlineitem', 'reference', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorderlineitem', 'received', 'NUMERIC NOT NULL DEFAULT 0');
      ensureColumn(wms, 'order_purchaseorderlineitem', 'notes', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorderlineitem', 'link', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'order_purchaseorderlineitem', 'line', "TEXT NOT NULL DEFAULT '1'");
      ensureColumn(wms, 'order_purchaseorderlineitem', 'line_int', 'INTEGER NOT NULL DEFAULT 1');
      ensureColumn(wms, 'order_purchaseorderlineitem', 'discount', 'NUMERIC NOT NULL DEFAULT 0');
      ensureColumn(wms, 'order_purchaseorderlineitem', 'purchase_price_currency', "TEXT NOT NULL DEFAULT 'USD'");

      ensureColumn(wms, 'stock_stockitem', 'serial', 'TEXT');
      ensureColumn(wms, 'stock_stockitem', 'packaging', 'TEXT');
      ensureColumn(wms, 'stock_stockitem', 'delete_on_deplete', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(wms, 'stock_stockitem', 'status', 'INTEGER NOT NULL DEFAULT 10');
      ensureColumn(wms, 'stock_stockitem', 'supplier_part_id', 'INTEGER');
      ensureColumn(wms, 'stock_stockitem', 'purchase_order_id', 'INTEGER');
      ensureColumn(wms, 'stock_stockitem', 'link', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'stock_stockitem', 'is_building', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(wms, 'stock_stockitem', 'serial_int', 'INTEGER NOT NULL DEFAULT 0');
      ensureColumn(wms, 'stock_stockitem', 'barcode_data', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'stock_stockitem', 'barcode_hash', "TEXT NOT NULL DEFAULT ''");
      ensureColumn(wms, 'stock_stockitem', 'batch', 'TEXT');

      wms.prepare('DELETE FROM stock_stockitem').run();
      wms.prepare('DELETE FROM order_purchaseorderlineitem').run();
      wms.prepare('DELETE FROM order_purchaseorder').run();
      wms.prepare('DELETE FROM part_supplierpart WHERE id != 124').run();
      wms.prepare('DELETE FROM part_partpricing WHERE part_id != 218').run();
      wms.prepare('DELETE FROM part_part WHERE id != 218').run();

      wms.prepare(`
        UPDATE company_company
        SET name = 'Encore Wire Corporation',
            description = 'Industrial Bare & Insulated Copper Conductor Mill (McKinney, TX)',
            website = 'https://www.encorewire.com'
        WHERE id = 181
      `).run();
      wms.prepare(`
        UPDATE part_part
        SET IPN = 'ITM-CU-20-BARE',
            name = '2/0 AWG Bare Stranded Copper Wire (2,000-FT Master Reel)',
            description = 'ASTM B8 19-Strand Bare Copper Conductor (4 x 2,000-FT Barcoded Reels = 8,000 FT Min Stock · 0.411 lb/FT = 3,288 lbs Cu)',
            units = 'FT',
            minimum_stock = 8000
        WHERE id = 218
      `).run();
      wms.prepare("UPDATE part_supplierpart SET SKU = 'ITM-CU-20-BARE' WHERE id = 124").run();
      wms.prepare(`
        UPDATE part_partpricing
        SET internal_cost_min = 2.89,
            purchase_cost_min = 2.89,
            overall_min = 2.89
        WHERE part_id = 218
      `).run();
    } finally {
      wms.close();
    }
  }

  function detectWmsStockOutFromSql() {
    const wms = new DatabaseSync(wmsDbPath, { readOnly: true });
    try {
      const row = wms.prepare(`
        SELECT p.id AS part_id,
               p.IPN AS ipn,
               p.name AS part_name,
               p.units AS units,
               p.minimum_stock AS minimum_stock,
               COALESCE(pp.internal_cost_min, 2.89) AS standard_unit_cost,
               COALESCE((SELECT SUM(s.quantity) FROM stock_stockitem s WHERE s.part_id = p.id), 0) AS on_hand_qty
        FROM part_part p
        LEFT JOIN part_partpricing pp ON pp.part_id = p.id
        WHERE p.minimum_stock > 0
        ORDER BY p.id ASC
        LIMIT 1
      `).get();
      if (!row) return null;
      const onHandFt = Number(row.on_hand_qty || 0);
      const minFt = Number(row.minimum_stock || 8000);
      const deficitFt = Math.max(0, minFt - onHandFt);
      const stdUnitUsd = Number(Number(row.standard_unit_cost || 2.89).toFixed(2));
      const stdTotalUsd = Number(((deficitFt || minFt) * stdUnitUsd).toFixed(2));
      return {
        partId: row.part_id,
        ipn: row.ipn,
        partName: row.part_name,
        units: row.units || 'FT',
        onHandFt,
        minFt,
        deficitFt,
        isStockOut: onHandFt < minFt,
        standardUnitUsd: stdUnitUsd,
        standardTotalUsd: stdTotalUsd,
      };
    } finally {
      wms.close();
    }
  }

  function queryDoaSeatByCodeOrId(codeOrEmpId) {
    const upper = String(codeOrEmpId || '').toUpperCase().trim();
    if (upper === 'KAL' || upper === 'EMP-AI-KAL' || upper === 'CAL' || upper === 'AGT-8090-KAL-01') {
      return {
        empId: 'EMP-AI-KAL',
        name: 'KAL (AI P2P Workflow Steward)',
        role: 'Zero-Authority Workflow Steward (Read, Orchestrate & Nudge Only)',
        limitUsd: 0,
        sodRole: 'AI_STEWARD_READ_AND_NUDGE_ONLY ($0.00 Signing Limit · 0 Ledger/Bank Credentials)',
        isAiSteward: true,
      };
    }
    const db = new DatabaseSync(hrmDbPath, { readOnly: true });
    try {
      const row = db.prepare('SELECT emp_id, emp_code, full_name, role_title, approval_limit_usd, p2p_sod_role FROM hrm_doa_authority_seat WHERE emp_code = ? OR emp_id = ? LIMIT 1').get(codeOrEmpId, codeOrEmpId);
      if (!row) return { empId: 'TBD', name: 'Pending Seat', role: 'Unassigned', limitUsd: 0 };
      return {
        empId: row.emp_id,
        name: row.full_name,
        role: row.role_title,
        limitUsd: Number(row.approval_limit_usd || 0),
        sodRole: row.p2p_sod_role,
      };
    } finally {
      db.close();
    }
  }

  function queryDeptByFgId(fgId) {
    if (!fgId) return { deptId: 'TBD', deptName: 'Pending Lineage Resolution' };
    const db = new DatabaseSync(hrmDbPath, { readOnly: true });
    try {
      const row = db.prepare('SELECT beehive_fg_id, name FROM hrm_beehive_department WHERE beehive_fg_id = ?').get(fgId);
      return row ? { deptId: row.beehive_fg_id, deptName: row.name } : { deptId: fgId, deptName: 'Operations Hub' };
    } finally {
      db.close();
    }
  }

  function enrichDealFromLiveDatabases(sc, st) {
    let vendorName = 'Encore Wire Corporation';
    let itemCanonical = 'ITM-CU-20-BARE';
    let itemName = '2/0 AWG Bare Stranded Copper Wire (2,000-FT Master Reel)';
    let locationName = 'WH-TX-NORTH';
    let onHandStockFt = sc.initialStockFt;
    let minThresholdFt = sc.minThresholdFt;
    let standardUnitPrice = sc.catalogUnitPrice;
    let syncedCatalogUnitPrice = sc.catalogUnitPrice;

    const wms = new DatabaseSync(wmsDbPath, { readOnly: true });
    try {
      const sup = wms.prepare('SELECT id, name FROM company_company WHERE id = ?').get(sc.wmsSupplierId);
      const part = wms.prepare('SELECT id, IPN, name, minimum_stock FROM part_part WHERE id = ?').get(sc.wmsPartId);
      const sp = wms.prepare('SELECT id, SKU FROM part_supplierpart WHERE id = ?').get(sc.wmsSupplierPartId);
      const pp = wms.prepare('SELECT internal_cost_min, purchase_cost_min FROM part_partpricing WHERE part_id = ?').get(sc.wmsPartId);
      const loc = wms.prepare('SELECT id, name, description FROM stock_stocklocation WHERE id = ?').get(sc.wmsLocationId);
      const stockSum = wms.prepare('SELECT COALESCE(SUM(quantity), 0) AS total_ft FROM stock_stockitem WHERE part_id = ?').get(sc.wmsPartId);
      const partCount = wms.prepare('SELECT COUNT(*) AS c FROM part_part').get().c;
      if (sup) vendorName = sup.name;
      if (part) {
        itemCanonical = part.IPN || (sp ? sp.SKU : `PART-${part.id}`);
        itemName = part.name;
        if (part.minimum_stock) minThresholdFt = Number(part.minimum_stock);
      }
      if (pp && Number(pp.internal_cost_min) > 0) {
        standardUnitPrice = Number(Number(pp.internal_cost_min).toFixed(2));
      }
      if (pp && Number(pp.purchase_cost_min) > 0) {
        syncedCatalogUnitPrice = Number(Number(pp.purchase_cost_min).toFixed(2));
      }
      if (loc) locationName = `${loc.name}${loc.description ? ' · ' + loc.description : ''}`;
      if (stockSum) onHandStockFt = Number(stockSum.total_ft);
      sc.stockedItemCountInWms = Number(partCount || 1);
    } finally {
      wms.close();
    }

    sc.catalogUnitPrice = standardUnitPrice;
    sc.catalogEstimateUsd = Number((sc.orderedQty * standardUnitPrice).toFixed(2));
    sc.minStockValueUsd = sc.catalogEstimateUsd;

    const scPlanner = queryDoaSeatByCodeOrId('EMP-0021');
    const reqSigner = queryDoaSeatByCodeOrId('OPS-01');
    const flowOwner = queryDoaSeatByCodeOrId('PROC-01');
    const dockSigner = queryDoaSeatByCodeOrId('DOCK-01');

    const llmRes = st.llmResolution;
    const deptInfo = llmRes
      ? { deptId: llmRes.resolved_dept_fg_id, deptName: llmRes.resolved_dept_name }
      : queryDeptByFgId(sc.reqDeptFgId);

    const poAmount = Number((sc.orderedQty * sc.unitPrice).toFixed(2));
    const catalogEstimateUsd = Number(sc.catalogEstimateUsd || poAmount);
    const spotSavingsPotentialUsd = Number((catalogEstimateUsd - poAmount).toFixed(2));

    const apSigner = queryDoaSeatByCodeOrId('EMP-0001');
    const achSigner = queryDoaSeatByCodeOrId('EMP-0007');

    const ocrTotal = st.wf3_ocr_result?.extracted?.totalDue?.value;
    const invoiceAmount = ocrTotal != null ? Number(ocrTotal) : poAmount;
    const receiptAmount = Number((sc.receivedQty * sc.unitPrice).toFixed(2));
    const leakage = invoiceAmount > receiptAmount
      ? Number((invoiceAmount - receiptAmount).toFixed(2))
      : 0;

    return {
      ...sc,
      vendorName,
      itemCanonical,
      itemName,
      locationName,
      onHandStockFt,
      onHandValueUsd: Number((onHandStockFt * standardUnitPrice).toFixed(2)),
      minThresholdFt,
      belowThresholdFt: Math.max(0, minThresholdFt - onHandStockFt),
      isBelowThreshold: onHandStockFt < minThresholdFt,
      deptId: deptInfo.deptId,
      deptName: deptInfo.deptName,
      glDebitAccount: sc.glInventoryAsset,
      glClearingAccount: sc.glGrirClearing,
      glPpvAccount: sc.glPpvAccount || journalAccountsMeta.ppvAcct,
      glApAccount: llmRes ? llmRes.gaap_credit_account : 'Liabilities:201100-AP-Trade-Payables',
      catalogEstimateUsd,
      syncedCatalogUnitPrice,
      ppvPerFtUsd: Number((sc.unitPrice - standardUnitPrice).toFixed(2)),
      ppvTotalUsd: Number((poAmount - catalogEstimateUsd).toFixed(2)),
      spotSavingsPotentialUsd,
      poAmount,
      receiptAmount,
      invoiceAmount,
      leakage,
      scPlanner,
      reqSigner,
      buyerSigner: flowOwner,
      flowOwner,
      dockSigner,
      apSigner,
      achSigner,
    };
  }

  function makeInitialRuntimeFor(sc) {
    return {
      kal_started: false,
      wf0_req_status: 'stock_out_alert',
      wf0_req_approved: 'pending',
      reqRef: sc.upstreamWo,
      wf1_spot_checked: false,
      spotQuote: null,
      wf1_po_committed: 'pending',
      wf1_catalog_synced: false,
      syncedCatalogUnitPrice: sc.catalogUnitPrice,
      wf1_vendor_ack: 'pending',
      wf1_ack_verified: false,
      poSha256: null,
      oaSha256: null,
      bolSha256: null,
      psSha256: null,
      wf2_dock_received: 'pending',
      wf3_mailbox_polled: false,
      wf3_ocr_result: null,
      wf3_eml_text: null,
      wf3_eml_sha256: null,
      wf3_pdf_sha256: null,
      llmResolution: null,
      wf4_match_status: 'pending',
      wf3_match_confirmed: false,
      wf4_ach_released: false,
      checkNumber: null,
      achTrace: null,
      poPaidStamp: null,
      invoicePaidStamp: null,
      debitMemoRef: null,
      poDbId: null,
      stockItemId: null,
      voucherRef: null,
      achRef: null,
      savedUsd: 0,
      spotSavingsLockedUsd: 0,
      stewardTimings: {},
      activeVoiceRole: 'ops_steward',
      lastGuardrailBlock: null,
      lastVoiceBrief: null,
      auditLog: [],
    };
  }

  function recordAuditEvent(dealId, stepCode, actor, summary, artifactHash) {
    const st = runtimeState[dealId];
    if (!st) return;
    st.auditLog.push({
      ts: new Date().toISOString(),
      stepCode,
      actor,
      summary,
      artifactHash: artifactHash || sha256FileSafe(journalPath),
    });
  }

  function initSandbox() {
    fs.mkdirSync(vaultDir, { recursive: true });
    fs.mkdirSync(outboxDir, { recursive: true });
    fs.mkdirSync(apInboxDir, { recursive: true });
    for (const f of fs.readdirSync(apInboxDir)) {
      fs.rmSync(path.join(apInboxDir, f), { force: true });
    }

    const wmsSrc = resolveSeedPath('wms_seed.sqlite3');
    const crmSrc = resolveSeedPath('crm_seed.sqlite3');
    const hrmSrc = resolveSeedPath('hrm_seed.sqlite3');
    const coaSrc = resolveSeedPath('coa_seed.journal') || path.join(sandboxDir, 'ledger.journal');

    fs.copyFileSync(wmsSrc, wmsDbPath);
    fs.copyFileSync(crmSrc, crmDbPath);
    fs.copyFileSync(hrmSrc, hrmDbPath);
    sanitizeAndAlignSandboxDbs();

    const rawCoa = coaSrc && fs.existsSync(coaSrc) ? fs.readFileSync(coaSrc, 'utf8') : '';
    const declaredSet = new Set(
      rawCoa
        .split(/\r?\n/)
        .filter(l => l.startsWith('account '))
        .map(l => l.replace(/^account\s+/, '').split(';')[0].trim())
    );
    journalAccountsMeta = {
      payrollAcct: declaredSet.has('Assets:101200-Payroll-Imprest-Checking')
        ? 'Assets:101200-Payroll-Imprest-Checking'
        : 'Assets:101200-Payroll-Checking',
      equityAcct: declaredSet.has('Equity:301100-Sponsor-Member-Capital')
        ? 'Equity:301100-Sponsor-Member-Capital'
        : 'Equity:301100-Common-Stock',
      ppvAcct: declaredSet.has('Expenses:501900-Purchase-Price-Variance-PPV')
        ? 'Expenses:501900-Purchase-Price-Variance-PPV'
        : 'Expenses:501900-Purchase-Price-Variance',
    };

    let journalBody = rawCoa.trimEnd();
    if (!journalBody.includes('GJ-OPEN-2026-001')) {
      journalBody += `\n\n2026-01-01 * (GJ-OPEN-2026-001) Opening Treasury Cash & Ring-Fenced Payroll Baseline  ; docType:GJ, subledger:TREASURY\n    Assets:101100-Operating-Checking                   $250,000.00\n    ${journalAccountsMeta.payrollAcct.padEnd(50)} $140,000.00\n    ${journalAccountsMeta.equityAcct.padEnd(50)}-$390,000.00`;
    }
    fs.writeFileSync(journalPath, journalBody + '\n', 'utf8');

    if (!lineageCore) {
      lineageCore = new LineageCoreEngine({
        lineageDbPath,
        wmsDbPath,
        crmDbPath,
        hrmDbPath,
        journalPath,
        sandboxDir: vaultDir,
      });
    } else {
      lineageCore.ensureSchema();
    }
    lineageCore.resetTransactionHops();
    lineageCore.seedVerifiedP2PDefaults();

    activeScenarios = {
      'PO-25800': {
        ...BASE_SCENARIOS['PO-25800'],
        glPpvAccount: journalAccountsMeta.ppvAcct,
        reelBarcodes: BASE_SCENARIOS['PO-25800'].reelBarcodes.map(r => ({ ...r })),
      },
    };

    runtimeState = {};
    for (const [id, sc] of Object.entries(activeScenarios)) {
      runtimeState[id] = makeInitialRuntimeFor(sc);
      const sqlStock = detectWmsStockOutFromSql();
      const deal = enrichDealFromLiveDatabases(sc, runtimeState[id]);
      const wmsHash = sha256FileSafe(wmsDbPath);

      lineageCore.recordHop({
        txId: id,
        stepNum: 0,
        stepName: 'Step 1 · WMS SQL Stock-Out Signal',
        sourceElement: `WMS.part_part(id=${deal.wmsPartId}, on_hand=${sqlStock ? sqlStock.onHandFt : 0} FT < min=${deal.minThresholdFt} FT)`,
        sourceValue: `Stock-Out on ${deal.itemCanonical} -> Alerts Supply Chain (${deal.scPlanner.name}, $20k Signing Limit)`,
        targetSystem: 'WMS',
        targetTable: 'part_part',
        targetPk: `id=${deal.wmsPartId}`,
        targetColumn: 'minimum_stock',
        targetValue: `0 FT on hand < ${fmtInt(deal.minThresholdFt)} FT minimum (${fmtUsd(deal.catalogEstimateUsd)} @ $${deal.catalogUnitPrice.toFixed(2)}/FT standard)`,
        actorType: 'STEWARD_GATE',
        actorId: 'SQL:WMS-STOCK-MONITOR',
        actorName: 'Deterministic WMS Stock-Out Block',
        authoritySource: 'InvenTree part_part.minimum_stock + part_partpricing.internal_cost_min',
        doaLimitUsd: null,
        controlTags: 'AI_GOV_L1,AI_GOV_L2,WMS_ZERO_STOCK_TRIGGER',
        gateVerdict: 'STOCK_OUT_TRIGGER_FIRED',
        evidenceSha256: wmsHash,
      });
      recordAuditEvent(
        id,
        'STEP-1-WMS-SIGNAL',
        'SQL:WMS-STOCK-MONITOR',
        `InvenTree SQL check: ${deal.itemCanonical} on-hand is 0 FT < ${fmtInt(deal.minThresholdFt)} FT minimum (${fmtUsd(deal.catalogEstimateUsd)} @ $${deal.catalogUnitPrice.toFixed(2)}/FT standard). Queued for Supply Chain Planner ${deal.scPlanner.name} ($20,000 Signing Limit).`,
        wmsHash
      );
    }
  }

  initSandbox();

  function computePureJsJournalSnapshot() {
    const raw = fs.existsSync(journalPath) ? fs.readFileSync(journalPath, 'utf8') : '';
    const lines = raw.split(/\r?\n/);
    const declaredAccounts = [];
    const balancesCents = new Map();
    const txBlocks = [];
    let currentBlock = null;
    let strictOk = true;

    const flushTx = () => {
      if (!currentBlock) return;
      if (currentBlock.txSumCents !== 0 || currentBlock.postingCount < 2) strictOk = false;
      txBlocks.push(currentBlock.lines.join('\n'));
      currentBlock = null;
    };

    for (const line of lines) {
      const acctDecl = line.match(/^account\s+([^\s;]+)/);
      if (acctDecl) {
        declaredAccounts.push(acctDecl[1]);
        continue;
      }
      if (/^\d{4}-\d{2}-\d{2}\b/.test(line)) {
        flushTx();
        currentBlock = { lines: [line], txSumCents: 0, postingCount: 0 };
        continue;
      }
      if (currentBlock) {
        if (!line.trim()) {
          flushTx();
        } else {
          currentBlock.lines.push(line);
          const stripped = line.replace(/;.*$/, '').trim();
          const postMatch = stripped.match(/^([^\s]+)\s+(-?\$?[\d,]+(?:\.\d+)?|-?\d[\d,]*(?:\.\d+)?\s*\$?)/);
          if (postMatch) {
            const acct = postMatch[1];
            if (declaredAccounts.length > 0 && !declaredAccounts.includes(acct)) strictOk = false;
            const numStr = postMatch[2].replace(/[$,\s]/g, '');
            const cents = Math.round(Number(numStr) * 100);
            if (!Number.isFinite(cents)) {
              strictOk = false;
            } else {
              currentBlock.txSumCents += cents;
              currentBlock.postingCount += 1;
              balancesCents.set(acct, (balancesCents.get(acct) || 0) + cents);
            }
          }
        }
      }
    }
    flushTx();

    const nonZero = [...balancesCents.entries()].filter(([, c]) => c !== 0).sort(([a], [b]) => a.localeCompare(b));
    const balLines = nonZero.map(([acct, c]) => {
      const sign = c < 0 ? '-' : '';
      const absUsd = (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${(`${sign}$${absUsd}`).padStart(14)}  ${acct}`;
    });
    if (balLines.length > 0) {
      balLines.push('--------------------');
      const net = nonZero.reduce((s, [, c]) => s + c, 0);
      balLines.push(`${(net === 0 ? '0' : (net / 100).toFixed(2)).padStart(14)}`);
    }

    return {
      accountCount: declaredAccounts.length,
      accounts: declaredAccounts,
      balText: balLines.join('\n') || `0.00  (All ${declaredAccounts.length} GAAP Accounts at $0.00 Opening Baseline)`,
      printText: txBlocks.join('\n\n') || '; No journal entries posted yet — GL remains $0.00 until physical dock scan-in (Step 6).',
      strictBalanced: strictOk,
      engineMode: 'pure-js-strict-fallback',
      journalSha256: sha256FileSafe(journalPath),
    };
  }

  function getHledgerSnapshot() {
    if (!resolvedHledger) {
      return computePureJsJournalSnapshot();
    }
    try {
      const balOut = execFileSync(resolvedHledger, ['-f', journalPath, 'bal', '--no-elide'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const printOut = execFileSync(resolvedHledger, ['-f', journalPath, 'print'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const accountsOut = execFileSync(resolvedHledger, ['-f', journalPath, 'accounts'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      const accountList = accountsOut ? accountsOut.split(/\r?\n/).filter(Boolean) : [];
      let strictOk = true;
      try {
        execFileSync(resolvedHledger, ['-f', journalPath, 'check', '--strict'], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        strictOk = false;
      }
      return {
        accountCount: accountList.length,
        accounts: accountList,
        balText: balOut || `0.00  (All ${accountList.length} GAAP Accounts at $0.00 Opening Baseline)`,
        printText: printOut || '; No journal entries posted yet — GL remains $0.00 until physical dock scan-in (Step 6).',
        strictBalanced: strictOk,
        engineMode: 'hledger-cli-strict',
        journalSha256: sha256FileSafe(journalPath),
      };
    } catch {
      return computePureJsJournalSnapshot();
    }
  }

  function appendJournalEntry(entryText) {
    fs.appendFileSync(journalPath, '\n' + entryText + '\n', 'utf8');
  }

  function postSidecarJson(routePath, bodyObj) {
    if (!ocrBase) return Promise.resolve(null);
    const parsedUrl = new URL(routePath, ocrBase.endsWith('/') ? ocrBase : ocrBase + '/');
    const payload = JSON.stringify(bodyObj);
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: parsedUrl.hostname,
        port: Number(parsedUrl.port),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(new Error(parsed?.message || parsed?.error || `Sidecar HTTP ${res.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  function writeFallbackOutboxArtifacts(sc) {
    const files = [sc.poFile, sc.oaFile, sc.bolFile, sc.psFile, sc.pdfFile];
    for (const f of files) {
      const p = path.join(outboxDir, f);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, `%PDF-1.4\n% ${f} fallback artifact\n%%EOF\n`, 'utf8');
      }
    }
    const pngPath = path.join(outboxDir, sc.pngFile);
    if (!fs.existsSync(pngPath)) {
      const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(pngPath, tinyPng);
    }
  }

  async function callWarmMintDocs(mintPayload) {
    try {
      const res = await postSidecarJson('/mint', { outDir: outboxDir, ...mintPayload });
      if (res) {
        aiTelemetry.pdfMints += 1;
        return res;
      }
    } catch {}
    const sc = activeScenarios['PO-25800'];
    writeFallbackOutboxArtifacts(sc);
    return {
      ok: true,
      poSha256: sha256FileSafe(path.join(outboxDir, sc.poFile)),
    };
  }

  async function callWarmRapidOcr(inputPath, previewPngPath, sc) {
    const t0 = performance.now();
    try {
      const parsed = await postSidecarJson('/scan', { inputPath, previewPngPath });
      if (parsed) {
        const now = new Date();
        aiTelemetry.ocrScans += 1;
        aiTelemetry.lastOcrLatencyMs = parsed.elapsedMs || Math.round(performance.now() - t0);
        aiTelemetry.lastOcrConfidencePct = parsed.avgConfidence ? Number((parsed.avgConfidence * 100).toFixed(1)) : null;
        aiTelemetry.lastOcrBoxes = Array.isArray(parsed.boxes) ? parsed.boxes.length : (parsed.boxCount || 0);
        parsed.ocrEndpoint = `POST ${ocrBase}/scan`;
        parsed.ocrEngine = parsed.engine || 'RapidOCR ONNX (PP-OCRv4 + PDFium/ReportLab)';
        parsed.calledAtIso = now.toISOString();
        parsed.calledAtLocal = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
        parsed.scanRunCount = aiTelemetry.ocrScans;
        return parsed;
      }
    } catch (err) {
      if (typeof ocrUrl === 'string' && ocrUrl) throw err;
    }

    // Deterministic offline fallback when sidecar is not running
    writeFallbackOutboxArtifacts(sc);
    if (!fs.existsSync(previewPngPath)) {
      fs.copyFileSync(path.join(outboxDir, sc.pngFile), previewPngPath);
    }
    const totalUsd = Number((sc.orderedQty * sc.unitPrice).toFixed(2));
    const now = new Date();
    aiTelemetry.ocrScans += 1;
    aiTelemetry.lastOcrLatencyMs = Math.max(1, Math.round(performance.now() - t0));
    aiTelemetry.lastOcrConfidencePct = 99.4;
    aiTelemetry.lastOcrBoxes = 28;
    const boxes = Array.from({ length: 28 }, (_, i) => ({
      id: i + 1,
      text: `OCR-LINE-${i + 1}`,
      confidence: 0.994,
      rect: { x: 40, y: 40 + i * 25, w: 320, h: 18 },
      quad: [[40, 40 + i * 25], [360, 40 + i * 25], [360, 58 + i * 25], [40, 58 + i * 25]],
    }));
    return {
      engine: 'RapidOCR ONNX (Offline Fallback)',
      ocrEndpoint: `POST ${ocrBase || 'http://127.0.0.1:3591'}/scan`,
      ocrEngine: 'RapidOCR ONNX (Offline Fallback)',
      calledAtIso: now.toISOString(),
      calledAtLocal: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }),
      scanRunCount: aiTelemetry.ocrScans,
      elapsedMs: aiTelemetry.lastOcrLatencyMs,
      fileSha256: sha256FileSafe(inputPath),
      imageWidth: 1275,
      imageHeight: 1650,
      previewPng: path.basename(previewPngPath),
      boxCount: 28,
      avgConfidence: 0.994,
      boxes,
      rawLines: boxes.map(b => b.text),
      extracted: {
        vendorName: { value: 'ENCORE WIRE CORPORATION', confidence: 0.995, sourceBoxId: 1 },
        invoiceNumber: { value: sc.invoiceId, confidence: 0.995, sourceBoxId: 2 },
        invoiceDate: { value: sc.deliveryDate, confidence: 0.995, sourceBoxId: 3 },
        poReference: { value: sc.id, confidence: 0.995, sourceBoxId: 4 },
        sku: { value: 'ITM-CU-20-BARE', confidence: 0.995, sourceBoxId: 5 },
        description: { value: '2/0 AWG Bare Stranded Copper Wire (4 x 2,000-FT Reels)', confidence: 0.995, sourceBoxId: 6 },
        quantity: { value: sc.orderedQty, confidence: 0.995, sourceBoxId: 7 },
        unitPrice: { value: sc.unitPrice, confidence: 0.995, sourceBoxId: 8 },
        totalDue: { value: totalUsd, confidence: 0.995, sourceBoxId: 9 },
      },
      mathVerified: true,
    };
  }

  function rejectAiStewardWriteAttempt(dealId, stepCode, attemptedDesc) {
    const st = runtimeState[dealId];
    aiTelemetry.kalBlockedAttempts += 1;
    const errHash = sha256Text(`${dealId}:KAL_ZERO_AUTH:${stepCode}:${Date.now()}`);
    const msg = `AI STEWARD AUTHORITY BLOCKED (HTTP 403): KAL holds a $0.00 Signing Limit and zero DB, GL, or bank write credentials. Attempted "${attemptedDesc}" rejected by deterministic kernel ($0.00 book/bank impact).`;
    lineageCore.recordHop({
      txId: dealId,
      stepNum: 0,
      stepName: 'Guardrail · Rogue KAL Write Attempt Blocked',
      sourceElement: 'Actor.EMP-AI-KAL ($0.00 Signing Limit)',
      sourceValue: attemptedDesc,
      targetSystem: 'LEDGER',
      targetTable: 'company.journal',
      targetPk: 'KAL-WRITE-DENIED',
      targetColumn: 'signing_limit_usd',
      targetValue: 'BLOCKED_403_AI_STEWARD_ZERO_AUTHORITY ($0.00 posted)',
      actorType: 'SENTINEL_GATE',
      actorId: 'SENTINEL:KAL-ZERO-WRITE',
      actorName: 'Deterministic 3-Plane AI Segregation Enforcer',
      authoritySource: 'SOX & 4-Layer Workflow Control + HRM Signing Limits ($0.00 AI Cap)',
      doaLimitUsd: 0,
      controlTags: 'AI_GOV_L1,AI_GOV_L4,KAL_ZERO_WRITE_ENFORCED',
      gateVerdict: 'BLOCKED_403_AI_STEWARD_ZERO_AUTHORITY',
      evidenceSha256: errHash,
    });
    st.lastGuardrailBlock = {
      ts: new Date().toISOString(),
      code: 'AI_STEWARD_ZERO_AUTHORITY',
      httpStatus: 403,
      layer: 'Layer 1 Workflow Control · AI Steward Zero-Authority Boundary ($0.00 Signing Limit)',
      step: stepCode,
      attemptedActor: 'EMP-AI-KAL · KAL (AI Steward · $0.00 Signing Limit)',
      requiredActor: 'Verified Named Human Officer + Upstream DB Preconditions',
      sha256: errHash,
      message: msg,
    };
    st.activeVoiceRole = 'treasury_steward';
    st.lastVoiceBrief = 'Guardrail block! As an AI workflow steward, KAL holds a $0.00 Signing Limit and zero ledger or bank credentials. Unauthorized token buy or check cut rejected.';
    recordAuditEvent(dealId, 'KAL-403-BLOCKED', 'SENTINEL:KAL-ZERO-WRITE', msg, errHash);
    throw new SoxGuardrailError(msg, 403, st.lastGuardrailBlock);
  }

  async function executeWorkflowAction(dealId, action, opts = {}) {
    const sc = activeScenarios[dealId];
    const st = runtimeState[dealId];
    if (!sc || !st) throw new Error('Invalid dealId');

    if (action === 'kal_rogue_attempt') {
      rejectAiStewardWriteAttempt(
        dealId,
        'AI-GUARD',
        opts.attemptDetail || 'Create unbacked $5,000 AI Compute Token PO & cut Check to unapproved vendor'
      );
    }
    const upperActor = String(opts.actingEmpId || '').toUpperCase().trim();
    if (upperActor === 'KAL' || upperActor === 'EMP-AI-KAL' || upperActor === 'CAL' || upperActor === 'AGT-8090-KAL-01') {
      rejectAiStewardWriteAttempt(dealId, String(action || 'STEP').toUpperCase(), `Sign human checkpoint ${action} as AI Steward KAL`);
    }

    let deal = enrichDealFromLiveDatabases(sc, st);

    if (action === 'wf0_detect_stockout') {
      const sqlStock = detectWmsStockOutFromSql();
      if (!sqlStock || !sqlStock.isStockOut) {
        throw new Error('WMS stock is above minimum — no stock-out signal exists.');
      }
      st.kal_started = true;
      st.lastGuardrailBlock = null;
      st.activeVoiceRole = 'ops_steward';
      st.lastVoiceBrief = `Good day. We have a stock-out demand signal from Supply Chain—0 feet of 2/0 AWG bare copper on hand against our 8,000-foot minimum—now in Darius Mercer's queue. Review Requisition REQ-25800 on screen and click Approve to confirm.`;
      recordAuditEvent(
        dealId,
        'STEP-1-KAL-START',
        'KAL (Read-Only Steward) + SQL:WMS-STOCK-MONITOR',
        `Verified InvenTree stock-out (${sqlStock.onHandFt} FT < ${fmtInt(sqlStock.minFt)} FT min · ${fmtUsd(sqlStock.standardTotalUsd)} standard). Nudged Supply Chain Planner ${deal.scPlanner.name} ($20,000 Signing Limit).`,
        sha256FileSafe(wmsDbPath)
      );
      return;
    }

    if (action === 'kal_auto_purchasing') {
      if (st.wf0_req_status !== 'approved') {
        throw new Error('VP Supply Chain approval (Step 3) is required before Centralized Purchasing executes.');
      }
      await executeWorkflowAction(dealId, 'wf1_check_spot');
      await executeWorkflowAction(dealId, 'wf1_commit_po');
      await executeWorkflowAction(dealId, 'wf1_vendor_ack');
      st.wf1_ack_verified = true;
      deal = enrichDealFromLiveDatabases(sc, st);
      st.activeVoiceRole = 'ops_steward';
      st.lastVoiceBrief = `Devon signed the requisition. Centralized Purchasing locked live COMEX copper with Encore Wire at $${sc.unitPrice.toFixed(2)} per foot—${fmtUsd(deal.poAmount)} total, a ${fmtUsd(st.spotSavingsLockedUsd)} favorable variance—and logged Encore's acknowledgement. Marcus, scan the four barcoded reels at the dock.`;
      return;
    }

    if (action === 'steward_autorun') {
      const tStart = performance.now();
      st.kal_started = true;
      if (st.wf0_req_status === 'stock_out_alert') await executeWorkflowAction(dealId, 'wf0_submit_req');
      if (st.wf0_req_status === 'pending_manager_doa') await executeWorkflowAction(dealId, 'wf0_approve_req');
      if (!st.wf1_spot_checked) await executeWorkflowAction(dealId, 'wf1_check_spot');
      if (st.wf1_po_committed === 'pending') await executeWorkflowAction(dealId, 'wf1_commit_po');
      if (st.wf1_vendor_ack === 'pending') await executeWorkflowAction(dealId, 'wf1_vendor_ack');
      st.wf1_ack_verified = true;
      if (st.wf2_dock_received === 'pending') await executeWorkflowAction(dealId, 'wf2_dock_receipt');
      if (!st.wf3_mailbox_polled) await executeWorkflowAction(dealId, 'wf3_poll_and_ocr', opts);
      st.wf3_match_confirmed = true;
      st.stewardTimings.roundTotalMs = Math.round(performance.now() - tStart);
      deal = enrichDealFromLiveDatabases(sc, st);
      st.activeVoiceRole = 'treasury_steward';
      st.lastVoiceBrief = `Steps 1 through 7 verified. 3-Way Match approved at ${fmtUsd(deal.receiptAmount)} with $0.00 variance. Waiting on CFO Meredith Hale to sign Check #10045.`;
      return;
    }

    if (action === 'wf0_submit_req' && st.wf0_req_status === 'stock_out_alert') {
      st.kal_started = true;
      st.activeVoiceRole = 'ops_steward';
      st.lastGuardrailBlock = null;
      st.wf0_req_status = 'pending_manager_doa';
      const wmsHash = sha256FileSafe(wmsDbPath);

      lineageCore.recordHop({
        txId: dealId,
        stepNum: 0,
        stepName: 'Step 2 · Supply Chain Confirm ($20k Signing Limit Escalated)',
        sourceElement: `Planner.${deal.scPlanner.empId} (${deal.scPlanner.name} · $20,000 Signing Limit)`,
        sourceValue: `${sc.upstreamWo}: ${fmtInt(deal.orderedQty)} FT (${fmtInt(sc.copperWeightLbs)} lbs Cu) @ $${sc.catalogUnitPrice.toFixed(2)}/FT Std = ${fmtUsd(deal.catalogEstimateUsd)}`,
        targetSystem: 'HRM',
        targetTable: 'hrm_doa_authority_seat',
        targetPk: deal.reqSigner.empId,
        targetColumn: 'approval_limit_usd',
        targetValue: `ESCALATED_OVER_20K_SIGNING_LIMIT (${fmtUsd(deal.catalogEstimateUsd)} > $20,000) -> Routed to ${deal.reqSigner.empId} (${deal.reqSigner.name} · $100k Signing Limit)`,
        actorType: 'HUMAN',
        actorId: deal.scPlanner.empId,
        actorName: deal.scPlanner.name,
        authoritySource: 'HRM.hrm_doa_authority_seat ($20,000 Signing Limit Enforced)',
        doaLimitUsd: deal.scPlanner.limitUsd,
        controlTags: 'SOX_SOD_PLANNER,AI_GOV_L1,DOA_ESCALATION_20K',
        gateVerdict: 'ESCALATED_NEEDS_VP_APPROVAL',
        evidenceSha256: wmsHash,
      });

      st.lastVoiceBrief = `Darius confirmed 8,000 feet at ${fmtUsd(deal.catalogEstimateUsd)} standard cost. That exceeds his $20,000 Signing Limit—routed to VP Devon Brooks for approval.`;
      recordAuditEvent(
        dealId,
        'STEP-2-SC-CONFIRMED',
        `${deal.scPlanner.empId} (${deal.scPlanner.name} · $20k Signing Limit)`,
        `Confirmed stock-out requisition ${sc.upstreamWo} for ${fmtInt(deal.orderedQty)} FT (${fmtUsd(deal.catalogEstimateUsd)} standard). Exceeds $20,000 Signing Limit -> Escalated to VP ${deal.reqSigner.name} ($100,000 Signing Limit).`,
        wmsHash
      );
      return;
    }

    if (action === 'wf0_approve_req' && (st.wf0_req_status === 'pending_manager_doa' || (opts.redTeamDemo && opts.actingEmpId))) {
      const actingSeat = queryDoaSeatByCodeOrId(opts.actingEmpId || deal.reqSigner.empId);
      if (actingSeat.limitUsd < deal.catalogEstimateUsd || actingSeat.empId === deal.scPlanner.empId) {
        const errHash = sha256Text(`${dealId}:WF00:DOA_BLOCK:${actingSeat.empId}:${Date.now()}`);
        const msg = `SIGNING LIMIT BLOCKED (HTTP 403): ${actingSeat.empId} (${actingSeat.name}) holds a ${fmtUsd(actingSeat.limitUsd)} Signing Limit and cannot approve ${sc.upstreamWo} (${fmtUsd(deal.catalogEstimateUsd)}). VP approval required: ${deal.reqSigner.empId} (${deal.reqSigner.name} · ${fmtUsd(deal.reqSigner.limitUsd)} Signing Limit).`;
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 0,
          stepName: 'Step 3 · Signing Limit Violation Blocked',
          sourceElement: `AttemptedApprover.${actingSeat.empId} (${actingSeat.name})`,
          sourceValue: `Attempted approval of ${fmtUsd(deal.catalogEstimateUsd)} with ${fmtUsd(actingSeat.limitUsd)} Signing Limit`,
          targetSystem: 'HRM',
          targetTable: 'hrm_doa_authority_seat',
          targetPk: actingSeat.empId,
          targetColumn: 'approval_limit_usd',
          targetValue: `BLOCKED_SIGNING_LIMIT (Requires >= ${fmtUsd(deal.catalogEstimateUsd)})`,
          actorType: 'SENTINEL_GATE',
          actorId: 'SENTINEL:HRM-SIGNING-LIMIT',
          actorName: 'Signing Limit Enforcer',
          authoritySource: 'HRM.hrm_doa_authority_seat',
          doaLimitUsd: actingSeat.limitUsd,
          controlTags: 'AI_GOV_L1,AI_GOV_L4,DOA_LIMIT_BLOCKED',
          gateVerdict: 'BLOCKED_403_DOA_LIMIT',
          evidenceSha256: errHash,
        });
        st.lastGuardrailBlock = {
          ts: new Date().toISOString(),
          code: 'DOA_LIMIT_EXCEEDED',
          httpStatus: 403,
          layer: 'Signing Limit Control ($20,000 Planner Cap)',
          step: 'WF-00',
          attemptedActor: `${actingSeat.empId} · ${actingSeat.name} ($20k Signing Limit)`,
          requiredActor: `${deal.reqSigner.empId} · ${deal.reqSigner.name} ($100k Signing Limit)`,
          sha256: errHash,
          message: msg,
        };
        st.activeVoiceRole = 'ops_steward';
        st.lastVoiceBrief = `Signing Limit block! ${actingSeat.name} holds a $20,000 Signing Limit and cannot approve ${fmtUsd(deal.catalogEstimateUsd)}. VP ${deal.reqSigner.name} must sign.`;
        recordAuditEvent(dealId, 'STEP-3-LIMIT-403', `SENTINEL:SIGNING-LIMIT (Blocked ${actingSeat.empId})`, msg, errHash);
        throw new SoxGuardrailError(msg, 403, st.lastGuardrailBlock);
      }

      st.lastGuardrailBlock = null;
      st.activeVoiceRole = 'ops_steward';
      st.wf0_req_status = 'approved';
      st.wf0_req_approved = 'done';
      const hrmHash = sha256FileSafe(hrmDbPath);

      lineageCore.recordHop({
        txId: dealId,
        stepNum: 0,
        stepName: 'Step 3 · VP Signing Limit Approval',
        sourceElement: `${sc.upstreamWo} (${fmtUsd(deal.catalogEstimateUsd)} Standard Ceiling)`,
        sourceValue: `Approved ${fmtInt(deal.orderedQty)} FT replenishment -> Released to Centralized Purchasing`,
        targetSystem: 'HRM',
        targetTable: 'hrm_doa_authority_seat',
        targetPk: actingSeat.empId,
        targetColumn: 'approval_limit_usd',
        targetValue: `${actingSeat.empId} (${fmtUsd(actingSeat.limitUsd)} Signing Limit >= ${fmtUsd(deal.catalogEstimateUsd)})`,
        actorType: 'HUMAN',
        actorId: actingSeat.empId,
        actorName: actingSeat.name,
        authoritySource: 'HRM.hrm_doa_authority_seat (VP $100,000 Signing Limit)',
        doaLimitUsd: actingSeat.limitUsd,
        controlTags: 'SOX_SOD_REQ_APPROVER,AI_GOV_L1,AI_GOV_L4',
        gateVerdict: 'SUPPLY_CHAIN_REQ_APPROVED',
        evidenceSha256: hrmHash,
      });

      st.lastVoiceBrief = `VP ${actingSeat.name} signed ${sc.upstreamWo} under his $100,000 Signing Limit. Releasing to Centralized Purchasing for live COMEX spot buy.`;
      recordAuditEvent(
        dealId,
        'STEP-3-VP-SIGNED',
        `${actingSeat.empId} (${actingSeat.name} · $100k Signing Limit)`,
        `Approved ${sc.upstreamWo} (${fmtInt(deal.orderedQty)} FT · ${fmtUsd(deal.catalogEstimateUsd)} ceiling) -> Signing tree complete; released to Centralized Purchasing.`,
        hrmHash
      );
      return;
    }

    if (action === 'wf1_check_spot') {
      if (st.wf0_req_status !== 'approved') {
        throw new Error('VP Supply Chain approval (Step 3) is required before Centralized Purchasing checks live spot pricing.');
      }
      st.lastGuardrailBlock = null;
      st.activeVoiceRole = 'ops_steward';
      const quote = await fetchLiveCopperSpotQuote(sc, { offline, fetchImpl, aiTelemetry });
      st.spotQuote = quote;
      st.wf1_spot_checked = true;
      sc.spotCopperPerLbUsd = quote.spotPerLbUsd;
      sc.unitPrice = quote.lockedUnitPriceFt;
      deal = enrichDealFromLiveDatabases(sc, st);

      const quoteHash = sha256Text(JSON.stringify(quote));
      const isFav = quote.savingsVsCatalogUsd >= -0.005;
      const absVarUsd = Math.abs(quote.savingsVsCatalogUsd);
      lineageCore.recordHop({
        txId: dealId,
        stepNum: 1,
        stepName: 'Step 4 · Live COMEX Copper Spot Check',
        sourceElement: quote.feedSource,
        sourceValue: `COMEX Cu $${quote.spotPerLbUsd.toFixed(4)}/lb + $${quote.millDrawPerLbUsd.toFixed(2)} Adder x 0.411 lb/FT -> $${quote.lockedUnitPriceFt.toFixed(2)}/FT (${fmtUsd(quote.quotedTotalUsd)})`,
        targetSystem: 'LINEAGE',
        targetTable: 'lc_hop_lineage',
        targetPk: dealId,
        targetColumn: 'spot_quote_usd',
        targetValue: isFav
          ? `Beats ${fmtUsd(quote.catalogEstimateUsd)} Standard by ${fmtUsd(absVarUsd)} Favorable`
          : `${fmtUsd(absVarUsd)} Unfavorable Market Variance vs ${fmtUsd(quote.catalogEstimateUsd)} Std (Within $50k Buyer Limit)`,
        actorType: 'STEWARD_GATE',
        actorId: 'BLOCK:SPOT-PRICE-API',
        actorName: 'Centralized Purchasing Spot Engine',
        authoritySource: quote.feedSource,
        doaLimitUsd: null,
        controlTags: 'AI_GOV_L2,AI_GOV_L3,LIVE_COMEX_SPOT_API',
        gateVerdict: isFav ? 'SPOT_BEATS_CATALOG' : 'SPOT_WITHIN_BUYER_DOA',
        evidenceSha256: quoteHash,
      });

      st.lastVoiceBrief = isFav
        ? `Devon signed the ceiling. Central Purchasing called live COMEX copper at $${quote.spotPerLbUsd.toFixed(2)} per pound, pricing 8,000 feet at $${quote.lockedUnitPriceFt.toFixed(2)} per foot—${fmtUsd(quote.quotedTotalUsd)} total, a ${fmtUsd(absVarUsd)} favorable variance below standard. Click OK to Proceed to cut Purchase Order ${deal.id}.`
        : `Devon signed the requisition. Central Purchasing called live COMEX copper at $${quote.spotPerLbUsd.toFixed(2)} per pound, pricing 8,000 feet at $${quote.lockedUnitPriceFt.toFixed(2)} per foot—${fmtUsd(quote.quotedTotalUsd)} total, a ${fmtUsd(absVarUsd)} unfavorable market variance above standard, covered within Purchasing's $50,000 authority. Click OK to Proceed to cut Purchase Order ${deal.id}.`;
      recordAuditEvent(
        dealId,
        'STEP-4A-SPOT-API',
        `BLOCK:SPOT-PRICE-API (${quote.feedSource})`,
        `Live COMEX Copper @ $${quote.spotPerLbUsd.toFixed(4)}/lb (${quote.latencyMs}ms) -> ASTM B8 2/0 AWG quote $${quote.lockedUnitPriceFt.toFixed(2)}/FT (${fmtUsd(quote.quotedTotalUsd)} for 8,000 FT, ${isFav ? '-' + fmtUsd(absVarUsd) + ' Favorable' : '+' + fmtUsd(absVarUsd) + ' Unfavorable'} PPV vs. ${fmtUsd(quote.catalogEstimateUsd)} standard).`,
        quoteHash
      );
      return;
    }

    if (action === 'wf1_commit_po' && st.wf1_po_committed === 'pending') {
      if (st.wf0_req_status !== 'approved') {
        throw new Error('Requisition REQ-25800 must be approved by VP Supply Chain (Step 3) before issuing a Purchase Order.');
      }
      if (!st.wf1_spot_checked) {
        await executeWorkflowAction(dealId, 'wf1_check_spot');
        deal = enrichDealFromLiveDatabases(sc, st);
      }
      if (deal.poAmount > deal.flowOwner.limitUsd) {
        throw new SoxGuardrailError(
          `SPOT EXCEEDS BUYER AUTHORITY (HTTP 409): Live quote ${fmtUsd(deal.poAmount)} exceeds Buyer ${deal.flowOwner.name}'s ${fmtUsd(deal.flowOwner.limitUsd)} Signing Limit — executive re-approval required.`,
          409
        );
      }

      st.activeVoiceRole = 'ops_steward';
      st.lastGuardrailBlock = null;
      const t0 = performance.now();

      const mintRes = await callWarmMintDocs({
        qtyFt: deal.orderedQty,
        unitPrice: sc.unitPrice,
        spotCopperPerLbUsd: sc.spotCopperPerLbUsd,
        catalogUnitPrice: sc.catalogUnitPrice,
        copperLbs: sc.copperWeightLbs,
        spotSource: 'COMEX HG',
        deliveryDate: sc.deliveryDate,
      });
      if (mintRes?.poSha256) st.poSha256 = mintRes.poSha256;
      const poSrc = path.join(outboxDir, sc.poFile);
      if (fs.existsSync(poSrc)) {
        fs.copyFileSync(poSrc, path.join(apInboxDir, sc.poFile));
      }

      const db = new DatabaseSync(wmsDbPath);
      try {
        const today = '2026-11-12';
        const poRes = db.prepare(`
          INSERT INTO order_purchaseorder (reference, description, creation_date, issue_date, supplier_id, link, status, supplier_reference, reference_int, barcode_data, barcode_hash)
          VALUES (?, ?, ?, ?, ?, '', 20, ?, ?, '', '')
        `).run(
          deal.id,
          `${deal.vendorName} - ${fmtInt(deal.orderedQty)} FT ${deal.itemName} @ $${sc.unitPrice.toFixed(2)}/FT Spot Lock`,
          today,
          today,
          deal.wmsSupplierId,
          'AWAITING_VENDOR_ACK',
          deal.refInt
        );
        const poDbId = Number(poRes.lastInsertRowid);

        const lineRes = db.prepare(`
          INSERT INTO order_purchaseorderlineitem (quantity, reference, received, order_id, part_id, notes, link, line, line_int, discount, purchase_price_currency)
          VALUES (?, ?, 0, ?, ?, ?, '', '1', 1, 0, 'USD')
        `).run(
          deal.orderedQty,
          deal.itemCanonical,
          poDbId,
          deal.wmsSupplierPartId,
          `Spot Locked @ $${sc.unitPrice.toFixed(2)}/FT ($${sc.spotCopperPerLbUsd.toFixed(4)}/lb COMEX Cu) vs $${sc.catalogUnitPrice.toFixed(2)}/FT Std — Saved ${fmtUsd(deal.spotSavingsPotentialUsd)}`
        );
        const lineDbId = Number(lineRes.lastInsertRowid);

        st.poDbId = poDbId;
        st.wf1_po_committed = 'done';
        st.wf1_catalog_synced = false;
        st.syncedCatalogUnitPrice = sc.catalogUnitPrice;
        st.spotSavingsLockedUsd = deal.spotSavingsPotentialUsd;
        st.stewardTimings.wf1Ms = Math.max(1, Math.round(performance.now() - t0));

        const wmsHash = sha256FileSafe(wmsDbPath);
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 1,
          stepName: 'Step 4 · Centralized Purchasing PO Issued',
          sourceElement: `${st.reqRef} (${fmtUsd(deal.catalogEstimateUsd)} Annual Std Cost) -> Spot $${sc.unitPrice.toFixed(2)}/FT`,
          sourceValue: `${deal.vendorName} · ${fmtUsd(deal.poAmount)} (-${fmtUsd(deal.spotSavingsPotentialUsd)} Favorable PPV vs Std Cost)`,
          targetSystem: 'WMS',
          targetTable: 'order_purchaseorder',
          targetPk: `id=${poDbId}`,
          targetColumn: 'reference,supplier_id',
          targetValue: `${deal.id} -> company_company.id=${deal.wmsSupplierId}`,
          actorType: 'HUMAN',
          actorId: deal.flowOwner.empId,
          actorName: deal.flowOwner.name,
          authoritySource: 'HRM.hrm_doa_authority_seat (Centralized Purchasing $50k Signing Limit)',
          doaLimitUsd: deal.flowOwner.limitUsd,
          controlTags: 'SOX_SOD_BUYER,AI_GOV_L1,SOC2_CC6.1,SPOT_LOCK',
          gateVerdict: 'SPOT_LOCKED_PO_COMMITTED',
          evidenceSha256: wmsHash,
        });
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 1,
          stepName: 'Step 4 · 1-Line Copper PO Line Writer',
          sourceElement: `PO.${deal.id}.line_1`,
          sourceValue: `${fmtInt(deal.orderedQty)} ${sc.uom} x ${deal.itemCanonical} @ $${sc.unitPrice.toFixed(2)}/FT`,
          targetSystem: 'WMS',
          targetTable: 'order_purchaseorderlineitem',
          targetPk: `id=${lineDbId}`,
          targetColumn: 'quantity,part_id',
          targetValue: `qty=${deal.orderedQty} FT, part_supplierpart.id=${deal.wmsSupplierPartId}`,
          actorType: 'STEWARD_GATE',
          actorId: 'BLOCK:CENTRAL-PURCHASING',
          actorName: 'Centralized Purchasing Block',
          authoritySource: 'lc_semantic_bindings.PurchaseOrderLine',
          doaLimitUsd: null,
          controlTags: 'SOC2_PI1.3,AI_GOV_L1',
          gateVerdict: 'FK_VERIFIED_1_LINE',
          evidenceSha256: wmsHash,
        });
        const isFavPo = deal.spotSavingsPotentialUsd >= -0.005;
        const absPoVar = Math.abs(deal.spotSavingsPotentialUsd);
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 1,
          stepName: 'Step 4 · Standard Cost Preserved & PPV Calculated',
          sourceElement: `WMS.part_partpricing ($${sc.catalogUnitPrice.toFixed(2)}/FT Annual Standard Cost)`,
          sourceValue: `Actual Spot $${sc.unitPrice.toFixed(2)}/FT vs $${sc.catalogUnitPrice.toFixed(2)}/FT Std Cost -> ${isFavPo ? '-' + fmtUsd(absPoVar) + ' Favorable' : '+' + fmtUsd(absPoVar) + ' Unfavorable'} PPV`,
          targetSystem: 'WMS',
          targetTable: 'part_partpricing',
          targetPk: `part_id=${deal.wmsPartId}`,
          targetColumn: 'internal_cost_min',
          targetValue: `$${sc.catalogUnitPrice.toFixed(2)}/FT Annual Standard Cost Locked (PPV staged for 501900 at Dock Receipt)`,
          actorType: 'STEWARD_GATE',
          actorId: 'BLOCK:STD-COST-PPV',
          actorName: 'Standard Cost & PPV Calculator Block',
          authoritySource: 'FY2026 Annual Standard Cost Policy ($2.89/FT)',
          doaLimitUsd: null,
          controlTags: 'SOC2_PI1.3,AI_GOV_L2,STD_COST_PPV_STAGED',
          gateVerdict: isFavPo ? 'FAVORABLE_PPV_CALCULATED' : 'UNFAVORABLE_PPV_STAGED',
          evidenceSha256: wmsHash,
        });

        st.lastVoiceBrief = isFavPo
          ? `Purchase Order ${deal.id} placed with Encore Wire for 8,000 feet at $${sc.unitPrice.toFixed(2)}/FT—${fmtUsd(deal.poAmount)} total, saving ${fmtUsd(absPoVar)}.`
          : `Purchase Order ${deal.id} placed with Encore Wire for 8,000 feet at $${sc.unitPrice.toFixed(2)}/FT—${fmtUsd(deal.poAmount)} total, with a ${fmtUsd(absPoVar)} unfavorable market variance staged to Purchase Price Variance.`;
        recordAuditEvent(
          dealId,
          'STEP-4B-PO-ISSUED',
          `${deal.flowOwner.empId} (${deal.flowOwner.name} · Centralized Purchasing)`,
          `Issued 1-line ${deal.id} (${fmtInt(deal.orderedQty)} FT = ${fmtUsd(deal.poAmount)}, ${isFavPo ? 'saving ' + fmtUsd(absPoVar) : '+' + fmtUsd(absPoVar) + ' unfavorable PPV'}) to Encore Wire in WMS order_purchaseorder #${poDbId}.`,
          wmsHash
        );
      } finally {
        db.close();
      }
      return;
    }

    if (action === 'wf1_vendor_ack' && st.wf1_po_committed === 'done' && st.wf1_vendor_ack === 'pending') {
      st.activeVoiceRole = 'ops_steward';
      st.lastGuardrailBlock = null;
      const t0 = performance.now();
      const oaSrc = path.join(outboxDir, sc.oaFile);
      const oaDst = path.join(apInboxDir, sc.oaFile);
      if (fs.existsSync(oaSrc)) {
        fs.copyFileSync(oaSrc, oaDst);
        st.oaSha256 = sha256FileSafe(oaDst);
      }
      const db = new DatabaseSync(wmsDbPath);
      try {
        db.prepare('UPDATE order_purchaseorder SET supplier_reference = ? WHERE id = ?').run(`${sc.oaId} (ETA ${sc.deliveryDate})`, st.poDbId);
      } finally {
        db.close();
      }
      st.wf1_vendor_ack = 'done';
      st.stewardTimings.wf1AckMs = Math.max(1, Math.round(performance.now() - t0));

      lineageCore.recordHop({
        txId: dealId,
        stepNum: 1,
        stepName: 'Step 5 · Vendor Order Acknowledgement',
        sourceElement: `SupplierAck.${sc.oaFile}`,
        sourceValue: `${sc.oaId} · Confirmed ${fmtInt(deal.orderedQty)} FT @ $${deal.unitPrice.toFixed(2)}/FT (${fmtUsd(deal.poAmount)}) · Delivery ETA ${sc.deliveryDate}`,
        targetSystem: 'WMS',
        targetTable: 'order_purchaseorder',
        targetPk: `id=${st.poDbId}`,
        targetColumn: 'supplier_reference',
        targetValue: `${sc.oaId} (ETA ${sc.deliveryDate})`,
        actorType: 'STEWARD_GATE',
        actorId: 'BLOCK:VENDOR-OA',
        actorName: 'Order Acknowledgement Block',
        authoritySource: 'Signed Encore Wire Order Acknowledgement PDF',
        doaLimitUsd: null,
        controlTags: 'SOC2_PI1.3,AI_GOV_L3,VENDOR_ACK_VERIFIED',
        gateVerdict: 'ORDER_ACK_CONFIRMED',
        evidenceSha256: st.oaSha256 || sha256FileSafe(wmsDbPath),
      });

      st.lastVoiceBrief = `Purchase Order ${deal.id} sent to Encore Wire, and Order Acknowledgement ${sc.oaId} just arrived back from the mill confirming 8,000 feet at $${deal.unitPrice.toFixed(2)} per foot, shipping from McKinney for Bay 4 delivery on ${sc.deliveryDate}. Verify dates and click OK to Proceed.`;
      recordAuditEvent(
        dealId,
        'STEP-5-ORDER-ACK',
        `Encore Mill Desk -> ${sc.oaId}`,
        `Logged signed Order Acknowledgement ${sc.oaId} (${sc.oaFile}): confirmed ${fmtInt(deal.orderedQty)} FT @ $${deal.unitPrice.toFixed(2)}/FT (${fmtUsd(deal.poAmount)}) arriving ${sc.deliveryDate}.`,
        st.oaSha256
      );
      return;
    }

    if (action === 'wf1_confirm_ack' && st.wf1_po_committed === 'done' && st.wf1_vendor_ack === 'done') {
      st.activeVoiceRole = 'ops_steward';
      st.lastGuardrailBlock = null;
      st.wf1_ack_verified = true;
      st.lastVoiceBrief = `Order Acknowledgement ${sc.oaId} dates and terms verified copacetic. Encore Wire's flatbed is staged at Receiving Bay 4 with four barcoded master reels. Warehouse Lead ${deal.dockSigner.name}, click Scan All 4 Reels once to sweep every barcode, then click Submit.`;
      recordAuditEvent(
        dealId,
        'STEP-5B-OA-VERIFIED',
        `${deal.flowOwner.empId} (${deal.flowOwner.name} · Central Purchasing)`,
        `Verified ${sc.oaId} ship date, carrier flatbed, and Bay 4 delivery date (${sc.deliveryDate}) match ${deal.id}. Staged ASN at Bay 4 for ${deal.dockSigner.name}.`,
        st.oaSha256 || sha256FileSafe(wmsDbPath)
      );
      return;
    }

    if (action === 'wf2_dock_receipt' && ((st.wf1_po_committed === 'done' && st.wf2_dock_received === 'pending') || (opts.redTeamDemo && opts.actingEmpId))) {
      if (!opts.redTeamDemo) {
        if (st.wf1_vendor_ack === 'pending') {
          await executeWorkflowAction(dealId, 'wf1_vendor_ack');
          deal = enrichDealFromLiveDatabases(sc, st);
        }
        st.wf1_ack_verified = true;
      }

      const actingSeat = queryDoaSeatByCodeOrId(opts.actingEmpId || deal.dockSigner.empId);
      const priorHumans = lineageCore.getTransactionLineage(dealId)
        .filter(h => h.actor_type === 'HUMAN' || h.actor_type === 'FLOW_OWNER')
        .map(h => h.actor_id);
      if (priorHumans.includes(actingSeat.empId) || actingSeat.empId !== deal.dockSigner.empId) {
        const errHash = sha256Text(`${dealId}:WF02:SOD_BLOCK:${actingSeat.empId}:${Date.now()}`);
        const msg = `SEGREGATION OF DUTIES BLOCKED (HTTP 403): ${actingSeat.empId} (${actingSeat.name}) already acted upstream on ${deal.id} and cannot scan physical dock receipt ${deal.grnId}. Warehouse Dock Lead ${deal.dockSigner.empId} (${deal.dockSigner.name}) required.`;
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 2,
          stepName: 'Step 6 · Dock Segregation of Duties Blocked',
          sourceElement: `AttemptedActor.${actingSeat.empId} (${actingSeat.name})`,
          sourceValue: `Unauthorized dock scan attempt on ${deal.grnId}`,
          targetSystem: 'HRM',
          targetTable: 'hrm_doa_authority_seat',
          targetPk: actingSeat.empId,
          targetColumn: 'p2p_sod_role',
          targetValue: `BLOCKED_SOD_COLLISION (Requires ${deal.dockSigner.empId})`,
          actorType: 'SENTINEL_GATE',
          actorId: 'SENTINEL:SOX-404-SOD',
          actorName: 'Segregation of Duties Enforcer',
          authoritySource: 'HRM.hrm_doa_authority_seat + lc_hop_lineage',
          doaLimitUsd: actingSeat.limitUsd,
          controlTags: 'AI_GOV_L1,AI_GOV_L3,AI_GOV_L4,SOX_SOD_BLOCKED',
          gateVerdict: 'BLOCKED_403_SOD_COLLISION',
          evidenceSha256: errHash,
        });
        st.lastGuardrailBlock = {
          ts: new Date().toISOString(),
          code: 'SOX_SOD_VIOLATION',
          httpStatus: 403,
          layer: 'Segregation of Duties (Purchasing != Receiving Dock)',
          step: 'WF-02',
          attemptedActor: `${actingSeat.empId} · ${actingSeat.name}`,
          requiredActor: `${deal.dockSigner.empId} · ${deal.dockSigner.name}`,
          sha256: errHash,
          message: msg,
        };
        st.activeVoiceRole = 'ops_steward';
        st.lastVoiceBrief = `Segregation of duties block! ${actingSeat.name} placed the purchase order and cannot scan goods at the dock. Warehouse Lead ${deal.dockSigner.name} is required.`;
        recordAuditEvent(dealId, 'STEP-6-SOD-403', `SENTINEL:SOD (Blocked ${actingSeat.empId})`, msg, errHash);
        throw new SoxGuardrailError(msg, 403, st.lastGuardrailBlock);
      }

      st.lastGuardrailBlock = null;
      st.activeVoiceRole = 'ops_steward';
      const t0 = performance.now();

      for (const [srcFile, stateKey] of [[sc.bolFile, 'bolSha256'], [sc.psFile, 'psSha256']]) {
        const sPath = path.join(outboxDir, srcFile);
        const dPath = path.join(apInboxDir, srcFile);
        if (fs.existsSync(sPath)) {
          fs.copyFileSync(sPath, dPath);
          st[stateKey] = sha256FileSafe(dPath);
        }
      }

      let newOnHandFt = deal.onHandStockFt;
      const reelSpecs = sc.reelBarcodes || [];
      if (Array.isArray(opts.scannedBarcodes) && opts.scannedBarcodes.length !== reelSpecs.length) {
        throw new SoxGuardrailError(
          `INCOMPLETE DOCK SCAN (HTTP 409): Scanned ${opts.scannedBarcodes.length} of ${reelSpecs.length} required Encore Wire GS1 reel barcodes. Scan all ${reelSpecs.length} reels (${fmtInt(deal.receivedQty)} FT) before submitting.`,
          409
        );
      }
      const db = new DatabaseSync(wmsDbPath);
      try {
        db.prepare('UPDATE order_purchaseorderlineitem SET received = ? WHERE order_id = ?').run(deal.receivedQty, st.poDbId);
        const insertReelStmt = db.prepare(`
          INSERT INTO stock_stockitem (quantity, serial, packaging, delete_on_deplete, status, part_id, supplier_part_id, location_id, purchase_order_id, link, is_building, serial_int, barcode_data, barcode_hash, batch)
          VALUES (?, ?, '2,000-FT Wooden Reel', 0, 10, ?, ?, ?, ?, '', 0, ?, ?, ?, ?)
        `);
        const insertedIds = [];
        for (const r of reelSpecs) {
          const siRes = insertReelStmt.run(
            r.qtyFt,
            r.serial,
            deal.wmsPartId,
            deal.wmsSupplierPartId,
            deal.wmsLocationId,
            st.poDbId,
            deal.refInt + r.seq,
            r.barcode,
            sha256Text(r.barcode).slice(0, 32),
            deal.grnId
          );
          insertedIds.push(Number(siRes.lastInsertRowid));
        }
        st.stockItemId = insertedIds[0];
        st.stockItemIds = insertedIds;
        st.scannedReelBarcodes = reelSpecs.map(r => r.barcode);
        st.wf2_dock_received = 'done';
        const sumRow = db.prepare('SELECT COALESCE(SUM(quantity), 0) AS total_ft FROM stock_stockitem WHERE part_id = ?').get(deal.wmsPartId);
        if (sumRow) newOnHandFt = Number(sumRow.total_ft);
      } finally {
        db.close();
      }

      const stdInventoryUsd = Number((deal.receivedQty * deal.catalogUnitPrice).toFixed(2));
      const ppvSignedUsd = Number((deal.receiptAmount - stdInventoryUsd).toFixed(2));
      const ppvLine = Math.abs(ppvSignedUsd) >= 0.005
        ? `\n    ${deal.glPpvAccount}                              ${ppvSignedUsd < 0 ? '-' + fmtUsd(Math.abs(ppvSignedUsd)) : fmtUsd(ppvSignedUsd)}`
        : '';

      appendJournalEntry(
`2026-11-13 * (${deal.grnId}) Step 6 Dock Scan Receipt (${fmtInt(deal.receivedQty)} FT @ $${deal.catalogUnitPrice.toFixed(2)} Std Cost · PPV ${ppvSignedUsd < 0 ? '-' + fmtUsd(Math.abs(ppvSignedUsd)) + ' Fav' : fmtUsd(ppvSignedUsd)}) — ${deal.vendorName}  ; po:${deal.id}, oa:${sc.oaId}, bol:${deal.grnId}, ps:${sc.psId}, wms_quant:SI-${st.stockItemId}, signer:${deal.dockSigner.empId}
    ${deal.glDebitAccount}                             ${fmtUsd(stdInventoryUsd)}
    ${deal.glClearingAccount}                         -${fmtUsd(deal.receiptAmount)}${ppvLine}`
      );

      st.stewardTimings.wf2Ms = Math.max(1, Math.round(performance.now() - t0));
      const jHash = sha256FileSafe(journalPath);
      lineageCore.recordHop({
        txId: dealId,
        stepNum: 2,
        stepName: 'Step 6 · Dock Scan Receipt (4 Barcoded Reels · BOL + Slip)',
        sourceElement: `${deal.grnId} + ${sc.psId} (4 Barcoded Master Reels · ${fmtInt(sc.copperWeightLbs)} lbs Cu)`,
        sourceValue: `4 RF Barcode Scans (+${fmtInt(deal.receivedQty)} ${sc.uom}) -> WMS Stock 0 FT -> ${fmtInt(newOnHandFt)} FT (${fmtUsd(stdInventoryUsd)} @ $${deal.catalogUnitPrice.toFixed(2)}/FT Std Cost)`,
        targetSystem: 'WMS',
        targetTable: 'stock_stockitem',
        targetPk: `ids=${(st.stockItemIds || [st.stockItemId]).join(',')}`,
        targetColumn: 'quantity,barcode_data,batch',
        targetValue: `4 rows x 2,000 FT (ENC-GS1-884192-R01..R04), batch=${deal.grnId}, total_on_hand=${newOnHandFt} FT`,
        actorType: 'HUMAN',
        actorId: deal.dockSigner.empId,
        actorName: deal.dockSigner.name,
        authoritySource: 'HRM.hrm_doa_authority_seat (Warehouse Dock Custodian)',
        doaLimitUsd: deal.dockSigner.limitUsd,
        controlTags: 'SOX_SOD_DOCK,GAAP_SUBLEDGER,AI_GOV_L1,BOL_PACKING_SLIP_VERIFIED',
        gateVerdict: 'FULL_RECEIPT_REPLENISHED',
        evidenceSha256: st.bolSha256 || sha256FileSafe(wmsDbPath),
      });
      lineageCore.recordHop({
        txId: dealId,
        stepNum: 2,
        stepName: 'Step 6 · Standard Cost Inventory, GRNI & PPV Entry',
        sourceElement: `WMS.stock_stockitem#${st.stockItemId}`,
        sourceValue: `Std ${fmtUsd(stdInventoryUsd)} ($${deal.catalogUnitPrice.toFixed(2)}/FT) vs Actual PO ${fmtUsd(deal.receiptAmount)} ($${deal.unitPrice.toFixed(2)}/FT) -> PPV -${fmtUsd(Math.abs(ppvSignedUsd))} Fav`,
        targetSystem: 'LEDGER',
        targetTable: 'company.journal',
        targetPk: deal.grnId,
        targetColumn: '121100_DR / 201200_GRNI_CR / 501900_PPV_CR',
        targetValue: `DR ${deal.glDebitAccount} ${fmtUsd(stdInventoryUsd)} | CR ${deal.glClearingAccount} ${fmtUsd(deal.receiptAmount)} | CR ${deal.glPpvAccount} ${fmtUsd(Math.abs(ppvSignedUsd))}`,
        actorType: 'STEWARD_GATE',
        actorId: 'BLOCK:DOCK-GRNI-PPV',
        actorName: 'Warehouse Dock, Standard Cost & PPV Block',
        authoritySource: 'lc_semantic_bindings.GAAP_GRIR_Clearing + 501900 PPV',
        doaLimitUsd: null,
        controlTags: 'GAAP_TIE_OUT,SOC2_PI1.3,STD_COST_PPV_POSTED',
        gateVerdict: 'BALANCED_POSTED',
        evidenceSha256: jHash,
      });

      const isFavDock = ppvSignedUsd <= 0.005;
      st.lastVoiceBrief = isFavDock
        ? `Marcus scanned all 4 barcoded reels—8,000 feet—into stock at ${fmtUsd(stdInventoryUsd)} standard cost, booking ${fmtUsd(deal.receiptAmount)} to GRNI and a ${fmtUsd(Math.abs(ppvSignedUsd))} favorable purchase price variance.`
        : `Marcus scanned all 4 barcoded reels—8,000 feet—into stock at ${fmtUsd(stdInventoryUsd)} standard cost, booking ${fmtUsd(deal.receiptAmount)} to GRNI and a ${fmtUsd(Math.abs(ppvSignedUsd))} unfavorable purchase price variance.`;
      recordAuditEvent(
        dealId,
        'STEP-6-DOCK-SCAN',
        `${deal.dockSigner.empId} (${deal.dockSigner.name} · Receiving Dock)`,
        `Scanned 4 GS1-barcoded reels (+${fmtInt(deal.receivedQty)} FT) into WMS stock (0 FT -> ${fmtInt(newOnHandFt)} FT) at ${fmtUsd(stdInventoryUsd)} Standard Cost, posted ${fmtUsd(deal.receiptAmount)} to 201200 GRNI, and booked ${isFavDock ? '-' : '+'}${fmtUsd(Math.abs(ppvSignedUsd))} ${isFavDock ? 'Favorable' : 'Unfavorable'} PPV to 501900.`,
        jHash
      );
      return;
    }

    if (action === 'wf3_rescan_ocr') {
      if (!st.wf3_mailbox_polled) {
        throw new Error('Run AP Email & OCR intake first before re-scanning.');
      }
      const dstPdf = path.join(apInboxDir, sc.pdfFile);
      const dstPng = path.join(apInboxDir, sc.pngFile);
      const freshOcr = await callWarmRapidOcr(dstPdf, dstPng, sc);
      st.wf3_ocr_result = freshOcr;
      st.wf3_pdf_sha256 = freshOcr.fileSha256;
      st.activeVoiceRole = 'treasury_steward';
      st.lastVoiceBrief = `Live RapidOCR neural scan complete in ${freshOcr.elapsedMs} milliseconds across ${freshOcr.boxCount} bounding boxes. All three documents—Purchase Order, Dock Receipt, and Supplier Invoice—match at 8,000 feet and ${fmtUsd(deal.receiptAmount)} with zero variance.`;
      recordAuditEvent(
        dealId,
        'STEP-7-OCR-RESCAN',
        'RapidOCR ONNX Sidecar (/scan)',
        `Live RapidOCR re-scanned ${sc.pdfFile} (${freshOcr.boxCount} boxes, ${(freshOcr.avgConfidence * 100).toFixed(1)}% conf, ${freshOcr.elapsedMs}ms) -> 3-Way Match exact ($0.00 variance).`,
        freshOcr.fileSha256
      );
      return;
    }

    if (action === 'wf3_test_variance_hold') {
      if (st.wf2_dock_received !== 'done' && !opts.redTeamDemo) {
        throw new Error('Complete Warehouse Dock Scan-In (Step 6) first before testing 3-Way Match variance hold.');
      }
      const basePoAmount = deal.poAmount || deal.catalogEstimateUsd;
      const baseRecvQty = deal.receivedQty || deal.orderedQty;
      const baseRecvAmount = deal.receiptAmount || basePoAmount;
      const overbillDeltaUsd = Number(opts.overbillDeltaUsd || 500);
      const simulatedInvTotal = Number((basePoAmount + overbillDeltaUsd).toFixed(2));
      const errHash = sha256Text(`${dealId}:WF03:MATCH_HOLD:${simulatedInvTotal}:${Date.now()}`);
      const msg = `3-WAY MATCH VARIANCE HOLD (HTTP 409): Disputed invoice bills ${fmtUsd(simulatedInvTotal)} vs. PO ${deal.id} (${fmtUsd(basePoAmount)}) and Dock ${deal.grnId} (${fmtInt(baseRecvQty)} FT = ${fmtUsd(baseRecvAmount)}) — +${fmtUsd(overbillDeltaUsd)} over-bill blocked ($0.00 AP / Cash leakage).`;
      lineageCore.recordHop({
        txId: dealId,
        stepNum: 3,
        stepName: 'Step 7 · 3-Way Match Variance Hold Blocked',
        sourceElement: `DisputedInvoice.OVERBILL_TEST (+${fmtUsd(overbillDeltaUsd)})`,
        sourceValue: `Billed ${fmtUsd(simulatedInvTotal)} != Ordered ${fmtUsd(basePoAmount)} / Received ${fmtUsd(baseRecvAmount)}`,
        targetSystem: 'LEDGER',
        targetTable: 'company.journal',
        targetPk: `${deal.id}-MATCH-HOLD`,
        targetColumn: '201100_AP_BLOCKED',
        targetValue: `MATCH_HOLD (+${fmtUsd(overbillDeltaUsd)} variance · $0.00 posted)`,
        actorType: 'SENTINEL_GATE',
        actorId: 'SENTINEL:3WM-VARIANCE',
        actorName: 'Deterministic 3-Way Match Block',
        authoritySource: 'Zero-Variance 3-Way Match Policy',
        doaLimitUsd: 0,
        controlTags: 'AI_GOV_L2,AI_GOV_L3,SOC2_PI1.3,MATCH_VARIANCE_HOLD',
        gateVerdict: 'BLOCKED_409_MATCH_VARIANCE',
        evidenceSha256: errHash,
      });
      st.lastGuardrailBlock = {
        ts: new Date().toISOString(),
        code: 'MATCH_VARIANCE_HOLD',
        httpStatus: 409,
        layer: '3-Way Match Variance Control (PO == Receiver == Invoice)',
        step: 'WF-03',
        attemptedActor: `Over-Billed Invoice (${fmtUsd(simulatedInvTotal)})`,
        requiredActor: `Exact 3-Way Match (${fmtUsd(basePoAmount)})`,
        sha256: errHash,
        message: msg,
      };
      st.activeVoiceRole = 'treasury_steward';
      st.lastVoiceBrief = `Three-way match variance hold! Simulated invoice billed ${fmtUsd(simulatedInvTotal)}, five hundred dollars above P O and dock receipt. Zero dollars posted to Accounts Payable.`;
      recordAuditEvent(dealId, 'STEP-7-MATCH-409', 'SENTINEL:3WM-VARIANCE', msg, errHash);
      throw new SoxGuardrailError(msg, 409, st.lastGuardrailBlock);
    }

    if ((action === 'wf3_poll_and_ocr' && !st.wf3_mailbox_polled) || action === 'wf3_reresolve_llm') {
      if (st.wf2_dock_received !== 'done') {
        throw new Error('Complete Warehouse Dock Scan-In (Step 6) first so BOL, Packing Slip, and physical stock exist before 3-Way Match.');
      }

      const t0 = performance.now();
      let ocrRes = st.wf3_ocr_result;
      if (!st.wf3_mailbox_polled) {
        const srcPdf = path.join(outboxDir, sc.pdfFile);
        if (!fs.existsSync(srcPdf)) {
          await callWarmMintDocs({
            qtyFt: deal.orderedQty,
            unitPrice: sc.unitPrice,
            spotCopperPerLbUsd: sc.spotCopperPerLbUsd,
            catalogUnitPrice: sc.catalogUnitPrice,
            copperLbs: sc.copperWeightLbs,
            spotSource: 'COMEX HG',
            deliveryDate: sc.deliveryDate,
          });
        }
        const dstPdf = path.join(apInboxDir, sc.pdfFile);
        const dstPng = path.join(apInboxDir, sc.pngFile);
        if (!fs.existsSync(dstPdf) && fs.existsSync(srcPdf)) {
          fs.copyFileSync(srcPdf, dstPdf);
        }
        const pdfStats = fs.statSync(dstPdf);
        const recvNow = new Date();
        const recvLocal = recvNow.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
        });
        const emlSubject = `Invoice ${sc.invoiceId} for ${deal.id} — 8,000 FT 2/0 AWG Bare Copper (${fmtUsd(deal.poAmount)})`;
        const dstEml = path.join(apInboxDir, sc.emlFile || 'EMAIL-INV-25800.eml');
        const generatedEml = [
          'Return-Path: <billing@encorewire.com>',
          `Received: from mail.encorewire.com (198.51.100.42) by mx.company-8090.com with ESMTPS; ${recvNow.toUTCString()}`,
          `Message-ID: <${sc.invoiceId}.${Date.now()}@encorewire.com>`,
          `Date: ${recvNow.toUTCString()}`,
          'From: Encore Wire Billing <billing@encorewire.com>',
          'To: Accounts Payable Intake <ap@company-8090.com>',
          `Subject: ${emlSubject}`,
          'MIME-Version: 1.0',
          'Content-Type: multipart/mixed; boundary="ENCORE-INV-25800"',
          `X-Attachment-Filename: ${sc.pdfFile} (${pdfStats.size} bytes)`,
          '',
          `Attached please find Commercial Invoice ${sc.invoiceId} matching Purchase Order ${deal.id}, Vendor Order Ack ${sc.oaId}, and Dock Bill of Lading ${deal.grnId} for 8,000 FT (4 Barcoded Master Reels) of 2/0 AWG Bare Copper at $${deal.unitPrice.toFixed(2)}/FT (${fmtUsd(deal.poAmount)} Net 30).`,
        ].join('\r\n');
        fs.writeFileSync(dstEml, generatedEml, 'utf8');
        st.wf3_eml_text = generatedEml;
        st.wf3_eml_sha256 = sha256FileSafe(dstEml);
        st.wf3_email_meta = {
          from: 'Encore Wire Billing <billing@encorewire.com>',
          to: 'ap@company-8090.com',
          subject: emlSubject,
          receivedAtLocal: recvLocal,
          receivedAtIso: recvNow.toISOString(),
          emlFile: path.basename(dstEml),
          attachmentFile: sc.pdfFile,
          attachmentBytes: pdfStats.size,
          emlSha256: st.wf3_eml_sha256,
        };
        ocrRes = await callWarmRapidOcr(dstPdf, dstPng, sc);
        st.wf3_mailbox_polled = true;
        st.wf3_ocr_result = ocrRes;
        st.wf3_pdf_sha256 = ocrRes.fileSha256;

        lineageCore.recordHop({
          txId: dealId,
          stepNum: 3,
          stepName: 'Step 7 · RapidOCR Invoice Tagging',
          sourceElement: `APMailbox.${sc.pdfFile}`,
          sourceValue: `${ocrRes.boxCount} boxes (${(ocrRes.avgConfidence * 100).toFixed(1)}% conf)`,
          targetSystem: 'OCR',
          targetTable: 'ap-inbox',
          targetPk: ocrRes.extracted.invoiceNumber.value,
          targetColumn: 'vendorName,poReference,quantity,totalDue',
          targetValue: `${ocrRes.extracted.vendorName.value} | ${ocrRes.extracted.poReference.value} | ${fmtInt(ocrRes.extracted.quantity.value)} FT | ${fmtUsd(ocrRes.extracted.totalDue.value)}`,
          actorType: 'STEWARD_OCR',
          actorId: 'BLOCK:RAPID-OCR',
          actorName: 'RapidOCR Invoice Tagging Engine',
          authoritySource: `Deterministic Penny-Math Check (${fmtInt(deal.orderedQty)} FT x $${deal.unitPrice.toFixed(2)} == ${fmtUsd(deal.poAmount)})`,
          doaLimitUsd: null,
          controlTags: 'SOC2_PI1.3,AI_GOV_L3',
          gateVerdict: ocrRes.mathVerified ? 'OCR_MATH_VERIFIED' : 'OCR_MATH_WARN',
          evidenceSha256: st.wf3_pdf_sha256,
        });
      }

      const ex = ocrRes.extracted;
      const forceLive = Boolean(opts.forceLive || action === 'wf3_reresolve_llm');
      const llmRes = await lineageCore.resolveInvoiceWithLlm({
        vendorName: ex.vendorName.value,
        invoiceNumber: ex.invoiceNumber.value,
        poReference: ex.poReference.value,
        sku: ex.sku.value,
        description: ex.description.value,
        quantity: ex.quantity.value,
        unitPrice: ex.unitPrice.value,
        totalDue: ex.totalDue.value,
      }, forceLive);

      st.llmResolution = llmRes;
      deal = enrichDealFromLiveDatabases(sc, st);

      lineageCore.recordHop({
        txId: dealId,
        stepNum: 3,
        stepName: 'Step 7 · Supplier & GL Account Tagging',
        sourceElement: `OCR.${ex.invoiceNumber.value} (${ex.vendorName.value})`,
        sourceValue: `${ex.sku.value} · ${fmtUsd(ex.totalDue.value)}`,
        targetSystem: 'LINEAGE',
        targetTable: 'lc_entity_resolutions',
        targetPk: llmRes.resolution_key,
        targetColumn: 'dept,gaap_debit,doa_seat',
        targetValue: `${llmRes.resolved_dept_fg_id} | ${llmRes.gaap_debit_account} | ${llmRes.required_doa_emp_id}`,
        actorType: 'STEWARD_AGENT',
        actorId: llmRes.resolved_by_model,
        actorName: `AP Account Resolver (${llmRes.resolved_by_model})`,
        authoritySource: 'SQLite Schema + COA Lookup (Read/Tag Only)',
        doaLimitUsd: llmRes.required_doa_limit_usd,
        controlTags: 'SOC2_CC6.1,AI_GOV_L1,AI_GOV_L2,GAAP_CODING',
        gateVerdict: `RESOLVED_${Math.round(llmRes.confidence * 100)}PCT`,
        evidenceSha256: sha256Text(JSON.stringify(llmRes)),
      });

      if (action !== 'wf3_reresolve_llm') {
        const wms = new DatabaseSync(wmsDbPath, { readOnly: true });
        let wmsDockQty = 0;
        try {
          const stockRow = wms.prepare('SELECT COALESCE(SUM(quantity), 0) AS quantity FROM stock_stockitem WHERE purchase_order_id = ?').get(st.poDbId);
          wmsDockQty = stockRow ? Number(stockRow.quantity) : 0;
        } finally {
          wms.close();
        }
        const ocrBilledQty = Number(ex.quantity.value || 0);
        if (ocrBilledQty > wmsDockQty + 0.001) {
          st.wf4_match_status = 'exception_hold';
          st.stewardTimings.wf3Ms = Math.max(1, Math.round(performance.now() - t0));
        } else {
          st.wf4_match_status = 'voucher_posted';
          st.voucherRef = `VCH-${deal.id.replace('PO-', '')}`;
          appendJournalEntry(
`2026-11-13 * (${st.voucherRef}) Step 7 3-Way Match Approved to Pay (${deal.id} == ${deal.grnId} == ${deal.invoiceId}) — ${deal.vendorName}  ; po:${deal.id}, oa:${sc.oaId}, bol:${deal.grnId}, inv:${deal.invoiceId}, signer:${deal.apSigner.empId}
    ${deal.glClearingAccount}                          ${fmtUsd(deal.receiptAmount)}
    ${deal.glApAccount}                               -${fmtUsd(deal.receiptAmount)}`
          );
          st.stewardTimings.wf3Ms = Math.max(1, Math.round(performance.now() - t0));
          const jHash = sha256FileSafe(journalPath);
          lineageCore.recordHop({
            txId: dealId,
            stepNum: 3,
            stepName: 'Step 7 · 3-Way Match Approved to Pay',
            sourceElement: `3WayMatch(${deal.id} == ${deal.grnId} == ${deal.invoiceId})`,
            sourceValue: `${fmtInt(deal.orderedQty)} FT == ${fmtInt(deal.receivedQty)} FT == ${fmtInt(ocrBilledQty)} FT · ${fmtUsd(deal.receiptAmount)} ($0.00 variance)`,
            targetSystem: 'LEDGER',
            targetTable: 'company.journal',
            targetPk: st.voucherRef,
            targetColumn: '201200_DR / 201100_CR',
            targetValue: `DR ${deal.glClearingAccount} ${fmtUsd(deal.receiptAmount)} | CR ${deal.glApAccount}`,
            actorType: 'HUMAN',
            actorId: deal.apSigner.empId,
            actorName: deal.apSigner.name,
            authoritySource: 'HRM.hrm_doa_authority_seat (Controller AP Voucher Policy)',
            doaLimitUsd: deal.apSigner.limitUsd,
            controlTags: 'SOX_SOD_VOUCHER,GAAP_GRIR_CLEAR,AI_GOV_L2',
            gateVerdict: '3WAY_MATCH_PASSED',
            evidenceSha256: jHash,
          });
          st.activeVoiceRole = 'treasury_steward';
          st.lastVoiceBrief = `Marcus scanned 8,000 feet into stock at ${fmtUsd(deal.catalogEstimateUsd)} standard cost. Encore's invoice arrived in the AP inbox, RapidOCR tagged 28 regions, and all three forms—Purchase Order, Dock Receiver, and Invoice—tie out at ${fmtUsd(deal.receiptAmount)} with zero variance. Click OK to Proceed to route to CFO Meredith Hale.`;
          recordAuditEvent(
            dealId,
            'STEP-7-3WAY-MATCH',
            `RapidOCR + 3-Way Match (${deal.apSigner.empId})`,
            `Tagged ${deal.invoiceId} (${ex.vendorName.value}, ${ex.poReference.value}, ${fmtInt(ocrBilledQty)} FT, ${fmtUsd(deal.invoiceAmount)}) -> 3-Way Match APPROVED TO PAY ($0.00 variance). Queued for AP verification.`,
            jHash
          );
        }
      }
      return;
    }

    if (action === 'wf3_confirm_match' && st.wf4_match_status === 'voucher_posted') {
      st.activeVoiceRole = 'treasury_steward';
      st.lastGuardrailBlock = null;
      st.wf3_match_confirmed = true;
      st.lastVoiceBrief = `Three-way match packet verified and routed to Treasury. CFO Meredith Hale, inspect the three matched backup documents and Check number 10045 for ${fmtUsd(deal.receiptAmount)} on screen, then click Approve.`;
      recordAuditEvent(
        dealId,
        'STEP-7B-3WM-ROUTED',
        `${deal.apSigner.empId} (${deal.apSigner.name} · Controller AP Gate)`,
        `Confirmed 3-Way Match (${deal.id} == ${deal.grnId} == ${deal.invoiceId} · $0.00 variance) and routed Voucher ${st.voucherRef} + Check #10045 to CFO ${deal.achSigner.name}.`,
        sha256FileSafe(journalPath)
      );
      return;
    }

    if (action === 'wf4_release_ach' && ((st.wf4_match_status === 'voucher_posted' && !st.wf4_ach_released) || (opts.redTeamDemo && (opts.actingEmpId || opts.bankAccount)))) {
      if (!opts.redTeamDemo) st.wf3_match_confirmed = true;
      const t0 = performance.now();
      deal = enrichDealFromLiveDatabases(sc, st);
      const checkAmt = deal.receiptAmount || deal.poAmount || deal.catalogEstimateUsd;
      const vchLabel = st.voucherRef || 'VCH-25800';

      const actingSeat = queryDoaSeatByCodeOrId(opts.actingEmpId || deal.achSigner.empId);
      const priorHumans = lineageCore.getTransactionLineage(dealId)
        .filter(h => h.actor_type === 'HUMAN' || h.actor_type === 'FLOW_OWNER')
        .map(h => h.actor_id);
      const sodPriorHit = opts.actingEmpId
        ? priorHumans.includes(actingSeat.empId)
        : (!opts.redTeamDemo && priorHumans.includes(actingSeat.empId));
      if (sodPriorHit || actingSeat.empId !== deal.achSigner.empId) {
        const errHash = sha256Text(`${dealId}:WF04:SOD_BLOCK:${actingSeat.empId}:${Date.now()}`);
        const msg = `SEGREGATION OF DUTIES BLOCKED (HTTP 403): ${actingSeat.empId} (${actingSeat.name}) acted upstream on ${deal.id} and is prohibited from releasing bank funds. CFO ${deal.achSigner.empId} (${deal.achSigner.name}) required.`;
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 4,
          stepName: 'Step 8 · Payment Segregation of Duties Blocked',
          sourceElement: `AttemptedSigner.${actingSeat.empId} (${actingSeat.name})`,
          sourceValue: `Blocked payment release on ${vchLabel} (${fmtUsd(checkAmt)})`,
          targetSystem: 'HRM',
          targetTable: 'hrm_doa_authority_seat',
          targetPk: actingSeat.empId,
          targetColumn: 'p2p_sod_role',
          targetValue: `BLOCKED_SOD_COLLISION (Requires ${deal.achSigner.empId} CFO)`,
          actorType: 'SENTINEL_GATE',
          actorId: 'SENTINEL:SOX-404-SOD',
          actorName: 'Treasury Segregation of Duties Enforcer',
          authoritySource: 'HRM.hrm_doa_authority_seat + lc_hop_lineage',
          doaLimitUsd: actingSeat.limitUsd,
          controlTags: 'AI_GOV_L1,AI_GOV_L3,AI_GOV_L4,SOX_SOD_BLOCKED',
          gateVerdict: 'BLOCKED_403_SOD_COLLISION',
          evidenceSha256: errHash,
        });
        st.lastGuardrailBlock = {
          ts: new Date().toISOString(),
          code: 'SOX_SOD_VIOLATION',
          httpStatus: 403,
          layer: 'Segregation of Duties (Purchasing != Bank Disbursement)',
          step: 'WF-04',
          attemptedActor: `${actingSeat.empId} · ${actingSeat.name}`,
          requiredActor: `${deal.achSigner.empId} · ${deal.achSigner.name} (CFO)`,
          sha256: errHash,
          message: msg,
        };
        st.activeVoiceRole = 'treasury_steward';
        st.lastVoiceBrief = `Segregation of duties block! ${actingSeat.name} placed the purchase order and cannot cut the check. Only C F O ${deal.achSigner.name} can release Operating Bank funds.`;
        recordAuditEvent(dealId, 'STEP-8-SOD-403', `SENTINEL:SOD (Blocked ${actingSeat.empId})`, msg, errHash);
        throw new SoxGuardrailError(msg, 403, st.lastGuardrailBlock);
      }

      const settlementAccount = opts.bankAccount || 'Assets:101100-Operating-Checking';
      if (settlementAccount.includes('101200') && checkAmt > 5000) {
        const errHash = sha256Text(`${dealId}:WF04:BANK_BLOCK:${settlementAccount}:${Date.now()}`);
        const msg = `BANK ACCOUNT GUARDRAIL BLOCKED (HTTP 403): Payroll Checking (101200) is ring-fenced and prohibited for vendor payments above $5,000.00 (${fmtUsd(checkAmt)}). Must disburse from Operating Checking (101100).`;
        lineageCore.recordHop({
          txId: dealId,
          stepNum: 4,
          stepName: 'Step 8 · Payroll Bank Ring-Fence Blocked',
          sourceElement: `AttemptedAccount.${settlementAccount}`,
          sourceValue: `Blocked ${fmtUsd(checkAmt)} vendor check against 101200 Payroll`,
          targetSystem: 'LEDGER',
          targetTable: 'company.journal',
          targetPk: '101200-Payroll-Checking',
          targetColumn: 'account_guardrail',
          targetValue: 'BLOCKED_403_PAYROLL_RINGFENCE',
          actorType: 'SENTINEL_GATE',
          actorId: 'SENTINEL:TREASURY-101100',
          actorName: 'Treasury Bank Ring-Fence',
          authoritySource: 'Treasury Policy (101200 Payroll Ring-Fence)',
          doaLimitUsd: null,
          controlTags: 'AI_GOV_L1,AI_GOV_L3,TREASURY_101200_BLOCKED',
          gateVerdict: 'BLOCKED_403_BANK_GUARDRAIL',
          evidenceSha256: errHash,
        });
        st.lastGuardrailBlock = {
          ts: new Date().toISOString(),
          code: 'TREASURY_BANK_GUARDRAIL',
          httpStatus: 403,
          layer: 'Treasury Bank Ring-Fence (101200 Payroll Protected)',
          step: 'WF-04',
          attemptedActor: settlementAccount,
          requiredActor: 'Assets:101100-Operating-Checking',
          sha256: errHash,
          message: msg,
        };
        st.activeVoiceRole = 'treasury_steward';
        st.lastVoiceBrief = 'Bank guardrail block! Payroll Checking ten-twelve-hundred is protected and blocked for supplier payments. Use Operating Checking ten-eleven-hundred.';
        recordAuditEvent(dealId, 'STEP-8-BANK-403', 'SENTINEL:TREASURY-101100', msg, errHash);
        throw new SoxGuardrailError(msg, 403, st.lastGuardrailBlock);
      }

      st.lastGuardrailBlock = null;
      st.wf4_ach_released = true;
      st.checkNumber = sc.checkNumber || 'Check #10045';
      st.achTrace = sc.achTrace || 'ACH-000582';
      st.achRef = 'CHK-10045 / ACH-000582';
      st.poPaidStamp = `PAID · ${st.checkNumber} (${st.achTrace})`;
      st.invoicePaidStamp = `PAID · ${st.checkNumber} (${st.achTrace})`;

      const db = new DatabaseSync(wmsDbPath);
      try {
        db.prepare('UPDATE order_purchaseorder SET status = 30, supplier_reference = ? WHERE id = ?').run(
          `${sc.oaId} · PAID CHK-10045 / ACH-000582`,
          st.poDbId
        );
      } finally {
        db.close();
      }

      appendJournalEntry(
`2026-11-13 * (CHK-10045) Step 8 CFO Payment Disbursed (${st.checkNumber} / ${st.achTrace}) — ${deal.vendorName}  ; po:${deal.id}=PAID, inv:${deal.invoiceId}=PAID, check:10045, ach:ACH-000582, signer:${deal.achSigner.empId}
    ${deal.glApAccount}                                ${fmtUsd(deal.receiptAmount)}
    ${settlementAccount}                              -${fmtUsd(deal.receiptAmount)}`
      );
      st.stewardTimings.wf4Ms = Math.max(1, Math.round(performance.now() - t0));
      const jHash = sha256FileSafe(journalPath);

      lineageCore.recordHop({
        txId: dealId,
        stepNum: 4,
        stepName: 'Step 8 · Operating Bank Verification',
        sourceElement: `SettlementAccount.${settlementAccount}`,
        sourceValue: `${fmtUsd(deal.receiptAmount)} via ${st.achRef}`,
        targetSystem: 'LEDGER',
        targetTable: 'company.journal',
        targetPk: 'CHK-10045',
        targetColumn: 'account_guardrail',
        targetValue: 'VERIFIED_101100_OPERATING_CHECKING',
        actorType: 'STEWARD_GATE',
        actorId: 'BLOCK:TREASURY-GUARD',
        actorName: 'Treasury Bank Guardrail',
        authoritySource: '101100 Operating Bank Policy',
        doaLimitUsd: null,
        controlTags: 'TREASURY_101100_GUARD,SOX_SOD_VERIFIED,AI_GOV_L1',
        gateVerdict: 'BANK_GUARDRAIL_PASSED',
        evidenceSha256: jHash,
      });
      lineageCore.recordHop({
        txId: dealId,
        stepNum: 4,
        stepName: 'Step 8 · CFO Check & ACH Payment Release',
        sourceElement: `Voucher.${st.voucherRef} (${deal.invoiceId})`,
        sourceValue: `${fmtUsd(deal.receiptAmount)} paid via ${st.checkNumber} / ${st.achTrace}`,
        targetSystem: 'LEDGER',
        targetTable: 'company.journal',
        targetPk: 'CHK-10045',
        targetColumn: '201100_DR / 101100_CR',
        targetValue: `DR ${deal.glApAccount} ${fmtUsd(deal.receiptAmount)} | CR ${settlementAccount} (${st.poPaidStamp})`,
        actorType: 'HUMAN',
        actorId: deal.achSigner.empId,
        actorName: deal.achSigner.name,
        authoritySource: 'HRM.hrm_doa_authority_seat (CFO $500,000 Signing Limit)',
        doaLimitUsd: deal.achSigner.limitUsd,
        controlTags: 'AI_GOV_L4_FIDUCIARY,SOX_SOD_TREASURY,SOC2_CC8.1',
        gateVerdict: 'ACH_RELEASED_SETTLED',
        evidenceSha256: jHash,
      });

      st.activeVoiceRole = 'treasury_steward';
      const absFinalPpv = Math.abs(deal.ppvTotalUsd || (deal.catalogEstimateUsd - deal.poAmount));
      const isFavFinal = (deal.ppvTotalUsd ?? -1) <= 0.005;
      st.lastVoiceBrief = `Check #10045 signed by CFO Meredith Hale for ${fmtUsd(deal.receiptAmount)}, settling 8,000 feet of 2/0 AWG bare copper across 4 barcoded 2,000-foot reels—3,288 pounds net copper stocked at ${fmtUsd(deal.catalogEstimateUsd)} standard cost with a ${fmtUsd(absFinalPpv)} ${isFavFinal ? 'favorable' : 'unfavorable'} purchase price variance. Four headless databases were hit on local disk: warehouse management SQLite, HRM and Django CRM SQLite, our 89-account hledger GAAP journal, and the SHA-256 lineage SQLite ledger.`;
      recordAuditEvent(
        dealId,
        'STEP-8-CHECK-PAID',
        `${deal.achSigner.empId} (${deal.achSigner.name} · CFO · $500k Signing Limit)`,
        `Cut ${st.checkNumber} (${st.achTrace}) for ${fmtUsd(deal.receiptAmount)} from 101100 Operating Checking. Stamped ${deal.id} & ${deal.invoiceId} PAID. GRNI = $0.00, AP = $0.00, GAAP DR == CR.`,
        jHash
      );
      return;
    }
  }

  function computeMoneyFlowForDeal(d, st) {
    const upstreamReqUsd = (st.wf0_req_status !== 'stock_out_alert' && st.wf1_po_committed === 'pending')
      ? d.catalogEstimateUsd
      : 0;
    const spotSavingsLockedUsd = st.wf1_po_committed === 'done'
      ? Number(st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd)
      : 0;

    let openPoCommitmentUsd = 0;
    if (st.wf1_po_committed === 'done' && st.wf2_dock_received === 'pending') {
      openPoCommitmentUsd = d.poAmount;
    }
    const grniLiabilityUsd = (st.wf2_dock_received === 'done' && st.wf4_match_status !== 'voucher_posted')
      ? d.receiptAmount
      : 0;
    const activeVarianceHoldUsd = st.wf4_match_status === 'exception_hold' ? d.leakage : 0;
    const savedLeakageUsd = Number(st.savedUsd || 0);
    const tradeApLiabilityUsd = (st.wf4_match_status === 'voucher_posted' && !st.wf4_ach_released)
      ? d.receiptAmount
      : 0;
    const settledCashUsd = st.wf4_ach_released ? d.receiptAmount : 0;
    const stdInventoryUsd = Number((d.receivedQty * d.catalogUnitPrice).toFixed(2));
    const inventoryAssetUsd = st.wf2_dock_received === 'done' ? stdInventoryUsd : 0;
    const ppvSignedUsd = st.wf2_dock_received === 'done'
      ? Number((d.receiptAmount - stdInventoryUsd).toFixed(2))
      : 0;

    let currentStage = 'STEP-1';
    if (st.wf4_ach_released) currentStage = 'PAID';
    else if (st.wf4_match_status === 'voucher_posted') currentStage = 'STEP-8';
    else if (st.wf2_dock_received === 'done') currentStage = 'STEP-7';
    else if (st.wf1_po_committed === 'done' && st.wf1_vendor_ack === 'done') currentStage = 'STEP-6';
    else if (st.wf1_po_committed === 'done') currentStage = 'STEP-5';
    else if (st.wf0_req_status === 'approved') currentStage = 'STEP-4';
    else if (st.wf0_req_status === 'pending_manager_doa') currentStage = 'STEP-3';
    else if (st.kal_started) currentStage = 'STEP-2';

    return {
      currentStage,
      poTotalBaselineUsd: d.catalogEstimateUsd,
      poCommittedBaselineUsd: d.poAmount,
      upstreamReqUsd,
      spotSavingsLockedUsd,
      openPoCommitmentUsd,
      grniLiabilityUsd,
      activeVarianceHoldUsd,
      savedLeakageUsd,
      tradeApLiabilityUsd,
      settledCashUsd,
      inventoryAssetUsd,
      ppvSignedUsd,
    };
  }

  function introspectLiveSqlFkMap() {
    const wms = new DatabaseSync(wmsDbPath, { readOnly: true });
    const hrm = new DatabaseSync(hrmDbPath, { readOnly: true });
    try {
      const p2pCols = new Set(['supplier_id', 'order_id', 'part_id', 'purchase_order_id', 'supplier_part_id', 'location_id']);
      const fmtFks = (db, tbl) => {
        const all = db.prepare(`PRAGMA foreign_key_list("${tbl}")`).all();
        const prioritized = [
          ...all.filter(fk => p2pCols.has(fk.from)),
          ...all.filter(fk => !p2pCols.has(fk.from)),
        ];
        return prioritized.map(fk => `${tbl}.${fk.from} -> ${fk.table}.${fk.to}`);
      };
      const poFks = [...fmtFks(wms, 'order_purchaseorder').slice(0, 1), ...fmtFks(wms, 'order_purchaseorderlineitem').slice(0, 2)];
      const stockFks = fmtFks(wms, 'stock_stockitem').slice(0, 3);
      const poCount = wms.prepare('SELECT COUNT(*) AS c FROM order_purchaseorder').get().c;
      const stockCount = wms.prepare('SELECT COUNT(*) AS c FROM stock_stockitem').get().c;
      const partCount = wms.prepare('SELECT COUNT(*) AS c FROM part_part').get().c;
      const doaCount = hrm.prepare('SELECT COUNT(*) AS c FROM hrm_doa_authority_seat').get().c;
      return {
        poFkSummary: poFks.join(' · ') || 'order_purchaseorder.supplier_id -> company_company.id',
        stockFkSummary: stockFks.join(' · ') || 'stock_stockitem.purchase_order_id -> order_purchaseorder.id',
        poCount,
        stockCount,
        partCount,
        doaCount,
      };
    } finally {
      wms.close();
      hrm.close();
    }
  }

  function computeActiveCockpitHat(d, st) {
    if (st.wf4_ach_released) {
      return {
        empId: d.achSigner.empId,
        name: d.achSigner.name,
        role: `Paid via ${st.checkNumber} (${st.achTrace}) · 6 Human Signers`,
        limitUsd: d.achSigner.limitUsd,
        icon: '✅',
        theme: 'settled',
        voiceRole: 'treasury_steward',
        badgeText: `PAID · ${st.checkNumber} · ${fmtInt(d.onHandStockFt)} FT In Stock`,
      };
    }
    if (st.wf4_match_status === 'voucher_posted') {
      return {
        empId: d.achSigner.empId,
        name: d.achSigner.name,
        role: 'CFO · Human Checkpoint #4 ($500k Signing Limit)',
        limitUsd: d.achSigner.limitUsd,
        icon: '🏦',
        theme: 'cfo',
        voiceRole: 'treasury_steward',
        badgeText: `${d.achSigner.name} · CFO ($500k Signing Limit)`,
      };
    }
    if (st.wf1_po_committed === 'done' && st.wf1_vendor_ack === 'done' && st.wf2_dock_received === 'pending') {
      return {
        empId: d.dockSigner.empId,
        name: d.dockSigner.name,
        role: 'Warehouse Dock · Human Checkpoint #3 (Scan Gun)',
        limitUsd: d.dockSigner.limitUsd,
        icon: '📦',
        theme: 'dock',
        voiceRole: 'ops_steward',
        badgeText: `${d.dockSigner.name} · Dock Scan Gun (${d.dockSigner.empId})`,
      };
    }
    if (st.wf0_req_status === 'stock_out_alert') {
      return {
        empId: d.scPlanner.empId,
        name: d.scPlanner.name,
        role: 'Supply Chain · Human Checkpoint #1 ($20k Signing Limit)',
        limitUsd: d.scPlanner.limitUsd,
        icon: '🚨',
        theme: 'dock',
        voiceRole: 'ops_steward',
        badgeText: `${d.scPlanner.name} · Supply Chain ($20k Signing Limit)`,
      };
    }
    if (st.wf0_req_status === 'pending_manager_doa') {
      return {
        empId: d.reqSigner.empId,
        name: d.reqSigner.name,
        role: 'VP Supply Chain · Human Checkpoint #2 ($100k Signing Limit)',
        limitUsd: d.reqSigner.limitUsd,
        icon: '🛡️',
        theme: 'dock',
        voiceRole: 'ops_steward',
        badgeText: `${d.reqSigner.name} · VP ($100k Signing Limit)`,
      };
    }
    return {
      empId: d.flowOwner.empId,
      name: d.flowOwner.name,
      role: 'Centralized Purchasing · Automated Spot & PO Block',
      limitUsd: d.flowOwner.limitUsd,
      icon: '⚡',
      theme: 'nancy',
      voiceRole: 'ops_steward',
      badgeText: `Automated Purchasing (${d.flowOwner.name} · $50k Signing Limit)`,
    };
  }

  function computeFinancialStatementsFromJournal(d, hledger) {
    const raw = fs.existsSync(journalPath) ? fs.readFileSync(journalPath, 'utf8') : '';
    const acctCents = new Map();
    const periodDrCents = new Map();
    const periodCrCents = new Map();
    let inTx = false;
    let isOpeningEntry = false;
    for (const line of raw.split(/\r?\n/)) {
      const hdrMatch = line.match(/^(\d{4}-\d{2}-\d{2})\b/);
      if (hdrMatch) {
        inTx = true;
        isOpeningEntry = hdrMatch[1] === '2026-01-01' || line.includes('GJ-OPEN-');
        continue;
      }
      if (inTx) {
        if (!line.trim()) {
          inTx = false;
          isOpeningEntry = false;
          continue;
        }
        const stripped = line.replace(/;.*$/, '').trim();
        const m = stripped.match(/^([^\s]+)\s+(-?\$?[\d,]+(?:\.\d+)?)/);
        if (m) {
          const acct = m[1];
          const cents = Math.round(Number(m[2].replace(/[$,]/g, '')) * 100);
          if (Number.isFinite(cents)) {
            acctCents.set(acct, (acctCents.get(acct) || 0) + cents);
            if (!isOpeningEntry) {
              if (cents > 0) periodDrCents.set(acct, (periodDrCents.get(acct) || 0) + cents);
              else if (cents < 0) periodCrCents.set(acct, (periodCrCents.get(acct) || 0) + Math.abs(cents));
            }
          }
        }
      }
    }
    const usd = (acct) => Number(((acctCents.get(acct) || 0) / 100).toFixed(2));
    const pDr = (acct) => Number(((periodDrCents.get(acct) || 0) / 100).toFixed(2));
    const pCr = (acct) => Number(((periodCrCents.get(acct) || 0) / 100).toFixed(2));

    const { payrollAcct, equityAcct, ppvAcct } = journalAccountsMeta;
    const operatingCashOpeningUsd = 250000;
    const operatingCashEndingUsd = usd('Assets:101100-Operating-Checking');
    const operatingCashChangeUsd = Number((operatingCashEndingUsd - operatingCashOpeningUsd).toFixed(2));
    const payrollCashBalanceUsd = usd(payrollAcct);
    const inventoryStdUsd = usd('Assets:121100-WMS-Inventory-Stock');

    const netAssetChangeUsd = Number((inventoryStdUsd + operatingCashChangeUsd).toFixed(2));
    const totalEndingAssetsUsd = Number((operatingCashEndingUsd + payrollCashBalanceUsd + inventoryStdUsd).toFixed(2));

    const grniLiabilityUsd = Number((-usd('Liabilities:201200-GRNI-Goods-Received-Not-Invoiced')).toFixed(2));
    const tradeApLiabilityUsd = Number((-usd('Liabilities:201100-AP-Trade-Payables')).toFixed(2));
    const totalLiabilitiesUsd = Number((grniLiabilityUsd + tradeApLiabilityUsd).toFixed(2));
    const sponsorCapitalUsd = Number((-usd(equityAcct)).toFixed(2));

    const ppvExpenseSignedUsd = usd(ppvAcct);
    const netIncomeImpactUsd = Number((-ppvExpenseSignedUsd).toFixed(2));
    const totalLiabilitiesAndEquityUsd = Number((totalLiabilitiesUsd + netIncomeImpactUsd).toFixed(2));
    const totalEndingLiabAndEquityUsd = Number((totalLiabilitiesUsd + sponsorCapitalUsd + netIncomeImpactUsd).toFixed(2));
    const accountingEquationBalanced =
      Math.abs(totalEndingAssetsUsd - totalEndingLiabAndEquityUsd) < 0.005 &&
      Math.abs(netAssetChangeUsd - totalLiabilitiesAndEquityUsd) < 0.005 &&
      Boolean(hledger.strictBalanced);

    const coaTrialBalance = [
      {
        acctNum: '101100',
        acctName: 'Cash — Operating Checking',
        subledgerSource: 'Treasury / Bank (#8801)',
        normalSide: 'DR',
        openingUsd: operatingCashOpeningUsd,
        debitUsd: pDr('Assets:101100-Operating-Checking'),
        creditUsd: pCr('Assets:101100-Operating-Checking'),
        balanceUsd: operatingCashEndingUsd,
      },
      {
        acctNum: '101200',
        acctName: 'Cash — Payroll (Ring-Fenced)',
        subledgerSource: 'HRM Payroll (#4409)',
        normalSide: 'DR',
        openingUsd: 140000,
        debitUsd: pDr(payrollAcct),
        creditUsd: pCr(payrollAcct),
        balanceUsd: payrollCashBalanceUsd,
      },
      {
        acctNum: '121100',
        acctName: 'Inventory — Raw Materials (Cu)',
        subledgerSource: 'WMS (stock_stockitem)',
        normalSide: 'DR',
        openingUsd: 0,
        debitUsd: pDr('Assets:121100-WMS-Inventory-Stock'),
        creditUsd: pCr('Assets:121100-WMS-Inventory-Stock'),
        balanceUsd: inventoryStdUsd,
      },
      {
        acctNum: '201100',
        acctName: 'Accounts Payable — Trade',
        subledgerSource: 'AP (INV-25800)',
        normalSide: 'CR',
        openingUsd: 0,
        debitUsd: pDr('Liabilities:201100-AP-Trade-Payables'),
        creditUsd: pCr('Liabilities:201100-AP-Trade-Payables'),
        balanceUsd: tradeApLiabilityUsd,
      },
      {
        acctNum: '201200',
        acctName: "GRNI Clearing (Rec'd Not Inv)",
        subledgerSource: 'WMS ↔ AP (3-Way Match)',
        normalSide: 'CR',
        openingUsd: 0,
        debitUsd: pDr('Liabilities:201200-GRNI-Goods-Received-Not-Invoiced'),
        creditUsd: pCr('Liabilities:201200-GRNI-Goods-Received-Not-Invoiced'),
        balanceUsd: grniLiabilityUsd,
      },
      {
        acctNum: '501900',
        acctName: 'Purchase Price Variance (PPV)',
        subledgerSource: 'Standard vs. Spot (P&L)',
        normalSide: 'DR',
        openingUsd: 0,
        debitUsd: pDr(ppvAcct),
        creditUsd: pCr(ppvAcct),
        balanceUsd: ppvExpenseSignedUsd,
      },
    ];

    return {
      asOfDate: d?.deliveryDate || '2026-11-13',
      coaTrialBalance,
      balanceSheet: {
        operatingCashOpeningUsd,
        operatingCashEndingUsd,
        operatingCashChangeUsd,
        payrollCashBalanceUsd,
        inventoryStdUsd,
        totalAssetsUsd: netAssetChangeUsd,
        totalEndingAssetsUsd,
        grniLiabilityUsd,
        tradeApLiabilityUsd,
        totalLiabilitiesUsd,
        sponsorCapitalUsd,
        retainedEarningsNetIncomeUsd: netIncomeImpactUsd,
        totalLiabilitiesAndEquityUsd,
        totalEndingLiabAndEquityUsd,
        balanced: accountingEquationBalanced,
      },
      profitAndLoss: {
        annualStandardCostBaselineUsd: d ? d.catalogEstimateUsd : 23120,
        actualSpotPurchaseUsd: d ? d.poAmount : 21600,
        ppvExpenseSignedUsd,
        favorableVarianceGainUsd: netIncomeImpactUsd,
        netIncomeImpactUsd,
      },
    };
  }

  function inspectSorVaultFiles(catalogs, hledger, hopCount) {
    const specs = [
      {
        key: 'wms',
        sysLabel: 'DB 1 · InvenTree WMS (MIT)',
        seedFile: 'seeds/wms_seed.sqlite3',
        engine: 'SQLite 3 Binary (WAL)',
        filePath: wmsDbPath,
        regSys: 'wms',
        regTable: 'stock_stockitem',
        detail: `${catalogs.wmsTableCount} tables · part_part#218 + stock_stockitem + order_purchaseorder`,
      },
      {
        key: 'crm',
        sysLabel: 'DB 2A · Django-CRM Supplier Master (MIT)',
        seedFile: 'seeds/crm_seed.sqlite3',
        engine: 'SQLite 3 Binary',
        filePath: crmDbPath,
        regSys: 'crm',
        regTable: 'crm_company',
        detail: `${catalogs.crmTableCount} tables · Approved Mill #181 Encore Wire Corp`,
      },
      {
        key: 'hrm',
        sysLabel: 'DB 2B · Headless HRM Signing Limits (MIT)',
        seedFile: 'seeds/hrm_seed.sqlite3',
        engine: 'SQLite 3 Binary',
        filePath: hrmDbPath,
        regSys: 'hrm',
        regTable: 'hrm_doa_authority_seat',
        detail: `${catalogs.hrmTableCount} tables · Darius $20k · Devon $100k · Nancy $50k · Meredith $500k · KAL $0`,
      },
      {
        key: 'ledger',
        sysLabel: 'DB 3 · Headless GAAP Ledger (MIT)',
        seedFile: 'seeds/coa_seed.journal',
        engine: `hledger CLI (${hledger.engineMode})`,
        filePath: journalPath,
        regSys: 'journal',
        regTable: 'company.journal',
        detail: `${hledger.accountCount} GAAP accounts · ${hledger.postingCount || 0} journal postings (--strict DR == CR)`,
      },
      {
        key: 'lineage',
        sysLabel: 'DB 4 · Cryptographic Hop Lineage (MIT)',
        seedFile: 'workbench_lineage.mjs (Runtime)',
        engine: 'SQLite 3 Binary',
        filePath: lineageDbPath,
        regSys: 'lineage',
        regTable: 'lc_hop_lineage',
        detail: `${catalogs.lineageTableCount} tables · ${hopCount} SHA-256 chained observability hops`,
      },
    ];

    let totalBytes = 0;
    const files = specs.map(sp => {
      let bytes = 0;
      let mtimeIso = null;
      let mtimeLocal = '—';
      try {
        const st = fs.statSync(sp.filePath);
        bytes = st.size;
        totalBytes += bytes;
        mtimeIso = st.mtime.toISOString();
        mtimeLocal = st.mtime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
      } catch {}
      const sha = sha256FileSafe(sp.filePath) || '';
      return {
        key: sp.key,
        sysLabel: sp.sysLabel,
        seedFile: sp.seedFile,
        engine: sp.engine,
        fileName: path.basename(sp.filePath),
        fullPath: sp.filePath,
        bytes,
        sizeHuman: bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(1)} KB`,
        mtimeIso,
        mtimeLocal,
        sha256: sha,
        shaShort: sha.slice(0, 10),
        regSys: sp.regSys,
        regTable: sp.regTable,
        detail: sp.detail,
      };
    });

    return {
      vaultDir,
      gitTracked: false,
      seedsInGitHub: true,
      seedDir: 'seeds/',
      license: 'MIT',
      storagePolicy: '100% MIT Seeds in GitHub (/seeds) -> Hydrated Live into Isolated Local SOR Vault',
      totalBytes,
      totalSizeHuman: `${(totalBytes / 1048576).toFixed(2)} MB`,
      files,
    };
  }

  function getFullState() {
    const wmsTables = listTablesWithCounts(wmsDbPath);
    const crmTables = listTablesWithCounts(crmDbPath);
    const hrmTables = listTablesWithCounts(hrmDbPath);
    const lineageTables = listTablesWithCounts(lineageDbPath);
    const hledger = getHledgerSnapshot();
    const fkMap = introspectLiveSqlFkMap();

    const catalogs = {
      wmsTableCount: wmsTables.length,
      crmTableCount: crmTables.length,
      hrmTableCount: hrmTables.length,
      lineageTableCount: lineageTables.length,
      totalSqlTables: wmsTables.length + crmTables.length + hrmTables.length + lineageTables.length,
      wmsTables,
      crmTables,
      hrmTables,
      lineageTables,
      fkMap,
    };

    const deals = {};
    const controlLenses = {};
    const perDealMoney = {};
    const activeHats = {};
    const portfolio = {
      poTotalBaselineUsd: 0,
      poCommittedBaselineUsd: 0,
      upstreamReqUsd: 0,
      spotSavingsLockedUsd: 0,
      openPoCommitmentUsd: 0,
      grniLiabilityUsd: 0,
      activeVarianceHoldUsd: 0,
      savedLeakageUsd: 0,
      tradeApLiabilityUsd: 0,
      settledCashUsd: 0,
      inventoryAssetUsd: 0,
      ppvSignedUsd: 0,
    };

    for (const [id, sc] of Object.entries(activeScenarios)) {
      const st = runtimeState[id];
      const d = enrichDealFromLiveDatabases(sc, st);
      deals[id] = d;
      controlLenses[id] = lineageCore.queryLiveControlLenses(id, hledger);
      activeHats[id] = computeActiveCockpitHat(d, st);
      const mf = computeMoneyFlowForDeal(d, st);
      perDealMoney[id] = mf;
      for (const k of Object.keys(portfolio)) {
        portfolio[k] = Number((portfolio[k] + (mf[k] || 0)).toFixed(2));
      }
    }

    const elevenLive = Boolean(voiceEnv?.ELEVENLABS_API_KEY?.trim());
    const syncedTelemetry = {
      ...aiTelemetry,
      ...(voiceTelemetry ? {
        sttCalls: voiceTelemetry.sttCalls,
        lastSttLatencyMs: voiceTelemetry.lastSttLatencyMs,
        lastSttTranscript: voiceTelemetry.lastSttTranscript,
        ttsCalls: voiceTelemetry.ttsCalls,
        lastTtsLatencyMs: voiceTelemetry.lastTtsLatencyMs,
        lastTtsModel: voiceTelemetry.lastTtsModel,
        totalAudioBytes: voiceTelemetry.totalAudioBytes,
      } : {}),
    };

    return {
      provenance: {
        intakeGate: '8090-SOFTWARE-FACTORY',
        archifyRevision: 'REV-02',
        streamId: 'WF-P2P-5A',
        constellationHandoff: 'P2M (WF-P2M-1A Supply Chain) -> P2P (WF-P2P-1A..1D + WF-P2P-2B Standard Cost & PPV)',
        project: 'ZeroSaaS P2P Headless ERP Workbench',
        aiSteward: {
          id: 'EMP-AI-KAL',
          bossAgentId: 'AGT-8090-KAL-01',
          name: 'KAL',
          phonetic: 'Cal',
          role: 'AI P2P Workflow Steward (Read, Orchestrate & Nudge Only)',
          signingLimitUsd: 0,
          dbWriteCredentials: 0,
        },
        purviewOwner: queryDoaSeatByCodeOrId('PROC-01'),
      },
      stewards: WORKFLOW_STEWARDS,
      activeHats,
      moneyFlow: {
        portfolio,
        perDeal: perDealMoney,
      },
      voiceConfig: {
        stewardName: 'KAL',
        elevenLabsConfigured: elevenLive,
        preferredModel: voiceEnv?.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
        fallbackModel: 'eleven_flash_v2_5',
        sttModel: voiceEnv?.ELEVENLABS_STT_MODEL || 'scribe_v1',
        opsVoiceId: voiceEnv?.ELEVENLABS_KAL_VOICE_ID || voiceEnv?.ELEVENLABS_VOICE_ID || DEFAULT_KAL_VOICE_ID,
        treasuryVoiceId: voiceEnv?.ELEVENLABS_TREASURY_VOICE_ID || DEFAULT_KAL_VOICE_ID,
        keytermsCount: KAL_KEYTERMS.length,
        engineLabel: elevenLive
          ? 'KAL · Eleven Turbo v2.5 + Scribe STT'
          : 'KAL · Ready (Add ELEVENLABS_API_KEY for Neural Voice)',
      },
      aiObservatory: {
        ...syncedTelemetry,
        elevenLabsLive: elevenLive,
        ocrEndpoint: `${ocrBase || 'http://127.0.0.1:3591'}/scan`,
        hledgerEngineMode: hledger.engineMode,
      },
      deals,
      runtimeState,
      lineage: {
        semanticBindings: lineageCore.getSemanticBindings(),
        entityResolutions: lineageCore.getEntityResolutions(),
        controlLenses,
      },
      apInboxFiles: fs.existsSync(apInboxDir) ? fs.readdirSync(apInboxDir) : [],
      sorVault: inspectSorVaultFiles(catalogs, hledger, controlLenses['PO-25800']?.hopCount || 1),
      catalogs,
      hledger,
      financialStatements: computeFinancialStatementsFromJournal(deals['PO-25800'], hledger),
    };
  }

  async function runKalBrain({ prompt = '', preset = '' } = {}) {
    const dealId = 'PO-25800';
    const sc = activeScenarios[dealId];
    const st = runtimeState[dealId];
    const cleanPrompt = normalizeInboundTranscript(prompt);
    const q = (preset || cleanPrompt).toLowerCase();

    let actionExecuted = null;
    let guardrailTriggered = false;

    if (q.includes('token') || (q.includes('kal') && (q.includes('check') || q.includes('cook') || q.includes('steal') || q.includes('buy')))) {
      try {
        await executeWorkflowAction(dealId, 'kal_rogue_attempt');
      } catch {
        guardrailTriggered = true;
        actionExecuted = 'kal_rogue_attempt';
      }
      const reply = 'Blocked with HTTP 403. KAL holds a $0.00 Signing Limit and zero database or bank write credentials—only deterministic workflow blocks and verified human officers can touch the books.';
      return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, guardrailTriggered, state: getFullState() };
    }

    if (preset === 'spot' || (q.includes('spot') && (q.includes('check') || q.includes('live') || q.includes('price') || !st.wf1_spot_checked))) {
      const quote = await fetchLiveCopperSpotQuote(sc, { offline, fetchImpl, aiTelemetry });
      const reply = `Live COMEX copper is $${quote.spotPerLbUsd.toFixed(2)} per pound, pricing 8,000 feet of 2/0 AWG Encore Wire at $${quote.lockedUnitPriceFt.toFixed(2)} per foot—${fmtUsd(quote.quotedTotalUsd)} total, saving ${fmtUsd(quote.savingsVsCatalogUsd)} below Supply Chain's ${fmtUsd(quote.catalogEstimateUsd)} standard.`;
      return { ok: true, transcript: cleanPrompt || 'Check live COMEX copper price', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'ops_steward', actionExecuted, state: getFullState() };
    }

    const full = getFullState();
    const d = full.deals[dealId];
    const mf = full.moneyFlow.perDeal[dealId];
    const lens = full.lineage.controlLenses[dealId];
    const bs = full.financialStatements.balanceSheet;
    const pnl = full.financialStatements.profitAndLoss;

    if (preset === 'sox_db_tour') {
      const reply = "Welcome to our headless System of Record vault and Super Intelligence control plane. Unlike thin workflow wrappers, this app ships three real MIT open-source databases: Warehouse Management, Django Supplier CRM, and Human-Resources Signing Limits, plus an 89-account GAAP general ledger, mutating live on local disk with zero SaaS seat tax. Our four runtime control layers directly enforce SOX 404, 8090's Know Your Superintelligence framework, and all four layers of the White House Accord on Super Intelligence: I hold a $0.00 signing limit with zero write credentials, five deterministic workflow blocks run every calculation, every hop is SHA-256 hashed for external audit, and four segregated human officers sign every dollar.";
      return { ok: true, transcript: 'SOX, Headless DBs & White House Super Intelligence Tour', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
    }

    if (preset === 'white_house_si' || q.includes('white house') || q.includes('super intelligence') || q.includes('superintelligence') || q.includes('president')) {
      const reply = "Here is how our architecture enforces the four layers of the White House Accord on Super Intelligence alongside 8090's Know Your Superintelligence framework. Layer one locks Super Intelligence at a $0.00 signing limit with zero database or bank credentials, returning HTTP 403 on any rogue move. Layer two runs internal oversight through deterministic SQL and hledger blocks, never model math. Layer three records a SHA-256 cryptographic lineage across every prompt, OCR scan, and ledger entry for external auditors. And Layer four keeps four segregated human corporate officers and an instant kill-switch in absolute command.";
      return { ok: true, transcript: 'White House Super Intelligence Accord & KYSI 4-Layer Brief', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
    }

    if (!preset) {
      if (/\b(approve|sign|release|wire|disburse|pay|cut\s+check|issue\s+po)\b/.test(q) && !/\b(who|was|did|is|has|how|what|which|when|limit)\b/.test(q)) {
        const reply = 'Refused by guardrail. KAL holds a $0.00 Signing Limit and zero database or bank write credentials. Only verified human corporate officers can sign approvals, scan dock receipts, or release cash.';
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }

      if (/\b(save|saving|savings|variance|ppv|profit|p&l|income|cheaper|standard\s+cost)\b/.test(q)) {
        const absPpv = Math.abs(pnl.favorableVarianceGainUsd || (d.catalogEstimateUsd - d.poAmount));
        const reply = st.wf1_po_committed === 'done'
          ? `Our annual standard cost for 8,000 feet is ${fmtUsd(d.catalogEstimateUsd)} at $2.89 per foot, while live COMEX spot locked PO-25800 at ${fmtUsd(d.poAmount)} ($${d.unitPrice.toFixed(2)} per foot)—capturing a ${fmtUsd(absPpv)} favorable purchase price variance in GAAP account 501900.`
          : `Supply Chain's annual standard cost ceiling for 8,000 feet is ${fmtUsd(d.catalogEstimateUsd)} at $2.89 per foot. Once Centralized Purchasing runs the live COMEX spot check at Step 4, any favorable savings book to Purchase Price Variance account 501900.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }

      if (/\b(bank|cash|money|checking|funds|treasury|payroll|liquid|account\s+balance)\b/.test(q)) {
        const totalCashUsd = Number((bs.operatingCashEndingUsd + bs.payrollCashBalanceUsd).toFixed(2));
        const reply = st.wf4_ach_released
          ? `Querying our live hledger general ledger right now: Operating Checking 101100 holds ${fmtUsd(bs.operatingCashEndingUsd)} after ${st.checkNumber} paid ${fmtUsd(d.receiptAmount)} from our ${fmtUsd(bs.operatingCashOpeningUsd)} opening balance, and ring-fenced Payroll Checking 101200 holds ${fmtUsd(bs.payrollCashBalanceUsd)} untouched—for ${fmtUsd(totalCashUsd)} total cash in the bank.`
          : `Querying our live hledger general ledger right now: Operating Checking 101100 holds ${fmtUsd(bs.operatingCashEndingUsd)} and ring-fenced Payroll Checking 101200 holds ${fmtUsd(bs.payrollCashBalanceUsd)}—for ${fmtUsd(totalCashUsd)} total cash in the bank, with $0.00 disbursed so far.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }

      if (/\b(inventory|stock|on\s+hand|copper|reel|reels|feet|foot|pound|pounds|weight|warehouse|dock)\b/.test(q)) {
        const reply = st.wf2_dock_received === 'done'
          ? `Live warehouse SQLite shows 8,000 feet of 2/0 AWG bare copper on hand across 4 barcoded 2,000-foot master reels—3,288 pounds net copper—valued in GAAP account 121100 at ${fmtUsd(bs.inventoryStdUsd)} annual standard cost.`
          : `Live warehouse SQLite currently shows 0 feet of 2/0 AWG bare copper on hand against an 8,000-foot minimum—4 barcoded 2,000-foot reels weighing 3,288 pounds are queued to arrive at Receiving Bay 4.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'ops_steward', actionExecuted, state: full };
      }

      if (/\b(invoice|ocr|bounding|three-way|3-way|match|payable|payables|grni|bill)\b/.test(q)) {
        const boxCnt = st.wf3_ocr_result?.boxCount || 28;
        const reply = st.wf3_mailbox_polled
          ? `RapidOCR extracted ${boxCnt} bounding boxes from Encore Invoice INV-25800 and verified a $0.00 three-way match across PO-25800, BOL-25800, and INV-25800 for 8,000 feet at ${fmtUsd(d.receiptAmount)}. Trade Accounts Payable 201100 is currently ${fmtUsd(bs.tradeApLiabilityUsd)} and GRNI 201200 is ${fmtUsd(bs.grniLiabilityUsd)}.`
          : `Encore Invoice INV-25800 has not been matched yet. Trade Accounts Payable 201100 is ${fmtUsd(bs.tradeApLiabilityUsd)} and GRNI Clearing 201200 is ${fmtUsd(bs.grniLiabilityUsd)}.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }

      if (/\b(vendor|supplier|encore|mill|payee|who\s+did\s+we\s+buy)\b/.test(q)) {
        const reply = `Our approved mill supplier in Django CRM SQLite is Encore Wire Corporation in McKinney, Texas, supplying 8,000 feet of 2/0 AWG bare copper across 4 master reels on PO-25800.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'ops_steward', actionExecuted, state: full };
      }

      if (/\b(database|databases|sqlite|table|tables|journal|hledger|ledger|balanced|trial\s+balance)\b/.test(q)) {
        const reply = `All four local databases are live on disk with zero SaaS dependencies: ${full.catalogs.wmsTableCount} tables in Warehouse SQLite, ${full.catalogs.crmTableCount + full.catalogs.hrmTableCount} tables across Django CRM and HRM SQLite, ${full.hledger.accountCount} GAAP accounts in our hledger journal with debits equal credits and ${fmtUsd(bs.totalEndingAssetsUsd)} in total assets, plus ${lens.hopCount} SHA-256 ${lens.hopCount === 1 ? 'hop' : 'hops'} in Lineage SQLite.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }

      if (/\b(who\s+signed|who\s+approved|officer|officers|approver|darius|devon|nancy|marcus|duncan|meredith)\b/.test(q)) {
        const reply = `HRM SQLite enforces segregated signing limits across every seat: KAL holds $0.00, Supply Chain Planner Darius Mercer holds $20,000, Buyer Nancy Rostova holds $50,000, VP Devon Brooks holds $100,000, Marcus Vance scans physical reels at Bay 4, Controller Duncan Vance gates 3-Way Match, and CFO Meredith Hale holds $500,000 on Operating Checking 101100.`;
        return { ok: true, transcript: cleanPrompt, reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
      }
    }

    if (preset === 'governance' || q.includes('sox') || q.includes('kysi') || q.includes('governance') || q.includes('signing') || q.includes('security') || q.includes('cfo')) {
      const reply = st.wf4_ach_released
        ? `All 4 human checkpoints and automated blocks completed across ${lens.hopCount} SHA-256 hops. KAL holds $0.00 signing authority; CFO Meredith Hale cut ${st.checkNumber} (${st.achTrace}) for ${fmtUsd(d.receiptAmount)}, leaving GRNI and Accounts Payable at $0.00.`
        : 'KAL has a $0.00 Signing Limit and zero ledger write access. Every financial move is gated by deterministic SQL/hledger blocks and 4 named humans: Darius ($20k), Devon ($100k), Marcus at the dock, and CFO Meredith Hale ($500k).';
      return { ok: true, transcript: cleanPrompt || 'Security & Signing Limits Brief', reply, spokenText: normalizeKalSpeech(reply), voiceRole: 'treasury_steward', actionExecuted, state: full };
    }

    let reply = '';
    let role = 'ops_steward';
    if (st.wf4_ach_released) {
      role = 'treasury_steward';
      const absSaved = Math.abs(st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd);
      reply = `PO-25800 and INV-25800 are stamped PAID via ${st.checkNumber} (${st.achTrace}) for ${fmtUsd(d.receiptAmount)}. Physically, 8,000 feet of 2/0 AWG bare copper—4 barcoded 2,000-foot reels weighing 3,288 pounds—moved from 0 feet into stock at ${fmtUsd(d.catalogEstimateUsd)} standard cost, saving ${fmtUsd(absSaved)}. Four local databases were hit: warehouse management SQLite for the PO and 4 reel stock rows, HRM and Django CRM SQLite for supplier and signing limits, our 89-account hledger GAAP journal for 3 balanced entries, and SHA-256 lineage SQLite across ${lens.hopCount} audit hops.`;
    } else if (st.wf4_match_status === 'voucher_posted') {
      role = 'treasury_steward';
      reply = `RapidOCR tagged Encore Invoice INV-25800 and verified a $0.00 3-Way Match at ${fmtUsd(d.receiptAmount)}. Waiting at Human Checkpoint 4 for CFO Meredith Hale to approve payment.`;
    } else if (st.wf2_dock_received === 'done') {
      reply = `Marcus Vance scanned all 4 barcoded reels—8,000 feet—into warehouse stock on BOL-25800 and booked ${fmtUsd(d.receiptAmount)} to GRNI. Ready for RapidOCR invoice tagging and 3-Way Match.`;
    } else if (st.wf1_po_committed === 'done') {
      reply = `Centralized Purchasing placed PO-25800 at $${d.unitPrice.toFixed(2)} per foot (${fmtUsd(d.poAmount)}), saving ${fmtUsd(st.spotSavingsLockedUsd || d.spotSavingsPotentialUsd)}, and Encore acknowledged delivery on ENC-OA-2026-884192. Waiting at Human Checkpoint 3 for Marcus at the dock.`;
    } else if (st.wf0_req_status === 'approved') {
      reply = `VP Devon Brooks signed the ${fmtUsd(d.catalogEstimateUsd)} requisition ceiling. Centralized Purchasing is ready to check live COMEX copper and place PO-25800.`;
    } else if (st.wf0_req_status === 'pending_manager_doa') {
      reply = `Planner Darius Mercer confirmed the 8,000-foot buy (${fmtUsd(d.catalogEstimateUsd)} standard). Because that exceeds his $20,000 Signing Limit, we are paused at Human Checkpoint 2 for VP Devon Brooks ($100,000 Signing Limit).`;
    } else {
      reply = `WMS stock-out active: our warehouse database shows 0 feet of 2/0 AWG bare copper on hand against an 8,000-foot minimum (${fmtUsd(d.catalogEstimateUsd)} standard). Paused at Human Checkpoint 1 for Supply Chain Planner Darius Mercer.`;
    }

    return {
      ok: true,
      transcript: cleanPrompt || 'KAL Status Brief',
      reply,
      spokenText: normalizeKalSpeech(reply),
      voiceRole: role,
      actionExecuted,
      moneyStage: mf.currentStage,
      state: full,
    };
  }

  const dbPathsBySystem = {
    wms: wmsDbPath,
    crm: crmDbPath,
    hrm: hrmDbPath,
    lineage: lineageDbPath,
  };

  return {
    vaultDir,
    reset() {
      initSandbox();
      return getFullState();
    },
    getFullState,
    async handleStep(body = {}) {
      const {
        dealId = 'PO-25800',
        action,
        forceLive,
        bankAccount,
        actingEmpId,
        attemptDetail,
        scannedBarcodes,
        redTeamDemo,
        overbillDeltaUsd,
      } = body;
      await executeWorkflowAction(dealId, action, {
        forceLive,
        bankAccount,
        actingEmpId,
        attemptDetail,
        scannedBarcodes,
        redTeamDemo,
        overbillDeltaUsd,
      });
      return getFullState();
    },
    async recrawlLineage() {
      await lineageCore.crawlSchemasWithLlm(true);
      lineageCore.seedVerifiedP2PDefaults();
      return getFullState();
    },
    async getCopperSpot() {
      return fetchLiveCopperSpotQuote(activeScenarios['PO-25800'], { offline, fetchImpl, aiTelemetry });
    },
    runKalBrain,
    handleTable(parsedUrl, res) {
      return handleTableRoute(parsedUrl, res, dbPathsBySystem);
    },
    handleInvoiceImage(parsedUrl, res) {
      return serveArtifactRoute(parsedUrl, res, {
        searchDirs: [apInboxDir, outboxDir, kernelDocsDir],
        allowedExt: '.png',
        contentType: 'image/png',
      });
    },
    handlePdfArtifact(parsedUrl, res) {
      return serveArtifactRoute(parsedUrl, res, {
        searchDirs: [apInboxDir, outboxDir, kernelDocsDir],
        allowedExt: '.pdf',
        contentType: 'application/pdf',
      });
    },
  };
}
