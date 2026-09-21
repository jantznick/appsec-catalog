import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import { Textarea } from '../ui/Textarea.jsx';
import { Select } from '../ui/Select.jsx';
import { Checkbox } from '../ui/Checkbox.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

const ALL_COMPANIES = '__all__';

/**
 * Create or edit a custom role.
 *
 * Which permissions are offered depends on who is authoring: a system admin
 * sees the whole company-scoped catalog, while a company admin sees only the
 * permissions they themselves hold in the company the role will belong to.
 * The server enforces the same cap — this just avoids offering a checkbox that
 * would be rejected on save.
 */
export function RoleEditorModal({
  isOpen,
  onClose,
  onSaved,
  role = null,
  companies = [],
  canAuthorGlobalRoles = false,
  authorableCompanyIds = null,
}) {
  const { can } = useAuthStore();
  const isEditing = Boolean(role);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    if (!isOpen) return;
    loadCatalog();
    if (role) {
      setName(role.name || '');
      setDescription(role.description || '');
      setOwner(role.companyId || ALL_COMPANIES);
      setSelected(new Set(role.permissions || []));
    } else {
      setName('');
      setDescription('');
      // Default to the only company they can author for, when there is just one.
      const only = !canAuthorGlobalRoles && authorableCompanyIds?.length === 1
        ? authorableCompanyIds[0]
        : '';
      setOwner(only);
      setSelected(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, role?.id]);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const data = await api.getPermissionCatalog();
      setGroups(data.groups || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load permissions');
    } finally {
      setLoading(false);
    }
  };

  // Ownership is fixed once a role exists: moving it between companies would
  // silently change who its existing assignments apply to.
  const ownerOptions = useMemo(() => {
    const allowed = canAuthorGlobalRoles
      ? companies
      : companies.filter((c) => (authorableCompanyIds ?? []).includes(c.id));
    const opts = allowed.map((c) => ({ value: c.id, label: c.name }));
    return canAuthorGlobalRoles
      ? [{ value: ALL_COMPANIES, label: 'All companies' }, ...opts]
      : opts;
  }, [companies, canAuthorGlobalRoles, authorableCompanyIds]);

  const targetCompanyId = owner === ALL_COMPANIES ? null : owner || null;

  /**
   * Company-scoped permissions only — a custom role can never carry a
   * system-wide one — narrowed to what this author actually holds.
   */
  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        permissions: group.permissions.filter((p) => {
          if (p.scope !== 'COMPANY') return false;
          if (canAuthorGlobalRoles) return true;
          return can(p.key, targetCompanyId);
        }),
      }))
      .filter((group) => group.permissions.length > 0);
  }, [groups, canAuthorGlobalRoles, can, targetCompanyId]);

  const togglePermission = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group) => {
    const keys = group.permissions.map((p) => p.key);
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Give the role a name');
      return;
    }
    if (!isEditing && !owner) {
      toast.error('Choose which company this role applies to');
      return;
    }
    if (selected.size === 0) {
      toast.error('Pick at least one permission');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        description: description.trim(),
        permissions: [...selected],
      };
      if (isEditing) {
        await api.updateRole(role.id, payload);
        toast.success('Role updated');
      } else {
        await api.createRole({ ...payload, companyId: targetCompanyId });
        toast.success('Role created');
      }
      onSaved?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit ${role.name}` : 'New role'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} loading={saving}>
            {isEditing ? 'Save changes' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Name"
          id="roleName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Release Manager"
          required
          maxLength={80}
        />

        <Textarea
          label="Description"
          id="roleDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What is this role for?"
          helperText="Shown to whoever is granting the role."
        />

        {isEditing ? (
          <div>
            <p className="block text-sm font-medium text-gray-700 mb-2">Applies to</p>
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              {role.companyId
                ? companies.find((c) => c.id === role.companyId)?.name || 'One company'
                : 'All companies'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Who a role applies to cannot be changed after it is created — it would move
              everyone already holding it.
            </p>
          </div>
        ) : (
          <Select
            label="Applies to"
            id="roleOwner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Select a company"
            options={ownerOptions}
            required
            helperText={
              canAuthorGlobalRoles
                ? 'A role for one company, or one that can be granted in every company.'
                : 'You can create roles for the companies you administer.'
            }
          />
        )}

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium text-gray-700">Permissions</p>
            <p className="text-xs text-gray-500">{selected.size} selected</p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Loading permissions…</p>
          ) : visibleGroups.length === 0 ? (
            <p className="rounded border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-500">
              {owner
                ? 'You do not hold any permissions you could put in a role for this company.'
                : 'Choose which company this role applies to first.'}
            </p>
          ) : (
            <div className="max-h-80 space-y-3 overflow-y-auto rounded border border-gray-200 p-3">
              {visibleGroups.map((group) => {
                const keys = group.permissions.map((p) => p.key);
                const allOn = keys.every((k) => selected.has(k));
                return (
                  <div key={group.resource}>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {group.resource}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleGroup(group)}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {allOn ? 'Clear' : 'Select all'}
                      </button>
                    </div>
                    <div className="space-y-1">
                      {group.permissions.map((p) => (
                        <div key={p.key} className="flex items-start gap-2">
                          <Checkbox
                            id={`perm-${p.key}`}
                            checked={selected.has(p.key)}
                            onChange={() => togglePermission(p.key)}
                          />
                          <label htmlFor={`perm-${p.key}`} className="cursor-pointer">
                            <span className="block text-sm text-gray-800">{p.label}</span>
                            <span className="block text-xs text-gray-500">{p.description}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
