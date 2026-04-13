import { integrationLog, safeUrlHost } from './log.js';

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
 * List all tag values (paginated) from Tenable.io.
 * @param {{ accessKey: string, secretKey: string }} keys
 * @param {string | null | undefined} baseUrl
 * @returns {Promise<Array<{ uuid: string, value?: string, category_uuid?: string }>>}
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

    const mapped = all.map((v) => ({
      uuid: v.uuid,
      value: v.value,
      category_uuid: v.category_uuid,
    }));

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
