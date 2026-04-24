import { integrationLog, safeUrlHost } from './log.js';
import { listTenableIoTagValues } from './tenableIo.js';

const DEFAULT_BASE = 'https://cloud.tenable.com';

/**
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string} base
 */
function authHeaders(keys, base) {
  return {
    'X-ApiKeys': `accessKey=${keys.accessKey}; secretKey=${keys.secretKey}`,
    Accept: 'application/json',
  };
}

/**
 * @param {string} risk
 * @param {string} [vpr] numeric
 */
function bucketForRiskString(risk, vpr) {
  const r = (risk || '').toString().toLowerCase();
  if (r === 'critical' || r === '4') return 'critical';
  if (r === 'high' || r === '3' || (vpr && Number(vpr) >= 9.0)) return 'high';
  if (r === 'medium' || r === '2') return 'medium';
  if (r === 'low' || r === '1' || (vpr && Number(vpr) > 0 && Number(vpr) < 2)) return 'low';
  if (r === 'none' || r === '0' || r === 'info' || r === 'informational') return 'info';
  if (vpr) {
    const n = Number(vpr);
    if (n >= 9.0) return 'critical';
    if (n >= 7.0) return 'high';
    if (n >= 4.0) return 'medium';
    if (n > 0) return 'low';
  }
  return 'info';
}

const pluginCache = new Map();

/**
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string} base
 * @param {number} pluginId
 */
async function pluginIdToBucket(keys, base, pluginId) {
  const cacheKey = `${base}::${pluginId}`;
  if (pluginCache.has(cacheKey)) {
    return /** @type {'critical'|'high'|'medium'|'low'|'info'} */ (pluginCache.get(cacheKey));
  }
  const url = `${base}/plugins/plugin/${pluginId}`;
  const res = await fetch(url, { headers: authHeaders(keys, base) });
  if (!res.ok) {
    pluginCache.set(cacheKey, 'info');
    return 'info';
  }
  const data = await res.json();
  const risk = data?.attributes?.risk || data?.risk;
  const vpr = data?.vpr;
  const bucket = bucketForRiskString(String(risk), vpr != null ? String(vpr) : undefined);
  pluginCache.set(cacheKey, bucket);
  return /** @type {'critical'|'high'|'medium'|'low'|'info'} */ (bucket);
}

/**
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string} base
 * @param {string} categoryName
 * @param {string} value
 */
async function listAssetIdsByWorkbenchTag(keys, base, categoryName, value) {
  const out = new Set();
  const baseHost = safeUrlHost(base);
  const filterKey = `tag.${categoryName}`;
  let offset = 0;
  for (;;) {
    const u = new URL(`${base}/workbenches/assets`);
    u.searchParams.set('offset', String(offset));
    u.searchParams.set('limit', '200');
    u.searchParams.set('filter.0.filter', filterKey);
    u.searchParams.set('filter.0.quality', 'eq');
    u.searchParams.set('filter.0.value', value);
    const res = await fetch(u.href, { headers: authHeaders(keys, base) });
    if (!res.ok) {
      const text = await res.text();
      integrationLog('error', {
        provider: 'TENABLE_IO',
        op: 'workbench_assets_tag',
        baseHost,
        status: res.status,
        detail: text?.slice(0, 400),
      });
      return [...out];
    }
    const data = await res.json();
    const assets = Array.isArray(data?.assets) ? data.assets : [];
    for (const a of assets) {
      if (a?.id) {
        out.add(a.id);
      }
    }
    if (assets.length < 200) {
      break;
    }
    offset += 200;
  }
  return [...out];
}

/**
 * @param {object | 'all' | null | undefined} timeRange
 *   - { all: true } or { from?: string (ISO), to?: string (ISO) }
 */
function wasTimeClauses(timeRange) {
  if (timeRange === 'all' || timeRange == null) {
    return [];
  }
  if (typeof timeRange === 'object' && (timeRange).all) {
    return [];
  }
  if (typeof timeRange !== 'object' || timeRange == null) {
    return [];
  }
  const from = timeRange.from;
  const to = timeRange.to;
  const out = [];
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) {
      out.push({ field: 'vulns.created_at', operator: 'gte', value: `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}` });
    }
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      out.push({ field: 'vulns.created_at', operator: 'lte', value: `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}` });
    }
  }
  return out;
}

/**
 * @param {object} keys
 * @param {string} base
 * @param {object} wasBody
 */
async function runWasSearch(keys, base, wasBody) {
  const baseHost = safeUrlHost(base);
  const allItems = [];
  let offset = 0;
  for (;;) {
    const url = new URL(`${base}/was/v2/vulnerabilities/search`);
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', String(offset));
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(keys, base), 'Content-Type': 'application/json' },
      body: JSON.stringify(wasBody),
    });
    if (!res.ok) {
      const text = await res.text();
      const e = new Error(`Tenable WAS search ${res.status}: ${text?.slice(0, 200)}`);
      e.statusCode = 502;
      e.detail = text;
      throw e;
    }
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    allItems.push(...items);
    if (items.length < 200) {
      break;
    }
    if (allItems.length > 8000) {
      integrationLog('warn', {
        provider: 'TENABLE_IO',
        op: 'was_search_cap',
        baseHost,
        count: allItems.length,
      });
      break;
    }
    offset += 200;
  }
  return allItems;
}

/**
 * Tenable WAS: counts by workbench-tagged web apps (WAS findings) with optional time.
 * @param {object} keys
 * @param {string|undefined} baseUrl
 * @param {{ tagUuid: string }} filter
 * @param {object} timeRange
 * @returns {Promise<{ source: string, critical: number, high: number, medium: number, low: number, info: number, error: string | null }>}
 */
export async function getTenableWasCountsByTag(keys, baseUrl, filter, timeRange) {
  const result = {
    source: 'Tenable WAS',
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    error: /** @type {string|null} */ (null),
  };

  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');

  let tag;
  try {
    const all = await listTenableIoTagValues(keys, base);
    tag = all.find((t) => t.uuid === filter.tagUuid);
  } catch (e) {
    const err = /** @type {Error} */ (e);
    result.error = err.message || 'Failed to list Tenable tag values';
    return result;
  }
  if (!tag || !tag.category_name || tag.value == null) {
    result.error = 'Could not resolve Tenable tag to category and value (needed for workbench + WAS).';
    return result;
  }

  const assets = await listAssetIdsByWorkbenchTag(keys, base, tag.category_name, String(tag.value));
  if (assets.length === 0) {
    return result;
  }

  const timeClauses = wasTimeClauses(timeRange);
  const byVuln = new Map();
  const CHUNK = 8;

  for (let i = 0; i < assets.length; i += CHUNK) {
    const part = assets.slice(i, i + CHUNK);
    const orF = { OR: part.map((id) => ({ field: 'asset_id', operator: 'eq', value: id })) };
    const wasBody =
      timeClauses.length > 0
        ? { AND: [orF, { AND: timeClauses }] }
        : orF;
    let items;
    try {
      items = await runWasSearch(keys, base, wasBody);
    } catch (e) {
      const err = /** @type {Error} */ (e);
      result.error = err.message || 'WAS search failed';
      return result;
    }
    for (const it of items) {
      const kid = it?.vuln_id || `p${it?.plugin_id}u${it?.uri}s${it?.scan_id}`;
      if (byVuln.has(kid)) {
        continue;
      }
      byVuln.set(kid, it);
    }
  }

  const pids = new Set();
  for (const it of byVuln.values()) {
    if (it?.plugin_id != null) pids.add(it.plugin_id);
  }
  const pMap = new Map();
  for (const pid of pids) {
    pMap.set(pid, await pluginIdToBucket(keys, base, Number(pid)));
  }
  for (const it of byVuln.values()) {
    const b = it?.plugin_id != null ? pMap.get(it.plugin_id) : 'info';
    if (b === 'critical') {
      result.critical += 1;
    } else if (b === 'high') {
      result.high += 1;
    } else if (b === 'medium') {
      result.medium += 1;
    } else if (b === 'low') {
      result.low += 1;
    } else {
      result.info += 1;
    }
  }

  return result;
}
