import { Modal } from '../ui/Modal.jsx';
import { depVulns, worstSeverity, severityMeta, osvUrl } from '../../utils/osv.js';

/**
 * Secondary modal listing the OSV advisories for a single dependency in a readable form
 * (severity, summary, CVE/advisory IDs, link out). Opened from the advisory badge in either
 * dependency table. Informational only — Wiz is the source of truth for vulnerability data.
 *
 * @param {{ dep: object|null, onClose: () => void }} props
 *   dep is the selected dependency (or null when closed).
 */
export function AdvisoryDetailsModal({ dep, onClose }) {
  const vulns = dep ? depVulns(dep) : [];
  const worst = worstSeverity(vulns);
  const version = dep?.version || dep?.versionRange || '';
  // Most severe first (Critical → High → Moderate → Low → unknown).
  const sortedVulns = [...vulns].sort(
    (a, b) => severityMeta(b.severity).rank - severityMeta(a.severity).rank,
  );

  return (
    <Modal
      isOpen={!!dep}
      onClose={onClose}
      title="Security advisories"
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
        >
          Close
        </button>
      }
    >
      {dep && (
        <div className="space-y-4">
          <div>
            <p className="font-mono text-sm font-semibold text-gray-900 break-all">
              {dep.name}
              {version ? <span className="ml-2 text-gray-500">{version}</span> : null}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              {vulns.length} known {vulns.length === 1 ? 'advisory' : 'advisories'}
              {worst.label ? ` · highest severity: ${worst.label}` : ''} · from{' '}
              <a
                href="https://osv.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-700"
              >
                OSV.dev
              </a>
              . Check <span className="font-medium">Wiz</span> for authoritative details.
            </p>
          </div>

          <ul className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
            {sortedVulns.map((v) => {
              const meta = severityMeta(v.severity);
              return (
                <li key={v.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                      >
                        {meta.label || 'Advisory'}
                      </span>
                      <p className="mt-1.5 text-sm text-gray-900">
                        {v.summary || 'No summary provided.'}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-gray-500">
                        {v.cve ? <span className="mr-2">{v.cve}</span> : null}
                      </p>
                    </div>
                    <a
                      href={osvUrl(v.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 whitespace-nowrap text-xs font-medium text-blue-600 hover:underline"
                    >
                      View on OSV ↗
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
