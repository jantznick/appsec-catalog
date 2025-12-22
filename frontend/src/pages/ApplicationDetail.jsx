import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { ScoreCard } from '../components/scoring/ScoreCard.jsx';
import { DomainPills } from '../components/domains/DomainPills.jsx';
import useAuthStore from '../store/authStore.js';
import { copyToClipboard, isClipboardAvailable } from '../utils/clipboard.js';

export function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuthStore();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [integrationLevels, setIntegrationLevels] = useState([]);
  const [scores, setScores] = useState(null);
  const [loadingScore, setLoadingScore] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [domains, setDomains] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [technicalFormUrl, setTechnicalFormUrl] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [interfaces, setInterfaces] = useState([]);
  const [originalInterfaces, setOriginalInterfaces] = useState([]);
  const [availableApplications, setAvailableApplications] = useState([]);
  const [loadingApplications, setLoadingApplications] = useState(false);
  const [newInterfaceName, setNewInterfaceName] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    repoUrl: '',
    language: '',
    framework: '',
    serverEnvironment: '',
    facing: '',
    deploymentType: '',
    authProfiles: '',
    dataTypes: '',
    devTeamContact: '',
    securityTestingDescription: '',
    sastTool: '',
    sastIntegrationLevel: '',
    dastTool: '',
    dastIntegrationLevel: '',
    appFirewallTool: '',
    appFirewallIntegrationLevel: '',
    apiSecurityTool: '',
    apiSecurityIntegrationLevel: '',
    apiSecurityNA: false,
    status: 'onboarded',
  });

  useEffect(() => {
    loadIntegrationLevels();
    if (id) {
      loadApplication();
      loadScore();
    }
  }, [id]);

  useEffect(() => {
    if (application && isEditing) {
      loadAvailableApplications();
    }
  }, [application, isEditing]);

  const loadIntegrationLevels = async () => {
    try {
      const levels = await api.getIntegrationLevels();
      setIntegrationLevels(levels);
    } catch (error) {
      console.error('Failed to load integration levels:', error);
    }
  };

  const loadAvailableApplications = async () => {
    if (!application) return;
    
    setLoadingApplications(true);
    try {
      const apps = await api.getApplications();
      // For non-admin users, API already filters by company, so we just need to exclude current app
      // For admin users, we filter to same company in frontend
      const filtered = apps.filter(app => 
        app.id !== application.id &&
        (isAdmin() ? app.companyId === application.companyId : true)
      );
      setAvailableApplications(filtered);
    } catch (error) {
      console.error('Failed to load applications:', error);
      toast.error('Failed to load available applications');
    } finally {
      setLoadingApplications(false);
    }
  };

  const toggleInterface = (appName) => {
    if (interfaces.includes(appName)) {
      removeInterface(appName);
    } else {
      addInterface(appName);
    }
  };

  const addInterface = (name) => {
    if (name && name.trim() && !interfaces.includes(name.trim())) {
      const newInterfaces = [...interfaces, name.trim()];
      setInterfaces(newInterfaces);
      if (isEditing && originalFormData) {
        const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(originalFormData);
        const hasInterfaceChanges = JSON.stringify(newInterfaces.sort()) !== JSON.stringify(originalInterfaces.sort());
        setHasUnsavedChanges(hasFormChanges || hasInterfaceChanges);
      } else {
        setHasUnsavedChanges(true);
      }
    }
  };

  const removeInterface = (name) => {
    const newInterfaces = interfaces.filter(i => i !== name);
    setInterfaces(newInterfaces);
    if (isEditing && originalFormData) {
      const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(originalFormData);
      const hasInterfaceChanges = JSON.stringify(newInterfaces.sort()) !== JSON.stringify(originalInterfaces.sort());
      setHasUnsavedChanges(hasFormChanges || hasInterfaceChanges);
    } else {
      setHasUnsavedChanges(true);
    }
  };

  const handleAddNewInterface = () => {
    if (newInterfaceName.trim()) {
      addInterface(newInterfaceName.trim());
      setNewInterfaceName('');
    }
  };

  const loadScore = async () => {
    try {
      setLoadingScore(true);
      const scoreData = await api.getApplicationScore(id);
      setScores(scoreData);
    } catch (error) {
      console.error('Failed to load score:', error);
    } finally {
      setLoadingScore(false);
    }
  };

  const handleMarkReviewed = async () => {
    try {
      await api.markApplicationReviewed(id);
      toast.success('Application marked as reviewed');
      // Reload application and score
      await loadApplication();
      await loadScore();
    } catch (error) {
      toast.error(error.message || 'Failed to mark as reviewed');
      throw error;
    }
  };

  const handleStatusChange = async (newStatus) => {
    try {
      setChangingStatus(true);
      await api.updateApplication(id, { status: newStatus });
      toast.success('Application status updated successfully');
      await loadApplication();
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setChangingStatus(false);
    }
  };

  const handleAddDomain = async (domainName) => {
    try {
      const result = await api.addDomainToApplication(id, domainName);
      setDomains(result.domains);
      toast.success('Hosting domain added successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to add hosting domain');
      throw error;
    }
  };

  const handleRemoveDomain = async (domainId) => {
    try {
      const result = await api.removeDomainFromApplication(id, domainId);
      setDomains(result.domains);
      toast.success('Hosting domain removed successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to remove hosting domain');
    }
  };

  const loadApplication = async () => {
    try {
      setLoading(true);
      const data = await api.getApplication(id);
      setApplication(data);
      
      // Set domains from application data
      setDomains(data.domains || []);
      
      // Parse interfaces if they exist
      let interfaceNames = [];
      if (data.interfaces) {
        try {
          const interfaceIds = JSON.parse(data.interfaces);
          // Load interface application names
          if (Array.isArray(interfaceIds) && interfaceIds.length > 0) {
            const interfaceApps = await Promise.all(
              interfaceIds.map(async (appId) => {
                try {
                  const app = await api.getApplication(appId);
                  return app.name;
                } catch (e) {
                  return null;
                }
              })
            );
            interfaceNames = interfaceApps.filter(name => name !== null);
          }
        } catch (e) {
          // If not JSON, treat as string
        }
      }
      setInterfaces(interfaceNames);

      const newFormData = {
        name: data.name || '',
        description: data.description || '',
        repoUrl: data.repoUrl || '',
        language: data.language || '',
        framework: data.framework || '',
        serverEnvironment: data.serverEnvironment || '',
        facing: data.facing || '',
        deploymentType: data.deploymentType || '',
        authProfiles: data.authProfiles || '',
        dataTypes: data.dataTypes || '',
        devTeamContact: data.devTeamContact || '',
        securityTestingDescription: data.securityTestingDescription || '',
        sastTool: data.sastTool || '',
        sastIntegrationLevel: data.sastIntegrationLevel?.toString() || '',
        dastTool: data.dastTool || '',
        dastIntegrationLevel: data.dastIntegrationLevel?.toString() || '',
        appFirewallTool: data.appFirewallTool || '',
        appFirewallIntegrationLevel: data.appFirewallIntegrationLevel?.toString() || '',
        apiSecurityTool: data.apiSecurityTool || '',
        apiSecurityIntegrationLevel: data.apiSecurityIntegrationLevel?.toString() || '',
        apiSecurityNA: data.apiSecurityNA || false,
        status: data.status || 'onboarded',
      };
      setFormData(newFormData);
      setInterfaces(interfaceNames);
      if (!isEditing) {
        setOriginalFormData(JSON.parse(JSON.stringify(newFormData)));
        setOriginalInterfaces([...interfaceNames]);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      toast.error('Failed to load application');
      console.error(error);
      navigate('/applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateApplication(id, {
        ...formData,
        interfaces: interfaces, // Include interfaces in the update
      });
      toast.success('Application updated successfully');
      setIsEditing(false);
      setHasUnsavedChanges(false);
      // Reload both application data and score
      await loadApplication();
      await loadScore();
    } catch (error) {
      toast.error(error.message || 'Failed to update application');
    } finally {
      setSaving(false);
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
      setInterfaces([...originalInterfaces]);
    } else {
      loadApplication();
    }
  };

  const handleFieldChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);
    if (isEditing && originalFormData) {
      const hasFormChanges = JSON.stringify(newFormData) !== JSON.stringify(originalFormData);
      const hasInterfaceChanges = JSON.stringify(interfaces.sort()) !== JSON.stringify(originalInterfaces.sort());
      setHasUnsavedChanges(hasFormChanges || hasInterfaceChanges);
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setOriginalFormData(JSON.parse(JSON.stringify(formData)));
    setOriginalInterfaces([...interfaces]);
    setHasUnsavedChanges(false);
  };

  const canEdit = () => {
    if (isAdmin()) return true;
    if (application && user?.companyId === application.companyId) return true;
    return false;
  };

  const handleGenerateTechnicalFormLink = async () => {
    if (!application) return;

    setGeneratingLink(true);
    try {
      const result = await api.generateTechnicalFormLink(application.id);
      setTechnicalFormUrl(result.technicalFormUrl);
      
      // Update the application with the new company slug if it was generated
      if (result.companySlug && application.company) {
        setApplication(prev => ({
          ...prev,
          company: { ...prev.company, slug: result.companySlug }
        }));
      }
      
      toast.success('Technical form link generated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to generate technical form link');
      console.error('Error generating link:', error);
    } finally {
      setGeneratingLink(false);
    }
  };

  const getTechnicalFormUrl = () => {
    if (technicalFormUrl) return technicalFormUrl;
    if (application?.company?.slug && application?.id) {
      return `${window.location.origin}/onboard/${application.company.slug}/application/${application.id}`;
    }
    return null;
  };

  const handleDeleteApplication = async () => {
    if (!application) return;
    if (deleteConfirmText !== `delete ${application.name}`) {
      return;
    }

    setDeleting(true);
    try {
      await api.deleteApplication(application.id);
      toast.success(`Application "${application.name}" deleted successfully`);
      navigate('/applications');
    } catch (error) {
      toast.error(error.message || 'Failed to delete application');
      console.error('Error deleting application:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading application..." />;
  }

  if (!application) {
    return null;
  }

  return (
    <div className={isEditing ? 'pb-24' : ''}>
      <div className="mb-8">
        <button
          onClick={() => navigate('/applications')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Applications
        </button>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2 flex-wrap">
              <h1 className="text-3xl font-bold text-gray-900">{application.name}</h1>
              <div className="flex items-center gap-2 text-sm">
                {getTechnicalFormUrl() ? (
                  <>
                    <span className="text-gray-600 font-medium">Technical Onboarding Form:</span>
                    <div className="flex items-center gap-2">
                      <Input
                        value={getTechnicalFormUrl()}
                        readOnly
                        className="font-mono text-sm w-96"
                        onClick={(e) => e.target.select()}
                      />
                      {isClipboardAvailable() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = getTechnicalFormUrl();
                            if (url) {
                              copyToClipboard(
                                url,
                                () => toast.success('Link copied to clipboard'),
                                (error) => toast.error(error)
                              );
                            }
                          }}
                        >
                          Copy
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateTechnicalFormLink}
                    disabled={generatingLink}
                  >
                    {generatingLink ? 'Generating...' : 'Generate Technical Form Link'}
                  </Button>
                )}
              </div>
            </div>
            <p className="text-gray-600">
              {application.company?.name && `Company: ${application.company.name}`}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {canEdit() && !isEditing && (
              <Button variant="primary" onClick={handleEditClick}>
                Edit Application
              </Button>
            )}
            {isAdmin() && (
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteModalOpen(true);
                  setDeleteConfirmText('');
                }}
              >
                Delete Application
              </Button>
            )}
            <div className="flex items-center gap-4">
              {canEdit() ? (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <select
                    value={application.status || 'onboarded'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={changingStatus}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="pending_executive">Pending Executive</option>
                    <option value="pending_technical">Pending Technical</option>
                    <option value="onboarded">Onboarded</option>
                  </select>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Status:</span>{' '}
                  <span className="capitalize">{application.status?.replace('_', ' ') || 'Onboarded'}</span>
                </div>
              )}
              {application.metadataLastReviewed && (
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Last Reviewed:</span>{' '}
                  {new Date(application.metadataLastReviewed).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Score Card - Full Width */}
      {scores && (
        <div className="mb-6">
          <ScoreCard
            knowledgeScore={scores.knowledgeScore}
            toolScore={scores.toolScore}
            totalScore={scores.totalScore}
            breakdown={scores.breakdown}
            onMarkReviewed={handleMarkReviewed}
            isAdmin={isAdmin()}
            lastReviewed={application.metadataLastReviewed}
            showBreakdownByDefault={true}
          />
        </div>
      )}

      {/* Application Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Application Name"
                value={formData.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                disabled={!isEditing}
                required
              />
              <Textarea
                label="Description / Use Case"
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                disabled={!isEditing}
                rows={3}
              />
              <Input
                label="Repository URL"
                type="url"
                value={formData.repoUrl}
                onChange={(e) => handleFieldChange('repoUrl', e.target.value)}
                disabled={!isEditing}
              />
              <Textarea
                label="Development Team Contact Info"
                value={formData.devTeamContact}
                onChange={(e) => handleFieldChange('devTeamContact', e.target.value)}
                disabled={!isEditing}
                rows={3}
                placeholder="Name, email, phone, etc. (can include multiple contacts)"
                helperText="Contact information for the development team"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Language"
                  value={formData.language}
                  onChange={(e) => handleFieldChange('language', e.target.value)}
                  disabled={!isEditing}
                />
                <Input
                  label="Framework"
                  value={formData.framework}
                  onChange={(e) => handleFieldChange('framework', e.target.value)}
                  disabled={!isEditing}
                />
                <Select
                  label="Server Environment"
                  value={formData.serverEnvironment || ''}
                  onChange={(e) => handleFieldChange('serverEnvironment', e.target.value)}
                  disabled={!isEditing}
                  options={[
                    { value: '', label: 'Select environment' },
                    { value: 'Cloud', label: 'Cloud' },
                    { value: 'On-prem', label: 'On-prem' },
                    { value: 'Both', label: 'Both' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Facing"
                  value={formData.facing || ''}
                  onChange={(e) => handleFieldChange('facing', e.target.value)}
                  disabled={!isEditing}
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
                  disabled={!isEditing}
                />
              </div>
              <Input
                label="Auth Profiles"
                value={formData.authProfiles}
                onChange={(e) => handleFieldChange('authProfiles', e.target.value)}
                disabled={!isEditing}
              />
              <Input
                label="Data Types"
                value={formData.dataTypes}
                onChange={(e) => handleFieldChange('dataTypes', e.target.value)}
                disabled={!isEditing}
              />
              <DomainPills
                domains={domains}
                onAdd={handleAddDomain}
                onRemove={handleRemoveDomain}
                disabled={!canEdit()}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Interfaces with Other Applications */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Interfaces with Other Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div className="space-y-4">
              {/* Available Applications Pills */}
              {loadingApplications ? (
                <p className="text-sm text-gray-500">Loading applications...</p>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select from existing applications:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableApplications.map((app) => {
                      const isSelected = interfaces.includes(app.name);
                      return (
                        <button
                          key={app.id}
                          type="button"
                          onClick={() => toggleInterface(app.name)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {app.name}
                        </button>
                      );
                    })}
                    {availableApplications.length === 0 && (
                      <p className="text-sm text-gray-500">No other applications available</p>
                    )}
                  </div>
                </div>
              )}

              {/* Add New Interface */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Or add a new application name:
                </label>
                <div className="flex gap-2">
                  <Input
                    value={newInterfaceName}
                    onChange={(e) => setNewInterfaceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newInterfaceName.trim()) {
                        e.preventDefault();
                        handleAddNewInterface();
                      }
                    }}
                    placeholder="Type application name and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddNewInterface}
                    disabled={!newInterfaceName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Selected Interfaces */}
              {interfaces.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selected interfaces:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {interfaces.map((name, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeInterface(name)}
                          className="ml-2 text-blue-600 hover:text-blue-800 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              {interfaces.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {interfaces.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No interfaces configured</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Tools - Full Width */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Security Tools</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Security Testing Description */}
            <div>
              <Textarea
                label="Security Testing Description"
                value={formData.securityTestingDescription}
                onChange={(e) => handleFieldChange('securityTestingDescription', e.target.value)}
                disabled={!isEditing}
                rows={12}
                placeholder="Describe the security testing practices, tools, and processes"
                helperText="Information about security testing in place"
              />
            </div>
            
            {/* Right Column: Security Tools */}
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="SAST Tool"
                    value={formData.sastTool}
                    onChange={(e) => handleFieldChange('sastTool', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Select
                    label="SAST Integration Level"
                    value={formData.sastIntegrationLevel}
                    onChange={(e) => handleFieldChange('sastIntegrationLevel', e.target.value)}
                    disabled={!isEditing}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="DAST Tool"
                    value={formData.dastTool}
                    onChange={(e) => handleFieldChange('dastTool', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Select
                    label="DAST Integration Level"
                    value={formData.dastIntegrationLevel}
                    onChange={(e) => handleFieldChange('dastIntegrationLevel', e.target.value)}
                    disabled={!isEditing}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="App Firewall Tool"
                    value={formData.appFirewallTool}
                    onChange={(e) => handleFieldChange('appFirewallTool', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Select
                    label="App Firewall Integration Level"
                    value={formData.appFirewallIntegrationLevel}
                    onChange={(e) => handleFieldChange('appFirewallIntegrationLevel', e.target.value)}
                    disabled={!isEditing}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="API Security Tool"
                    value={formData.apiSecurityTool}
                    onChange={(e) => handleFieldChange('apiSecurityTool', e.target.value)}
                    disabled={!isEditing}
                  />
                  <Select
                    label="API Security Integration Level"
                    value={formData.apiSecurityIntegrationLevel}
                    onChange={(e) => handleFieldChange('apiSecurityIntegrationLevel', e.target.value)}
                    disabled={!isEditing}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <Checkbox
                  id="apiSecurityNA"
                  label="API Security Not Applicable"
                  checked={formData.apiSecurityNA}
                  onChange={(e) => handleFieldChange('apiSecurityNA', e.target.checked)}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </CardContent>
        </Card>

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

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteConfirmText('');
        }}
        title="Delete Application"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteModalOpen(false);
                setDeleteConfirmText('');
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteApplication}
              disabled={deleteConfirmText !== `delete ${application?.name || ''}` || deleting}
              loading={deleting}
            >
              Delete
            </Button>
          </>
        }
      >
        {application && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete <strong>{application.name}</strong>?
            </p>
            <p className="text-sm text-red-600">
              This action cannot be undone. All data associated with this application will be permanently deleted.
            </p>
            <div className="mt-4">
              <Input
                label={`Type "delete ${application.name}" to confirm`}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={`delete ${application.name}`}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                You must type the exact text above to confirm deletion
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

