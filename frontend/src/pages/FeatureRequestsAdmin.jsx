import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardContent } from '../components/ui/Card.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { toast } from '../components/ui/Toast.jsx';
import { usePendingApprovals } from '../contexts/PendingApprovalsContext.jsx';
import {
  REQUEST_STATUSES,
  categoryBadgeClass,
  formatDateTime,
  requestStatusMeta,
  stageMeta,
} from '../lib/productCommunication.js';

const FILTERS = [{ key: 'all', label: 'All' }, ...REQUEST_STATUSES];

function RequestCard({ request, busy, onStatusChange, onReply, onPromote, onDelete }) {
  const meta = requestStatusMeta(request.status);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
                {meta.label}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(request.category)}`}
              >
                {request.category}
              </span>
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">{request.title}</h2>
            <p className="mt-1 text-xs text-gray-500">
              <a
                href={`mailto:${request.submitterEmail}`}
                className="text-blue-600 hover:text-blue-700"
              >
                {request.submitterEmail}
              </a>
              {' · '}
              {formatDateTime(request.createdAt)}
              {request.handledBy && <> · handled by {request.handledBy.email}</>}
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <Select
              value={request.status}
              onChange={(event) => onStatusChange(request, event.target.value)}
              disabled={busy}
              options={REQUEST_STATUSES.map((status) => ({ value: status.key, label: status.label }))}
              aria-label={`Status for ${request.title}`}
            />
          </div>
        </div>

        <p className="whitespace-pre-line text-sm leading-6 text-gray-700">{request.details}</p>

        {request.adminNote && (
          <div className="rounded-lg border-l-2 border-blue-500 bg-gray-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Your reply (the submitter sees this)
            </p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-700">
              {request.adminNote}
            </p>
          </div>
        )}

        {request.roadmapItem && (
          <p className="text-xs text-gray-500">
            On the roadmap as{' '}
            <span className="font-medium text-gray-700">{request.roadmapItem.title}</span> —{' '}
            {stageMeta(request.roadmapItem.stage).label}
            {request.roadmapItem.status === 'draft' && ' (draft)'}.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onReply(request)}>
            {request.adminNote ? 'Edit reply' : 'Reply'}
          </Button>
          {!request.roadmapItem && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onPromote(request)}>
              Add to roadmap
            </Button>
          )}
          <Button size="sm" variant="danger" disabled={busy} onClick={() => onDelete(request)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Admin triage for feature requests.
 *
 * Mirrors the information-requests page: a status filter, one card per
 * submission, and the two things an admin actually does — write back, or turn
 * the idea into a roadmap item. Promoting creates the roadmap item as a draft,
 * so nothing becomes public until it has been edited and published.
 */
export function FeatureRequestsAdmin() {
  const { isAdmin } = useAuthStore();
  const navigate = useNavigate();
  // Triaging a request changes the waiting count, so the badges are refreshed
  // straight away rather than waiting out the 30-second poll.
  const { refresh: refreshBadges } = usePendingApprovals();

  const [filter, setFilter] = useState('all');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.listFeatureRequests(filter);
      setRequests(data.requests || []);
    } catch (err) {
      setError(err?.message || 'Failed to load feature requests');
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

  const applyUpdated = (updated) => {
    setRequests((current) => {
      // A status change can push a request out of the active filter, in which
      // case it drops off the list rather than lingering in the wrong bucket.
      if (filter !== 'all' && updated.status !== filter) {
        return current.filter((request) => request.id !== updated.id);
      }
      return current.map((request) => (request.id === updated.id ? updated : request));
    });
  };

  const changeStatus = async (request, status) => {
    if (status === request.status) return;
    try {
      setBusyId(request.id);
      applyUpdated(await api.updateFeatureRequest(request.id, { status }));
      refreshBadges();
    } catch (err) {
      toast.error(err?.message || 'Failed to update the request');
    } finally {
      setBusyId(null);
    }
  };

  const openReply = (request) => {
    setReplyTo(request);
    setReplyText(request.adminNote || '');
  };

  const saveReply = async () => {
    if (!replyTo) return;
    try {
      setBusyId(replyTo.id);
      applyUpdated(await api.updateFeatureRequest(replyTo.id, { adminNote: replyText }));
      setReplyTo(null);
      toast.success('Reply saved');
    } catch (err) {
      toast.error(err?.message || 'Failed to save your reply');
    } finally {
      setBusyId(null);
    }
  };

  const promote = async (request) => {
    try {
      setBusyId(request.id);
      const result = await api.promoteFeatureRequest(request.id);
      applyUpdated(result.request);
      refreshBadges();
      toast.success('Added to the roadmap as a draft');
      // Hand the new item's id over so the roadmap editor opens on it — the
      // draft still needs wording and a stage before it can be published.
      navigate(`/settings/roadmap?item=${encodeURIComponent(result.roadmapItem.id)}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to add this to the roadmap');
    } finally {
      setBusyId(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      setBusyId(confirmDelete.id);
      await api.deleteFeatureRequest(confirmDelete.id);
      setRequests((current) => current.filter((request) => request.id !== confirmDelete.id));
      setConfirmDelete(null);
      refreshBadges();
      toast.success('Request deleted');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete the request');
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
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Feature requests</h1>
        <p className="max-w-2xl text-gray-600">
          What people have asked for from the What&apos;s New page. Only admins see these. Anything
          you write in a reply is shown back to whoever sent the request.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setFilter(option.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === option.key
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            {option.label}
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
              {filter === 'all' ? 'No feature requests yet.' : 'No requests match this filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              busy={busyId === request.id}
              onStatusChange={changeStatus}
              onReply={openReply}
              onPromote={promote}
              onDelete={setConfirmDelete}
            />
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(replyTo)}
        onClose={() => setReplyTo(null)}
        title="Reply to this request"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
            <Button onClick={saveReply} loading={busyId === replyTo?.id}>
              Save reply
            </Button>
          </div>
        }
      >
        <Textarea
          label="Reply"
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          rows={6}
          maxLength={4000}
          helperText="Shown to the submitter on their own request. Clear it to remove the reply."
        />
      </Modal>

      <Modal
        isOpen={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete feature request"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={doDelete} loading={busyId === confirmDelete?.id}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          Delete &ldquo;{confirmDelete?.title}&rdquo;? This can&apos;t be undone, and the submitter
          will no longer see it in their list.
        </p>
      </Modal>
    </div>
  );
}
