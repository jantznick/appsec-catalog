import { useState, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Select } from '../ui/Select.jsx';
import { api } from '../../lib/api.js';
import { toast } from '../ui/Toast.jsx';
import useAuthStore from '../../store/authStore.js';

const ALL_COMPANIES = '__all__';

/**
 * Grant and revoke a user's roles.
 *
 * System admins can scope a grant to a single company or to every company the
 * user belongs to; company-level role managers can only grant within a company
 * they administer, so the scope selector is limited accordingly.
 */
export function ManageRolesModal({ isOpen, onClose, user, onChanged }) {
  const { isAdmin, companiesWith } = useAuthStore();
  const [assignments, setAssignments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  const isSystemAdmin = isAdmin();

  useEffect(() => {
    if (!isOpen || !user) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user?.id]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [assignmentData, roleData, companyData] = await Promise.all([
        api.getUserRoleAssignments(user.id),
        api.getRoles(),
        api.getCompanies(),
      ]);
      setAssignments(assignmentData.assignments || []);
      setRoles(roleData.roles || []);
      setCompanies(Array.isArray(companyData) ? companyData : []);
      setSelectedRoleId('');
      setSelectedCompanyId(isSystemAdmin ? '' : (user.companyId || ''));
    } catch (error) {
      toast.error(error.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  // Companies this grant can target. A system admin can pick any company the
  // list returned; anyone else is limited to those they manage roles in.
  const companyOptions = useMemo(() => {
    const manageable = isSystemAdmin ? null : new Set(companiesWith('company.manage_roles'));
    return companies
      .filter((c) => !manageable || manageable.has(c.id))
      .map((c) => ({ value: c.id, label: c.name }));
  }, [companies, isSystemAdmin, companiesWith]);

  const scopeOptions = isSystemAdmin
    ? [{ value: ALL_COMPANIES, label: 'Every company this user belongs to' }, ...companyOptions]
    : companyOptions;

  const selectedRole = roles.find((r) => r.id === selectedRoleId) || null;

  const handleGrant = async () => {
    if (!selectedRoleId) {
      toast.error('Pick a role to grant');
      return;
    }
    if (!selectedCompanyId) {
      toast.error('Pick which company this role applies to');
      return;
    }

    try {
      setSaving(true);
      await api.grantRole({
        userId: user.id,
        roleId: selectedRoleId,
        companyId: selectedCompanyId === ALL_COMPANIES ? null : selectedCompanyId,
      });
      toast.success('Role granted');
      setSelectedRoleId('');
      await loadAll();
      onChanged?.();
    } catch (error) {
      toast.error(error.message || 'Failed to grant role');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (assignment) => {
    try {
      setSaving(true);
      await api.revokeRole(assignment.id);
      toast.success('Role revoked');
      await loadAll();
      onChanged?.();
    } catch (error) {
      toast.error(error.message || 'Failed to revoke role');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Roles"
      size="lg"
      footer={
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Done
        </Button>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> {user.email}
          </p>
          {user.isAdmin && (
            <p className="mt-2 text-sm text-purple-800 bg-purple-100 rounded px-3 py-2">
              This user is a system administrator and already has every permission in
              every company. Roles below make no difference while that is the case.
            </p>
          )}
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-2">Current roles</h3>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-gray-500">No roles granted.</p>
          ) : (
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
              {assignments.map((assignment) => (
                <li key={assignment.id} className="flex items-start justify-between gap-4 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{assignment.role.name}</p>
                    <p className="text-xs text-gray-500">
                      {assignment.company
                        ? assignment.company.name
                        : 'Every company this user belongs to'}
                      {' · '}
                      {assignment.role.permissions.length} permission
                      {assignment.role.permissions.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(assignment)}
                    disabled={saving}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-900">Grant a role</h3>
          <Select
            label="Role"
            id="roleId"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
            placeholder="Select a role"
            options={roles.map((role) => ({ value: role.id, label: role.name }))}
            helperText={selectedRole?.description || undefined}
          />
          <Select
            label="Applies to"
            id="roleCompanyId"
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            placeholder="Select a company"
            options={scopeOptions}
            helperText={
              isSystemAdmin
                ? 'Scope the role to one company, or to every company the user belongs to.'
                : 'You can grant roles in the companies you administer.'
            }
          />
          {selectedRole && selectedRole.permissions.length > 0 && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-medium text-gray-700 mb-1">This role grants</p>
              <p className="text-xs text-gray-500 break-words">
                {selectedRole.permissions.join(', ')}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="primary" onClick={handleGrant} disabled={saving} loading={saving}>
              Grant Role
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
