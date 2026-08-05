import { depVulns, worstSeverity } from '../../utils/osv.js';

/**
 * Per-row OSV advisory indicator, shared by the dependencies modal and the Integrations-tab table.
 *   colored badge — one or more known advisories, labeled by worst severity + count. Clicking it
 *                   (when onOpenDetails is provided) opens the advisory details modal.
 *   yellow "—"    — couldn't be checked (no usable version / unsupported ecosystem)
 *   gray "✓"      — checked, no known advisories
 * Flags are informational only — Wiz is the source of truth for vulnerability data.
 *
 * @param {{ dep: object, onOpenDetails?: (dep: object) => void }} props
 */
export function AdvisoryCell({ dep, onOpenDetails }) {
  const vulns = depVulns(dep);

  if (vulns.length > 0) {
    const worst = worstSeverity(vulns);
    const label = worst.label
      ? `${worst.label} · ${vulns.length}`
      : `${vulns.length} ${vulns.length === 1 ? 'advisory' : 'advisories'}`;
    const cls = `inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${worst.badge}`;

    return onOpenDetails ? (
      <button
        type="button"
        onClick={() => onOpenDetails(dep)}
        className={`${cls} cursor-pointer hover:brightness-95`}
        title="View advisory details"
      >
        ⚠ {label}
      </button>
    ) : (
      <span className={cls}>⚠ {label}</span>
    );
  }

  if (!dep.osvScanned) {
    return (
      <span className="text-amber-500 text-xs" title="No usable version to check against OSV.dev">
        —
      </span>
    );
  }
  return (
    <span className="text-emerald-500 text-xs" title="No known advisories on OSV.dev">
      ✓
    </span>
  );
}
