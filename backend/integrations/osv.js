/**
 * OSV.dev advisory lookup for repo dependencies.
 *
 * This is an INFORMATIONAL flag only — a lightweight "this pinned version has a known
 * advisory, go look into it" signal. Wiz remains the source of truth for actual vulnerability
 * monitoring and triage. We deliberately keep this simple:
 *
 *   - Only dependencies with a CONCRETE resolved version and a mappable ecosystem are queried.
 *     Range-only rows (e.g. "^1.2.0") are left unscanned rather than guessed at — querying by
 *     range would over-report. The UI surfaces those as "unable to check".
 *   - We use the public batch endpoint (no auth, no key). One HTTP call per 1000 deps.
 *   - We store the advisory IDs only; the UI links each out to osv.dev. Severity/details are
 *     intentionally out of scope — that is what Wiz is for.
 *
 * API: https://google.github.io/osv.dev/post-v1-querybatch/
 */
import { integrationLog } from './log.js';

const OSV_QUERYBATCH_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_URL = 'https://api.osv.dev/v1/vulns/'; // + {id}
const PROVIDER_OSV = 'OSV';
const BATCH_SIZE = 1000; // OSV querybatch hard limit
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ENRICHED_ADVISORIES = 200; // cap detail lookups per scan (flagged advisories are usually few)

// Our internal ecosystem identifiers -> OSV's (case-sensitive) ecosystem names.
// See https://ossf.github.io/osv-schema/#defined-ecosystems.
const OSV_ECOSYSTEM = {
  npm: 'npm',
  pypi: 'PyPI',
  maven: 'Maven', // OSV package name is "groupId:artifactId" — matches what we store
  go: 'Go',
  rubygems: 'RubyGems',
  nuget: 'NuGet',
  composer: 'Packagist',
};

/**
 * Best-effort concrete version from a declared range/constraint. We deliberately favor coverage
 * over precision: a caret/tilde/inequality range (^1.2.0, ~> 1.2, >=1.0.0,<2.0.0) is coerced to
 * the first version it mentions and checked as-is. That is the *declared floor*, not necessarily
 * the installed version — so a flag may be stale if the app resolved to a higher, patched build.
 * That's an acceptable "go look into it" signal; Wiz remains the source of truth. Pure wildcards
 * with no version ("*", "latest", "x") return null and stay unchecked.
 *
 * Examples: "1.2.3"→1.2.3, "^19.2.3"→19.2.3, "~> 1.2"→1.2, ">=1.0.0,<2.0.0"→1.0.0,
 * "==1.2.3"→1.2.3, "1.0.0.RELEASE"→1.0.0.RELEASE, "*"→null, "latest"→null.
 * @param {string | null | undefined} range
 * @returns {string | null}
 */
export function coerceVersion(range) {
  if (!range) return null;
  const s = String(range).trim();
  if (!s) return null;
  // First version-looking token: major[.minor[.patch...]] with optional -prerelease / +build / .qualifier.
  const m = s.match(/\d+(?:\.\d+)*(?:[-+.][0-9A-Za-z][0-9A-Za-z.-]*)?/);
  return m ? m[0] : null;
}

/**
 * The version to query OSV with: the resolved lockfile version when we have it, else a best-effort
 * version coerced from the declared range.
 * @param {{ version?: string, versionRange?: string }} dep
 * @returns {string | null}
 */
export function resolveScanVersion(dep) {
  if (dep?.version) return dep.version;
  return coerceVersion(dep?.versionRange);
}

/**
 * @param {{ ecosystem?: string, name?: string, version?: string, versionRange?: string }} dep
 * @returns {boolean} whether this dep can be queried against OSV (concrete version + mappable ecosystem)
 */
export function isOsvScannable(dep) {
  return Boolean(dep && dep.name && OSV_ECOSYSTEM[dep.ecosystem] && resolveScanVersion(dep));
}

async function postQueryBatch(queries) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(OSV_QUERYBATCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ queries }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`OSV querybatch failed: ${res.status}`);
      err.statusCode = 502;
      err.detail = body.slice(0, 300);
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const SEVERITY_LABELS = { CRITICAL: 'Critical', HIGH: 'High', MODERATE: 'Moderate', MEDIUM: 'Moderate', LOW: 'Low' };

/**
 * Reduce a full OSV vulnerability record to the few fields worth showing a human.
 * @param {object} v OSV vuln JSON
 * @returns {{ id: string|null, summary: string|null, severity: string|null, cve: string|null }}
 */
function summarizeVuln(v) {
  const rawSeverity = (v?.database_specific?.severity || v?.ecosystem_specific?.severity || '')
    .toString()
    .toUpperCase();
  const severity = SEVERITY_LABELS[rawSeverity] || null;
  const cve = Array.isArray(v?.aliases) ? v.aliases.find((a) => /^CVE-/i.test(a)) || null : null;
  let summary = v?.summary || null;
  if (!summary && v?.details) {
    summary = String(v.details).replace(/\s+/g, ' ').trim().slice(0, 160);
  }
  return { id: v?.id || null, summary, severity, cve };
}

/**
 * Fetch one advisory's details. Never throws — returns a bare { id } on any failure so display
 * still works (falling back to just the ID).
 * @param {string} id
 */
async function fetchVulnDetail(id) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${OSV_VULN_URL}${encodeURIComponent(id)}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return { id, summary: null, severity: null, cve: null };
    return summarizeVuln(await res.json());
  } catch {
    return { id, summary: null, severity: null, cve: null };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Enrich flagged dependencies in place with human-friendly advisory details (severity, summary,
 * CVE). Sets `d.osvVulns` to an array of detail objects for flagged rows, else null. Deduplicates
 * lookups across deps (the same advisory often affects several packages). Best-effort and capped.
 * @param {Array<object>} deps
 */
async function enrichFlaggedAdvisories(deps) {
  const uniqueIds = [
    ...new Set(deps.flatMap((d) => (Array.isArray(d.osvVulnIds) ? d.osvVulnIds : []))),
  ].slice(0, MAX_ENRICHED_ADVISORIES);

  const detailById = new Map();
  await Promise.all(
    uniqueIds.map(async (id) => {
      detailById.set(id, await fetchVulnDetail(id));
    }),
  );

  for (const d of deps) {
    const ids = Array.isArray(d.osvVulnIds) ? d.osvVulnIds : [];
    d.osvVulns = ids.length ? ids.map((id) => detailById.get(id) || { id, summary: null, severity: null, cve: null }) : null;
  }
}

/**
 * Query OSV for the given dependencies and annotate each one in place with advisory results.
 *
 * Mutates each dep object, setting:
 *   - osvScanned:   true if the dep was actually queried against OSV
 *   - osvVulnIds:   string[] of advisory IDs (empty when scanned-and-clean), null when not scanned
 *   - osvVulns:     [{ id, summary, severity, cve }] friendly details for flagged rows, else null
 *   - osvScannedAt: Date when queried, else null
 *
 * Never throws: on any network/API failure the affected rows are left osvScanned=false so the UI
 * shows an honest "couldn't check" (yellow) state rather than a false all-clear.
 *
 * @param {Array<{ ecosystem?: string, name?: string, version?: string,
 *   osvScanned?: boolean, osvVulnIds?: string[]|null, osvScannedAt?: Date|null }>} deps
 * @returns {Promise<{ scanned: number, flagged: number, unscanned: number, error: string|null }>}
 *   `error` is set (a short code/message) when the OSV request failed — e.g. a TLS/proxy problem
 *   (UNABLE_TO_GET_ISSUER_CERT_LOCALLY) or network error — so callers can distinguish "couldn't
 *   reach OSV" from "genuinely nothing to check".
 */
export async function scanDependenciesForOsv(deps) {
  const now = new Date();
  // Default everything to "not scanned"; we upgrade the ones we actually query.
  for (const d of deps) {
    d.osvScanned = false;
    d.osvVulnIds = null;
    d.osvVulns = null;
    d.osvScannedAt = null;
  }

  const scannable = deps.filter(isOsvScannable);
  if (scannable.length === 0) {
    return { scanned: 0, flagged: 0, unscanned: deps.length, error: null };
  }

  const started = Date.now();
  let flagged = 0;
  let scanError = null;
  try {
    for (let i = 0; i < scannable.length; i += BATCH_SIZE) {
      const chunk = scannable.slice(i, i + BATCH_SIZE);
      const payload = chunk.map((d) => ({
        package: { name: d.name, ecosystem: OSV_ECOSYSTEM[d.ecosystem] },
        version: resolveScanVersion(d),
      }));
      const data = await postQueryBatch(payload);
      const results = Array.isArray(data?.results) ? data.results : [];
      chunk.forEach((d, idx) => {
        const vulns = results[idx]?.vulns;
        const ids = Array.isArray(vulns) ? vulns.map((v) => v.id).filter(Boolean) : [];
        d.osvScanned = true;
        d.osvScannedAt = now;
        d.osvVulnIds = ids;
        if (ids.length > 0) flagged += 1;
      });
    }
    if (flagged > 0) await enrichFlaggedAdvisories(deps);
  } catch (err) {
    // Partial or total failure: any chunk we didn't reach stays osvScanned=false (yellow in UI).
    // Surface the underlying cause code (e.g. UNABLE_TO_GET_ISSUER_CERT_LOCALLY for a TLS-inspection
    // proxy Node doesn't trust — fix with NODE_EXTRA_CA_CERTS) so it isn't mistaken for a data issue.
    scanError = err?.cause?.code || err?.code || err?.message || String(err);
    integrationLog('warn', {
      provider: PROVIDER_OSV,
      op: 'querybatch',
      durationMs: Date.now() - started,
      error: scanError,
      scannableCount: scannable.length,
    });
  }

  const scanned = deps.filter((d) => d.osvScanned).length;
  integrationLog('info', {
    provider: PROVIDER_OSV,
    op: 'scan_complete',
    durationMs: Date.now() - started,
    total: deps.length,
    scanned,
    flagged,
    unscanned: deps.length - scanned,
    ...(scanError ? { scanError } : {}),
  });
  return { scanned, flagged, unscanned: deps.length - scanned, error: scanError };
}
