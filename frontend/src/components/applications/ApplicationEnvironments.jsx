import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { environmentLabel } from '../../utils/environments.js';

/**
 * Which of its company's environments this application runs in, and what is deployed
 * to each.
 *
 * The version and branch shown on the App Data tab come from the PRODUCTION one. They
 * are not editable there any more, because they describe a particular running copy —
 * this card is where they are edited, and where a deploy writes them.
 *
 * There is no "make primary" control, deliberately. The primary environment is the one
 * whose kind is PRODUCTION, and a company has at most one of those, so primary is
 * derived rather than chosen. Changing which environment is primary means changing a
 * kind in company settings, which is a company-wide decision rather than a per-app one.
 */

const emptyForm = { environmentId: '', currentVersion: '', gitBranch: '' };

export function ApplicationEnvironments({ applicationId, companyId, canManage, onChanged }) {
  const [loading, setLoading] = useState(true);
  const [instances, setInstances] = useState([]);
  const [vocabulary, setVocabulary] = useState([]);
  const [saving, setSaving] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ currentVersion: '', gitBranch: '' });
  const [removeTarget, setRemoveTarget] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const [rows, envs] = await Promise.all([
        api.getApplicationEnvironments(applicationId),
        companyId ? api.getEnvironments({ companyId, status: 'active' }) : Promise.resolve([]),
      ]);
      setInstances(rows || []);
      setVocabulary(envs || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, companyId]);

  const inUse = useMemo(
    () => new Set(instances.map((i) => i.environmentId)),
    [instances],
  );

  const available = useMemo(
    () => vocabulary.filter((env) => !inUse.has(env.id)),
    [vocabulary, inUse],
  );

  const hasPrimary = instances.some((i) => i.isPrimary && i.status === 'active');

  const refresh = async () => {
    await load();
    // The App Data tab reads currentVersion off the production instance, so a change
    // here moves a number over there.
    if (onChanged) onChanged();
  };

  const handleAdd = async () => {
    if (!addForm.environmentId) {
      toast.error('Pick an environment');
      return;
    }
    try {
      setSaving(true);
      await api.addApplicationEnvironment(applicationId, addForm);
      toast.success('Environment added');
      setShowAdd(false);
      setAddForm(emptyForm);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to add environment');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setSaving(true);
      await api.updateApplicationEnvironment(applicationId, editing.id, editForm);
      toast.success('Environment updated');
      setEditing(null);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to update environment');
    } finally {
      setSaving(false);
    }
  };

  const handleRetireToggle = async (instance) => {
    try {
      await api.updateApplicationEnvironment(applicationId, instance.id, {
        status: instance.status === 'active' ? 'retired' : 'active',
      });
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to change status');
    }
  };

  const handleRemove = async () => {
    try {
      const result = await api.deleteApplicationEnvironment(applicationId, removeTarget.id);
      const detached = (result?.detachedDomains || 0) + (result?.detachedToolLinks || 0);
      toast.success(
        detached
          ? `Removed. ${detached} domain/tool link kept, but no longer attributed to an environment.`
          : 'Removed',
      );
      setRemoveTarget(null);
      await refresh();
    } catch (e) {
      toast.error(e.message || 'Failed to remove environment');
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Environments</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Where this application runs, and what is deployed to each. Deploys write these
            automatically.
          </p>
        </div>
        {canManage && available.length > 0 && (
          <Button variant="secondary" onClick={() => setShowAdd(true)}>
            Add environment
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : instances.length === 0 ? (
          <p className="text-sm italic text-gray-500">
            Not recorded in any environment yet.
          </p>
        ) : (
          <div className="space-y-3">
            {instances.map((instance) => {
              const retired = instance.status !== 'active';
              const envRetired = instance.environment?.status !== 'active';
              return (
                <div
                  key={instance.id}
                  className={`rounded-lg border p-4 ${retired || envRetired ? 'border-gray-200 bg-gray-50 opacity-70' : 'border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {environmentLabel(instance.environment) || 'Unknown environment'}
                        </span>
                        {instance.isPrimary && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Primary
                          </span>
                        )}
                        {retired && (
                          <span className="text-xs text-gray-500">Retired here</span>
                        )}
                        {!retired && envRetired && (
                          <span className="text-xs text-gray-500">
                            Environment retired company-wide
                          </span>
                        )}
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        <div>
                          <dt className="inline text-gray-600">Version: </dt>
                          <dd className="inline text-gray-900">
                            {instance.currentVersion || <span className="italic text-gray-400">not set</span>}
                          </dd>
                        </div>
                        <div>
                          <dt className="inline text-gray-600">Branch: </dt>
                          <dd className="inline text-gray-900">
                            {instance.gitBranch || <span className="italic text-gray-400">not set</span>}
                          </dd>
                        </div>
                      </dl>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditing(instance);
                            setEditForm({
                              currentVersion: instance.currentVersion || '',
                              gitBranch: instance.gitBranch || '',
                            });
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => handleRetireToggle(instance)}>
                          {retired ? 'Reactivate' : 'Retire'}
                        </Button>
                        <Button variant="ghost" onClick={() => setRemoveTarget(instance)}>
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !hasPrimary && (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            No production environment. The current version and git branch on the App Data tab
            come from production, so they will read as not set until one exists.{' '}
            {canManage && vocabulary.some((e) => e.kind === 'PRODUCTION')
              ? 'Add it above.'
              : (
                <>
                  Name your production environment in{' '}
                  <Link to="/settings/environments" className="underline">
                    Deployment Environments
                  </Link>{' '}
                  first.
                </>
              )}
          </p>
        )}
      </CardContent>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add an environment">
        <div className="space-y-4">
          <Select
            label="Environment"
            value={addForm.environmentId}
            onChange={(e) => setAddForm({ ...addForm, environmentId: e.target.value })}
            options={[
              { value: '', label: 'Select an environment' },
              ...available.map((env) => ({ value: env.id, label: environmentLabel(env) })),
            ]}
            helperText="Only your company's environments appear here. Add a new one in settings."
          />
          <Input
            label="Current version (optional)"
            value={addForm.currentVersion}
            onChange={(e) => setAddForm({ ...addForm, currentVersion: e.target.value })}
            placeholder="e.g. 1.2.3"
            helperText="A deploy to this environment will overwrite whatever is here."
          />
          <Input
            label="Git branch (optional)"
            value={addForm.gitBranch}
            onChange={(e) => setAddForm({ ...addForm, gitBranch: e.target.value })}
            placeholder="e.g. main"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.environment?.name || 'environment'}`}
      >
        <div className="space-y-4">
          <Input
            label="Current version"
            value={editForm.currentVersion}
            onChange={(e) => setEditForm({ ...editForm, currentVersion: e.target.value })}
            placeholder="e.g. 1.2.3"
            helperText="The next deploy to this environment will overwrite it."
          />
          <Input
            label="Git branch"
            value={editForm.gitBranch}
            onChange={(e) => setEditForm({ ...editForm, gitBranch: e.target.value })}
            placeholder="e.g. main"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        title="Remove this environment?"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            This application will no longer be recorded as running in{' '}
            &ldquo;{environmentLabel(removeTarget?.environment)}&rdquo;, and the version and branch stored
            for it are deleted. Deploy history is kept.
          </p>
          {(removeTarget?._count?.domains > 0 || removeTarget?._count?.toolLinks > 0) && (
            <p className="text-sm text-gray-700">
              {removeTarget?._count?.domains || 0} domain(s) and{' '}
              {removeTarget?._count?.toolLinks || 0} tool link(s) point at this environment. They
              stay attached to the application — they just stop being attributed to an
              environment.
            </p>
          )}
          <p className="text-sm text-gray-600">
            If it simply is not running any more, retire it instead and keep the record.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

export default ApplicationEnvironments;
