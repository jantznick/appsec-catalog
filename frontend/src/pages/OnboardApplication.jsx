import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Alert } from '../components/ui/Alert.jsx';

export function OnboardApplication() {
  const { slug, applicationId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [useDefaults, setUseDefaults] = useState(true);
  const [interfaceSearch, setInterfaceSearch] = useState('');
  const [interfaceResults, setInterfaceResults] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [showInterfaceResults, setShowInterfaceResults] = useState(false);
  const [integrationLevels, setIntegrationLevels] = useState([]);

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
  });

  useEffect(() => {
    loadIntegrationLevels();
    if (applicationId) {
      loadApplication();
    } else {
      loadCompany();
    }
  }, [slug, applicationId]);

  const loadIntegrationLevels = async () => {
    try {
      const levels = await api.getIntegrationLevels();
      setIntegrationLevels(levels);
    } catch (error) {
      console.error('Failed to load integration levels:', error);
    }
  };

  useEffect(() => {
    if (company && useDefaults) {
      setFormData(prev => ({
        ...prev,
        language: company.language || prev.language,
        framework: company.framework || prev.framework,
        serverEnvironment: company.serverEnvironment || prev.serverEnvironment,
        facing: company.facing || prev.facing,
        deploymentType: company.deploymentType || prev.deploymentType,
        authProfiles: company.authProfiles || prev.authProfiles,
        dataTypes: company.dataTypes || prev.dataTypes,
        owner: company.engManager || prev.owner,
      }));
    }
  }, [company, useDefaults]);

  // Debounced search for interfaces
  useEffect(() => {
    if (interfaceSearch.trim().length < 2) {
      setInterfaceResults([]);
      setShowInterfaceResults(false);
      return;
    }

    const timer = setTimeout(() => {
      searchInterfaces(interfaceSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [interfaceSearch, company]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanyBySlug(slug);
      setCompany(data);
    } catch (error) {
      toast.error('Company not found');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadApplication = async () => {
    try {
      setLoading(true);
      const app = await api.getApplicationPublic(applicationId);
      const companyData = await api.getCompanyBySlug(slug);
      setCompany(companyData);
      
      // Pre-fill form with existing application data
      setFormData(prev => ({
        ...prev,
        name: app.name || '',
        description: app.description || '',
        owner: app.owner || '',
        repoUrl: app.repoUrl || '',
        language: app.language || '',
        framework: app.framework || '',
        serverEnvironment: app.serverEnvironment || '',
        facing: app.facing || '',
        deploymentType: app.deploymentType || '',
        authProfiles: app.authProfiles || '',
        dataTypes: app.dataTypes || '',
        sastTool: app.sastTool || '',
        sastIntegrationLevel: app.sastIntegrationLevel?.toString() || '',
        dastTool: app.dastTool || '',
        dastIntegrationLevel: app.dastIntegrationLevel?.toString() || '',
        appFirewallTool: app.appFirewallTool || '',
        appFirewallIntegrationLevel: app.appFirewallIntegrationLevel?.toString() || '',
        apiSecurityTool: app.apiSecurityTool || '',
        apiSecurityIntegrationLevel: app.apiSecurityIntegrationLevel?.toString() || '',
        apiSecurityNA: app.apiSecurityNA || false,
      }));
      
      // Load interfaces if they exist
      if (app.interfaces) {
        try {
          const interfaceIds = JSON.parse(app.interfaces);
          // Fetch interface applications to get names
          const interfaceApps = await Promise.all(
            interfaceIds.map(id => api.getApplicationPublic(id))
          );
          setInterfaces(interfaceApps.map(app => app.name));
        } catch (e) {
          console.error('Error parsing interfaces:', e);
        }
      }
    } catch (error) {
      toast.error('Failed to load application');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const searchInterfaces = async (query) => {
    if (!company) return;
    
    try {
      const results = await api.searchApplicationsByName(query);
      setInterfaceResults(results.filter(app => app.companyId === company.id));
      setShowInterfaceResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setInterfaceResults([]);
    }
  };

  const addInterface = (app) => {
    const name = typeof app === 'string' ? app : app.name;
    if (name && !interfaces.includes(name)) {
      setInterfaces([...interfaces, name]);
    }
    setInterfaceSearch('');
    setShowInterfaceResults(false);
  };

  const removeInterface = (name) => {
    setInterfaces(interfaces.filter(i => i !== name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      
      if (applicationId) {
        // Update existing application with technical details
        await api.updateApplicationPublic(applicationId, {
          interfaces: interfaces,
          sastTool: formData.sastTool,
          sastIntegrationLevel: formData.sastIntegrationLevel,
          dastTool: formData.dastTool,
          dastIntegrationLevel: formData.dastIntegrationLevel,
          appFirewallTool: formData.appFirewallTool,
          appFirewallIntegrationLevel: formData.appFirewallIntegrationLevel,
          apiSecurityTool: formData.apiSecurityTool,
          apiSecurityIntegrationLevel: formData.apiSecurityIntegrationLevel,
          apiSecurityNA: formData.apiSecurityNA,
        });
        toast.success('Application technical details updated successfully!');
      } else {
        toast.error('Application ID is required');
        return;
      }
      
      setSubmitted(true);
    } catch (error) {
      toast.error(error.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading company information..." />;
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="error">Company not found</Alert>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-2xl w-full">
          <CardContent>
            <div className="text-center py-12">
              <div className="mb-4">
                <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Submitted!</h2>
              <p className="text-gray-600 mb-6">
                Your application has been submitted successfully. It will be reviewed by the security team.
              </p>
              <Button onClick={() => {
                setSubmitted(false);
                setFormData({
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
                });
                setInterfaces([]);
              }} variant="primary">
                Submit Another Application
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Application Technical Details
          </h1>
          {formData.name && (
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">
              {formData.name}
            </h2>
          )}
          <p className="text-gray-600">
            Complete the technical information for this application.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Language"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                />
                <Input
                  label="Framework"
                  value={formData.framework}
                  onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                />
                <Select
                  label="Server Environment"
                  value={formData.serverEnvironment || ''}
                  onChange={(e) => setFormData({ ...formData, serverEnvironment: e.target.value })}
                  options={[
                    { value: '', label: 'Select environment' },
                    { value: 'Cloud', label: 'Cloud' },
                    { value: 'On-prem', label: 'On-prem' },
                    { value: 'Both', label: 'Both' },
                  ]}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Select
                  label="Facing"
                  value={formData.facing || ''}
                  onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                  options={[
                    { value: '', label: 'Select facing' },
                    { value: 'Internal', label: 'Internal' },
                    { value: 'External', label: 'External' },
                  ]}
                />
                <Input
                  label="Deployment Type"
                  value={formData.deploymentType}
                  onChange={(e) => setFormData({ ...formData, deploymentType: e.target.value })}
                  placeholder="e.g. Scheduled, Ad-hoc"
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Necessary Auth Profiles"
                  value={formData.authProfiles}
                  onChange={(e) => setFormData({ ...formData, authProfiles: e.target.value })}
                />
              </div>
              <div className="mt-4">
                <Input
                  label="Data Types Collected/Stored"
                  value={formData.dataTypes}
                  onChange={(e) => setFormData({ ...formData, dataTypes: e.target.value })}
                  placeholder="e.g. PII, PCI"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Interfaces with Other Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Input
                  label="Search or type application name"
                  value={interfaceSearch}
                  onChange={(e) => setInterfaceSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && interfaceSearch.trim().length >= 2) {
                      e.preventDefault();
                      addInterface(interfaceSearch.trim());
                    }
                  }}
                  placeholder="Start typing to search..."
                  helperText="Applications will be created automatically if they don't exist"
                />
                {showInterfaceResults && interfaceResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {interfaceResults.map((app) => (
                      <button
                        key={app.id}
                        type="button"
                        onClick={() => addInterface(app)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100"
                      >
                        <div className="font-medium">{app.name}</div>
                      </button>
                    ))}
                  </div>
                )}
                {interfaceSearch.trim().length >= 2 && interfaceResults.length === 0 && showInterfaceResults && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm text-gray-600">
                    No applications found. Press Enter to create "{interfaceSearch}"
                  </div>
                )}
              </div>
              {interfaceSearch.trim().length >= 2 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    if (interfaceSearch.trim()) {
                      addInterface(interfaceSearch.trim());
                    }
                  }}
                >
                  Add "{interfaceSearch}"
                </Button>
              )}
              {interfaces.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {interfaces.map((name, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => removeInterface(name)}
                        className="ml-2 text-blue-600 hover:text-blue-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Tools</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="SAST Tool"
                    value={formData.sastTool}
                    onChange={(e) => setFormData({ ...formData, sastTool: e.target.value })}
                  />
                  <Select
                    label="SAST Integration Level"
                    value={formData.sastIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, sastIntegrationLevel: e.target.value })}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="DAST Tool"
                    value={formData.dastTool}
                    onChange={(e) => setFormData({ ...formData, dastTool: e.target.value })}
                  />
                  <Select
                    label="DAST Integration Level"
                    value={formData.dastIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, dastIntegrationLevel: e.target.value })}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="WAF Tool"
                    value={formData.appFirewallTool}
                    onChange={(e) => setFormData({ ...formData, appFirewallTool: e.target.value })}
                  />
                  <Select
                    label="WAF Integration Level"
                    value={formData.appFirewallIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, appFirewallIntegrationLevel: e.target.value })}
                    options={[
                      { value: '', label: 'Select level' },
                      ...integrationLevels,
                    ]}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="API Security Tool"
                    value={formData.apiSecurityTool}
                    onChange={(e) => setFormData({ ...formData, apiSecurityTool: e.target.value })}
                  />
                  <div>
                    <Select
                      label="API Security Integration Level"
                      value={formData.apiSecurityIntegrationLevel}
                      onChange={(e) => setFormData({ ...formData, apiSecurityIntegrationLevel: e.target.value })}
                      options={[
                        { value: '', label: 'Select level' },
                        ...integrationLevels,
                      ]}
                    />
                    <div className="mt-2">
                      <Checkbox
                        id="apiSecurityNA"
                        label="N/A"
                        checked={formData.apiSecurityNA}
                        onChange={(e) => setFormData({ ...formData, apiSecurityNA: e.target.checked })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

