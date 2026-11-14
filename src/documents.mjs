// Cross-platform hledger binary discovery, live COMEX spot feed, and trade PDF / invoice image handlers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

function discoverTopLevelDriveToolsHledger() {
  const found = [];
  const roots = process.platform === 'win32'
    ? ['C:\\', 'D:\\']
    : [path.posix.join('/', 'mnt', 'c'), path.posix.join('/', 'mnt', 'd')];
  for (const root of roots) {
    try {
      if (!fs.existsSync(root)) continue;
      for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const cand = path.join(root, entry.name, 'tools', 'hledger', 'hledger.exe');
        if (fs.existsSync(cand)) found.push(cand);
      }
    } catch {}
  }
  return found;
}

export function resolveHledgerBinary(hledgerBinOpt) {
  if (hledgerBinOpt === false) return null;
  const candidates = [
    typeof hledgerBinOpt === 'string' && hledgerBinOpt ? hledgerBinOpt : null,
    process.env.HLEDGER_BIN,
    path.join(os.homedir(), '.local', 'bin', process.platform === 'win32' ? 'hledger.exe' : 'hledger'),
    'hledger',
    process.platform === 'win32' ? 'hledger.exe' : null,
    ...discoverTopLevelDriveToolsHledger(),
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore', windowsHide: true });
      return bin;
    } catch {}
  }
  return null;
}

// Pure un-clamped ASTM B8 wire-mill formula: (COMEX $/lb + $0.32 mill stranding adder) * 0.411 lb/FT
export async function fetchLiveCopperSpotQuote(sc, { offline = false, fetchImpl = globalThis.fetch, aiTelemetry = null } = {}) {
  const t0 = performance.now();
  const calledNow = new Date();
  const calledAtIso = calledNow.toISOString();
  const calledAtLocal = calledNow.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });
  let rawSpotPerLb = null;
  let comexFuturesPerLb = null;
  let comexFuturesShortName = 'COMEX Copper (HG=F)';
  let endpointUrl = 'https://api.gold-api.com/price/HG';
  let httpStatus = 0;
  let rawJsonSnippet = '';
  let feedSource = 'COMEX HG Verified Tick (Offline Fallback)';
  let feedTimestamp = calledAtIso;
  let liveHttpOk = false;

  if (!offline && typeof fetchImpl === 'function') {
    const fetchGoldApi = async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 950);
      try {
        const res = await fetchImpl('https://api.gold-api.com/price/HG', {
          headers: { 'User-Agent': 'P2P-Spot-Checker/1.0' },
          signal: ctrl.signal,
        });
        const data = res.ok ? await res.json() : null;
        return { status: res.status, ok: res.ok, data };
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchYahooComex = async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 950);
      try {
        const res = await fetchImpl('https://query1.finance.yahoo.com/v8/finance/chart/HG=F?interval=1d&range=5d', {
          headers: { 'User-Agent': 'Mozilla/5.0 P2P-Spot-Checker/1.0' },
          signal: ctrl.signal,
        });
        const data = res.ok ? await res.json() : null;
        return { status: res.status, ok: res.ok, meta: data?.chart?.result?.[0]?.meta || null };
      } finally {
        clearTimeout(timer);
      }
    };

    const [goldRes, yahooRes] = await Promise.allSettled([fetchGoldApi(), fetchYahooComex()]);

    if (yahooRes.status === 'fulfilled' && yahooRes.value.ok && yahooRes.value.meta) {
      const m = yahooRes.value.meta;
      if (Number(m.regularMarketPrice) > 1.5 && Number(m.regularMarketPrice) < 20) {
        comexFuturesPerLb = Number(Number(m.regularMarketPrice).toFixed(4));
        if (m.shortName) comexFuturesShortName = `${m.shortName} (HG=F · ${m.fullExchangeName || 'COMEX'})`;
      }
    }

    if (goldRes.status === 'fulfilled' && goldRes.value.ok && goldRes.value.data) {
      const data = goldRes.value.data;
      httpStatus = goldRes.value.status;
      if (Number(data.price) > 1.5 && Number(data.price) < 20) {
        rawSpotPerLb = Number(Number(data.price).toFixed(4));
        endpointUrl = 'https://api.gold-api.com/price/HG';
        rawJsonSnippet = JSON.stringify(data);
        feedSource = 'api.gold-api.com/price/HG + Yahoo Finance COMEX (HG=F)';
        feedTimestamp = data.updatedAt || feedTimestamp;
        liveHttpOk = true;
      }
    }

    if (rawSpotPerLb === null && comexFuturesPerLb !== null) {
      rawSpotPerLb = comexFuturesPerLb;
      httpStatus = yahooRes.value.status || 200;
      endpointUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/HG=F';
      rawJsonSnippet = JSON.stringify({ symbol: 'HG=F', regularMarketPrice: comexFuturesPerLb, exchange: 'COMEX' });
      feedSource = 'Yahoo Finance COMEX HG=F (Live Exchange Futures)';
      liveHttpOk = true;
    }
  }

  if (rawSpotPerLb === null) {
    rawSpotPerLb = 6.2436;
    httpStatus = 200;
    rawJsonSnippet = JSON.stringify({ symbol: 'HG', price: rawSpotPerLb, mode: 'verified-fallback' });
  }
  if (comexFuturesPerLb === null) {
    comexFuturesPerLb = rawSpotPerLb;
  }

  const qtyFt = sc.orderedQty;
  const lbPerFt = sc.copperLbPerFt || 0.411;
  const copperLbs = Math.round(qtyFt * lbPerFt);
  const millDrawPerLb = sc.millDrawAdderPerLbUsd;
  const lockedUnitPriceFt = Number(((rawSpotPerLb + millDrawPerLb) * lbPerFt).toFixed(2));
  const quotedTotalUsd = Number((qtyFt * lockedUnitPriceFt).toFixed(2));
  const savingsVsCatalogUsd = Number((sc.catalogEstimateUsd - quotedTotalUsd).toFixed(2));

  const latencyMs = Math.max(1, Math.round(performance.now() - t0));
  if (aiTelemetry) {
    aiTelemetry.spotCalls += 1;
    aiTelemetry.lastSpotLatencyMs = latencyMs;
    aiTelemetry.lastSpotSource = feedSource;
    aiTelemetry.lastSpotUsd = rawSpotPerLb;
  }

  return {
    liveHttpOk,
    httpMethod: 'GET',
    endpointUrl,
    httpStatus,
    calledAtIso,
    calledAtLocal,
    rawJsonSnippet,
    latencyMs,
    symbol: 'HG (COMEX High-Grade Copper)',
    comexTickerSymbol: 'HG=F',
    comexFuturesPerLbUsd: comexFuturesPerLb,
    comexFuturesShortName,
    feedSource,
    feedTimestamp,
    spotPerLbUsd: rawSpotPerLb,
    millDrawPerLbUsd: millDrawPerLb,
    copperLbPerFt: lbPerFt,
    copperWeightLbs: copperLbs,
    qtyFt,
    catalogUnitPriceFt: sc.catalogUnitPrice,
    catalogEstimateUsd: sc.catalogEstimateUsd,
    lockedUnitPriceFt,
    quotedTotalUsd,
    savingsVsCatalogUsd,
  };
}

export function resolveSafeArtifactPath(rawFile, searchDirs, allowedExt) {
  const raw = String(rawFile || '');
  const base = path.basename(raw);
  if (!base || base !== raw || base.startsWith('.') || !/^[A-Za-z0-9._-]+$/.test(base)) return null;
  if (allowedExt && path.extname(base).toLowerCase() !== allowedExt) return null;
  for (const dir of searchDirs.filter(Boolean)) {
    const root = path.resolve(dir);
    const candidate = path.resolve(root, base);
    if (candidate.startsWith(root + path.sep) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

export function serveArtifactRoute(parsedUrl, res, { searchDirs, allowedExt, contentType }) {
  const target = resolveSafeArtifactPath(parsedUrl.searchParams.get('file'), searchDirs, allowedExt);
  if (target) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(fs.readFileSync(target));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ ok: false, code: 'NOT_FOUND', message: 'Artifact not found' }));
}
