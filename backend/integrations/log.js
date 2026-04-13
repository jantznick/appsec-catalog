/**
 * Structured integration logs — one JSON line per event, prefix `[integrations]`.
 * Never log secrets, tokens, API keys, or raw Authorization headers.
 *
 * Set INTEGRATIONS_VERBOSE=1 (or "true") for extra detail (per-page fetches, fallbacks).
 */

/**
 * @returns {boolean}
 */
export function isIntegrationsVerbose() {
  const v = process.env.INTEGRATIONS_VERBOSE;
  return v === '1' || v === 'true';
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
