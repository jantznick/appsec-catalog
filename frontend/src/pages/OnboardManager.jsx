import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Alert } from '../components/ui/Alert.jsx';

export function OnboardManager() {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApplications, setSubmittedApplications] = useState(null); // Array of created applications

  const [applications, setApplications] = useState([]); // Array of applications being prepared
  const [currentForm, setCurrentForm] = useState({
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
  });

  useEffect(() => {
    loadCompany();
  }, [slug]);

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanyBySlug(slug);
      setCompany(data);
      // Pre-fill with company defaults if available
      setCurrentForm(prev => ({
        ...prev,
        language: data.language || prev.language,
        framework: data.framework || prev.framework,
        serverEnvironment: data.serverEnvironment || prev.serverEnvironment,
        facing: data.facing || prev.facing,
        deploymentType: data.deploymentType || prev.deploymentType,
        authProfiles: data.authProfiles || prev.authProfiles,
        dataTypes: data.dataTypes || prev.dataTypes,
        owner: data.engManager || prev.owner,
      }));
    } catch (error) {
      toast.error('Company not found');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentForm({
      name: '',
      description: '',
      owner: company?.engManager || '',
      repoUrl: '',
      language: company?.language || '',
      framework: company?.framework || '',
      serverEnvironment: company?.serverEnvironment || '',
      facing: company?.facing || '',
      deploymentType: company?.deploymentType || '',
      authProfiles: company?.authProfiles || '',
      dataTypes: company?.dataTypes || '',
    });
  };

  const handleAddApplication = () => {
    if (!currentForm.name.trim()) {
      toast.error('Application name is required');
      return;
    }

    // Add current form to applications list
    setApplications([...applications, { ...currentForm }]);
    resetForm();
    toast.success('Application added to list');
  };

  const handleRemoveApplication = (index) => {
    setApplications(applications.filter((_, i) => i !== index));
  };

  const handleEditApplication = (index) => {
    const appToEdit = applications[index];
    setCurrentForm({ ...appToEdit });
    setApplications(applications.filter((_, i) => i !== index));
    toast.success('Application loaded for editing');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate company slug
    if (!slug) {
      toast.error('Company slug is missing');
      return;
    }

    // Build the list of applications to submit
    const appsToSubmit = [...applications];
    
    // If current form has a name, include it in the submission
    if (currentForm.name.trim()) {
      appsToSubmit.push({ ...currentForm });
    }

    // Validate we have at least one application
    if (appsToSubmit.length === 0) {
      toast.error('Please add at least one application or fill out the form');
      return;
    }

    // Validate all applications have names
    const invalidApps = appsToSubmit.filter(app => !app.name || !app.name.trim());
    if (invalidApps.length > 0) {
      toast.error('All applications must have a name');
      return;
    }

    try {
      setSubmitting(true);
      const result = await api.createApplicationOnboardExecutive({
        companySlug: slug,
        applications: appsToSubmit,
      });
      
      toast.success(`${appsToSubmit.length} application(s) submitted successfully!`);
      setSubmittedApplications(result.applications || [result.application]);
      setApplications([]);
      resetForm();
    } catch (error) {
      toast.error(error.message || 'Failed to submit applications');
      console.error('Submit error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!submittedApplications || submittedApplications.length === 0) return;

    // Check if at least one application has an engineering manager
    const hasEngineeringManager = submittedApplications.some(app => app.owner && app.owner.trim());

    // Build headers
    const headers = ['Application Name'];
    if (hasEngineeringManager) {
      headers.push('Engineering Manager');
    }
    headers.push('Invite Link');

    // Build rows
    const rows = submittedApplications.map(app => {
      const inviteLink = `${window.location.origin}/onboard/${slug}/application/${app.id}`;
      const row = [app.name || ''];
      if (hasEngineeringManager) {
        row.push(app.owner || '');
      }
      row.push(inviteLink);
      return row;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `applications_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('CSV downloaded successfully');
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

  if (submittedApplications) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent>
              <div className="text-center py-6 mb-6">
                <div className="mb-4">
                  <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {submittedApplications.length} Application(s) Submitted!
                </h2>
                <p className="text-gray-600 mb-4">
                  Copy the links below and send them to the engineering managers to complete the technical onboarding.
                </p>
                {submittedApplications.length > 1 && (
                  <Button
                    variant="primary"
                    onClick={handleDownloadCSV}
                    className="mb-4"
                  >
                    Download CSV
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {submittedApplications.map((app, index) => (
                  <div key={app.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{app.name}</h3>
                        {app.owner && (
                          <p className="text-sm text-gray-600">Eng. Manager: {app.owner}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${window.location.origin}/onboard/${slug}/application/${app.id}`}
                        readOnly
                        className="font-mono text-sm flex-1"
                        onClick={(e) => e.target.select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/onboard/${slug}/application/${app.id}`);
                          toast.success('Link copied to clipboard');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <Button 
                  onClick={() => {
                    setSubmittedApplications(null);
                    setApplications([]);
                    resetForm();
                  }} 
                  variant="outline" 
                  className="w-full"
                >
                  Submit More Applications
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            New Application Intake - {company.name}
          </h1>
          <p className="text-gray-600">
            Provide basic information about your application(s). You can add multiple applications before submitting.
          </p>
        </div>

        {/* Applications List */}
        {applications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Applications to Submit ({applications.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {applications.map((app, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{app.name}</p>
                      {app.owner && (
                        <p className="text-sm text-gray-600">Eng. Manager: {app.owner}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditApplication(index)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveApplication(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  label="Application Name *"
                  value={currentForm.name}
                  onChange={(e) => setCurrentForm({ ...currentForm, name: e.target.value })}
                  required
                  placeholder="e.g. Customer Portal"
                />
              </div>

              <div>
                <Textarea
                  label="Description / Use Case"
                  value={currentForm.description}
                  onChange={(e) => setCurrentForm({ ...currentForm, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Owner / Eng. Lead"
                  value={currentForm.owner}
                  onChange={(e) => setCurrentForm({ ...currentForm, owner: e.target.value })}
                />
                <Input
                  label="Repository URL"
                  type="url"
                  value={currentForm.repoUrl}
                  onChange={(e) => setCurrentForm({ ...currentForm, repoUrl: e.target.value })}
                />
              </div>

              <hr className="my-6" />

              <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Application Details</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Language"
                  value={currentForm.language}
                  onChange={(e) => setCurrentForm({ ...currentForm, language: e.target.value })}
                />
                <Input
                  label="Framework"
                  value={currentForm.framework}
                  onChange={(e) => setCurrentForm({ ...currentForm, framework: e.target.value })}
                />
                <Select
                  label="Server Environment"
                  value={currentForm.serverEnvironment || ''}
                  onChange={(e) => setCurrentForm({ ...currentForm, serverEnvironment: e.target.value })}
                  options={[
                    { value: '', label: 'Select environment' },
                    { value: 'Cloud', label: 'Cloud' },
                    { value: 'On-prem', label: 'On-prem' },
                    { value: 'Both', label: 'Both' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Facing"
                  value={currentForm.facing || ''}
                  onChange={(e) => setCurrentForm({ ...currentForm, facing: e.target.value })}
                  options={[
                    { value: '', label: 'Select facing' },
                    { value: 'Internal', label: 'Internal' },
                    { value: 'External', label: 'External' },
                  ]}
                />
                <Input
                  label="Deployment Type"
                  value={currentForm.deploymentType}
                  onChange={(e) => setCurrentForm({ ...currentForm, deploymentType: e.target.value })}
                  placeholder="e.g. Scheduled, Ad-hoc"
                />
              </div>

              <div>
                <Input
                  label="Necessary Auth Profiles"
                  value={currentForm.authProfiles}
                  onChange={(e) => setCurrentForm({ ...currentForm, authProfiles: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Data Types Collected/Stored"
                  value={currentForm.dataTypes}
                  onChange={(e) => setCurrentForm({ ...currentForm, dataTypes: e.target.value })}
                  placeholder="e.g. PII, PCI"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddApplication}
                  disabled={!currentForm.name.trim()}
                >
                  Add Application
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting || (applications.length === 0 && !currentForm.name.trim())}
                >
                  {submitting 
                    ? 'Submitting...' 
                    : (() => {
                        const totalCount = applications.length + (currentForm.name.trim() ? 1 : 0);
                        return totalCount > 1 
                          ? `Submit ${totalCount} Applications`
                          : 'Submit Application';
                      })()}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
