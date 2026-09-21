import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { RoleEditorModal } from '../components/roles/RoleEditorModal.jsx';
import useAuthStore from '../store/authStore.js';

/**
 * Role administration.
 *
 * System admins manage every role, and can create one that applies to a single
 * company or to all of them. Anyone holding `company.author_roles` (which
 * Company Admin does) manages the custom roles belonging to their own company.
 * Built-in roles are listed for reference but are defined in code and cannot be
 * edited here.
 */
export function SettingsRoles() {
  const { isAdmin } = useAuthStore();
  const [roles, setRoles] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [meta, setMeta] = useState({
    canAuthorRoles: false,
    canAuthorGlobalRoles: false,
    authorableCompanyIds: null,
  });
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const [roleData, companyData] = await Promise.all([api.getRoles(), api.getCompanies()]);
      setRoles(roleData.roles || []);
      setMeta({
        canAuthorRoles: Boolean(roleData.canAuthorRoles),
        canAuthorGlobalRoles: Boolean(roleData.canAuthorGlobalRoles),
        authorableCompanyIds: roleData.authorableCompanyIds ?? null,
      });
      setCompanies(Array.isArray(companyData) ? companyData : []);
    } catch (error) {
      toast.error(error.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const companyName = (id) => companies.find((c) => c.id === id)?.name || 'Unknown company';

  /** Can the current user edit or delete this particular role? */
  const canAuthor = (role) => {
    if (role.isSystem) return false;
    if (meta.canAuthorGlobalRoles) return true;
    if (!role.companyId) return false;
    return (meta.authorableCompanyIds ?? []).includes(role.companyId);
  };

  const { builtIn, custom } = useMemo(() => {
    return {
      builtIn: roles.filter((r) => r.isSystem),
      custom: roles.filter((r) => !r.isSystem),
    };
  }, [roles]);

  const handleNew = () => {
    setEditingRole(null);
    setEditorOpen(true);
  };

  const handleEdit = (role) => {
    setEditingRole(role);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await api.deleteRole(deleteTarget.id);
      toast.success(`Deleted ${deleteTarget.name}`);
      setDeleteTarget(null);
      await load();
    } catch (error) {
      // A 409 carries the number of users still holding the role.
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingPage />;

  const appliesTo = (role) => (role.companyId ? companyName(role.companyId) : 'All companies');

  const renderRole = (role) => {
    const held = role.assignmentCount ?? 0;
    const editable = canAuthor(role);
    return (
      <div key={role.id} className="flex items-start justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{role.name}</p>
            {role.isSystem && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                Built-in
              </span>
            )}
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              {appliesTo(role)}
            </span>
          </div>
          {role.description && (
            <p className="mt-1 text-sm text-gray-600">{role.description}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'}
            {' · '}
            held by {held} user{held === 1 ? '' : 's'}
          </p>
        </div>
        {editable && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleEdit(role)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(role)}>
              Delete
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="mb-8">
        <Link to="/settings" className="mb-2 inline-block text-sm text-blue-600 hover:text-blue-700">
          Back to Settings
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold text-gray-800">Roles</h1>
            <p className="max-w-2xl text-gray-600">
              A role is a named bundle of permissions.{' '}
              {isAdmin()
                ? 'You can create a role for one company, or one that can be granted in every company.'
                : 'You can create roles for the companies you administer.'}
            </p>
          </div>
          {meta.canAuthorRoles && (
            <Button variant="primary" onClick={handleNew}>
              New role
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Custom roles</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Roles created here. Deleting one requires revoking it from everyone first.
            </p>
          </CardHeader>
          <CardContent>
            {custom.length === 0 ? (
              <p className="rounded-lg border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                No custom roles yet.
              </p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {custom.map(renderRole)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Built-in roles</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Defined in code and kept in sync on every deploy, so they cannot be edited here.
            </p>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {builtIn.map(renderRole)}
            </div>
          </CardContent>
        </Card>
      </div>

      <RoleEditorModal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingRole(null);
        }}
        onSaved={load}
        role={editingRole}
        companies={companies}
        canAuthorGlobalRoles={meta.canAuthorGlobalRoles}
        authorableCompanyIds={meta.authorableCompanyIds}
      />

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete role"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleDelete} disabled={deleting} loading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Delete <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            {(deleteTarget.assignmentCount ?? 0) > 0 && (
              <p className="rounded bg-yellow-100 px-3 py-2 text-sm text-yellow-800">
                {deleteTarget.assignmentCount} user
                {deleteTarget.assignmentCount === 1 ? '' : 's'} currently{' '}
                {deleteTarget.assignmentCount === 1 ? 'holds' : 'hold'} this role. Revoke it from
                them first — the delete will be refused until you do.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
