import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import { Button } from '../ui/Button.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Select } from '../ui/Select.jsx';
import { environmentLabel } from '../../utils/environments.js';

/**
 * Triage: turn a deployment string Orbit did not recognise into a name of one of
 * the company's environments.
 *
 * WHY THIS EXISTS
 *
 * Resolution is deliberately unforgiving - a string matches an EnvironmentName
 * row exactly or it goes to Unassigned, with no fuzzy match and no auto-create.
 * That is only defensible if Unassigned is somewhere you can act from. Without
 * this screen the catalog surfaces the problem and offers no way to fix it.
 *
 * NOTHING IS ASSUMED
 *
 * A suggestion may be shown, and it is only ever a label - the dropdown starts
 * empty and the user picks. The deployments to attach start UNCHECKED, so
 * adopting a name and re-homing history are two separate decisions rather than
 * one of them riding along with the other. Select-all exists so that is not
 * tedious, but the selection is the user's and it travels with the request.
 */

/** Orbit's own guess at the kind a string names. A hint on screen, never a choice. */
const KIND_HINTS = [
  [/^(prod|production|prd|live)([-_].*)?$/i, 'PRODUCTION'],
  [/^(stage|staging|stg|preprod|pre-prod)([-_].*)?$/i, 'STAGING'],
  [/^(qa|test|testing|uat)([-_].*)?$/i, 'QA'],
  [/^(dev|development|develop)([-_].*)?$/i, 'DEVELOPMENT'],
];

function suggestedKind(value) {
  const trimmed = String(value || '').trim();
  for (const [pattern, kind] of KIND_HINTS) {
    if (pattern.test(trimmed)) return kind;
  }
  return null;
}

export function UnassignedDeploymentsModal({ isOpen, onClose, applicationId, companyId, onAdopted }) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [activeValue, setActiveValue] = useState(null);
  const [chosenEnvironmentId, setChosenEnvironmentId] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [unassigned, envs] = await Promise.all([
        api.getUnassignedDeployments(applicationId),
        companyId ? api.getEnvironments({ companyId, status: 'active' }) : Promise.resolve([]),
      ]);
      setGroups(unassigned.groups || []);
      setEnvironments(envs || []);
    } catch (e) {
      toast.error(e.message || 'Failed to load unassigned deployments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setActiveValue(null);
      setChosenEnvironmentId('');
      setSelectedIds(new Set());
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, applicationId, companyId]);

  const active = useMemo(
    () => groups.find((g) => g.value === activeValue) || null,
    [groups, activeValue],
  );

  const hint = active ? suggestedKind(active.value) : null;
  const suggestedEnvironment = hint
    ? environments.find((e) => e.kind === hint)
    : null;

  const toggle = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = active && active.deployments.every((d) => selectedIds.has(d.id));

  const handleAdopt = async () => {
    if (!chosenEnvironmentId) {
      toast.error('Choose which environment this name belongs to');
      return;
    }
    try {
      setSaving(true);
      const result = await api.adoptEnvironmentName(chosenEnvironmentId, {
        value: active.value,
        deploymentIds: [...selectedIds],
      });
      const attached = result.attachedDeployments || 0;
      toast.success(
        attached
          ? `"${result.value}" added, and ${attached} deployment${attached === 1 ? '' : 's'} attached`
          : `"${result.value}" added. No deployments were attached.`,
      );
      if (result.rejectedDeployments) {
        toast.error(
          `${result.rejectedDeployments} selected deployment(s) were not attached — they no longer carry that exact string.`,
        );
      }
      setActiveValue(null);
      setChosenEnvironmentId('');
      setSelectedIds(new Set());
      await load();
      if (onAdopted) onAdopted();
    } catch (e) {
      toast.error(e.message || 'Failed to adopt that name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Unassigned deployments" size="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          These deployments named an environment Orbit does not recognise. Nothing was guessed —
          adopting a name here is what makes it resolve, now and for future deploys.
        </p>

        {loading && <p className="text-sm text-gray-500">Loading…</p>}

        {!loading && groups.length === 0 && (
          <p className="text-sm italic text-gray-500">
            Every deployment resolved to an environment. Nothing to triage.
          </p>
        )}

        {!loading && groups.length > 0 && !active && (
          <div className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {groups.map((group) => (
              <button
                key={group.value}
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                onClick={() => {
                  setActiveValue(group.value);
                  setChosenEnvironmentId('');
                  setSelectedIds(new Set());
                }}
              >
                <span>
                  <span className="font-mono text-sm text-gray-900">
                    {group.value || '(empty)'}
                  </span>
                  <span className="ml-3 text-xs text-gray-500">
                    {group.count} deployment{group.count === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-sm text-blue-600">Adopt…</span>
              </button>
            ))}
          </div>
        )}

        {!loading && active && (
          <div className="space-y-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="text-sm text-gray-700">
                Adopting <span className="font-mono font-medium">{active.value}</span>. Every future
                deploy sending this exact string will resolve on its own.
              </p>
            </div>

            <Select
              label="Belongs to which environment?"
              value={chosenEnvironmentId}
              onChange={(e) => setChosenEnvironmentId(e.target.value)}
              options={[
                { value: '', label: 'Choose an environment…' },
                ...environments.map((env) => ({
                  value: env.id,
                  label:
                    suggestedEnvironment && env.id === suggestedEnvironment.id
                      ? `${environmentLabel(env)}  — looks like this one`
                      : environmentLabel(env),
                })),
              ]}
              helperText={
                suggestedEnvironment
                  ? `"${active.value}" reads like ${environmentLabel(suggestedEnvironment)}, but nothing is selected until you choose it.`
                  : 'Orbit has no opinion about which this is.'
              }
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  Attach past deployments ({selectedIds.size} of {active.deployments.length}{' '}
                  selected)
                </span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    setSelectedIds(
                      allSelected ? new Set() : new Set(active.deployments.map((d) => d.id)),
                    )
                  }
                >
                  {allSelected ? 'Select none' : 'Select all'}
                </Button>
              </div>
              <p className="mb-2 text-xs text-gray-500">
                Optional, and nothing is selected by default — adopting the name and re-homing
                history are two decisions. Unselected deployments stay unassigned.
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                {active.deployments.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 px-2 py-1 text-sm">
                    <Checkbox
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggle(d.id)}
                    />
                    <span className="text-gray-900">
                      {d.version || <span className="italic text-gray-400">no version</span>}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(d.deployedAt).toLocaleString()}
                    </span>
                    {d.deployedBy && (
                      <span className="text-xs text-gray-500">by {d.deployedBy}</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setActiveValue(null)} disabled={saving}>
                Back
              </Button>
              <Button onClick={handleAdopt} disabled={saving || !chosenEnvironmentId}>
                {saving ? 'Adopting…' : 'Adopt this name'}
              </Button>
            </div>
          </div>
        )}

        {!active && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default UnassignedDeploymentsModal;
