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
  const base = (baseUrl || DEFAULT_BASE).replace(/\/$/, '');
  const headers = authHeaders(keys.accessKey, keys.secretKey, base);
  const all = [];
  let offset = 0;
  const limit = 500;

  for (;;) {
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

  return all.map((v) => ({
    uuid: v.uuid,
    value: v.value,
    category_uuid: v.category_uuid,
  }));
}
