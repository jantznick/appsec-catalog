import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { toast } from '../components/ui/Toast.jsx';
import {
  ROADMAP_PROGRESS_STATES,
  ROADMAP_STAGES,
  UPDATE_CATEGORIES,
  categoryBadgeClass,
  formatShortDate,
  progressStateLabel,
  stageMeta,
} from '../lib/productCommunication.js';

const emptyForm = {
  title: '',
  summary: '',
  body: '',
  category: 'Feature',
  stage: 'EXPLORING',
  progressState: '',
  scheduledReleaseAt: '',
  targetLabel: '',
  status: 'draft',
  linkedUpdateId: '',
};

/** `<input type="date">` wants YYYY-MM-DD; the API speaks ISO timestamps. */
function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formToPayload(form) {
  return {
    ...form,
    progressState: form.progressState || null,
    scheduledReleaseAt: form.scheduledReleaseAt || null,
    linkedUpdateId: form.linkedUpdateId || null,
  };
}

function itemToForm(item) {
  return {
    title: item.title || '',
    summary: item.summary || '',
    body: item.body || '',
    category: item.category || 'Feature',
    stage: item.stage || 'EXPLORING',
    progressState: item.progressState || '',
    scheduledReleaseAt: toDateInput(item.scheduledReleaseAt),
    targetLabel: item.targetLabel || '',
    status: item.status || 'draft',
    linkedUpdateId: item.linkedUpdateId || '',
  };
}

function statusBadgeClasses(status) {
  return status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700';
}

export function RoadmapAdmin() {
  const { isAdmin } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?item=<id> — set when arriving from a promoted feature request, so the
  // editor opens on the draft that was just created instead of making the
  // admin hunt for it in the list.
  const requestedId = searchParams.get('item');
  const [items, setItems] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [orderStage, setOrderStage] = useState('IN_PROGRESS');

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [roadmapData, updateData] = await Promise.all([
        api.getAdminRoadmap(),
        // Only published notes can be linked, since the roadmap drops a link
        // to a draft note anyway.
        api.getAdminProductUpdates('published').catch(() => ({ updates: [] })),
      ]);
      setItems(roadmapData.items || []);
      setUpdates(updateData.updates || []);
    } catch (error) {
      toast.error(error?.message || 'Failed to load the roadmap');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin()) loadData();
  }, []);

  useEffect(() => {
    if (!requestedId) return;
    const match = items.find((item) => item.id === requestedId);
    if (!match) return;
    setSelectedId(match.id);
    setForm(itemToForm(match));
    // Drop the parameter once it has been honoured, so a later "New item"
    // isn't pulled back to this draft by the next render.
    setSearchParams({}, { replace: true });
  }, [requestedId, items, setSearchParams]);

  if (!isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  const resetForm = () => {
    setSelectedId(null);
    setForm(emptyForm);
  };

  const editItem = (item) => {
    setSelectedId(item.id);
    setForm(itemToForm(item));
  };

  const updateField = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      // Keep the form honest about what the server will store: the delivery
      // state only exists inside In progress, and the date only inside
      // Scheduled for production release.
      if (field === 'stage' && value !== 'IN_PROGRESS') {
        next.progressState = '';
        next.scheduledReleaseAt = '';
      }
      if (field === 'progressState' && value !== 'SCHEDULED_RELEASE') {
        next.scheduledReleaseAt = '';
      }
      return next;
    });
  };

  const applySaved = (saved) => {
    setItems((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current];
    });
    setSelectedId(saved.id);
    setForm(itemToForm(saved));
  };

  const save = async (nextStatus = form.status) => {
    if (!form.title.trim() || !form.summary.trim()) {
      toast.error('Title and summary are required');
      return;
    }

    try {
      setSaving(true);
      const payload = formToPayload({ ...form, status: nextStatus });
      const saved = selectedId
        ? await api.updateRoadmapItem(selectedId, payload)
        : await api.createRoadmapItem(payload);
      applySaved(saved);
      toast.success(nextStatus === 'published' ? 'Roadmap item published' : 'Roadmap item saved');
    } catch (error) {
      toast.error(error?.message || 'Failed to save the roadmap item');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId) return;
    try {
      setSaving(true);
      await api.deleteRoadmapItem(selectedId);
      setItems((current) => current.filter((item) => item.id !== selectedId));
      setConfirmDelete(false);
      resetForm();
      toast.success('Roadmap item deleted');
    } catch (error) {
      toast.error(error?.message || 'Failed to delete the roadmap item');
    } finally {
      setSaving(false);
    }
  };

  const orderedForStage = useMemo(
    () => items.filter((item) => item.stage === orderStage),
    [items, orderStage],
  );

  const move = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= orderedForStage.length) return;

    const reordered = [...orderedForStage];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

    try {
      setReordering(true);
      await api.reorderRoadmapItems(reordered.map((item) => item.id));
      // sortOrder is rewritten as 0..n-1 server-side; mirror that locally so the
      // list settles without a refetch.
      const positions = new Map(reordered.map((item, position) => [item.id, position]));
      setItems((current) =>
        current.map((item) =>
          positions.has(item.id) ? { ...item, sortOrder: positions.get(item.id) } : item,
        ),
      );
    } catch (error) {
      toast.error(error?.message || 'Failed to reorder');
      loadData();
    } finally {
      setReordering(false);
    }
  };

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const stageOrder =
          ROADMAP_STAGES.findIndex((stage) => stage.key === a.stage) -
          ROADMAP_STAGES.findIndex((stage) => stage.key === b.stage);
        return stageOrder || a.sortOrder - b.sortOrder;
      }),
    [items],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/settings" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
            Back to Settings
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Roadmap</h1>
          <p className="mt-1 text-sm text-gray-600">
            Publish what Orbit is working on. Drafts stay hidden until you publish them.
          </p>
        </div>
        <Button variant="outline" onClick={resetForm}>
          New item
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <Card>
          <CardHeader>
            <CardTitle>All items</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : sortedItems.length === 0 ? (
              <p className="text-sm text-gray-500">No roadmap items yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => editItem(item)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      item.id === selectedId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-gray-900">{item.title}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClasses(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {stageMeta(item.stage).label}
                      {progressStateLabel(item) && ` · ${progressStateLabel(item)}`}
                      {item.targetLabel && ` · ${item.targetLabel}`}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{selectedItem ? 'Edit item' : 'Create item'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Title"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              required
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Select
                label="Category"
                value={form.category}
                onChange={(event) => updateField('category', event.target.value)}
                options={UPDATE_CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
              <Select
                label="Stage"
                value={form.stage}
                onChange={(event) => updateField('stage', event.target.value)}
                options={ROADMAP_STAGES.map((stage) => ({ value: stage.key, label: stage.label }))}
              />
              <Input
                label="Target"
                value={form.targetLabel}
                onChange={(event) => updateField('targetLabel', event.target.value)}
                placeholder="e.g. Q1 2026"
              />
            </div>

            {form.stage === 'IN_PROGRESS' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-2">
                <Select
                  label="Delivery state"
                  value={form.progressState}
                  onChange={(event) => updateField('progressState', event.target.value)}
                  options={[
                    { value: '', label: 'Being built' },
                    ...ROADMAP_PROGRESS_STATES.map((state) => ({
                      value: state.key,
                      label: state.label,
                    })),
                  ]}
                  helperText="Shown as a sub-group on the roadmap board."
                />
                {form.progressState === 'SCHEDULED_RELEASE' && (
                  <Input
                    type="date"
                    label="Production release date"
                    value={form.scheduledReleaseAt}
                    onChange={(event) => updateField('scheduledReleaseAt', event.target.value)}
                  />
                )}
              </div>
            )}

            <Textarea
              label="Summary"
              value={form.summary}
              onChange={(event) => updateField('summary', event.target.value)}
              rows={3}
              required
              helperText="One or two sentences — this is the card body on the board."
            />
            <Textarea
              label="Details"
              value={form.body}
              onChange={(event) => updateField('body', event.target.value)}
              rows={8}
              helperText="Optional. Blank lines separate paragraphs; lines starting with - become bullets."
            />

            {form.stage === 'SHIPPED' && (
              <Select
                label="Release note"
                value={form.linkedUpdateId}
                onChange={(event) => updateField('linkedUpdateId', event.target.value)}
                options={[
                  { value: '', label: 'No linked release note' },
                  ...updates.map((update) => ({ value: update.id, label: update.title })),
                ]}
                helperText="Shipped cards link through to this note."
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div>
                {selectedId && (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => save('draft')} loading={saving}>
                  Save draft
                </Button>
                <Button onClick={() => save('published')} loading={saving}>
                  Publish
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Board order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Column"
              value={orderStage}
              onChange={(event) => setOrderStage(event.target.value)}
              options={ROADMAP_STAGES.map((stage) => ({ value: stage.key, label: stage.label }))}
            />
            {orderedForStage.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing in this column.</p>
            ) : (
              <ol className="space-y-2">
                {orderedForStage.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-lg border border-gray-200 p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-500">
                        <span
                          className={`mr-1 rounded px-1.5 py-0.5 ${categoryBadgeClass(item.category)}`}
                        >
                          {item.category}
                        </span>
                        {item.status === 'draft' ? 'Draft' : 'Published'}
                        {item.shippedAt && ` · ${formatShortDate(item.shippedAt)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col">
                      <button
                        type="button"
                        disabled={reordering || index === 0}
                        onClick={() => move(index, -1)}
                        className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        aria-label={`Move ${item.title} up`}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={reordering || index === orderedForStage.length - 1}
                        onClick={() => move(index, 1)}
                        className="px-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        aria-label={`Move ${item.title} down`}
                      >
                        ▼
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete roadmap item"
        size="sm"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} loading={saving}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-700">
          Delete &ldquo;{selectedItem?.title}&rdquo;? Any feature request promoted into it keeps its
          status but loses the link.
        </p>
      </Modal>
    </div>
  );
}
