/**
 * Download filename for security findings overview CSVs (matches backend).
 * @param {string} s
 * @returns {string}
 */
function safeSlug(s) {
  if (!s || typeof s !== 'string') {
    return 'company';
  }
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (t || 'company').slice(0, 80);
}

/**
 * @param {{ scope: string, companyName?: string | null }} o
 * @returns {string}
 */
export function securityOverviewCsvFilename({ scope, companyName }) {
  if (scope === 'ADMIN_MULTI') {
    return 'security-overview-global.csv';
  }
  return `security-overview-${safeSlug(companyName)}.csv`;
}
