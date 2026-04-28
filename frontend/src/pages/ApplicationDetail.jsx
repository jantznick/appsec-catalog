import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { CICDDeploymentView } from '../components/deployments/CICDDeploymentView.jsx';
import { NotesSection } from '../components/notes/NotesSection.jsx';
import { VersionHistory } from '../components/versions/VersionHistory.jsx';
import { Tabs, Tab, TabPanel } from '../components/ui/Tabs.jsx';
import { PolicyComplianceView } from '../components/policy/PolicyComplianceView.jsx';
import { ApplicationIntegrationsSection } from '../components/integrations/ApplicationIntegrationsSection.jsx';

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
  const [notesRefreshTrigger, setNotesRefreshTrigger] = useState(0);
  const [pendingVersionsCount, setPendingVersionsCount] = useState(0);
  const [policyCompliance, setPolicyCompliance] = useState(null);
  const [loadingCompliance, setLoadingCompliance] = useState(false);

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
    businessCriticality: '',
    criticalAspects: '',
    securityTestingDescription: '',
    sastTool: '',
    sastIntegrationLevel: '',
    sastIncludesSca: false,
    dastTool: '',
    dastIntegrationLevel: '',
    scaTool: '',
    scaIntegrationLevel: '',
    appFirewallTool: '',
    appFirewallIntegrationLevel: '',
    apiSecurityTool: '',
    apiSecurityIntegrationLevel: '',
    apiSecurityNA: false,
    appFirewallNA: false,
    status: 'onboarded',
    currentVersion: '',
    deploymentEnvironment: '',
    gitBranch: '',
    lastDastScanDate: '',
    lastSastScanDate: '',
    lastScaScanDate: '',
  });

  const [allDeployments, setAllDeployments] = useState([]);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [showDeploymentForm, setShowDeploymentForm] = useState(false);
  const [deploymentFormView, setDeploymentFormView] = useState('manual'); // 'manual' or 'cicd'
  const [deploymentHistoryExpanded, setDeploymentHistoryExpanded] = useState(true);
  const [deploymentPage, setDeploymentPage] = useState(1);
  const deploymentsPerPage = 5;
  const [deploymentEnvironmentFilter, setDeploymentEnvironmentFilter] = useState('');
  const [deleteDeploymentId, setDeleteDeploymentId] = useState(null);
  const [deletingDeployment, setDeletingDeployment] = useState(false);
  const [deploymentTokens, setDeploymentTokens] = useState([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [creatingToken, setCreatingToken] = useState(false);
  const [selectedTokenForApp, setSelectedTokenForApp] = useState('');
  const [addingToToken, setAddingToToken] = useState(false);
  const [newDeployment, setNewDeployment] = useState({
    deployedAt: new Date().toISOString().split('T')[0],
    environment: '',
    version: '',
    gitBranch: '',
    deployedBy: '',
    notes: '',
  });

  const loadPendingVersionsCount = useCallback(async () => {
    if (!id || !user?.isAdmin) {
      setPendingVersionsCount(0);
      return;
    }
    try {
      const data = await api.getPendingVersionsCountForApplication(id);
      const count = data.count || 0;
      console.log('Pending versions count for application:', id, count);
      setPendingVersionsCount(count);
    } catch (error) {
      console.error('Failed to load pending versions count:', error);
      setPendingVersionsCount(0);
    }
  }, [id, user?.isAdmin]);

  useEffect(() => {
    loadIntegrationLevels();
    if (id) {
      loadApplication();
      loadScore();
      loadDeployments();
      loadDeploymentTokens();
    }
  }, [id]);

  useEffect(() => {
    if (id && user?.isAdmin) {
      loadPendingVersionsCount();
      const interval = setInterval(loadPendingVersionsCount, 30000);
      return () => clearInterval(interval);
    } else {
      setPendingVersionsCount(0);
    }
  }, [id, user?.isAdmin, loadPendingVersionsCount]);

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

  const getIntegrationLevelName = (levelValue) => {
    if (!levelValue && levelValue !== 0) return null;
    const level = integrationLevels.find(l => l.value === String(levelValue));
    return level ? level.label : null;
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

  const loadDeployments = async () => {
    if (!id) return;
    try {
      setLoadingDeployments(true);
      const data = await api.getDeployments(id);
      setAllDeployments(data);
      // Reset to first page and clear filter when loading new data
      setDeploymentPage(1);
      setDeploymentEnvironmentFilter('');
    } catch (error) {
      console.error('Failed to load deployments:', error);
      toast.error('Failed to load deployments');
    } finally {
      setLoadingDeployments(false);
    }
  };

  // Filter deployments by environment
  const filteredDeployments = deploymentEnvironmentFilter
    ? allDeployments.filter(d => d.environment === deploymentEnvironmentFilter)
    : allDeployments;

  // Get unique environments from all deployments
  const availableEnvironments = [...new Set(allDeployments.map(d => d.environment))].sort();

  // Format environment label for display
  const formatEnvironmentLabel = (env) => {
    if (!env) return '';
    // Capitalize first letter, handle special cases
    const formatted = env.charAt(0).toUpperCase() + env.slice(1).toLowerCase();
    // Handle special cases like "qa" -> "QA"
    if (env.toLowerCase() === 'qa') return 'QA';
    return formatted;
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredDeployments.length / deploymentsPerPage);
  const startIndex = (deploymentPage - 1) * deploymentsPerPage;
  const endIndex = startIndex + deploymentsPerPage;
  const deployments = filteredDeployments.slice(startIndex, endIndex);

  const deploymentPendingDelete = deleteDeploymentId
    ? allDeployments.find((d) => d.id === deleteDeploymentId)
    : null;

  const handleCreateDeployment = async () => {
    if (!newDeployment.environment || !newDeployment.environment.trim()) {
      toast.error('Environment is required');
      return;
    }

    try {
      await api.createDeployment(id, {
        ...newDeployment,
        deployedAt: newDeployment.deployedAt || new Date().toISOString(),
      });
      toast.success('Deployment added successfully');
      setShowDeploymentForm(false);
      setNewDeployment({
        deployedAt: new Date().toISOString().split('T')[0],
        environment: '',
        version: '',
        gitBranch: '',
        deployedBy: '',
        notes: '',
      });
      await loadDeployments();
    } catch (error) {
      toast.error(error.message || 'Failed to create deployment');
    }
  };

  const confirmDeleteDeployment = async () => {
    if (!deleteDeploymentId) return;
    setDeletingDeployment(true);
    try {
      await api.deleteDeployment(id, deleteDeploymentId);
      toast.success('Deployment deleted successfully');
      setDeleteDeploymentId(null);
      await loadDeployments();
    } catch (error) {
      toast.error(error.message || 'Failed to delete deployment');
    } finally {
      setDeletingDeployment(false);
    }
  };

  const loadDeploymentTokens = async () => {
    if (!id) return;
    try {
      setLoadingTokens(true);
      const tokens = await api.getDeploymentTokensForApplication(id);
      setDeploymentTokens(tokens);
    } catch (error) {
      console.error('Failed to load deployment tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  const loadAllDeploymentTokens = async () => {
    try {
      const tokens = await api.getDeploymentTokens();
      return tokens.filter(t => !t.revokedAt); // Only active tokens
    } catch (error) {
      console.error('Failed to load all deployment tokens:', error);
      return [];
    }
  };

  const handleCreateToken = async () => {
    if (!newTokenName || !newTokenName.trim()) {
      toast.error('Token name is required');
      return null;
    }

    try {
      setCreatingToken(true);
      const token = await api.createDeploymentToken(id, newTokenName.trim());
      toast.success('Deployment token created successfully');
      setNewTokenName('');
      await loadDeploymentTokens();
      // Return the token with plaintextToken for display
      return { ...token, plaintextToken: token.token };
    } catch (error) {
      toast.error(error.message || 'Failed to create deployment token');
      return null;
    } finally {
      setCreatingToken(false);
    }
  };

  const handleAddToExistingToken = async () => {
    if (!selectedTokenForApp) {
      toast.error('Please select a token');
      return;
    }

    try {
      setAddingToToken(true);
      const token = await api.getDeploymentToken(selectedTokenForApp);
      const currentAppIds = token.applications.map(a => a.application.id);
      if (!currentAppIds.includes(id)) {
        await api.updateDeploymentToken(selectedTokenForApp, {
          applicationIds: [...currentAppIds, id],
        });
        toast.success('Application added to token successfully');
        await loadDeploymentTokens();
      } else {
        toast.info('Application is already associated with this token');
      }
      setSelectedTokenForApp('');
    } catch (error) {
      toast.error(error.message || 'Failed to add application to token');
    } finally {
      setAddingToToken(false);
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
      // Refresh notes to show the new review note
      setNotesRefreshTrigger(prev => prev + 1);
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
        businessCriticality: data.businessCriticality?.toString() || '',
        criticalAspects: data.criticalAspects || '',
        securityTestingDescription: data.securityTestingDescription || '',
        sastTool: data.sastTool || '',
        sastIntegrationLevel: data.sastIntegrationLevel?.toString() || '',
        sastIncludesSca: !!data.sastIncludesSca,
        dastTool: data.dastTool || '',
        dastIntegrationLevel: data.dastIntegrationLevel?.toString() || '',
        scaTool: data.scaTool || '',
        scaIntegrationLevel: data.scaIntegrationLevel?.toString() || '',
        appFirewallTool: data.appFirewallTool || '',
        appFirewallIntegrationLevel: data.appFirewallIntegrationLevel?.toString() || '',
        apiSecurityTool: data.apiSecurityTool || '',
        apiSecurityIntegrationLevel: data.apiSecurityIntegrationLevel?.toString() || '',
        apiSecurityNA: data.apiSecurityNA || false,
        appFirewallNA: data.appFirewallNA || false,
        status: data.status || 'onboarded',
        currentVersion: data.currentVersion || '',
        deploymentEnvironment: data.deploymentEnvironment || '',
        gitBranch: data.gitBranch || '',
        lastDastScanDate: data.lastDastScanDate ? new Date(data.lastDastScanDate).toISOString().split('T')[0] : '',
        lastSastScanDate: data.lastSastScanDate ? new Date(data.lastSastScanDate).toISOString().split('T')[0] : '',
        lastScaScanDate: data.lastScaScanDate ? new Date(data.lastScaScanDate).toISOString().split('T')[0] : '',
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
      // Refresh pending count after application loads
      if (isAdmin()) {
        loadPendingVersionsCount();
      }
    }
  };

  const loadPolicyCompliance = async () => {
    if (!id) return;
    try {
      setLoadingCompliance(true);
      const data = await api.getApplicationPolicyCompliance(id);
      setPolicyCompliance(data);
    } catch (error) {
      console.error('Failed to load policy compliance:', error);
      // Don't show toast error here - it's not critical if it fails
    } finally {
      setLoadingCompliance(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.updateApplication(id, {
        ...formData,
        businessCriticality: formData.businessCriticality ? parseInt(formData.businessCriticality) : null,
        interfaces: interfaces, // Include interfaces in the update
      });
      toast.success('Application updated successfully');
      setIsEditing(false);
      setHasUnsavedChanges(false);
      // Reload both application data and score
      await loadApplication();
      await loadScore();
      // Reload policy compliance to reflect any changes
      await loadPolicyCompliance();
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

  const handleFieldClick = (e) => {
    if (!canEdit() || isEditing) {
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
    
    // Try to focus the field that was clicked on
    const input = e.target.closest('input, select, textarea');
    if (input) {
      setTimeout(() => {
        input.focus();
        if (input.type === 'text' || input.type === 'url' || input.tagName === 'TEXTAREA') {
          input.select();
        }
      }, 10);
    }
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
              {application.company?.name && (
                <>
                  Company:{' '}
                  <Link
                    to={`/companies/${application.company.id}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {application.company.name}
                  </Link>
                </>
              )}
              {application.product?.name && (
                <> {' • '}
                  <span className="text-gray-600 font-medium">Product: </span>
                  <Link
                    to={`/products/${application.product.id}`}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    {application.product.name}
                  </Link>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3 items-center">
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
              <div className="flex items-center gap-2 text-sm text-gray-600">
                {application.metadataLastReviewed ? (
                  <>
                    <span className="font-medium text-gray-700">Last Reviewed:</span>{' '}
                    {new Date(application.metadataLastReviewed).toLocaleDateString()}
                  </>
                ) : (
                  <span className="text-gray-500 italic">Not reviewed</span>
                )}
                {isAdmin() && (
                  <button
                    onClick={() => {
                      setDeleteModalOpen(true);
                      setDeleteConfirmText('');
                    }}
                    className="ml-2 p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
                    title="Delete Application"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
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

      {/* Tabs for organized content */}
      <Tabs defaultTab={0}>
        <Tab>App Data</Tab>
        <Tab>Deployments</Tab>
        {isAdmin() && <Tab>App Timeline</Tab>}
        <Tab>Security</Tab>
        <Tab>Infosec Policy Compliance</Tab>
        {isAdmin() && <Tab badge={pendingVersionsCount}>Application Metadata History</Tab>}
        <Tab>Integrations</Tab>

        {/* App Data Tab */}
        <TabPanel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Basic Information
                  {canEdit() && !isEditing && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                  )}
                  </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                {canEdit() && !isEditing && (
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
                        label="Application Name"
                        value={formData.name}
                        onChange={(e) => handleFieldChange('name', e.target.value)}
                        required
                      />
                      <Textarea
                        label="Description / Use Case"
                        value={formData.description}
                        onChange={(e) => handleFieldChange('description', e.target.value)}
                        rows={3}
                      />

                      {/* Repository and Contact Section */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Repository & Contact
                        </h5>
                        <div className="space-y-4">
                          <Input
                            label="Repository URL"
                            type="url"
                            value={formData.repoUrl}
                            onChange={(e) => handleFieldChange('repoUrl', e.target.value)}
                          />
                          <Textarea
                            label="Development Team Contact Info"
                            value={formData.devTeamContact}
                            onChange={(e) => handleFieldChange('devTeamContact', e.target.value)}
                            rows={3}
                            placeholder="Name, email, phone, etc. (can include multiple contacts)"
                            helperText="Contact information for the development team"
                          />
                        </div>
                      </div>

                      {/* Business Criticality Section */}
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <h5 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Business Criticality
                        </h5>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Business Criticality (1-5, 5 being most critical)
                            </label>
                            <Select
                              value={formData.businessCriticality || ''}
                              onChange={(e) => handleFieldChange('businessCriticality', e.target.value)}
                              options={[
                                { value: '', label: 'Select criticality' },
                                { value: '1', label: '1 - Low' },
                                { value: '2', label: '2' },
                                { value: '3', label: '3 - Medium' },
                                { value: '4', label: '4' },
                                { value: '5', label: '5 - Most Critical' },
                              ]}
                            />
                          </div>
                          <Input
                            label="Critical Aspects"
                            value={formData.criticalAspects}
                            onChange={(e) => handleFieldChange('criticalAspects', e.target.value)}
                            placeholder="e.g., Availability, Data Handling, Confidentiality, Integrity"
                            helperText="Comma-separated list of critical aspects"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Application Name</label>
                        <p className="text-base text-gray-900 font-medium">{formData.name || <span className="text-gray-400 italic">Not set</span>}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Description / Use Case</label>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                            {formData.description || <span className="text-gray-400 italic">Not set</span>}
                          </p>
                        </div>
                      </div>

                      {/* Repository and Contact Section */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Repository & Contact
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Repository URL:</span>
                            {formData.repoUrl ? (
                              <a 
                                href={formData.repoUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 underline text-sm mt-0.5 block"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                {formData.repoUrl}
                              </a>
                            ) : (
                              <p className="text-sm text-gray-400 italic mt-0.5">Not set</p>
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Development Team Contact Info:</span>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 mt-1">
                              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">
                                {formData.devTeamContact || <span className="text-gray-400 italic">Not set</span>}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Business Criticality Section */}
                      <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                        <h5 className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Business Criticality
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Business Criticality:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">
                              {formData.businessCriticality ? `${formData.businessCriticality}/5` : <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Critical Aspects:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.criticalAspects || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  Technical Information
                  {canEdit() && !isEditing && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="relative">
                {canEdit() && !isEditing && (
                  <div
                    onClick={handleFieldClick}
                    className="absolute inset-0 z-10 cursor-pointer"
                    style={{ backgroundColor: 'transparent' }}
                  />
                )}
                <div className="space-y-4">
                  {isEditing ? (
                    <div className="space-y-5">
                      {/* Tech Stack Section */}
                      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                        <h5 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          Tech Stack
                        </h5>
                        <div className="grid grid-cols-3 gap-4">
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
                          <Input
                            label="Server Environment"
                            value={formData.serverEnvironment || ''}
                            onChange={(e) => handleFieldChange('serverEnvironment', e.target.value)}
                            placeholder="e.g. cloud, on-premises, hybrid"
                          />
                        </div>
                      </div>

                      {/* Deployment Info Section */}
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h5 className="text-sm font-semibold text-teal-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Deployment Information
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            label="Current Version"
                            value={formData.currentVersion}
                            onChange={(e) => handleFieldChange('currentVersion', e.target.value)}
                            placeholder="e.g., 1.2.3, v2.1.0"
                            helperText="Auto-populated from most recent deployment (can be overridden)"
                          />
                          <div></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
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
                        </div>
                      </div>

                      {/* Security & Data Section */}
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h5 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Security & Data
                        </h5>
                        <div className="space-y-4">
                          <Input
                            label="Auth Profiles"
                            value={formData.authProfiles}
                            onChange={(e) => handleFieldChange('authProfiles', e.target.value)}
                          />
                          <Input
                            label="Data Types"
                            value={formData.dataTypes}
                            onChange={(e) => handleFieldChange('dataTypes', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Domains Section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Hosting Domains</label>
                        <DomainPills
                          domains={domains}
                          onAdd={handleAddDomain}
                          onRemove={handleRemoveDomain}
                          disabled={false}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {/* Tech Stack Section */}
                      <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                        <h5 className="text-sm font-semibold text-indigo-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                          </svg>
                          Tech Stack
                        </h5>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Language:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.language || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Framework:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.framework || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Server Environment:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.serverEnvironment || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                        </div>
                      </div>

                      {/* Deployment Info Section */}
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h5 className="text-sm font-semibold text-teal-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          Deployment Information
                        </h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Current Version:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.currentVersion || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Facing:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.facing || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Deployment Type:</span>
                            <p className="text-sm text-gray-900 mt-0.5 font-medium">{formData.deploymentType || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                        </div>
                      </div>

                      {/* Security & Data Section */}
                      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                        <h5 className="text-sm font-semibold text-amber-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Security & Data
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Auth Profiles:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.authProfiles || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Data Types:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.dataTypes || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                        </div>
                      </div>

                      {/* Domains Section */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Hosting Domains</label>
                        <DomainPills
                          domains={domains}
                          onAdd={handleAddDomain}
                          onRemove={handleRemoveDomain}
                          disabled={!canEdit()}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interfaces with Other Applications */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>
                Interfaces with Other Applications
                {canEdit() && !isEditing && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {canEdit() && !isEditing && (
                <div
                  onClick={handleFieldClick}
                  className="absolute inset-0 z-10 cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                />
              )}
              <div>
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
                    <div className="text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-500">No interfaces configured</p>
                    </div>
                  )}
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Deployments Tab */}
        <TabPanel>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Deployment History</h3>
                <div className="flex items-center gap-2">
                  {canEdit() && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeploymentForm(true)}
                      title="Add Deployment"
                    >
                      Add Deployment
                    </Button>
                  )}
                  {availableEnvironments.length > 0 && (
                    <select
                      value={deploymentEnvironmentFilter}
                      onChange={(e) => {
                        setDeploymentEnvironmentFilter(e.target.value);
                        setDeploymentPage(1);
                      }}
                      className="text-sm border border-gray-300 rounded px-2 py-1 bg-white"
                      title="Filter by environment"
                    >
                      <option value="">All Environments</option>
                      {availableEnvironments.map(env => (
                        <option key={env} value={env}>{formatEnvironmentLabel(env)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              {loadingDeployments ? (
                <p className="text-sm text-gray-500">Loading deployments...</p>
              ) : allDeployments.length === 0 ? (
                <p className="text-sm text-gray-500">No deployments recorded yet.</p>
              ) : filteredDeployments.length === 0 ? (
                <p className="text-sm text-gray-500">No deployments found for the selected environment.</p>
              ) : (
                <>
                  <div className="space-y-3">
                    {deployments.map((deployment) => (
                    <div
                      key={deployment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {new Date(deployment.deployedAt).toLocaleDateString()}
                          </span>
                          <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
                            {deployment.environment}
                          </span>
                          {deployment.version && (
                            <span className="text-sm text-gray-600">v{deployment.version}</span>
                          )}
                          {deployment.gitBranch && (
                            <span className="text-sm text-gray-500">({deployment.gitBranch})</span>
                          )}
                        </div>
                        {deployment.deployedBy && (
                          <p className="text-xs text-gray-500 mt-1">Deployed by: {deployment.deployedBy}</p>
                        )}
                        {deployment.notes && (
                          <p className="text-sm text-gray-600 mt-1">{deployment.notes}</p>
                        )}
                      </div>
                      {canEdit() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteDeploymentId(deployment.id)}
                          className="ml-4"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        Showing {startIndex + 1}-{Math.min(endIndex, filteredDeployments.length)} of {filteredDeployments.length} deployments
                        {deploymentEnvironmentFilter && ` (${allDeployments.length} total)`}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeploymentPage(prev => Math.max(1, prev - 1))}
                          disabled={deploymentPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm text-gray-600">
                          Page {deploymentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeploymentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={deploymentPage === totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabPanel>

        {/* Notes/Timeline Tab - Admin Only */}
        {isAdmin() && (
          <TabPanel>
            <NotesSection
              entityType="application"
              entityId={id}
              showApplicationLabels={false}
              refreshTrigger={notesRefreshTrigger}
            />
          </TabPanel>
        )}

        {/* Security Tab */}
        <TabPanel>
          <Card>
            <CardHeader>
              <CardTitle>
                Security Tools
                {canEdit() && !isEditing && (
                  <span className="ml-2 text-xs text-gray-400 font-normal">(click to edit)</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              {canEdit() && !isEditing && (
                <div
                  onClick={handleFieldClick}
                  className="absolute inset-0 z-10 cursor-pointer"
                  style={{ backgroundColor: 'transparent' }}
                />
              )}
              <div className="space-y-8">
                {/* Security Testing Description - Full Width */}
                <div className="border-b border-gray-200 pb-6">
                  {isEditing ? (
                    <Textarea
                      label="Security Testing Description"
                      value={formData.securityTestingDescription}
                      onChange={(e) => handleFieldChange('securityTestingDescription', e.target.value)}
                      rows={6}
                      placeholder="Describe the security testing practices, tools, and processes"
                      helperText="Information about security testing in place"
                    />
                  ) : (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Security Testing Description</label>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <p className="text-gray-900 whitespace-pre-wrap leading-relaxed">
                          {formData.securityTestingDescription || <span className="text-gray-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Security Tools - Grid Layout */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">Security Tools Configuration</h4>
                  {isEditing ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* SAST Section */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3">SAST (Static Analysis)</h5>
                        <div className="space-y-3">
                          <Input
                            label="Tool"
                            value={formData.sastTool}
                            onChange={(e) => handleFieldChange('sastTool', e.target.value)}
                          />
                          <Select
                            label="Integration Level"
                            value={formData.sastIntegrationLevel}
                            onChange={(e) => handleFieldChange('sastIntegrationLevel', e.target.value)}
                            options={[
                              { value: '', label: 'Select level' },
                              ...integrationLevels,
                            ]}
                          />
                          <Input
                            label="Last Scan Date"
                            type="date"
                            value={formData.lastSastScanDate}
                            onChange={(e) => handleFieldChange('lastSastScanDate', e.target.value)}
                          />
                          <Checkbox
                            id="sastIncludesSca"
                            label="SAST output includes SCA (dependency) scanning"
                            checked={formData.sastIncludesSca}
                            onChange={(e) => handleFieldChange('sastIncludesSca', e.target.checked)}
                          />
                          <p className="text-xs text-gray-600">
                            When enabled, SCA is scored with the same tool, integration level, and last scan date as SAST.
                          </p>
                        </div>
                      </div>

                      {/* DAST Section */}
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h5 className="text-sm font-semibold text-green-900 mb-3">DAST (Dynamic Analysis)</h5>
                        <div className="space-y-3">
                          <Input
                            label="Tool"
                            value={formData.dastTool}
                            onChange={(e) => handleFieldChange('dastTool', e.target.value)}
                          />
                          <Select
                            label="Integration Level"
                            value={formData.dastIntegrationLevel}
                            onChange={(e) => handleFieldChange('dastIntegrationLevel', e.target.value)}
                            options={[
                              { value: '', label: 'Select level' },
                              ...integrationLevels,
                            ]}
                          />
                          <Input
                            label="Last Scan Date"
                            type="date"
                            value={formData.lastDastScanDate}
                            onChange={(e) => handleFieldChange('lastDastScanDate', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* SCA Section */}
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h5 className="text-sm font-semibold text-teal-900 mb-3">SCA (Software Composition / Dependencies)</h5>
                        {formData.sastIncludesSca ? (
                          <p className="text-sm text-teal-800">
                            SCA is covered by your SAST configuration above (same tool, level, and last scan as SAST).
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <Input
                              label="Tool"
                              value={formData.scaTool}
                              onChange={(e) => handleFieldChange('scaTool', e.target.value)}
                            />
                            <Select
                              label="Integration Level"
                              value={formData.scaIntegrationLevel}
                              onChange={(e) => handleFieldChange('scaIntegrationLevel', e.target.value)}
                              options={[
                                { value: '', label: 'Select level' },
                                ...integrationLevels,
                              ]}
                            />
                            <Input
                              label="Last Scan Date"
                              type="date"
                              value={formData.lastScaScanDate}
                              onChange={(e) => handleFieldChange('lastScaScanDate', e.target.value)}
                            />
                          </div>
                        )}
                      </div>

                      {/* App Firewall Section */}
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <h5 className="text-sm font-semibold text-purple-900 mb-3">Application Firewall</h5>
                        <div className="space-y-3">
                          <Input
                            label="Tool"
                            value={formData.appFirewallTool}
                            onChange={(e) => handleFieldChange('appFirewallTool', e.target.value)}
                          />
                          <Select
                            label="Integration Level"
                            value={formData.appFirewallIntegrationLevel}
                            onChange={(e) => handleFieldChange('appFirewallIntegrationLevel', e.target.value)}
                            options={[
                              { value: '', label: 'Select level' },
                              ...integrationLevels,
                            ]}
                          />
                          <Checkbox
                            id="appFirewallNA"
                            label="Not Applicable"
                            checked={formData.appFirewallNA}
                            onChange={(e) => handleFieldChange('appFirewallNA', e.target.checked)}
                          />
                        </div>
                      </div>

                      {/* API Security Section */}
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <h5 className="text-sm font-semibold text-orange-900 mb-3">API Security</h5>
                        <div className="space-y-3">
                          <Input
                            label="Tool"
                            value={formData.apiSecurityTool}
                            onChange={(e) => handleFieldChange('apiSecurityTool', e.target.value)}
                          />
                          <Select
                            label="Integration Level"
                            value={formData.apiSecurityIntegrationLevel}
                            onChange={(e) => handleFieldChange('apiSecurityIntegrationLevel', e.target.value)}
                            options={[
                              { value: '', label: 'Select level' },
                              ...integrationLevels,
                            ]}
                          />
                          <Checkbox
                            id="apiSecurityNA"
                            label="Not Applicable"
                            checked={formData.apiSecurityNA}
                            onChange={(e) => handleFieldChange('apiSecurityNA', e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* SAST Section */}
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          SAST (Static Analysis)
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Tool:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.sastTool || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Integration Level:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {getIntegrationLevelName(formData.sastIntegrationLevel) || <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Last Scan Date:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {formData.lastSastScanDate ? new Date(formData.lastSastScanDate).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">SAST includes SCA:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.sastIncludesSca ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      </div>

                      {/* DAST Section */}
                      <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                        <h5 className="text-sm font-semibold text-green-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          DAST (Dynamic Analysis)
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Tool:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.dastTool || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Integration Level:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {getIntegrationLevelName(formData.dastIntegrationLevel) || <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Last Scan Date:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {formData.lastDastScanDate ? new Date(formData.lastDastScanDate).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* SCA Section (read-only) */}
                      <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                        <h5 className="text-sm font-semibold text-teal-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          SCA (Software Composition)
                        </h5>
                        {formData.sastIncludesSca ? (
                          <p className="text-sm text-teal-900">
                            Same as SAST: tool, integration level, and last scan as shown under SAST above.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <span className="text-xs font-medium text-gray-600">Tool:</span>
                              <p className="text-sm text-gray-900 mt-0.5">{formData.scaTool || <span className="text-gray-400 italic">Not set</span>}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-600">Integration Level:</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {getIntegrationLevelName(formData.scaIntegrationLevel) || <span className="text-gray-400 italic">Not set</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-gray-600">Last Scan Date:</span>
                              <p className="text-sm text-gray-900 mt-0.5">
                                {formData.lastScaScanDate ? new Date(formData.lastScaScanDate).toLocaleDateString() : <span className="text-gray-400 italic">Not set</span>}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* App Firewall Section */}
                      <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                        <h5 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Application Firewall
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Tool:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.appFirewallTool || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Integration Level:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {getIntegrationLevelName(formData.appFirewallIntegrationLevel) || <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Not Applicable:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.appFirewallNA ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      </div>

                      {/* API Security Section */}
                      <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                        <h5 className="text-sm font-semibold text-orange-900 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          API Security
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600">Tool:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.apiSecurityTool || <span className="text-gray-400 italic">Not set</span>}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Integration Level:</span>
                            <p className="text-sm text-gray-900 mt-0.5">
                              {getIntegrationLevelName(formData.apiSecurityIntegrationLevel) || <span className="text-gray-400 italic">Not set</span>}
                            </p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600">Not Applicable:</span>
                            <p className="text-sm text-gray-900 mt-0.5">{formData.apiSecurityNA ? 'Yes' : 'No'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </CardContent>
            </Card>
        </TabPanel>

        {/* Infosec Policy Compliance Tab */}
        <TabPanel>
          <PolicyComplianceView 
            applicationId={id}
            compliance={policyCompliance}
            loading={loadingCompliance}
            onLoad={loadPolicyCompliance}
            onRefresh={loadPolicyCompliance}
          />
        </TabPanel>

        {/* Application Metadata History Tab - Admin Only */}
        {isAdmin() && (
          <TabPanel>
            <VersionHistory 
              applicationId={id} 
              alwaysExpanded={true}
              onVersionProcessed={loadPendingVersionsCount}
            />
          </TabPanel>
        )}

        <TabPanel>
          {application && (
            <ApplicationIntegrationsSection application={application} onRefresh={loadApplication} />
          )}
        </TabPanel>
      </Tabs>

      {/* Add Deployment Modal */}
      <Modal
        isOpen={showDeploymentForm}
        onClose={() => {
          setShowDeploymentForm(false);
          setDeploymentFormView('manual');
          setNewDeployment({
            deployedAt: new Date().toISOString().split('T')[0],
            environment: '',
            version: '',
            gitBranch: '',
            deployedBy: '',
            notes: '',
          });
          setNewTokenName('');
          setSelectedTokenForApp('');
        }}
        title="Add New Deployment"
        size="xl"
      >
        {/* View Toggle */}
        <div className="flex gap-2 mb-4 border-b border-gray-200">
          <button
            onClick={() => setDeploymentFormView('manual')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              deploymentFormView === 'manual'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manual Entry
          </button>
          <button
            onClick={() => setDeploymentFormView('cicd')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              deploymentFormView === 'cicd'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            CI/CD Pipeline
          </button>
        </div>

        {deploymentFormView === 'manual' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Deployment Date"
                type="date"
                value={newDeployment.deployedAt}
                onChange={(e) => setNewDeployment({ ...newDeployment, deployedAt: e.target.value })}
                required
              />
              <Select
                label="Environment"
                value={newDeployment.environment}
                onChange={(e) => setNewDeployment({ ...newDeployment, environment: e.target.value })}
                options={[
                  { value: '', label: 'Select environment' },
                  { value: 'dev', label: 'Development' },
                  { value: 'staging', label: 'Staging' },
                  { value: 'qa', label: 'QA' },
                  { value: 'prod', label: 'Production' },
                  { value: 'other', label: 'Other' },
                ]}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Version"
                value={newDeployment.version}
                onChange={(e) => setNewDeployment({ ...newDeployment, version: e.target.value })}
                placeholder="e.g., 1.2.3"
              />
              <Input
                label="Git Branch/Tag"
                value={newDeployment.gitBranch}
                onChange={(e) => setNewDeployment({ ...newDeployment, gitBranch: e.target.value })}
                placeholder="e.g., main, v1.2.3"
              />
            </div>
            <Input
              label="Deployed By"
              value={newDeployment.deployedBy}
              onChange={(e) => setNewDeployment({ ...newDeployment, deployedBy: e.target.value })}
              placeholder="Name or email"
            />
            <Textarea
              label="Notes"
              value={newDeployment.notes}
              onChange={(e) => setNewDeployment({ ...newDeployment, notes: e.target.value })}
              rows={3}
              placeholder="Optional notes about this deployment"
            />
            <div className="flex gap-2 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeploymentForm(false);
                  setDeploymentFormView('manual');
                  setNewDeployment({
                    deployedAt: new Date().toISOString().split('T')[0],
                    environment: '',
                    version: '',
                    gitBranch: '',
                    deployedBy: '',
                    notes: '',
                  });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateDeployment}>Add Deployment</Button>
            </div>
          </div>
        ) : (
          <CICDDeploymentView
            applicationId={id}
            applicationName={application?.name}
            applicationCompanyId={application?.companyId}
            deploymentTokens={deploymentTokens}
            loadingTokens={loadingTokens}
            newTokenName={newTokenName}
            setNewTokenName={setNewTokenName}
            creatingToken={creatingToken}
            selectedTokenForApp={selectedTokenForApp}
            setSelectedTokenForApp={setSelectedTokenForApp}
            addingToToken={addingToToken}
            onLoadAllTokens={loadAllDeploymentTokens}
            onCreateToken={handleCreateToken}
            onAddToToken={handleAddToExistingToken}
            onRefreshTokens={loadDeploymentTokens}
          />
        )}
      </Modal>

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

      <Modal
        isOpen={deleteDeploymentId != null}
        onClose={() => !deletingDeployment && setDeleteDeploymentId(null)}
        title="Delete deployment?"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setDeleteDeploymentId(null)}
              disabled={deletingDeployment}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteDeployment} loading={deletingDeployment}>
              Delete
            </Button>
          </>
        }
      >
        {deploymentPendingDelete && (
          <div className="space-y-2 text-gray-700">
            <p>
              Remove this deployment record for{' '}
              <strong>{deploymentPendingDelete.environment}</strong>
              {deploymentPendingDelete.version ? (
                <> (v{deploymentPendingDelete.version})</>
              ) : null}
              ?
            </p>
            <p className="text-sm text-gray-500">
              {new Date(deploymentPendingDelete.deployedAt).toLocaleString()}
            </p>
          </div>
        )}
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

