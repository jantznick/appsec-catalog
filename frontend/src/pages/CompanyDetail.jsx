import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';
import { isClipboardAvailable, copyToClipboard } from '../utils/clipboard.js';
import { NotesSection } from '../components/notes/NotesSection.jsx';
import { ApplicablePoliciesView } from '../components/policy/ApplicablePoliciesView.jsx';

export function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuthStore();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [averageScore, setAverageScore] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [domains, setDomains] = useState([]);

  const [divisions, setDivisions] = useState([]);
  const [loadingDivisions, setLoadingDivisions] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    domains: '',
    divisionId: '',
    engManager: '',
    language: '',
    framework: '',
    serverEnvironment: '',
    facing: '',
    deploymentType: '',
    authProfiles: '',
    dataTypes: '',
  });

  useEffect(() => {
    if (id) {
      loadCompany();
      loadAverageScore();
      loadDomains();
    }
    if (isAdmin()) {
      loadDivisions();
    }
  }, [id, isAdmin]);

  const loadDivisions = async () => {
    try {
      setLoadingDivisions(true);
      const data = await api.getDivisions();
      setDivisions(data);
    } catch (error) {
      console.error('Failed to load divisions:', error);
    } finally {
      setLoadingDivisions(false);
    }
  };

  const loadAverageScore = async () => {
    try {
      const data = await api.getCompanyAverageScore(id);
      setAverageScore(data.averageScore);
      setScoreData(data);
    } catch (error) {
      console.error('Failed to load average score:', error);
    }
  };

  const loadDomains = async () => {
    try {
      const data = await api.getCompanyDomains(id);
      setDomains(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  };

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await api.getCompany(id);
      setCompany(data);
      const newFormData = {
        name: data.name || '',
        domains: data.domains || '',
        divisionId: data.divisionId || '',
        engManager: data.engManager || '',
        language: data.language || '',
        framework: data.framework || '',
        serverEnvironment: data.serverEnvironment || '',
        facing: data.facing || '',
        deploymentType: data.deploymentType || '',
        authProfiles: data.authProfiles || '',
        dataTypes: data.dataTypes || '',
      };
      setFormData(newFormData);
      setOriginalFormData(JSON.parse(JSON.stringify(newFormData)));
    } catch (error) {
      toast.error('Failed to load company');
      console.error(error);
      navigate('/companies');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if user can edit company fields
  const canEditCompany = () => {
    return isAdmin() || user?.companyId === id;
  };

  const handleEditClick = () => {
    if (!canEditCompany()) return;
    setIsEditing(true);
    setOriginalFormData(JSON.parse(JSON.stringify(formData)));
  };

  const handleFieldClick = (e) => {
    if (!canEditCompany() || isEditing) {
      return;
    }
    
    // Don't trigger if clicking on actual buttons or links
    const clickedButton = e.target.closest('button:not([disabled])');
    const clickedLink = e.target.closest('a');
    if (clickedButton || clickedLink) {
      return;
    }
    
    // Enable editing mode
    handleEditClick();
  };

  const handleFieldChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    if (isEditing && originalFormData) {
      const hasChanges = JSON.stringify(newFormData) !== JSON.stringify(originalFormData);
      setHasUnsavedChanges(hasChanges);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowCancelModal(true);
      return;
    }
    cancelEditing();
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setHasUnsavedChanges(false);
    setShowCancelModal(false);
    if (originalFormData) {
      setFormData(JSON.parse(JSON.stringify(originalFormData)));
    } else {
      loadCompany();
    }
  };

  const handleSave = async () => {
    // Check if user has access (admin or member of company)
    if (!isAdmin() && user?.companyId !== id) {
      toast.error('You can only update your own company');
      return;
    }

    try {
      setSaving(true);
      await api.updateCompany(id, formData);
      toast.success('Company updated successfully');
      setIsEditing(false);
      setHasUnsavedChanges(false);
      await loadCompany();
    } catch (error) {
      toast.error(error.message || 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };


  if (loading) {
    return <LoadingPage message="Loading company..." />;
  }

  if (!company) {
    return null;
  }

  return (
    <div className="pb-24">
      <div className="mb-8">
        {!isAdmin() && (
          <button
            onClick={() => navigate('/companies')}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to Companies
          </button>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-800">{company.name}</h1>
          {company.division && (
            <Link
              to={`/divisions/${company.division.id}`}
              className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
            >
              {company.division.name}
            </Link>
          )}
        </div>
        <p className="text-gray-600">Company details and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Score Cards */}
          {scoreData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Average Score Card */}
              {averageScore !== null && (
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle className="text-sm">Average Score 📊</CardTitle>
                      <Link
                        to="/docs/scoring-methodology"
                        className="text-xs text-blue-600 hover:text-blue-700"
                        target="_blank"
                      >
                        How? →
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className={`text-3xl font-semibold mb-1 ${
                        averageScore >= 76 ? 'text-green-600' :
                        averageScore >= 51 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {averageScore}/100
                      </div>
                      <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        averageScore >= 76 ? 'bg-green-100 text-green-800' :
                        averageScore >= 51 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {averageScore >= 76 ? 'Excellent' : averageScore >= 51 ? 'Good' : 'Needs Improvement'}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Highest Score Card */}
              {scoreData.highestApplication && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Highest Score 👑</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-1 text-green-600">
                        {scoreData.highestApplication.score}/100
                      </div>
                      <Link
                        to={`/applications/${scoreData.highestApplication.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 block truncate"
                        title={scoreData.highestApplication.name}
                      >
                        {scoreData.highestApplication.name}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lowest Score Card */}
              {scoreData.lowestApplication && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Lowest Score 🗑️</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <div className="text-3xl font-semibold mb-1 text-red-600">
                        {scoreData.lowestApplication.score}/100
                      </div>
                      <Link
                        to={`/applications/${scoreData.lowestApplication.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 block truncate"
                        title={scoreData.lowestApplication.name}
                      >
                        {scoreData.lowestApplication.name}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* View All Applications Link */}
          {scoreData && (
            <div className="text-center">
              <Link
                to={`/applications?companyId=${id}`}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View all applications →
              </Link>
            </div>
          )}

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle>
                Company Information
                {canEditCompany() && !isEditing && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {canEditCompany() && !isEditing && (
                <div
                  onClick={handleFieldClick}
                  className="absolute inset-0 z-10 cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                />
              )}
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <Input
                      label="Company Name"
                      value={formData.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      disabled={!isAdmin()}
                      required
                    />
                    <Textarea
                      label="Email Domains (comma-separated)"
                      value={formData.domains}
                      onChange={(e) => handleFieldChange('domains', e.target.value)}
                      disabled={!isAdmin()}
                      placeholder="example.com, subdomain.example.com"
                      helperText="Email domains that will automatically assign users to this company (different from hosting domains where applications are hosted)"
                    />
                    {isAdmin() && (
                      <Select
                        label="Division"
                        value={formData.divisionId || ''}
                        onChange={(e) => handleFieldChange('divisionId', e.target.value)}
                        disabled={loadingDivisions}
                        options={[
                          { value: '', label: 'No division' },
                          ...divisions.map(d => ({ value: d.id, label: d.name })),
                        ]}
                      />
                    )}
                    <Input
                      label="Engineering Manager"
                      value={formData.engManager}
                      onChange={(e) => handleFieldChange('engManager', e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Company Name</label>
                      <p className="text-base text-gray-800 font-medium">{formData.name || <span className="text-gray-400 italic">Not set</span>}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Email Domains</label>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-sm text-gray-800">
                          {formData.domains || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                    {isAdmin() && company.division && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Division</label>
                        <Link
                          to={`/divisions/${company.division.id}`}
                          className="inline-block px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          {company.division.name}
                        </Link>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Engineering Manager</label>
                      <p className="text-base text-gray-800">
                        {formData.engManager || <span className="text-gray-400 italic">Not set</span>}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Default Settings */}
          <Card>
            <CardHeader>
              <CardTitle>
                Default Settings
                {canEditCompany() && !isEditing && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {canEditCompany() && !isEditing && (
                <div
                  onClick={handleFieldClick}
                  className="absolute inset-0 z-10 cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                />
              )}
              <p className="text-sm text-gray-600 mb-4">
                These settings will be used as defaults when onboarding new applications for this company.
              </p>
              <div className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Language"
                        value={formData.language}
                        onChange={(e) => handleFieldChange('language', e.target.value)}
                      />
                      <Input
                        label="Framework"
                        value={formData.framework}
                        onChange={(e) => handleFieldChange('framework', e.target.value)}
                      />
                      <Select
                        label="Server Environment"
                        value={formData.serverEnvironment || ''}
                        onChange={(e) => handleFieldChange('serverEnvironment', e.target.value)}
                        options={[
                          { value: '', label: 'Select environment' },
                          { value: 'Cloud', label: 'Cloud' },
                          { value: 'On-prem', label: 'On-prem' },
                          { value: 'Both', label: 'Both' },
                        ]}
                      />
                      <Select
                        label="Facing"
                        value={formData.facing || ''}
                        onChange={(e) => handleFieldChange('facing', e.target.value)}
                        options={[
                          { value: '', label: 'Select facing' },
                          { value: 'Internal', label: 'Internal' },
                          { value: 'External', label: 'External' },
                        ]}
                      />
                      <Input
                        label="Deployment Type"
                        value={formData.deploymentType}
                        onChange={(e) => handleFieldChange('deploymentType', e.target.value)}
                      />
                      <Input
                        label="Auth Profiles"
                        value={formData.authProfiles}
                        onChange={(e) => handleFieldChange('authProfiles', e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        label="Data Types"
                        value={formData.dataTypes}
                        onChange={(e) => handleFieldChange('dataTypes', e.target.value)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Language</label>
                        <p className="text-sm text-gray-700">
                          {formData.language || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Framework</label>
                        <p className="text-sm text-gray-700">
                          {formData.framework || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Server Environment</label>
                        <p className="text-sm text-gray-700">
                          {formData.serverEnvironment || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Facing</label>
                        <p className="text-sm text-gray-700">
                          {formData.facing || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Deployment Type</label>
                        <p className="text-sm text-gray-700">
                          {formData.deploymentType || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Auth Profiles</label>
                        <p className="text-sm text-gray-700">
                          {formData.authProfiles || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">Data Types</label>
                      <p className="text-sm text-gray-700">
                        {formData.dataTypes || <span className="text-gray-400 italic">Not set</span>}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Public Onboarding Form */}
          {company.slug && (
            <Card>
              <CardHeader>
                <CardTitle>Public Onboarding Form</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Share this link with executives to submit basic application information.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Onboarding URL</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${window.location.origin}/onboard/${company.slug}/manager`}
                        readOnly
                        className="font-mono text-sm"
                        onClick={(e) => e.target.select()}
                      />
                      {isClipboardAvailable() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            copyToClipboard(
                              `${window.location.origin}/onboard/${company.slug}/manager`,
                              () => toast.success('Link copied to clipboard'),
                              (error) => toast.error(error)
                            );
                          }}
                        >
                          Copy
                        </Button>
                      )}
                    </div>
                  </div>
                  <Link
                    to={`/onboard/${company.slug}/manager`}
                    target="_blank"
                    className="block"
                  >
                    <Button variant="primary" className="w-full">
                      View Onboarding Form
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hosting Domains */}
          <Card>
            <CardHeader>
              <CardTitle>Hosting Domains ({domains.length})</CardTitle>
            </CardHeader>
            <CardContent padding="none">
              {domains.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {domains.map((domain) => (
                    <div
                      key={domain.id}
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Link
                            to={`/domains/${domain.id}`}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            {domain.name}
                          </Link>
                          <p className="text-sm text-gray-500 mt-1">
                            {domain._count?.applicationDomains || 0} application{domain._count?.applicationDomains !== 1 ? 's' : ''} hosted
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No hosting domains associated with this company's applications
                </div>
              )}
            </CardContent>
          </Card>

          {/* Applicable Policies */}
          <ApplicablePoliciesView
            entityType="company"
            entityId={id}
            entityData={company}
          />
        </div>
      </div>

      {/* Notes & Timeline - Admin Only */}
      {isAdmin() && (
        <div className="mt-6">
          <NotesSection
            entityType="company"
            entityId={id}
            showApplicationLabels={true}
          />
        </div>
      )}

      {/* Sticky Save Bar - Only show when editing */}
      {isEditing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>You have unsaved changes</span>
                  </div>
                )}
                {!hasUnsavedChanges && (
                  <div className="text-sm text-gray-500">
                    No changes made
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={handleCancel}>
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

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Discard Changes?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowCancelModal(false)}
            >
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
