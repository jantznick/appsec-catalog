/**
 * Structured integration logs - one JSON line per event, prefix `[integrations]`.
 * Never log secrets, tokens, API keys, or raw Authorization headers.
 *
 * Set INTEGRATIONS_VERBOSE=1 (or "true") for extra detail (per-page fetches, fallbacks).
 *
 * Security findings CSV export always logs each outbound Tenable/Wiz HTTP request (method, host, path)
 * via `logExportVendorRequest` (no env flag).
 */

/**
 * @returns {boolean}
 */
export function isIntegrationsVerbose() {
  const v = process.env.INTEGRATIONS_VERBOSE;
  return v === '1' || v === 'true';
}

/**
 * Best-effort GraphQL operation name for logs (e.g. `query SastExportV2` -> `SastExportV2`).
 * @param {string} gql
 * @returns {string | null}
 */
export function graphQlOpNameFromQuery(gql) {
  const m = /\b(?:query|mutation|subscription)\s+([_A-Za-z0-9]+)\b/.exec(String(gql || ''));
  return m ? m[1] : null;
}

/**
 * @param {object} p
 * @param {string} p.provider e.g. TENABLE_IO, WIZ
 * @param {string} p.method
 * @param {string} p.url absolute URL
 * @param {string} [p.label] human hint (e.g. pagination, operation name)
 */
export function logExportVendorRequest(p) {
  let host = null;
  let path = p.url;
  try {
    const u = new URL(p.url);
    host = u.host;
    path = `${u.pathname}${u.search}`;
    if (path.length > 500) {
      path = path.slice(0, 500) + '…';
    }
  } catch {
    path = String(p.url).slice(0, 200);
  }
  integrationLog('info', {
    provider: p.provider,
    op: 'http_request',
    method: p.method,
    host,
    path,
    ...(p.label != null && p.label !== '' ? { label: p.label } : {}),
  });
}

/**
 * @param {'info' | 'warn' | 'error'} level
 * @param {Record<string, unknown>} payload
 */
export function integrationLog(level, payload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = `[integrations] ${JSON.stringify(entry)}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.info(line);
  }
}

/**
 * Host only, for correlating which tenant/region was called (no path/query).
 * @param {string | undefined | null} urlStr
 */
export function safeUrlHost(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') {
    return null;
  }
  try {
    return new URL(urlStr.trim()).host;
  } catch {
    return '(invalid-url)';
  }
}
