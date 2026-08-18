import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { scmProviderLabel } from '../../lib/integrationLabels.js';

/**
 * Reusable picker for the current user's connected source-control repositories. Handles the
 * connection-status check and repo fetch itself; on confirm it hands the chosen repo back via
 * onSelect — the caller decides what to do with it (link, prefill, navigate, …).
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onSelect: (repo: object) => void,
 *   title?: string,
 *   confirmLabel?: string,
 *   submitting?: boolean,   // caller's async in-flight state, shows loading on the confirm button
 * }} props
 */
export function ScmRepoPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Choose a repository',
  confirmLabel = 'Select repository',
  submitting = false,
}) {
  const [statusLoading, setStatusLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [repos, setRepos] = useState([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setSelected(null);
    setFilter('');
    (async () => {
      setStatusLoading(true);
      try {
        const status = await api.getScmStatus();
        if (cancelled) return;
        setConnected(Boolean(status.connected));
        if (status.connected) {
          setReposLoading(true);
          const { repos: list } = await api.getScmRepos();
          if (!cancelled) setRepos(Array.isArray(list) ? list : []);
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load repositories');
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
          setReposLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, filter]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !submitting && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => selected && onSelect(selected)}
            loading={submitting}
            disabled={!selected || !connected}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {statusLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !connected ? (
        <div className="text-sm text-gray-700 space-y-2">
          <p>No source-control account is connected yet.</p>
          <p>
            Connect it under{' '}
            <Link to="/settings/integrations" className="text-blue-600 hover:underline">
              Integration settings
            </Link>
            , then come back to pick a repository.
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
              No repositories found. Make sure your connected account can access the repos you want.
            </p>
          ) : (
            <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
              {filteredRepos.map((r) => {
                const isSel =
                  selected?.provider === r.provider &&
                  selected?.host === r.host &&
                  selected?.externalId === r.externalId;
                return (
                  <li key={`${r.provider}:${r.host}:${r.externalId}`}>
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                        isSel ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="font-medium text-gray-900 break-all">{r.fullName}</span>
                      <span className="ml-2 text-xs text-gray-400">{scmProviderLabel(r.provider)}</span>
                      {r.isPrivate ? <span className="ml-2 text-xs text-gray-400">private</span> : null}
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
  );
}
