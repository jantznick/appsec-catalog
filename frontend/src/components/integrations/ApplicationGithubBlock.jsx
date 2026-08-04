import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Per-application GitHub repo link (one repo per app). Shows detected languages, frameworks, and
 * the parsed dependency inventory, with Sync / Apply / Unlink actions. API access uses the acting
 * user's own GitHub connection (managed under Integration settings).
 *
 * @param {{ application: object, canManage: boolean, onRefresh: () => Promise<void> }} props
 */
export function ApplicationGithubBlock({ application, canManage, onRefresh }) {
  const applicationId = application?.id;
  const repo = application?.githubRepoLink?.repo || null;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [showAllDeps, setShowAllDeps] = useState(false);

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

  const detectedLanguage = languageEntries.slice(0, 3).map(([l]) => l).join(', ');
  const detectedFramework = [...new Set(frameworks.map((f) => f.framework).filter(Boolean))].join(', ');

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, filter]);

  const openPicker = async () => {
    setPickerOpen(true);
    setSelected(null);
    setFilter('');
    setStatusLoading(true);
    try {
      const status = await api.getGithubStatus();
      setConnected(Boolean(status.connected));
      if (status.connected) {
        setReposLoading(true);
        const { repos: list } = await api.getGithubRepos();
        setRepos(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load GitHub repositories');
    } finally {
      setStatusLoading(false);
      setReposLoading(false);
    }
  };

  const doLink = async () => {
    if (!selected) return;
    setLinking(true);
    try {
      await api.linkApplicationGithubRepo(applicationId, { owner: selected.owner, name: selected.name });
      toast.success(`Linked ${selected.fullName}`);
      setPickerOpen(false);
      await onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to link repository');
    } finally {
      setLinking(false);
    }
  };

  const doSync = async () => {
    setSyncing(true);
    try {
      await api.syncApplicationGithubRepo(applicationId);
      toast.success('Repository synced');
      await onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to sync repository');
    } finally {
      setSyncing(false);
    }
  };

  const doApply = async () => {
    setApplying(true);
    try {
      await api.applyApplicationGithubData(applicationId, ['language', 'framework']);
      toast.success('Applied detected language and framework');
      setApplyOpen(false);
      await onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to apply detected values');
    } finally {
      setApplying(false);
    }
  };

  const doUnlink = async () => {
    setUnlinking(true);
    try {
      await api.unlinkApplicationGithubRepo(applicationId);
      toast.success('Repository unlinked');
      setUnlinkOpen(false);
      await onRefresh();
    } catch (e) {
      toast.error(e.message || 'Failed to unlink repository');
    } finally {
      setUnlinking(false);
    }
  };

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
            {canManage && (
              <Button variant={repo ? 'ghost' : 'primary'} size="sm" onClick={openPicker} className="shrink-0">
                {repo ? 'Change repo…' : 'Link a GitHub repo'}
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
                    <Button variant="secondary" size="sm" onClick={doSync} loading={syncing}>
                      Sync
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setApplyOpen(true)}
                      disabled={!detectedLanguage && !detectedFramework}
                    >
                      Apply to fields
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setUnlinkOpen(true)}>
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
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
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
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Dependencies ({dependencies.length})
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Repo picker */}
      <Modal
        isOpen={pickerOpen}
        onClose={() => !linking && setPickerOpen(false)}
        title="Link a GitHub repository"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickerOpen(false)} disabled={linking}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doLink} loading={linking} disabled={!selected}>
              Link repository
            </Button>
          </>
        }
      >
        {statusLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : !connected ? (
          <div className="text-sm text-gray-700 space-y-2">
            <p>Your GitHub account isn&apos;t connected yet.</p>
            <p>
              Connect it under{' '}
              <Link to="/settings/integrations" className="text-blue-600 hover:underline">
                Integration settings
              </Link>
              , then come back to link a repository.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter repositories…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {reposLoading ? (
              <p className="text-sm text-gray-500">Loading repositories…</p>
            ) : filteredRepos.length === 0 ? (
              <p className="text-sm text-gray-500">
                No repositories found. Make sure the GitHub App is installed on the repos you want to link.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
                {filteredRepos.map((r) => {
                  const isSel = selected?.githubRepoId === r.githubRepoId;
                  return (
                    <li key={r.githubRepoId}>
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          isSel ? 'bg-blue-50' : ''
                        }`}
                      >
                        <span className="font-medium text-gray-900 break-all">{r.fullName}</span>
                        {r.isPrivate ? (
                          <span className="ml-2 text-xs text-gray-400">private</span>
                        ) : null}
                        {r.description ? (
                          <span className="block text-xs text-gray-500 truncate">{r.description}</span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* Apply confirm */}
      <Modal
        isOpen={applyOpen}
        onClose={() => !applying && setApplyOpen(false)}
        title="Apply detected values?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)} disabled={applying}>
              Cancel
            </Button>
            <Button variant="primary" onClick={doApply} loading={applying}>
              Apply
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">This overwrites the application&apos;s Language and Framework fields:</p>
          <dl className="space-y-2">
            <div>
              <dt className="text-xs font-medium text-gray-500">Language</dt>
              <dd className="text-gray-800">
                <span className="text-gray-400 line-through mr-2">{application?.language || '(empty)'}</span>
                <span className="font-medium">→ {detectedLanguage || '(none detected)'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Framework</dt>
              <dd className="text-gray-800">
                <span className="text-gray-400 line-through mr-2">{application?.framework || '(empty)'}</span>
                <span className="font-medium">→ {detectedFramework || '(none detected)'}</span>
              </dd>
            </div>
          </dl>
        </div>
      </Modal>

      {/* Unlink confirm */}
      <Modal
        isOpen={unlinkOpen}
        onClose={() => !unlinking && setUnlinkOpen(false)}
        title="Unlink repository?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setUnlinkOpen(false)} disabled={unlinking}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doUnlink} loading={unlinking}>
              Unlink
            </Button>
          </>
        }
      >
        <p className="text-gray-700">
          This removes the repository link from this application. The repository data stays cached for any
          other applications linked to it.
        </p>
      </Modal>
    </>
  );
}
