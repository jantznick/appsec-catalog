/**
 * Plain, grep-friendly Tenable security-export lines (per request: company/app context + URLs + pagination).
 */

/**
 * @param {string} company - user-visible scope, e.g. "Acme - Tenable app: my-api"
 */
export function logFetchingFindingsFor(company) {
  console.log(`fetching findings for ${company}`);
}

/**
 * @param {string} url
 * @param {boolean} isPaginationRequest if true, logs the "(pagination)" variant
 */
export function logHittingApiEndpoint(url, isPaginationRequest) {
  if (isPaginationRequest) {
    console.log(`hitting api endpoint(pagination): ${url}`);
  } else {
    console.log(`hitting api endpoint: ${url}`);
  }
}

/**
 * @param {boolean} v
 */
export function logPaginationDiscovered(v) {
  console.log(`pagination discovered: ${v ? 'true' : 'false'}`);
}

/**
 * @param {string} label
 * @param {string} [error]
 * @param {object} o
 * @param {number} o.workbenchAssetCount
 * @param {number} o.uniqueVulnCount
 * @param {string} o.counts - e.g. c=0 h=1 m=2
 */
export function logTenableResultSummary(label, error, o) {
  const e = error ? ` error=${String(error).slice(0, 200)}` : '';
  console.log(
    `tenable result summary for ${label}: workbench assets=${o.workbenchAssetCount} unique vulns (deduped)=${o.uniqueVulnCount} sev[${o.counts}]${e}`,
  );
}
