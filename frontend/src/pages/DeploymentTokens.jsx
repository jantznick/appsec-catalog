import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { copyToClipboard, isClipboardAvailable } from '../utils/clipboard.js';
import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

export function DeploymentTokens() {
  const { user, isAdmin } = useAuthStore();
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [selectedInfoApplicationId, setSelectedInfoApplicationId] = useState('');
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenApplicationId, setNewTokenApplicationId] = useState('');
  const [applications, setApplications] = useState([]);
  const [editingName, setEditingName] = useState('');
  const [editingApplicationIds, setEditingApplicationIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [commandTab, setCommandTab] = useState('curl');

  useEffect(() => {
    loadTokens();
    loadApplications();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      const data = await api.getDeploymentTokens();
      setTokens(data.filter(t => !t.revokedAt)); // Only show active tokens
    } catch (error) {
      toast.error(error.message || 'Failed to load deployment tokens');
    } finally {
      setLoading(false);
    }
  };

  const loadApplications = async () => {
    try {
      const data = await api.getApplications();
      // Filter by company if not admin
      if (!isAdmin() && user?.companyId) {
        setApplications(data.filter(app => app.companyId === user.companyId));
      } else {
        setApplications(data);
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenApplicationId) {
      toast.error('Please select an application');
      return;
    }

    try {
      setSaving(true);
      const token = await api.createDeploymentToken(newTokenApplicationId, newTokenName.trim() || null);
      toast.success('Deployment token created successfully');
      setShowCreateModal(false);
      setNewTokenName('');
      setNewTokenApplicationId('');
      await loadTokens();
    } catch (error) {
      toast.error(error.message || 'Failed to create deployment token');
    } finally {
      setSaving(false);
    }
  };

  const handleEditToken = async () => {
    if (!selectedToken) return;

    try {
      setSaving(true);
      await api.updateDeploymentToken(selectedToken.id, {
        name: editingName.trim() || null,
        applicationIds: editingApplicationIds,
      });
      toast.success('Token updated successfully');
      setShowEditModal(false);
      setSelectedToken(null);
      await loadTokens();
    } catch (error) {
      toast.error(error.message || 'Failed to update token');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    if (!selectedToken) return;

    try {
      setSaving(true);
      await api.revokeDeploymentToken(selectedToken.id);
      toast.success('Token revoked successfully');
      setShowDeleteModal(false);
      setSelectedToken(null);
      await loadTokens();
    } catch (error) {
      toast.error(error.message || 'Failed to revoke token');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (token) => {
    setSelectedToken(token);
    setEditingName(token.name || '');
    setEditingApplicationIds(token.applications?.map(a => a.application?.id || a.applicationId) || []);
    setShowEditModal(true);
    // Reload applications filtered by token's company
    loadApplicationsForToken(token.companyId);
  };

  const loadApplicationsForToken = async (companyId) => {
    try {
      const data = await api.getApplications();
      // Filter by the token's company
      setApplications(data.filter(app => app.companyId === companyId));
    } catch (error) {
      console.error('Failed to load applications:', error);
    }
  };

  const openInfoModal = (token) => {
    setSelectedToken(token);
    // Set first application as default if available
    if (token.applications && token.applications.length > 0) {
      setSelectedInfoApplicationId(token.applications[0].application?.id || token.applications[0].applicationId || '');
    } else {
      setSelectedInfoApplicationId('');
    }
    setShowInfoModal(true);
  };

  const openDeleteModal = (token) => {
    setSelectedToken(token);
    setShowDeleteModal(true);
  };

  const copyToken = (token) => {
    if (!token.token) {
      toast.error('Token value not available');
      return;
    }
    copyToClipboard(
      token.token,
      () => toast.success('Token copied to clipboard!'),
      (error) => toast.error(error || 'Failed to copy token')
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading deployment tokens...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Deployment Tokens</h1>
            <p className="mt-2 text-gray-600">
              Manage API tokens for CI/CD pipeline integrations
            </p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            Create Token
          </Button>
        </div>

        {/* Informational Section */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">About Deployment Tokens</h2>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>
                    Deployment tokens are <strong>limited-scope API tokens</strong> designed specifically for CI/CD pipeline integrations.
                    While they share the name "token" with other authentication mechanisms, that often allow broader access and abillities <strong>these tokens have very restricted capabilities.</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Single Purpose:</strong> These tokens can <strong>only</strong> log deployment records for applications. They cannot read, modify, or delete any other data.</li>
                    <li><strong>Application-Specific:</strong> Each token is locked down to specific applications you choose. A token can only log deployments for the applications it's explicitly associated with.</li>
                    <li><strong>Limited Scope:</strong> Unlike full API tokens, deployment tokens have no access to application details, user data, company information, or any other system resources.</li>
                    <li><strong>Final Reiteration:</strong> These tokens are intentionally limited in scope. If a token is compromised, the worst-case scenario is unauthorized deployment records being logged for the associated applications—they cannot access or modify any other data.</li>
                  </ul>
                  <p className="mt-3 text-gray-600">
                    Use these tokens in your CI/CD pipelines to automatically record deployments when code is deployed to your environments.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {tokens.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-600 mb-4">No deployment tokens found.</p>
              <Button onClick={() => setShowCreateModal(true)}>
                Create Your First Token
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent padding="none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead>Applications</TableHead>
                    <TableHead>Last Used</TableHead>
                    {isAdmin() && <TableHead>Company</TableHead>}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow 
                      key={token.id}
                      onClick={() => openInfoModal(token)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <TableCell className="font-medium">
                        {token.name || <span className="text-gray-400 italic">Unnamed Token</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono max-w-[120px] truncate">
                            {token.token ? `${token.token.substring(0, 16)}...` : 'Token value not available'}
                          </code>
                          {isClipboardAvailable() && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToken(token);
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              title="Copy token"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {token.applications && token.applications.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {token.applications.slice(0, 2).map((appToken) => {
                              const app = appToken.application;
                              return (
                                <Link
                                  key={appToken.id}
                                  to={`/applications/${app.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200"
                                >
                                  {app.name}
                                </Link>
                              );
                            })}
                            {token.applications.length > 2 && (
                              <span className="text-xs text-gray-500 px-2 py-1">
                                +{token.applications.length - 2} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {token.lastUsedAt ? (
                          <span className="text-sm text-gray-700">
                            {new Date(token.lastUsedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Never</span>
                        )}
                      </TableCell>
                      {isAdmin() && (
                        <TableCell>
                          {token.company ? (
                            <Link
                              to={`/companies/${token.company.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-blue-600 hover:text-blue-700"
                            >
                              {token.company.name}
                            </Link>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditModal(token)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteModal(token)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Create Token Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setNewTokenName('');
            setNewTokenApplicationId('');
          }}
          title="Create Deployment Token"
        >
          <div className="space-y-4">
            <Select
              label="Application"
              value={newTokenApplicationId}
              onChange={(e) => setNewTokenApplicationId(e.target.value)}
              options={[
                { value: '', label: 'Select an application...' },
                ...applications.map(app => ({
                  value: app.id,
                  label: app.name,
                })),
              ]}
              required
            />
            <Input
              label="Token Name (Optional)"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="e.g., Production Pipeline Token"
            />
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewTokenName('');
                  setNewTokenApplicationId('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateToken}
                disabled={!newTokenApplicationId || saving}
                loading={saving}
              >
                Create Token
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Token Modal */}
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedToken(null);
          }}
          title="Edit Deployment Token"
          size="lg"
        >
          {selectedToken && (
            <div className="space-y-4">
              <Input
                label="Token Name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="e.g., Production Pipeline Token"
              />
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Applications
                </label>
                <div className="border border-gray-300 rounded-lg p-4 max-h-64 overflow-y-auto">
                  {applications.length === 0 ? (
                    <p className="text-sm text-gray-500">No applications available</p>
                  ) : (
                    <div className="space-y-2">
                      {applications.map((app) => (
                        <label key={app.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingApplicationIds.includes(app.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditingApplicationIds([...editingApplicationIds, app.id]);
                              } else {
                                setEditingApplicationIds(editingApplicationIds.filter(id => id !== app.id));
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{app.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedToken(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditToken}
                  disabled={saving}
                  loading={saving}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Token Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedToken(null);
          }}
          title="Revoke Deployment Token"
        >
          {selectedToken && (
            <div className="space-y-4">
              <p className="text-gray-700">
                Are you sure you want to revoke the token <strong>{selectedToken.name || 'Unnamed Token'}</strong>?
              </p>
              <p className="text-sm text-gray-600">
                This action cannot be undone. The token will no longer be able to log deployments.<br/><br/><strong> Please ensure that this will not block any automated deployments.</strong>
              </p>
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedToken(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={handleDeleteToken}
                  disabled={saving}
                  loading={saving}
                >
                  Revoke Token
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Info Modal */}
        <Modal
          isOpen={showInfoModal}
          onClose={() => {
            setShowInfoModal(false);
            setSelectedToken(null);
            setSelectedInfoApplicationId('');
          }}
          title="CI/CD Integration Instructions"
          size="xl"
        >
          {selectedToken && (
            <TokenInfoModal
              token={selectedToken}
              selectedApplicationId={selectedInfoApplicationId}
              setSelectedApplicationId={setSelectedInfoApplicationId}
              commandTab={commandTab}
              setCommandTab={setCommandTab}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}

// Token Info Modal Component
function TokenInfoModal({ token, selectedApplicationId, setSelectedApplicationId, commandTab, setCommandTab }) {
  const [frontendUrl, setFrontendUrl] = useState('');
  const tokenValue = token.token || '';

  useEffect(() => {
    const url = window.location.origin;
    setFrontendUrl(url);
  }, []);

  const generateCurlCommand = () => {
    if (!selectedApplicationId) return '';
    const apiUrl = `${frontendUrl}/api/applications/deployments`;
    
    return `curl -X POST ${apiUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "token": "${tokenValue}",
    "applicationId": "${selectedApplicationId}",
    "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "{env}",
    "version": "{version}",
    "gitBranch": "{gitBranch}",
    "deployedBy": "CI/CD Pipeline",
    "notes": "Automated deployment"
  }'`;
  };

  const generateWgetCommand = () => {
    if (!selectedApplicationId) return '';
    const apiUrl = `${frontendUrl}/api/applications/deployments`;
    
    return `wget --method=POST \\
  --header="Content-Type: application/json" \\
  --body-data='{
    "token": "${tokenValue}",
    "applicationId": "${selectedApplicationId}",
    "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
    "environment": "{env}",
    "version": "{version}",
    "gitBranch": "{gitBranch}",
    "deployedBy": "CI/CD Pipeline",
    "notes": "Automated deployment"
  }' \\
  ${apiUrl}`;
  };

  const copyCommand = (command) => {
    copyToClipboard(
      command,
      () => toast.success('Command copied to clipboard!'),
      (error) => toast.error(error || 'Failed to copy command')
    );
  };

  const availableApplications = token.applications?.map(a => a.application) || [];

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Application
        </label>
        <Select
          value={selectedApplicationId}
          onChange={(e) => setSelectedApplicationId(e.target.value)}
          options={[
            { value: '', label: 'Select an application...' },
            ...availableApplications.map(app => ({
              value: app.id,
              label: app.name,
            })),
          ]}
        />
      </div>

      {selectedApplicationId && (
        <>
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-medium text-gray-700">CI/CD Command</label>
              {isClipboardAvailable() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyCommand(commandTab === 'curl' ? generateCurlCommand() : generateWgetCommand())}
                >
                  Copy
                </Button>
              )}
            </div>
            
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setCommandTab('curl')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  commandTab === 'curl'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                cURL
              </button>
              <button
                onClick={() => setCommandTab('wget')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  commandTab === 'wget'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                wget
              </button>
            </div>

            {/* Command Content */}
            <pre className="bg-gray-900 text-gray-100 p-4 rounded text-xs overflow-x-auto">
              <code>{commandTab === 'curl' ? generateCurlCommand() : generateWgetCommand()}</code>
            </pre>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Replace the variables ({'{'}env{'}'}, {'{'}version{'}'}, {'{'}gitBranch{'}'}) with your actual deployment data.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

