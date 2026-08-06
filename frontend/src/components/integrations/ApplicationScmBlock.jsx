import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { useRepoLinkFlow } from '../../hooks/useRepoLinkFlow.jsx';
import { AdvisoryCell } from './AdvisoryCell.jsx';
import { AdvisoryDetailsModal } from './AdvisoryDetailsModal.jsx';
import { summarizeOsv } from '../../utils/osv.js';

/**
 * Per-application GitHub repo panel (Integrations tab). Shows the linked repo's detected languages,
 * frameworks, and dependency inventory, with Change / Sync / Unlink. All actions run through the
 * shared repo-link flow (link/change/sync open the Language/Framework modal) and are independent of
 * the metadata edit form.
 *
 * @param {{ application: object, canManage: boolean, onRefresh: () => Promise<void> }} props
 */
export function ApplicationScmBlock({ application, canManage, onRefresh }) {
  const repo = application?.scmRepoLink?.repo || null;
  const [showAllDeps, setShowAllDeps] = useState(false);
  const [detailsDep, setDetailsDep] = useState(null);
  const flow = useRepoLinkFlow(application, onRefresh);

  const languageEntries = useMemo(() => {
    const langs = repo?.languages || {};
    return Object.entries(langs).sort((a, b) => b[1] - a[1]);
  }, [repo]);
  const totalLangBytes = useMemo(
    () => languageEntries.reduce((sum, [, bytes]) => sum + bytes, 0) || 1,
    [languageEntries],
  );

  const frameworks = useMemo(
    () => (repo?.dependencies || []).filter((d) => d.isFramework),
    [repo],
  );
  const dependencies = repo?.dependencies || [];
  const osv = useMemo(() => summarizeOsv(dependencies), [dependencies]);

  return (
    <>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>GitHub repository</CardTitle>
              <p className="text-sm text-gray-500 mt-1 max-w-2xl">
                Link a repository to pull languages, frameworks, and dependencies from the source.
                Uses your own{' '}
                <Link to="/settings/integrations" className="text-blue-600 hover:underline">
                  connected GitHub account
                </Link>
                .
              </p>
            </div>
            {canManage && !repo && (
              <Button variant="primary" size="sm" onClick={flow.openLinkPicker} className="shrink-0">
                Link a GitHub repo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!repo ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-600">
              No repository linked yet.
            </div>
          ) : (
            <div className="space-y-5">
              {/* Repo header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-blue-600 hover:underline break-all"
                  >
                    {repo.fullName}
                  </a>
                  {repo.isPrivate ? (
                    <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600 align-middle">
                      Private
                    </span>
                  ) : null}
                  {repo.description ? (
                    <p className="text-sm text-gray-600 mt-1">{repo.description}</p>
                  ) : null}
                  <p className="text-xs text-gray-400 mt-1">
                    {repo.defaultBranch ? `Default branch: ${repo.defaultBranch}` : null}
                    {repo.lastSyncedAt
                      ? `${repo.defaultBranch ? ' · ' : ''}Synced ${new Date(repo.lastSyncedAt).toLocaleString()}`
                      : null}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="secondary" size="sm" onClick={flow.sync} loading={flow.busy}>
                      Sync
                    </Button>
                    <Button variant="secondary" size="sm" onClick={flow.openLinkPicker} disabled={flow.busy}>
                      Change
                    </Button>
                    <Button variant="ghost" size="sm" onClick={flow.unlink} loading={flow.unlinking}>
                      Unlink
                    </Button>
                  </div>
                )}
              </div>

              {/* Languages */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Detected languages
                </h4>
                {languageEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">None detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {languageEntries.map(([lang, bytes]) => (
                      <span
                        key={lang}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-surface px-2.5 py-1 text-xs text-gray-700"
                      >
                        <span className="font-medium">{lang}</span>
                        <span className="text-gray-400">
                          {Math.round((bytes / totalLangBytes) * 100)}%
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Frameworks */}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Detected frameworks
                </h4>
                {frameworks.length === 0 ? (
                  <p className="text-sm text-gray-500">None detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {frameworks.map((f) => (
                      <span
                        key={`${f.ecosystem}-${f.name}`}
                        className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-800"
                      >
                        <span className="font-medium">{f.framework}</span>
                        {f.version ? <span className="text-indigo-500">{f.version}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Dependencies */}
              {dependencies.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
                      Dependencies ({dependencies.length})
                      {osv.status === 'flagged' && (
                        <span className="normal-case rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          ⚠ {osv.flagged} flagged
                        </span>
                      )}
                      {osv.status === 'partial' && (
                        <span className="normal-case rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          ⚠ {osv.unscanned} unchecked
                        </span>
                      )}
                    </h4>
                    {dependencies.length > 8 && (
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => setShowAllDeps((v) => !v)}
                      >
                        {showAllDeps ? 'Show fewer' : 'Show all'}
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Ecosystem</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Package</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Version</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Advisory</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(showAllDeps ? dependencies : dependencies.slice(0, 8)).map((d) => (
                          <tr key={`${d.ecosystem}-${d.name}`}>
                            <td className="px-3 py-1.5 text-gray-500">{d.ecosystem}</td>
                            <td className="px-3 py-1.5 text-gray-800 font-mono text-xs break-all">
                              {d.name}
                              {d.isFramework ? (
                                <span className="ml-1.5 rounded bg-indigo-50 px-1 py-0.5 text-[10px] text-indigo-700">
                                  framework
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-1.5 text-gray-600 font-mono text-xs">
                              {d.version || d.versionRange || '—'}
                            </td>
                            <td className="px-3 py-1.5">
                              <AdvisoryCell dep={d} onOpenDetails={setDetailsDep} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {osv.status !== 'none' && (
                    <p className="mt-2 text-[11px] text-gray-400">
                      Advisory flags come from{' '}
                      <a
                        href="https://osv.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-gray-600"
                      >
                        OSV.dev
                      </a>{' '}
                      and are informational only — check Wiz for authoritative vulnerability details.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {flow.modals}
      <AdvisoryDetailsModal dep={detailsDep} onClose={() => setDetailsDep(null)} />
    </>
  );
}
