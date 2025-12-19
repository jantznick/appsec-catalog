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
import { RadioGroup, Radio } from '../components/ui/Radio.jsx';
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
    repoUrl: '',
    deploymentFrequency: '',
    deploymentMethod: '',
    deploymentMethodOther: '',
    requiresSpecialAccess: '',
    authInfo: '',
    handlesUserData: '',
    userDataTypes: '',
    userDataStorage: '',
    hasInterfaces: '',
    pciData: false,
    piiData: false,
    phiData: false,
    hasSecurityTesting: '',
    securityTestingDescription: '',
    additionalNotes: '',
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

  // Removed company defaults pre-fill for technical form

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
        repoUrl: app.repoUrl || '',
        securityTestingDescription: app.securityTestingDescription || '',
        additionalNotes: app.additionalNotes || '',
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
        // Process deploymentMethod - combine selected method with "Other" if provided
        let deploymentMethod = formData.deploymentMethod;
        if (formData.deploymentMethod === 'Manual Other' && formData.deploymentMethodOther && formData.deploymentMethodOther.trim()) {
          deploymentMethod = `Manual Other: ${formData.deploymentMethodOther.trim()}`;
        }

        // Update existing application with technical details
        await api.updateApplicationPublic(applicationId, {
          repoUrl: formData.repoUrl,
          deploymentFrequency: formData.deploymentFrequency,
          deploymentMethod: deploymentMethod,
          requiresSpecialAccess: formData.requiresSpecialAccess,
          authInfo: formData.authInfo,
          handlesUserData: formData.handlesUserData,
          userDataTypes: formData.userDataTypes,
          userDataStorage: formData.userDataStorage,
          hasInterfaces: formData.hasInterfaces,
          interfaces: formData.hasInterfaces === 'Yes' ? interfaces : [],
          pciData: formData.pciData,
          piiData: formData.piiData,
          phiData: formData.phiData,
          hasSecurityTesting: formData.hasSecurityTesting,
          securityTestingDescription: formData.securityTestingDescription,
          additionalNotes: formData.additionalNotes,
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
              <CardTitle>Repository & Deployment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Repo Link"
                  type="url"
                  value={formData.repoUrl}
                  onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                  placeholder="https://github.com/..."
                />
                <Select
                  label="How often does it deploy?"
                  value={formData.deploymentFrequency || ''}
                  onChange={(e) => setFormData({ ...formData, deploymentFrequency: e.target.value })}
                  options={[
                    { value: '', label: 'Select frequency' },
                    { value: 'Multiple times per day', label: 'Multiple times per day' },
                    { value: 'Daily', label: 'Daily' },
                    { value: 'Weekly', label: 'Weekly' },
                    { value: 'Monthly', label: 'Monthly' },
                    { value: 'Quarterly', label: 'Quarterly' },
                    { value: 'As needed', label: 'As needed' },
                  ]}
                />
                <div>
                  <RadioGroup label="What is the main deployment method?">
                    <Radio
                      name="deploymentMethod"
                      value="Automated CI/CD Pipeline"
                      checked={formData.deploymentMethod === 'Automated CI/CD Pipeline'}
                      onChange={(e) => setFormData({ ...formData, deploymentMethod: e.target.value, deploymentMethodOther: '' })}
                      label="Automated CI/CD Pipeline"
                    />
                    <Radio
                      name="deploymentMethod"
                      value="Manual Pipeline Steps"
                      checked={formData.deploymentMethod === 'Manual Pipeline Steps'}
                      onChange={(e) => setFormData({ ...formData, deploymentMethod: e.target.value, deploymentMethodOther: '' })}
                      label="Manual Pipeline Steps"
                    />
                    <Radio
                      name="deploymentMethod"
                      value="Manual Other"
                      checked={formData.deploymentMethod === 'Manual Other'}
                      onChange={(e) => setFormData({ ...formData, deploymentMethod: e.target.value })}
                      label="Manual Other"
                    />
                    {formData.deploymentMethod === 'Manual Other' && (
                      <div className="ml-6 mt-2">
                        <Input
                          label="Please specify"
                          value={formData.deploymentMethodOther}
                          onChange={(e) => setFormData({ ...formData, deploymentMethodOther: e.target.value })}
                          placeholder="Describe the deployment method"
                        />
                      </div>
                    )}
                  </RadioGroup>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authentication & Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RadioGroup label="Does it require special access permissions?">
                  <Radio
                    name="requiresSpecialAccess"
                    value="Yes"
                    checked={formData.requiresSpecialAccess === 'Yes'}
                    onChange={(e) => setFormData({ ...formData, requiresSpecialAccess: e.target.value })}
                    label="Yes"
                  />
                  <Radio
                    name="requiresSpecialAccess"
                    value="No"
                    checked={formData.requiresSpecialAccess === 'No'}
                    onChange={(e) => setFormData({ ...formData, requiresSpecialAccess: e.target.value, authInfo: '' })}
                    label="No"
                  />
                </RadioGroup>
                {formData.requiresSpecialAccess === 'Yes' && (
                  <div>
                    <Textarea
                      label="Please provide authentication information"
                      value={formData.authInfo}
                      onChange={(e) => setFormData({ ...formData, authInfo: e.target.value })}
                      rows={3}
                      placeholder="Describe the authentication requirements"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Data Handling</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RadioGroup label="Does it handle user supplied data of any kinds?">
                  <Radio
                    name="handlesUserData"
                    value="Yes"
                    checked={formData.handlesUserData === 'Yes'}
                    onChange={(e) => setFormData({ ...formData, handlesUserData: e.target.value })}
                    label="Yes"
                  />
                  <Radio
                    name="handlesUserData"
                    value="No"
                    checked={formData.handlesUserData === 'No'}
                    onChange={(e) => setFormData({ ...formData, handlesUserData: e.target.value, userDataTypes: '', userDataStorage: '' })}
                    label="No"
                  />
                </RadioGroup>
                {formData.handlesUserData === 'Yes' && (
                  <>
                    <Textarea
                      label="List the user supplied data it handles"
                      value={formData.userDataTypes}
                      onChange={(e) => setFormData({ ...formData, userDataTypes: e.target.value })}
                      rows={2}
                      placeholder="e.g. Names, email addresses, payment information"
                    />
                    <Input
                      label="Where is the user supplied data stored?"
                      value={formData.userDataStorage}
                      onChange={(e) => setFormData({ ...formData, userDataStorage: e.target.value })}
                      placeholder="e.g. PostgreSQL database, S3 bucket, etc."
                    />
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Does this application have access to any databases that contain PCI, PII or PHI Data?
                  </label>
                  <div className="space-y-2">
                    <Checkbox
                      id="pciData"
                      label="PCI Data"
                      checked={formData.pciData}
                      onChange={(e) => setFormData({ ...formData, pciData: e.target.checked })}
                    />
                    <Checkbox
                      id="piiData"
                      label="PII Data"
                      checked={formData.piiData}
                      onChange={(e) => setFormData({ ...formData, piiData: e.target.checked })}
                    />
                    <Checkbox
                      id="phiData"
                      label="PHI Data"
                      checked={formData.phiData}
                      onChange={(e) => setFormData({ ...formData, phiData: e.target.checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Application Interfaces</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RadioGroup label="Does it directly integrate with any other applications created by your company?">
                  <Radio
                    name="hasInterfaces"
                    value="Yes"
                    checked={formData.hasInterfaces === 'Yes'}
                    onChange={(e) => setFormData({ ...formData, hasInterfaces: e.target.value })}
                    label="Yes"
                  />
                  <Radio
                    name="hasInterfaces"
                    value="No"
                    checked={formData.hasInterfaces === 'No'}
                    onChange={(e) => {
                      setFormData({ ...formData, hasInterfaces: e.target.value });
                      setInterfaces([]);
                    }}
                    label="No"
                  />
                </RadioGroup>
                {formData.hasInterfaces === 'Yes' && (
                  <div className="relative">
                    <Input
                      label="Which applications does it interact with?"
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
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Testing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <RadioGroup label="Is there any security testing in place on it today?">
                  <Radio
                    name="hasSecurityTesting"
                    value="Yes"
                    checked={formData.hasSecurityTesting === 'Yes'}
                    onChange={(e) => setFormData({ ...formData, hasSecurityTesting: e.target.value })}
                    label="Yes"
                  />
                  <Radio
                    name="hasSecurityTesting"
                    value="No"
                    checked={formData.hasSecurityTesting === 'No'}
                    onChange={(e) => setFormData({ ...formData, hasSecurityTesting: e.target.value, securityTestingDescription: '', sastTool: '', sastIntegrationLevel: '', dastTool: '', dastIntegrationLevel: '', appFirewallTool: '', appFirewallIntegrationLevel: '', apiSecurityTool: '', apiSecurityIntegrationLevel: '', apiSecurityNA: false })}
                    label="No"
                  />
                </RadioGroup>
                {formData.hasSecurityTesting === 'Yes' && (
                  <>
                    <Textarea
                      label="Describe the security testing in place"
                      value={formData.securityTestingDescription}
                      onChange={(e) => setFormData({ ...formData, securityTestingDescription: e.target.value })}
                      rows={4}
                      placeholder="Describe the security testing practices, tools, and processes"
                    />
                    <div className="mt-6 pt-6 border-t">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Tools</h3>
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
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                label="Is there anything else we should know about this application?"
                value={formData.additionalNotes}
                onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                rows={4}
                placeholder="Examples: - We have highly specific logging that can't be changed - It has alerting to suspicious behaviors coming through - It is behind a firewall"
                helperText="Any additional context, constraints, or important information about the application"
              />
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

