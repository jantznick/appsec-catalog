import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

function getStatusBadgeClasses(status) {
  const normalized = (status || 'unknown').toLowerCase();
  if (normalized === 'active') return 'bg-green-100 text-green-800';
  if (normalized === 'parked') return 'bg-yellow-100 text-yellow-800';
  if (normalized === 'deprecated') return 'bg-red-100 text-red-800';
  return 'bg-gray-100 text-gray-800';
}

export function DomainDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    status: 'unknown',
  });

  useEffect(() => {
    if (id) {
      loadDomain();
    }
  }, [id]);

  const loadDomain = async () => {
    try {
      setLoading(true);
      const data = await api.getDomain(id);
      setDomain(data);
      const nextFormData = {
        name: data.name || '',
        description: data.description || '',
        owner: data.owner || '',
        status: data.status || 'unknown',
      };
      setFormData(nextFormData);
      setOriginalFormData(nextFormData);
      setHasUnsavedChanges(false);
    } catch (error) {
      toast.error('Failed to load domain');
      console.error(error);
      navigate('/domains');
    } finally {
      setLoading(false);
    }
  };

  const updateFormField = (field, value) => {
    const nextFormData = { ...formData, [field]: value };
    setFormData(nextFormData);

    if (originalFormData) {
      setHasUnsavedChanges(JSON.stringify(nextFormData) !== JSON.stringify(originalFormData));
    }
  };

  const startEditing = () => {
    setIsEditing(true);
    if (originalFormData) {
      setHasUnsavedChanges(JSON.stringify(formData) !== JSON.stringify(originalFormData));
    }
  };

  if (loading) {
    return <LoadingPage message="Loading domain..." />;
  }

  if (!domain) {
    return null;
  }

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateDomain(id, {
        name: formData.name,
        description: formData.description,
        owner: formData.owner,
        status: formData.status,
      });
      toast.success('Domain metadata updated');
      setOriginalFormData(formData);
      setHasUnsavedChanges(false);
      setIsEditing(false);
      await loadDomain();
    } catch (error) {
      toast.error(error.message || 'Failed to update domain metadata');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const cancelEditing = () => {
    if (originalFormData) {
      setFormData(originalFormData);
    }
    setHasUnsavedChanges(false);
    setShowCancelModal(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      setShowCancelModal(true);
      return;
    }
    cancelEditing();
  };

  const relatedDomains = domain.relatedDomains || [];
  const relationships = domain.relationships || {};
  const apexDomainRecord = relatedDomains.find(
    (relatedDomain) => relatedDomain.name === domain.apexDomain
  );

  return (
    <div className={isEditing ? 'pb-24' : ''}>
      <div className="mb-8">
        <button
          onClick={() => navigate('/domains')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Domains
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{domain.name}</h1>
            {domain.company?.id ? (
              <p className="text-gray-600">
                Company:{' '}
                <Link to={`/companies/${domain.company.id}`} className="text-blue-600 hover:text-blue-700">
                  {domain.company.name}
                </Link>
              </p>
            ) : (
              <p className="text-gray-600">Company: —</p>
            )}
          </div>
          {isAdmin() && (
            <Button
              variant={isEditing ? 'secondary' : 'outline'}
              onClick={() => (isEditing ? handleCancelEdit() : startEditing())}
            >
              {isEditing ? 'Cancel' : 'Edit Metadata'}
            </Button>
          )}
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Domain Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Domain Name</p>
              {isEditing ? (
                <input
                  value={formData.name}
                  onChange={(e) => updateFormField('name', e.target.value)}
                  placeholder="example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900">{domain.name || '—'}</p>
              )}
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Owner</p>
              {isEditing ? (
                <input
                  value={formData.owner}
                  onChange={(e) => updateFormField('owner', e.target.value)}
                  placeholder="Team contacts, email aliases, or owner notes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900">{domain.owner || '—'}</p>
              )}
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Status</p>
              {isEditing ? (
                <select
                  value={formData.status}
                  onChange={(e) => updateFormField('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="unknown">unknown</option>
                  <option value="active">active</option>
                  <option value="parked">parked</option>
                  <option value="deprecated">deprecated</option>
                </select>
              ) : (
                <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClasses(domain.status)}`}>
                  {domain.status || 'unknown'}
                </span>
              )}
            </div>

            <div
              onClick={!isEditing && apexDomainRecord?.id ? () => navigate(`/domains/${apexDomainRecord.id}`) : undefined}
              className={!isEditing && apexDomainRecord?.id ? 'p-2 text-left cursor-pointer' : 'p-2 text-left'}
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Apex Domain Group</p>
              <p className={apexDomainRecord?.id ? 'text-blue-600' : 'text-gray-900'}>
                {domain.apexDomain || '—'}
              </p>
            </div>

            <div className="p-2 text-left">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Updated</p>
              <p className="text-gray-900">
                {domain.updatedAt ? new Date(domain.updatedAt).toLocaleString() : '—'}
              </p>
            </div>

            <div
              onClick={!isEditing && isAdmin() ? startEditing : undefined}
              className="md:col-span-2 p-2 text-left"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Description</p>
              {isEditing ? (
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  placeholder="Add optional context for this domain"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
                />
              ) : (
                <p className="text-gray-900 whitespace-pre-wrap">{domain.description || 'No description provided'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Related Domains ({relatedDomains.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              {relationships.isApexDomain ? (
                <>
                  <p className="font-medium text-gray-900 mb-1">This is the apex domain.</p>
                  <p>
                    {relationships.children?.length > 0
                      ? `Detected ${relationships.children.length} related subdomain${relationships.children.length !== 1 ? 's' : ''}.`
                      : 'No related subdomains detected yet.'}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-gray-900 mb-1">Parent apex domain</p>
                  {relationships.parent ? (
                    <Link to={`/domains/${relationships.parent.id}`} className="text-blue-600 hover:text-blue-700">
                      {relationships.parent.name}
                    </Link>
                  ) : (
                    <p>No apex domain record exists yet for this group.</p>
                  )}
                </>
              )}
            </div>

            {relatedDomains.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applications</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {relatedDomains.map((relatedDomain) => (
                      <tr key={relatedDomain.id}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {relatedDomain.id === domain.id ? (
                            <span className="font-semibold text-blue-700">{relatedDomain.name}</span>
                          ) : (
                            <Link to={`/domains/${relatedDomain.id}`} className="text-blue-600 hover:text-blue-700">
                              {relatedDomain.name}
                            </Link>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {relatedDomain._count?.applicationDomains || 0}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{relatedDomain.owner || '—'}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusBadgeClasses(relatedDomain.status)}`}>
                            {relatedDomain.status || 'unknown'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Associated Applications ({domain.applications?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent padding="none">
          {domain.applications && domain.applications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application Name</TableHead>
                  <TableHead>Owner</TableHead>
                  {isAdmin() && <TableHead>Company</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domain.applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Link
                        to={`/applications/${application.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {application.name}
                      </Link>
                    </TableCell>
                    <TableCell>{application.owner || '—'}</TableCell>
                    {isAdmin() && (
                      <TableCell>
                        {application.company ? (
                          <Link
                            to={`/companies/${application.company.id}`}
                            className="text-gray-700 hover:text-blue-600"
                          >
                            {application.company.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        application.status === 'onboarded' 
                          ? 'bg-green-100 text-green-800'
                          : application.status === 'pending_technical'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {application.status || 'onboarded'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/applications/${application.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        View →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No applications hosted on this domain
            </div>
          )}
        </CardContent>
      </Card>

      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasUnsavedChanges ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>You have unsaved changes</span>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">No changes made</div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasUnsavedChanges}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Discard Changes?"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep Editing
            </Button>
            <Button
              variant="primary"
              onClick={cancelEditing}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            You have unsaved changes. Are you sure you want to discard them?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone. All your changes will be lost.
          </p>
        </div>
      </Modal>
    </div>
  );
}

