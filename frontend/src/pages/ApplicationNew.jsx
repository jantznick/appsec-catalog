import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import useAuthStore from '../store/authStore.js';

export function ApplicationNew() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [companyDefaults, setCompanyDefaults] = useState(null);
  const [useDefaults, setUseDefaults] = useState(true);
  const [interfaceSearch, setInterfaceSearch] = useState('');
  const [interfaceResults, setInterfaceResults] = useState([]);
  const [interfaces, setInterfaces] = useState([]);
  const [showInterfaceResults, setShowInterfaceResults] = useState(false);

  const [formData, setFormData] = useState({
    companyId: '',
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
    loadCompanies();
  }, []);

  useEffect(() => {
    if (formData.companyId && useDefaults) {
      loadCompanyDefaults();
    }
  }, [formData.companyId, useDefaults]);

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
  }, [interfaceSearch]);

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
      
      // Auto-select user's company if they have one
      if (user?.companyId && !isAdmin()) {
        setFormData(prev => ({ ...prev, companyId: user.companyId }));
      }
    } catch (error) {
      toast.error('Failed to load companies');
    }
  };

  const loadCompanyDefaults = async () => {
    try {
      const company = await api.getCompany(formData.companyId);
      setCompanyDefaults(company);
      
      if (useDefaults) {
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
    } catch (error) {
      console.error('Failed to load company defaults:', error);
    }
  };

  const searchInterfaces = async (query) => {
    try {
      const results = await api.searchApplications(query, formData.companyId);
      setInterfaceResults(results);
      setShowInterfaceResults(true);
    } catch (error) {
      console.error('Failed to search applications:', error);
    }
  };

  const addInterface = (app) => {
    if (!interfaces.find(i => i === app.name)) {
      setInterfaces([...interfaces, app.name]);
    }
    setInterfaceSearch('');
    setShowInterfaceResults(false);
  };

  const removeInterface = (name) => {
    setInterfaces(interfaces.filter(i => i !== name));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Application name is required');
      return;
    }

    if (!formData.companyId) {
      toast.error('Company is required');
      return;
    }

    try {
      setLoading(true);
      const application = await api.createApplication({
        ...formData,
        interfaces: interfaces,
      });
      toast.success('Application created successfully');
      navigate(`/applications/${application.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/applications')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Applications
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">New Application Intake</h1>
        <p className="text-gray-600">Provide detailed information about your application.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Company / Team"
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  options={companies.map(c => ({ value: c.id, label: c.name }))}
                  placeholder="Select a company..."
                  required
                  disabled={!isAdmin() && user?.companyId}
                />
                <Input
                  label="Application Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="mt-4">
                <Textarea
                  label="Description / Use Case"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  label="Owner / Eng. Lead"
                  value={formData.owner}
                  onChange={(e) => setFormData({ ...formData, owner: e.target.value })}
                />
                <Input
                  label="Repository URL"
                  type="url"
                  value={formData.repoUrl}
                  onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardContent>
              {formData.companyId && (
                <div className="mb-4">
                  <Checkbox
                    id="useDefaults"
                    label="Use company defaults"
                    checked={useDefaults}
                    onChange={(e) => {
                      setUseDefaults(e.target.checked);
                      if (e.target.checked) {
                        loadCompanyDefaults();
                      }
                    }}
                  />
                </div>
              )}
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
                <Input
                  label="Server Environment"
                  value={formData.serverEnvironment}
                  onChange={(e) => setFormData({ ...formData, serverEnvironment: e.target.value })}
                  placeholder="e.g. AWS, On-prem"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input
                  label="Facing"
                  value={formData.facing}
                  onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                  placeholder="e.g. Internal, External"
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
                      addInterface({ name: interfaceSearch.trim() });
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
                        <div className="text-sm text-gray-500">{app.company.name}</div>
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
                      addInterface({ name: interfaceSearch.trim() });
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="SAST Tool"
                    value={formData.sastTool}
                    onChange={(e) => setFormData({ ...formData, sastTool: e.target.value })}
                  />
                  <Input
                    label="SAST Integration Level"
                    type="number"
                    min="0"
                    max="4"
                    value={formData.sastIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, sastIntegrationLevel: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="DAST Tool"
                    value={formData.dastTool}
                    onChange={(e) => setFormData({ ...formData, dastTool: e.target.value })}
                  />
                  <Input
                    label="DAST Integration Level"
                    type="number"
                    min="0"
                    max="4"
                    value={formData.dastIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, dastIntegrationLevel: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="App Firewall Tool"
                    value={formData.appFirewallTool}
                    onChange={(e) => setFormData({ ...formData, appFirewallTool: e.target.value })}
                  />
                  <Input
                    label="App Firewall Integration Level"
                    type="number"
                    min="0"
                    max="4"
                    value={formData.appFirewallIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, appFirewallIntegrationLevel: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="API Security Tool"
                    value={formData.apiSecurityTool}
                    onChange={(e) => setFormData({ ...formData, apiSecurityTool: e.target.value })}
                  />
                  <Input
                    label="API Security Integration Level"
                    type="number"
                    min="0"
                    max="4"
                    value={formData.apiSecurityIntegrationLevel}
                    onChange={(e) => setFormData({ ...formData, apiSecurityIntegrationLevel: e.target.value })}
                  />
                </div>
                <Checkbox
                  id="apiSecurityNA"
                  label="API Security Not Applicable"
                  checked={formData.apiSecurityNA}
                  onChange={(e) => setFormData({ ...formData, apiSecurityNA: e.target.checked })}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/applications')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
            >
              Submit Application
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

