import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Card, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { toast } from '../components/ui/Toast.jsx';
import { usePendingApprovals } from '../contexts/PendingApprovalsContext.jsx';

const FILTERS = [
  { key: 'NEW', label: 'New' },
  { key: 'HANDLED', label: 'Handled' },
  { key: 'all', label: 'All' },
];

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function ProgramInfoRequests() {
  const { isAdmin } = useAuthStore();
  const { refresh: refreshBadges } = usePendingApprovals();

  const [filter, setFilter] = useState('NEW');
  const [requests, setRequests] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const programLabels = useMemo(
    () => Object.fromEntries(programs.map((p) => [p.key, p.label])),
    [programs]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.listProgramRequests(filter);
      setRequests(data.requests || []);
      setPrograms(data.programs || []);
    } catch (err) {
      setError(err?.message || 'Failed to load information requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const setStatus = async (request, status) => {
    try {
      setBusyId(request.id);
      await api.updateProgramRequestStatus(request.id, status);
      await load();
      refreshBadges();
    } catch (err) {
      toast.error(err?.message || 'Failed to update request');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    const request = confirmDelete;
    if (!request) return;
    try {
      setBusyId(request.id);
      await api.deleteProgramRequest(request.id);
      setConfirmDelete(null);
      await load();
      refreshBadges();
      toast.success('Request deleted');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete request');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link to="/settings" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          Back to Settings
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Information requests</h1>
        <p className="max-w-2xl text-gray-600">
          People who asked about the program from the public documentation site. Mark a request handled
          once you&apos;ve followed up.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : error ? (
        <Card>
          <CardContent>
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-gray-500">
              {filter === 'NEW'
                ? 'No new information requests.'
                : 'No requests match this filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`mailto:${request.email}`}
                        className="text-base font-semibold text-blue-600 hover:text-blue-700"
                      >
                        {request.email}
                      </a>
                      {request.status === 'NEW' ? (
                        <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-medium">
                          New
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs font-medium">
                          Handled
                        </span>
                      )}
                      {request.sourcePage === 'account-request' && (
                        <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-xs font-medium">
                          Account request
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatDate(request.createdAt)}
                      {request.sourcePage && request.sourcePage !== 'account-request' && ` · from the ${request.sourcePage} page`}
                      {request.status === 'HANDLED' && request.handledBy && (
                        <> · handled by {request.handledBy.email}</>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {request.status === 'NEW' ? (
                      <Button
                        size="sm"
                        variant="success"
                        loading={busyId === request.id}
                        onClick={() => setStatus(request, 'HANDLED')}
                      >
                        Mark handled
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={busyId === request.id}
                        onClick={() => setStatus(request, 'NEW')}
                      >
                        Reopen
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(request)}>
                      Delete
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {request.programs
                    .filter((key) => key !== 'account-request')
                    .map((key) => (
                      <span
                        key={key}
                        className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-xs font-medium"
                      >
                        {programLabels[key] || key}
                      </span>
                    ))}
                </div>

                {request.message && (
                  <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                    {request.message}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this request?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={Boolean(busyId)} onClick={doDelete}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-700">
          This permanently deletes the request from{' '}
          <span className="font-medium text-gray-900">{confirmDelete?.email}</span>. Use this for spam —
          if you&apos;ve already followed up, mark it handled instead so you keep the record.
        </p>
      </Modal>
    </div>
  );
}
