// Read-only SQLite brownfield table explorer for WMS, HRM, CRM, and Lineage databases.
import { DatabaseSync } from 'node:sqlite';

export function listTablesWithCounts(dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
    return names.map(name => {
      let count = 0;
      try {
        count = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
      } catch {}
      return { name, count };
    });
  } finally {
    db.close();
  }
}

export function queryTableRows(dbPathsBySystem, system, tableName, limit = 30) {
  const sys = ['wms', 'hrm', 'lineage', 'crm'].includes(system) ? system : 'wms';
  const dbPath = dbPathsBySystem[sys] || dbPathsBySystem.crm;
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 30));
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    let resolvedTable = String(tableName || '');
    let valid = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(resolvedTable);
    if (!valid && sys === 'crm' && resolvedTable === 'crm_company') {
      const alias = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'accounts_account'").get();
      if (alias) {
        resolvedTable = 'accounts_account';
        valid = alias;
      }
    }
    if (!valid) throw new Error(`Unknown table: ${tableName}`);
    const cols = db.prepare(`PRAGMA table_info("${resolvedTable}")`).all().map(c => c.name);
    const totalRows = db.prepare(`SELECT COUNT(*) AS c FROM "${resolvedTable}"`).get().c;
    const rows = db.prepare(`SELECT * FROM "${resolvedTable}" ORDER BY rowid DESC LIMIT ?`).all(safeLimit);
    return { system: sys, tableName: resolvedTable, totalRows, columns: cols.slice(0, 10), rows };
  } finally {
    db.close();
  }
}

export function handleTableRoute(parsedUrl, res, dbPathsBySystem) {
  try {
    const sys = parsedUrl.searchParams.get('system') || parsedUrl.searchParams.get('db') || 'wms';
    const tbl = parsedUrl.searchParams.get('table') || 'part_part';
    const limit = parsedUrl.searchParams.get('limit') || '30';
    const data = queryTableRows(dbPathsBySystem, sys, tbl, limit);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify(data));
  } catch (err) {
    res.writeHead(400, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(JSON.stringify({ ok: false, error: String(err.message || err) }));
  }
}
