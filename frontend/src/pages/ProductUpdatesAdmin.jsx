import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { toast } from '../components/ui/Toast.jsx';

const CATEGORIES = [
  'Feature',
  'Improvement',
  'Fix',
  'Security',
  'Admin',
  'Integration',
  'Deployment',
];

const emptyForm = {
  title: '',
  summary: '',
  body: '',
  category: 'Improvement',
  releaseLabel: '',
  status: 'draft',
  relatedCommits: [],
};

function formatDate(value) {
  if (!value) return 'Unpublished';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unpublished';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function commitKey(commit) {
  return commit.hash || commit.shortHash || commit.subject;
}

function statusBadgeClasses(status) {
  return status === 'published'
    ? 'bg-green-100 text-green-800'
    : 'bg-gray-100 text-gray-700';
}

export function ProductUpdatesAdmin() {
  const { isAdmin } = useAuthStore();
  const [updates, setUpdates] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [commitError, setCommitError] = useState('');

  const selectedUpdate = useMemo(
    () => updates.find((update) => update.id === selectedId) || null,
    [updates, selectedId],
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [updateData, commitData] = await Promise.all([
        api.getAdminProductUpdates(),
        api.getAdminGitCommits(30).catch((error) => {
          setCommitError(error?.message || 'Unable to load recent commits');
          return { commits: [] };
        }),
      ]);
      setUpdates(updateData.updates || []);
      setCommits(commitData.commits || []);
    } catch (error) {
      toast.error(error?.message || 'Failed to load product updates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin()) {
      loadData();
    }
  }, []);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const editUpdate = (update) => {
    setSelectedId(update.id);
    setForm({
      title: update.title || '',
      summary: update.summary || '',
      body: update.body || '',
      category: update.category || 'Improvement',
      releaseLabel: update.releaseLabel || '',
      status: update.status || 'draft',
      relatedCommits: Array.isArray(update.relatedCommits) ? update.relatedCommits : [],
    });
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const isCommitSelected = (commit) =>
    form.relatedCommits.some((selected) => commitKey(selected) === commitKey(commit));

  const toggleCommit = (commit) => {
    setForm((current) => {
      const exists = current.relatedCommits.some((selected) => commitKey(selected) === commitKey(commit));
      return {
        ...current,
        relatedCommits: exists
          ? current.relatedCommits.filter((selected) => commitKey(selected) !== commitKey(commit))
          : [...current.relatedCommits, commit],
      };
    });
  };

  const useCommitAsDraft = (commit) => {
    setForm((current) => ({
      ...current,
      title: current.title || commit.subject || '',
      summary: current.summary || commit.subject || '',
      relatedCommits: current.relatedCommits.some((selected) => commitKey(selected) === commitKey(commit))
        ? current.relatedCommits
        : [...current.relatedCommits, commit],
    }));
  };

  const saveUpdate = async (nextStatus = form.status) => {
    try {
      setSaving(true);
      const payload = { ...form, status: nextStatus };
      const saved = selectedId
        ? await api.updateProductUpdate(selectedId, payload)
        : await api.createProductUpdate(payload);

      setUpdates((current) => {
        const exists = current.some((update) => update.id === saved.id);
        const next = exists
          ? current.map((update) => (update.id === saved.id ? saved : update))
          : [saved, ...current];
        return next.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      });
      setSelectedId(saved.id);
      setForm({
        title: saved.title || '',
        summary: saved.summary || '',
        body: saved.body || '',
        category: saved.category || 'Improvement',
        releaseLabel: saved.releaseLabel || '',
        status: saved.status || 'draft',
        relatedCommits: Array.isArray(saved.relatedCommits) ? saved.relatedCommits : [],
      });
      toast.success(nextStatus === 'published' ? 'Product update published' : 'Product update saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save product update');
    } finally {
      setSaving(false);
    }
  };

  const deleteUpdate = async () => {
    if (!selectedId) return;
    try {
      setDeleting(true);
      await api.deleteProductUpdate(selectedId);
      setUpdates((current) => current.filter((update) => update.id !== selectedId));
      resetForm();
      toast.success('Product update deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete product update');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Updates</h1>
          <p className="text-sm text-gray-600 mt-1">Draft and publish Atlas release notes.</p>
        </div>
        <Button variant="outline" onClick={resetForm}>New update</Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)_360px] gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Updates</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : updates.length === 0 ? (
              <p className="text-sm text-gray-500">No product updates yet.</p>
            ) : (
              <div className="space-y-2">
                {updates.map((update) => (
                  <button
                    key={update.id}
                    type="button"
                    onClick={() => editUpdate(update)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${
                      update.id === selectedId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{update.title}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClasses(update.status)}`}>
                        {update.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{formatDate(update.publishedAt || update.createdAt)}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedUpdate ? 'Edit update' : 'Create update'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Category"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                options={CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value)}
                options={[
                  { value: 'draft', label: 'Draft' },
                  { value: 'published', label: 'Published' },
                ]}
              />
              <Input
                label="Release label"
                value={form.releaseLabel}
                onChange={(event) => updateField('releaseLabel', event.target.value)}
                placeholder="e.g. July 2026"
              />
            </div>
            <Textarea
              label="Summary"
              value={form.summary}
              onChange={(event) => updateField('summary', event.target.value)}
              required
              rows={3}
            />
            <Textarea
              label="Details"
              value={form.body}
              onChange={(event) => updateField('body', event.target.value)}
              rows={8}
            />

            {form.relatedCommits.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Related commits</p>
                <div className="flex flex-wrap gap-2">
                  {form.relatedCommits.map((commit) => (
                    <button
                      key={commitKey(commit)}
                      type="button"
                      onClick={() => toggleCommit(commit)}
                      className="px-2 py-1 text-xs rounded border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                    >
                      {commit.shortHash || commit.hash?.slice(0, 7)} {commit.subject}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {selectedId && (
                  <Button variant="danger" onClick={deleteUpdate} loading={deleting}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => saveUpdate('draft')} loading={saving}>
                  Save draft
                </Button>
                <Button onClick={() => saveUpdate('published')} loading={saving}>
                  Publish
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Recent commits</CardTitle>
              <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {commitError ? (
              <p className="text-sm text-red-600">{commitError}</p>
            ) : commits.length === 0 ? (
              <p className="text-sm text-gray-500">No commits available.</p>
            ) : (
              <div className="space-y-3 max-h-[760px] overflow-auto pr-1">
                {commits.map((commit) => {
                  const selected = isCommitSelected(commit);
                  return (
                    <div
                      key={commitKey(commit)}
                      className={`border rounded-lg p-3 ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{commit.subject}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {commit.shortHash} · {formatDate(commit.committedAt)}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleCommit(commit)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`Select commit ${commit.shortHash}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => useCommitAsDraft(commit)}
                      >
                        Use in draft
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
