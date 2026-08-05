/**
 * Helpers for OSV.dev advisory flags carried on dependency rows.
 *
 * These flags are informational only — a "this pinned version has a known advisory, look into it"
 * signal from OSV.dev. Wiz remains the source of truth for real vulnerability monitoring.
 *
 * Each dependency may carry:
 *   - osvScanned: boolean — whether it had a concrete version + mappable ecosystem and was queried
 *   - osvVulnIds: string[] — advisory IDs affecting the pinned version (empty when clean)
 */

/** @param {{ osvVulnIds?: string[] }} dep */
export function depVulnIds(dep) {
  return Array.isArray(dep?.osvVulnIds) ? dep.osvVulnIds : [];
}

/**
 * Friendly advisory detail objects for a dependency: [{ id, summary, severity, cve }].
 * Falls back to synthesizing bare records from the raw IDs for rows scanned before enrichment.
 * @param {{ osvVulns?: object[], osvVulnIds?: string[] }} dep
 */
export function depVulns(dep) {
  if (Array.isArray(dep?.osvVulns) && dep.osvVulns.length) return dep.osvVulns;
  return depVulnIds(dep).map((id) => ({ id, summary: null, severity: null, cve: null }));
}

const SEVERITY_META = {
  Critical: { rank: 4, label: 'Critical', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  High: { rank: 3, label: 'High', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  Moderate: { rank: 2, label: 'Moderate', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  Low: { rank: 1, label: 'Low', badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
};
// Known advisory but severity not provided — still worth attention, so keep it red-toned.
const UNKNOWN_SEVERITY = { rank: 0, label: null, badge: 'bg-red-100 text-red-700', dot: 'bg-red-400' };

/** @param {string|null|undefined} severity */
export function severityMeta(severity) {
  return SEVERITY_META[severity] || UNKNOWN_SEVERITY;
}

/** Highest-severity meta among a list of advisory detail objects. */
export function worstSeverity(vulns) {
  return (vulns || []).reduce((worst, v) => {
    const m = severityMeta(v?.severity);
    return m.rank > worst.rank ? m : worst;
  }, UNKNOWN_SEVERITY);
}

/** @param {{ osvVulnIds?: string[] }} dep */
export function isFlagged(dep) {
  return depVulnIds(dep).length > 0;
}

/**
 * Roll a dependency list up into a single advisory status.
 * @param {Array<{ osvScanned?: boolean, osvVulnIds?: string[] }>} deps
 * @returns {{ flagged: number, unscanned: number, scanned: number, total: number,
 *   status: 'flagged' | 'partial' | 'clean' | 'none' }}
 *   status:
 *     'flagged' (red)    — at least one dependency has a known advisory
 *     'partial' (yellow) — none flagged, but some couldn't be checked (no pinned version)
 *     'clean'            — everything checkable was checked and came back clean
 *     'none'             — nothing to report (no dependencies)
 */
export function summarizeOsv(deps) {
  const list = Array.isArray(deps) ? deps : [];
  let flagged = 0;
  let scanned = 0;
  for (const d of list) {
    if (isFlagged(d)) flagged += 1;
    if (d?.osvScanned) scanned += 1;
  }
  const unscanned = list.length - scanned;
  let status = 'none';
  if (flagged > 0) status = 'flagged';
  else if (unscanned > 0 && list.length > 0) status = 'partial';
  else if (list.length > 0) status = 'clean';
  return { flagged, unscanned, scanned, total: list.length, status };
}

/** Link to an advisory's OSV.dev page. @param {string} id */
export function osvUrl(id) {
  return `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;
}
