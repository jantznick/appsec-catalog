import { integrationLog, safeUrlHost } from './log.js';
import {
  logFetchingFindingsFor,
  logHittingApiEndpoint,
  logTenableResultSummary,
} from '../services/securityFindingsTenableLog.js';

const DEFAULT_BASE = 'https://cloud.tenable.com';

const V3_COUNT_PATH = '/api/v3/findings/vulnerabilities/webapp/search/count';

/**
 * Tenable v3 `severity` filter (numeric per webapp count API) → export buckets. One `severity` `eq` per count request.
 */
const SEV_ORDER = [
  { key: 'critical', n: 4 },
  { key: 'high', n: 3 },
  { key: 'medium', n: 2 },
  { key: 'low', n: 1 },
  { key: 'info', n: 0 },
];

/**
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string} base
 */
function authHeaders(keys, base) {
  return {
    'X-ApiKeys': `accessKey=${keys.accessKey}; secretKey=${keys.secretKey}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

/**
 * @param {object | 'all' | null | undefined} timeRange
 */
function lastSeenClauses(timeRange) {
  if (timeRange == null) {
    return [];
  }
  if (timeRange === 'all') {
    return [];
  }
  if (typeof timeRange === 'object' && timeRange && (/** @type {object} */(timeRange)).all) {
    return [];
  }
  if (typeof timeRange !== 'object' || timeRange == null) {
    return [];
  }
  const { from, to } = timeRange;
  const out = [];
  if (from) {
    out.push({ property: 'last_seen', operator: 'gt', value: String(from) });
  }
  if (to) {
    out.push({ property: 'last_seen', operator: 'lt', value: String(to) });
  }
  return out;
}

/**
 * Tenable v3 `.../webapp/search/count` body is `{ "total": <n> }` (observed; n may be number or string).
 * @param {unknown} data
 * @returns {number}
 */
function readCountValue(data) {
  if (data == null) {
    return 0;
  }
  if (typeof data === 'number' && !Number.isNaN(data)) {
    return data;
  }
  if (typeof data === 'object' && !Array.isArray(data)) {
    const o = /** @type {Record<string, unknown>} */ (data);
    if (typeof o.total === 'number' && !Number.isNaN(o.total)) {
      return o.total;
    }
    if (o.total != null) {
      const n = Number(o.total);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
    for (const k of ['value', 'count']) {
      if (k in o && typeof o[k] === 'number') {
        return /** @type {number} */(o[k]);
      }
    }
  }
  return 0;
}

/**
 * Webapp findings: POST /api/v3/findings/vulnerabilities/webapp/search/count
 * Filter: `asset.tags` = tag value UUID, `severity` = one level per request; optional `last_seen` from export time range.
 * @param {object} keys
 * @param {string|undefined} baseUrl
 * @param {{ tagUuid: string }} filter
 * @param {object} timeRange
 * @param {{ findingsFor?: string }} [options]
 * @returns {Promise<{ source: string, critical: number, high: number, medium: number, low: number, info: number, error: string | null }>}
 */
export async function getTenableWasCountsByTag(keys, baseUrl, filter, timeRange, options = {}) {
  const findingsFor = options.findingsFor || 'Tenable (unlabeled)';

  const result = {
    source: 'Tenable WAS',
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    error: /** @type {string|null} */(null),
  };

  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const countUrl = `${base}${V3_COUNT_PATH}`;
  const baseHost = safeUrlHost(base);
  const tagId = String(filter.tagUuid);

  const timeClauses = lastSeenClauses(timeRange);

  logFetchingFindingsFor(findingsFor);

  /**
   * @param {number} sev
   * @param {'critical'|'high'|'medium'|'low'|'info'} bucket
   * @returns {Promise<number>}
   */
  const oneCount = async (sev, bucket) => {
    const andClauses = [
      { property: 'asset.tags', operator: 'eq', value: [tagId] },
      { property: 'severity', operator: 'eq', value: sev },
      ...timeClauses,
    ];
    const body = { filter: { and: andClauses } };
    const url = countUrl;
    logHittingApiEndpoint(url, false);
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(keys, base),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      const msg = (data && (/** @type {object} */(data).message || /** @type {object} */(data).error)) || text?.slice(0, 200) || `HTTP ${res.status}`;
      const err = new Error(`Tenable v3 count ${res.status}: ${String(msg).slice(0, 200)}`);
      err.statusCode = 502;
      err.detail = text;
      throw err;
    }
    const n = readCountValue(data);
    result[bucket] = n;
    return n;
  };

  try {
    await Promise.all(SEV_ORDER.map(({ key, n }) => oneCount(n, key)));
  } catch (e) {
    const err = /** @type {Error} */(e);
    result.error = err.message || 'Tenable v3 webapp count failed';
    integrationLog('error', {
      provider: 'TENABLE_IO',
      op: 'webapp_v3_search_count',
      baseHost,
      err: err.message,
    });
    logTenableResultSummary(findingsFor, result.error, {
      workbenchAssetCount: -1,
      uniqueVulnCount: -1,
      counts: 'c=0 h=0 m=0 l=0 i=0',
    });
    return result;
  }

  const sum =
    result.critical + result.high + result.medium + result.low + result.info;
  logTenableResultSummary(findingsFor, null, {
    workbenchAssetCount: -1,
    uniqueVulnCount: sum,
    counts: `c=${result.critical} h=${result.high} m=${result.medium} l=${result.low} i=${result.info}`,
  });
  return result;
}
