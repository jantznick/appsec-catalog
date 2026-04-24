import { integrationLog, logExportVendorRequest, safeUrlHost } from './log.js';

const DEFAULT_BASE = 'https://cloud.tenable.com';

/**
 * @param {string} accessKey
 * @param {string} secretKey
 * @param {string} [baseUrl]
 */
function authHeaders(accessKey, secretKey, baseUrl) {
  return {
    'X-ApiKeys': `accessKey=${accessKey}; secretKey=${secretKey}`,
    Accept: 'application/json',
  };
}

/**
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string} base
 * @returns {Promise<Map<string, string>>} category uuid -> name
 */
async function loadTenableIoCategoryNameMap(keys, base) {
  const headers = authHeaders(keys.accessKey, keys.secretKey, base);
  const map = new Map();
  let offset = 0;
  const limit = 200;
  for (;;) {
    const url = `${base}/tags/categories?limit=${limit}&offset=${offset}`;
    logExportVendorRequest({
      provider: 'TENABLE_IO',
      method: 'GET',
      url,
      label: `tags/categories (category name map) offset=${offset} limit=${limit}`,
    });
    const res = await fetch(url, { headers });
    if (!res.ok) {
      // Older tenants may not expose categories; fall back to value-only display
      return map;
    }
    const data = await res.json();
    const list = Array.isArray(data.categories) ? data.categories : [];
    for (const c of list) {
      if (c?.uuid && c?.name) map.set(c.uuid, c.name);
    }
    if (list.length < limit) break;
    offset += limit;
  }
  return map;
}

/**
 * List all tag values (paginated) from Tenable.io.
 * Adds `category_name` and `display_label` for UI (Tenable: "Category: value" style).
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string | null | undefined} baseUrl
 * @returns {Promise<Array<{ uuid: string, value?: string, category_uuid?: string, category_name?: string, display_label: string }>>}
 */
export async function listTenableIoTagValues(keys, baseUrl) {
  const started = Date.now();
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const baseHost = safeUrlHost(`${base}/`);
  const headers = authHeaders(keys.accessKey, keys.secretKey, base);
  const all = [];
  let offset = 0;
  const limit = 500;
  let page = 0;

  try {
    for (;;) {
      page += 1;
      const url = `${base}/tags/values?limit=${limit}&offset=${offset}`;
      logExportVendorRequest({
        provider: 'TENABLE_IO',
        method: 'GET',
        url,
        label: `tags/values (list tag list for export) page=${page} offset=${offset} limit=${limit}`,
      });
      const res = await fetch(url, { headers });
      if (!res.ok) {
        const text = await res.text();
        const err = new Error(`Tenable.io tags request failed: ${res.status}`);
        err.statusCode = res.status === 401 || res.status === 403 ? 403 : 502;
        err.detail = text?.slice(0, 500);
        throw err;
      }
      const data = await res.json();
      const values = Array.isArray(data.values) ? data.values : [];
      all.push(...values);
      if (values.length < limit) {
        break;
      }
      offset += limit;
    }

    const categoryNameByUuid = await loadTenableIoCategoryNameMap(keys, base);
    const mapped = all.map((v) => {
      const value = v.value;
      const categoryUuid = v.category_uuid;
      const categoryName = categoryUuid ? categoryNameByUuid.get(categoryUuid) : undefined;
      const displayLabel =
        categoryName && (value != null && value !== '')
          ? `${categoryName}: ${value}`
          : (value != null && value !== '')
            ? String(value)
            : (categoryName || v.uuid);
      return {
        uuid: v.uuid,
        value: v.value,
        category_uuid: v.category_uuid,
        category_name: categoryName,
        display_label: displayLabel,
      };
    });

    integrationLog('info', {
      provider: 'TENABLE_IO',
      op: 'list_tag_values',
      baseHost,
      tagCount: mapped.length,
      pages: page,
      durationMs: Date.now() - started,
    });

    return mapped;
  } catch (e) {
    const err = /** @type {{ message?: string, statusCode?: number }} */ (e);
    integrationLog('error', {
      provider: 'TENABLE_IO',
      op: 'list_tag_values',
      baseHost,
      page,
      durationMs: Date.now() - started,
      error: err.message || String(e),
      httpStatus: err.statusCode,
    });
    throw e;
  }
}
