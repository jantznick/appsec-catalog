import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button, LoadingSpinner, Modal, toast } from '../ui';
import { FourQuestionEditor } from './FourQuestionEditor.jsx';
import { AddComponentModal } from './AddComponentModal.jsx';

const EMPTY_ROOT = {
  scope: '',
  actors: [],
  dataTypes: [],
  threats: [],
  status: 'draft',
  reviewer: '',
};

const STATUS_BADGE = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  superseded: 'bg-gray-100 text-gray-400',
};

// Which Q1 boxes trigger auto-creation of each component archetype.
// Mirrors getRecommendedArchetypes on the backend.
const ARCHETYPE_TRIGGERS = {
  auth: { field: 'dataTypes', keys: ['credentials'] },
  payment: { field: 'dataTypes', keys: ['payment'] },
  data_storage: { field: 'dataTypes', keys: ['pii', 'health', 'other_regulated'] },
  admin: { field: 'actors', keys: ['privileged_user', 'platform_admin'] },
  integration: { field: 'actors', keys: ['api_client', 'partner'] },
};

// Short terms for the auto-added note (not the full Q1 checkbox labels).
const TRIGGER_TERMS = {
  credentials: 'credentials',
  payment: 'payment data',
  pii: 'PII',
  health: 'health data',
  other_regulated: 'regulated data',
  privileged_user: 'admin users',
  platform_admin: 'platform admins',
  api_client: 'API clients',
  partner: 'partner integrations',
};

// Short terms for the currently-checked Q1 boxes that make this component required.
function triggeringBoxLabels(component, model) {
  const rule = component && ARCHETYPE_TRIGGERS[component.archetype];
  if (!rule || !model) return [];
  const selected = model[rule.field] || [];
  return rule.keys.filter((k) => selected.includes(k)).map((k) => TRIGGER_TERMS[k] || k);
}

function TreeNode({ label, sublabel, active, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
        active ? 'bg-blue-50 border border-blue-300' : 'border border-transparent hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-medium truncate ${active ? 'text-blue-700' : 'text-gray-800'}`}>
          {label}
        </span>
        {badge}
      </div>
      {sublabel && <span className="text-xs text-gray-400">{sublabel}</span>}
    </button>
  );
}

export function ThreatModelTab({ applicationId }) {
  const [options, setOptions] = useState(null);
  const [data, setData] = useState({ model: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState('root');
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [opts, model] = await Promise.all([
        api.getThreatModelOptions(),
        api.getThreatModel(applicationId),
      ]);
      setOptions(opts);
      setData(model);
    } catch (err) {
      toast.error(err.message || 'Failed to load threat model');
    } finally {
      setLoading(false);
    }
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  const model = data.model;
  const components = model?.components || [];

  const rootNode = model
    ? {
        scope: model.scope,
        actors: model.actors,
        dataTypes: model.dataTypes,
        threats: model.threats,
        status: model.status,
        reviewer: model.reviewer,
      }
    : { ...EMPTY_ROOT };

  const selectedComponent = components.find((c) => c.id === selectedId);
  const isRoot = selectedId === 'root' || !selectedComponent;

  const saveRoot = async (payload) => {
    setSaving(true);
    try {
      const updated = await api.saveThreatModel(applicationId, payload);
      setData(updated);
      toast.success('Threat model saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const saveComponent = async (payload) => {
    setSaving(true);
    try {
      const updated = await api.updateThreatModelComponent(applicationId, selectedId, payload);
      setData(updated);
      toast.success('Component saved');
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteComponent = async () => {
    setSaving(true);
    try {
      const updated = await api.deleteThreatModelComponent(applicationId, selectedId);
      setData(updated);
      setSelectedId('root');
      setConfirmDeleteOpen(false);
      toast.success('Component deleted');
    } catch (err) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  };

  const addComponent = async (payload) => {
    try {
      const updated = await api.addThreatModelComponent(applicationId, payload);
      setData(updated);
      setAddOpen(false);
      const created = (updated.model?.components || []).slice(-1)[0];
      if (created) setSelectedId(created.id);
      toast.success('Component added');
    } catch (err) {
      toast.error(err.message || 'Failed to add component');
    }
  };

  const markReviewed = async () => {
    setSaving(true);
    try {
      const updated = await api.saveThreatModel(applicationId, { markReviewed: true });
      setData(updated);
      toast.success('Marked reviewed');
    } catch (err) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !options) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  const componentThreatCount = (c) => (c.threats || []).length;
  const rootThreatCount = (rootNode.threats || []).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Threat model</h2>
          <p className="text-sm text-gray-600 max-w-2xl">
            A lightweight threat model for this application, structured around Adam Shostack's four
            questions. Start with the application as a whole, then break out the parts that carry the
            most risk — authentication, payment processing, data storage, integrations — and model
            each one. It's meant to be filled in together, e.g. a working session between the
            engineering team and a security partner. You don't need to capture everything; focus on
            the threats that genuinely matter and a clear plan for each.
          </p>
        </div>
        {model?.lastReviewedAt && (
          <span className="text-xs text-gray-500">
            Last reviewed {new Date(model.lastReviewedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Left rail — hierarchy */}
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-white p-2 space-y-1">
            <TreeNode
              label="Whole application"
              sublabel={`${rootThreatCount} threat${rootThreatCount === 1 ? '' : 's'}`}
              active={isRoot}
              onClick={() => setSelectedId('root')}
              badge={
                model && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGE[model.status] || ''}`}>
                    {model.status.replace('_', ' ')}
                  </span>
                )
              }
            />
            {components.length > 0 && (
              <div className="pl-2 border-l border-gray-100 ml-2 mt-1 space-y-1">
                {components.map((c) => (
                  <TreeNode
                    key={c.id}
                    label={c.name}
                    sublabel={`${componentThreatCount(c)} threat${componentThreatCount(c) === 1 ? '' : 's'}`}
                    active={selectedId === c.id}
                    onClick={() => setSelectedId(c.id)}
                    badge={
                      c.reviewed ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                          reviewed
                        </span>
                      ) : null
                    }
                  />
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
            + Add component
          </Button>
          <Button variant="ghost" size="sm" className="w-full" onClick={markReviewed} loading={saving}>
            Mark reviewed now
          </Button>
        </div>

        {/* Right pane — the four-question editor for the selected node */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <FourQuestionEditor
            key={isRoot ? `root:${model?.updatedAt || 'new'}` : `${selectedId}:${selectedComponent?.updatedAt}`}
            node={isRoot ? rootNode : selectedComponent}
            isRoot={isRoot}
            options={options}
            saving={saving}
            requiredByBoxes={isRoot ? [] : triggeringBoxLabels(selectedComponent, model)}
            onSave={isRoot ? saveRoot : saveComponent}
            onDelete={() => setConfirmDeleteOpen(true)}
          />
        </div>
      </div>

      <AddComponentModal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        archetypes={options.archetypes}
        existingArchetypes={components.map((c) => c.archetype)}
        onAdd={addComponent}
        adding={saving}
      />

      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Delete component"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmDeleteComponent}
              loading={saving}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-gray-700">
            Delete <strong>{selectedComponent?.name}</strong> and its threats?
          </p>
          {triggeringBoxLabels(selectedComponent, model).length > 0 && (
            <p className="text-sm text-amber-700">
              This component is still required by your question 1 answers, so it will be re-created
              the next time you save the application node.
            </p>
          )}
          <p className="text-sm text-red-600">This can't be undone.</p>
        </div>
      </Modal>
    </div>
  );
}
