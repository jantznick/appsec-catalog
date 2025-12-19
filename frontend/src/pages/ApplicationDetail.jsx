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
import { ScoreCard } from '../components/scoring/ScoreCard.jsx';
import useAuthStore from '../store/authStore.js';

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

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    owner: '',
    repoUrl: '',
    language: '',
    framework: '',
    serverEnvironment: '',
    facing: '',
    deploymentType: '',
    authProfiles: '',
    dataTypes: '',
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

  const loadIntegrationLevels = async () => {
    try {
      const levels = await api.getIntegrationLevels();
      setIntegrationLevels(levels);
    } catch (error) {
      console.error('Failed to load integration levels:', error);
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

  const loadApplication = async () => {
    try {
      setLoading(true);
      const data = await api.getApplication(id);
      setApplication(data);
      
      // Parse interfaces if they exist
      let interfaces = [];
      if (data.interfaces) {
        try {
          const interfaceIds = JSON.parse(data.interfaces);
          // Could load interface names here if needed
        } catch (e) {
          // If not JSON, treat as string
        }
      }

      setFormData({
        name: data.name || '',
        description: data.description || '',
        owner: data.owner || '',
        repoUrl: data.repoUrl || '',
        language: data.language || '',
        framework: data.framework || '',
        serverEnvironment: data.serverEnvironment || '',
        facing: data.facing || '',
        deploymentType: data.deploymentType || '',
        authProfiles: data.authProfiles || '',
        dataTypes: data.dataTypes || '',
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
      });
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
      await api.updateApplication(id, formData);
      toast.success('Application updated successfully');
      setIsEditing(false);
      // Reload both application data and score
      await loadApplication();
      await loadScore();
    } catch (error) {
      toast.error(error.message || 'Failed to update application');
    } finally {
      setSaving(false);
    }
  };

  const canEdit = () => {
    if (isAdmin()) return true;
    if (application && user?.companyId === application.companyId) return true;
    return false;
  };

  if (loading) {
    return <LoadingPage message="Loading application..." />;
  }

  if (!application) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/applications')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Applications
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{application.name}</h1>
            <p className="text-gray-600">
              {application.company?.name && `Company: ${application.company.name}`}
            </p>
          </div>
          <div className="flex gap-3 items-center">
            {canEdit() && (
              <div className="flex gap-3">
                {isEditing ? (
                  <>
                    <Button variant="secondary" onClick={() => {
                      setIsEditing(false);
                      loadApplication();
                    }}>
                      Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} loading={saving}>
                      Save Changes
                    </Button>
                  </>
                ) : (
                  <Button variant="primary" onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                )}
              </div>
            )}
            {canEdit() && (
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
            )}
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                required
              />
              <Textarea
                label="Description / Use Case"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!isEditing}
                rows={3}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Owner / Eng. Lead"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                  disabled={!isEditing}
                />
                <Input
                  label="Repository URL"
                  type="url"
                  value={formData.repoUrl}
                  onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
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
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  disabled={!isEditing}
                />
                <Input
                  label="Framework"
                  value={formData.framework}
                  onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                  disabled={!isEditing}
                />
                <Input
                  label="Server Environment"
                  value={formData.serverEnvironment}
                  onChange={(e) => setFormData({ ...formData, serverEnvironment: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Facing"
                  value={formData.facing}
                  onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                  disabled={!isEditing}
                />
                <Input
                  label="Deployment Type"
                  value={formData.deploymentType}
                  onChange={(e) => setFormData({ ...formData, deploymentType: e.target.value })}
                  disabled={!isEditing}
                />
              </div>
              <Input
                label="Auth Profiles"
                value={formData.authProfiles}
                onChange={(e) => setFormData({ ...formData, authProfiles: e.target.value })}
                disabled={!isEditing}
              />
              <Input
                label="Data Types"
                value={formData.dataTypes}
                onChange={(e) => setFormData({ ...formData, dataTypes: e.target.value })}
                disabled={!isEditing}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="SAST Tool"
                  value={formData.sastTool}
                  onChange={(e) => setFormData({ ...formData, sastTool: e.target.value })}
                  disabled={!isEditing}
                />
                <Select
                  label="SAST Integration Level"
                  value={formData.sastIntegrationLevel}
                  onChange={(e) => setFormData({ ...formData, sastIntegrationLevel: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, dastTool: e.target.value })}
                  disabled={!isEditing}
                />
                <Select
                  label="DAST Integration Level"
                  value={formData.dastIntegrationLevel}
                  onChange={(e) => setFormData({ ...formData, dastIntegrationLevel: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, appFirewallTool: e.target.value })}
                  disabled={!isEditing}
                />
                <Select
                  label="App Firewall Integration Level"
                  value={formData.appFirewallIntegrationLevel}
                  onChange={(e) => setFormData({ ...formData, appFirewallIntegrationLevel: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, apiSecurityTool: e.target.value })}
                  disabled={!isEditing}
                />
                <Select
                  label="API Security Integration Level"
                  value={formData.apiSecurityIntegrationLevel}
                  onChange={(e) => setFormData({ ...formData, apiSecurityIntegrationLevel: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, apiSecurityNA: e.target.checked })}
                disabled={!isEditing}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
                >
                  <option value="pending_executive">Pending Executive</option>
                  <option value="pending_technical">Pending Technical</option>
                  <option value="onboarded">Onboarded</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Note: You can also change status using the dropdown in the header above.
                </p>
              </div>
              {application.metadataLastReviewed && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Reviewed</label>
                  <p className="text-sm text-gray-600">
                    {new Date(application.metadataLastReviewed).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

