import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table.jsx';
import { copyToClipboard, isClipboardAvailable } from '../utils/clipboard.js';
import useAuthStore from '../store/authStore.js';

export function SettingsApiTokens() {
  const { user, isAdmin } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [myTokens, setMyTokens] = useState([]);
  const [allTokens, setAllTokens] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenCompanyId, setNewTokenCompanyId] = useState('');
  const [newTokenAdminAccessDisabled, setNewTokenAdminAccessDisabled] = useState(true);
  const [createdTokenValue, setCreatedTokenValue] = useState('');
  const [createdTokenMeta, setCreatedTokenMeta] = useState(null);

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeAsAdmin, setRevokeAsAdmin] = useState(false);

  const canCopy = useMemo(() => isClipboardAvailable(), []);

  const load = async () => {
    try {
      setLoading(true);
      const mine = await api.getApiTokens();
      setMyTokens(mine);
      if (isAdmin()) {
        const [all, companyRows] = await Promise.all([
          api.getAdminApiTokens(),
          api.getCompanies(),
        ]);
        setAllTokens(all);
        setCompanies(companyRows);
      } else {
        setAllTokens([]);
        const companyRows = user?.companyId ? await api.getCompanies() : [];
        setCompanies(companyRows);
      }
    } catch (e) {
      toast.error(e.message || 'Failed to load API tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (newTokenCompanyId) {
      setNewTokenAdminAccessDisabled(true);
    }
  }, [newTokenCompanyId]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const resp = await api.createApiToken({
        name: newTokenName.trim() || null,
        companyId: newTokenCompanyId || null,
        adminAccessDisabled: newTokenCompanyId ? true : newTokenAdminAccessDisabled,
      });
      setCreatedTokenValue(resp.token || '');
      setCreatedTokenMeta(resp.apiToken || null);
      toast.success('API token created. Copy it now; it will not be shown again.');
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to create API token');
    } finally {
      setSaving(false);
    }
  };

  const openRevoke = (token, asAdmin) => {
    setRevokeTarget(token);
    setRevokeAsAdmin(Boolean(asAdmin));
    setShowRevokeModal(true);
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    try {
      setSaving(true);
      if (revokeAsAdmin) {
        await api.adminRevokeApiToken(revokeTarget.id);
      } else {
        await api.revokeApiToken(revokeTarget.id);
      }
      toast.success('API token revoked');
      setShowRevokeModal(false);
      setRevokeTarget(null);
      await load();
    } catch (e) {
      toast.error(e.message || 'Failed to revoke API token');
    } finally {
      setSaving(false);
    }
  };

  const copyCreated = () => {
    if (!createdTokenValue) return;
    copyToClipboard(
      createdTokenValue,
      () => toast.success('Token copied to clipboard!'),
      (err) => toast.error(err || 'Failed to copy token'),
    );
  };

  const createdHeader = useMemo(() => {
    if (!createdTokenValue) return null;
    const parts = createdTokenValue.split('.');
    const prefix = parts[0] || '';
    return `${prefix}.…`;
  }, [createdTokenValue]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading API tokens...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">API Tokens</h1>
            <p className="mt-2 text-gray-600">
              Create personal API tokens for programmatic access. Tokens are shown once at creation.
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>Create Token</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>My tokens</CardTitle>
          </CardHeader>
          <CardContent padding="none">
            {myTokens.length === 0 ? (
              <div className="p-6 text-gray-600">No API tokens yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Hint</TableHead>
                    <TableHead>Company scope</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myTokens.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.name || <span className="text-gray-400 italic">Unnamed</span>}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          …{t.secretHint || ''}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {t.company?.name || 'Unrestricted'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {t.adminAccessDisabled ? 'Disabled' : 'Allowed'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openRevoke(t, false)}>
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {isAdmin() && (
          <Card>
            <CardHeader>
              <CardTitle>All tokens (admin)</CardTitle>
            </CardHeader>
            <CardContent padding="none">
              {allTokens.length === 0 ? (
                <div className="p-6 text-gray-600">No tokens found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Hint</TableHead>
                      <TableHead>Company scope</TableHead>
                      <TableHead>Admin</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last used</TableHead>
                      <TableHead>Revoked</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTokens.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm text-gray-800">
                          {t.user?.email || t.userId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {t.name || <span className="text-gray-400 italic">Unnamed</span>}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                            …{t.secretHint || ''}
                          </code>
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.company?.name || 'Unrestricted'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.adminAccessDisabled ? 'Disabled' : 'Allowed'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : 'Never'}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">
                          {t.revokedAt ? new Date(t.revokedAt).toLocaleDateString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={Boolean(t.revokedAt)}
                            onClick={() => openRevoke(t, true)}
                          >
                            Revoke
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewTokenName('');
            setNewTokenCompanyId('');
            setNewTokenAdminAccessDisabled(true);
            setCreatedTokenValue('');
            setCreatedTokenMeta(null);
          }}
          title="Create API token"
          size="lg"
        >
          <div className="space-y-4">
            <Input
              label="Token name (optional)"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g., Terraform / Reporting script"
            />
            <Select
              label="Company restriction"
              value={newTokenCompanyId}
              onChange={(e) => setNewTokenCompanyId(e.target.value)}
              options={[
                { value: '', label: 'No company restriction' },
                ...companies.map((company) => ({
                  value: company.id,
                  label: company.name,
                })),
              ]}
              helperText="When set, this token can only act within the selected company."
            />
            <Checkbox
              id="api-token-disable-admin"
              label="Prevent admin abilities for this token"
              checked={newTokenAdminAccessDisabled}
              disabled={Boolean(newTokenCompanyId)}
              onChange={(e) => setNewTokenAdminAccessDisabled(e.target.checked)}
              helperText={
                newTokenCompanyId
                  ? 'Company-restricted tokens cannot use global admin abilities.'
                  : 'Recommended for automation tokens, even when your user account is an admin.'
              }
            />

            {createdTokenValue ? (
              <div className="space-y-3">
                <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
                  Copy this token now. For security, it won’t be shown again.
                </div>

                <div className="rounded border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">
                      <div className="font-medium">Token</div>
                      <div className="text-xs text-gray-500">{createdHeader}</div>
                    </div>
                    {canCopy && (
                      <Button variant="outline" size="sm" onClick={copyCreated}>
                        Copy
                      </Button>
                    )}
                  </div>
                  <pre className="mt-3 bg-gray-900 text-gray-100 p-3 rounded text-xs overflow-x-auto">
                    <code>{createdTokenValue}</code>
                  </pre>
                </div>

                {createdTokenMeta?.id && (
                  <div className="text-xs text-gray-500">
                    Created for {user?.email}. Token id: {createdTokenMeta.id}
                    {createdTokenMeta.company?.name ? ` · Restricted to ${createdTokenMeta.company.name}` : ' · No company restriction'}
                    {createdTokenMeta.adminAccessDisabled ? ' · Admin disabled' : ''}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewTokenName('');
                      setNewTokenCompanyId('');
                      setNewTokenAdminAccessDisabled(true);
                      setCreatedTokenValue('');
                      setCreatedTokenMeta(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTokenName('');
                    setNewTokenCompanyId('');
                    setNewTokenAdminAccessDisabled(true);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving} loading={saving}>
                  Create
                </Button>
              </div>
            )}
          </div>
        </Modal>

        <Modal
          isOpen={showRevokeModal}
          onClose={() => {
            setShowRevokeModal(false);
            setRevokeTarget(null);
          }}
          title="Revoke API token"
        >
          {revokeTarget && (
            <div className="space-y-4">
              <p className="text-gray-700">
                Revoke token <strong>{revokeTarget.name || 'Unnamed'}</strong>?
              </p>
              <p className="text-sm text-gray-600">
                This token will stop working immediately. This action cannot be undone.
              </p>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRevokeModal(false);
                    setRevokeTarget(null);
                  }}
                >
                  Cancel
                </Button>
                <Button variant="danger" onClick={handleRevoke} disabled={saving} loading={saving}>
                  Revoke
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
