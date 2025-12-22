import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import { RadioGroup, Radio } from '../components/ui/Radio.jsx';
import { Checkbox } from '../components/ui/Checkbox.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { isClipboardAvailable, copyToClipboard } from '../utils/clipboard.js';

export function OnboardManager() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedApplications, setSubmittedApplications] = useState(null); // Array of created applications
  
  // Company selection state (when no slug provided)
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);

  const [applications, setApplications] = useState([]); // Array of applications being prepared
  const [currentForm, setCurrentForm] = useState({
    name: '',
    description: '',
    facing: '',
    serverEnvironment: '',
    businessCriticality: '',
    criticalAspects: [],
    criticalAspectsOther: '',
    devTeamContact: '',
  });

  useEffect(() => {
    if (slug) {
      loadCompany();
    } else {
      loadCompanies();
    }
  }, [slug]);

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

  const loadCompanies = async () => {
    try {
      setLoadingCompanies(true);
      const data = await api.getPublicCompanies();
      setCompanies(data);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoadingCompanies(false);
      setLoading(false);
    }
  };

  const handleCompanySelect = () => {
    if (!selectedCompanyId) {
      toast.error('Please select a company');
      return;
    }
    const selectedCompany = companies.find(c => c.id === selectedCompanyId);
    if (selectedCompany) {
      navigate(`/onboard/${selectedCompany.slug}/manager`);
    }
  };

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      setCreatingCompany(true);
      const newCompany = await api.createPublicCompany({ name: newCompanyName.trim() });
      toast.success('Company created successfully');
      navigate(`/onboard/${newCompany.slug}/manager`);
    } catch (error) {
      toast.error(error.message || 'Failed to create company');
      console.error(error);
    } finally {
      setCreatingCompany(false);
    }
  };

  const resetForm = () => {
    setCurrentForm({
      name: '',
      description: '',
      facing: '',
      serverEnvironment: '',
      businessCriticality: '',
      criticalAspects: [],
      criticalAspectsOther: '',
      devTeamContact: '',
    });
  };

  const handleCriticalAspectChange = (aspect) => {
    setCurrentForm(prev => {
      const aspects = prev.criticalAspects || [];
      if (aspects.includes(aspect)) {
        return { ...prev, criticalAspects: aspects.filter(a => a !== aspect) };
      } else {
        return { ...prev, criticalAspects: [...aspects, aspect] };
      }
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
      // Format criticalAspects - combine selected aspects with "Other" if provided
      const criticalAspects = [...(currentForm.criticalAspects || [])];
      if (currentForm.criticalAspectsOther && currentForm.criticalAspectsOther.trim()) {
        criticalAspects.push(`Other: ${currentForm.criticalAspectsOther.trim()}`);
      }
      
      appsToSubmit.push({
        ...currentForm,
        criticalAspects: criticalAspects.length > 0 ? criticalAspects : null,
      });
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

    // Check if at least one application has development team contact
    const hasDevTeamContact = submittedApplications.some(app => app.devTeamContact && app.devTeamContact.trim());

    // Build headers
    const headers = ['Application Name'];
    if (hasDevTeamContact) {
      headers.push('Development Team Contact');
    }
    headers.push('Invite Link');

    // Build rows
    const rows = submittedApplications.map(app => {
      const inviteLink = `${window.location.origin}/onboard/${slug}/application/${app.id}`;
      const row = [app.name || ''];
      if (hasDevTeamContact) {
        row.push(app.devTeamContact || '');
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

  // Show company selection if no slug provided
  if (!slug) {
    if (loading || loadingCompanies) {
      return <LoadingPage message="Loading companies..." />;
    }

    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              New Application Intake
            </h1>
            <p className="text-gray-600">
              Select your company or create a new one to get started.
            </p>
          </div>

          <Card>
            <CardContent>
              {!showCreateCompany ? (
                <div className="space-y-6">
                  <div>
                    <Select
                      label="Select Company *"
                      value={selectedCompanyId}
                      onChange={(e) => setSelectedCompanyId(e.target.value)}
                      options={[
                        { value: '', label: 'Choose a company...' },
                        ...companies.map(c => ({ value: c.id, label: c.name }))
                      ]}
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-sm text-gray-500">OR</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateCompany(true)}
                    className="w-full"
                  >
                    Create New Company
                  </Button>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleCompanySelect}
                    disabled={!selectedCompanyId}
                    className="w-full"
                  >
                    Continue
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <Input
                      label="Company Name *"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      placeholder="e.g. Acme Corporation"
                      required
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateCompany(false);
                        setNewCompanyName('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleCreateCompany}
                      disabled={!newCompanyName.trim() || creatingCompany}
                      className="flex-1"
                    >
                      {creatingCompany ? 'Creating...' : 'Create & Continue'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Existing flow when slug is provided
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
                      {app.devTeamContact && (
                        <p className="text-sm text-gray-600">Dev Team: {app.devTeamContact}</p>
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
                      {isClipboardAvailable() && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            copyToClipboard(
                              `${window.location.origin}/onboard/${slug}/application/${app.id}`,
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
                      {app.devTeamContact && (
                        <p className="text-sm text-gray-600">Dev Team: {app.devTeamContact}</p>
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
                  label="What is the business purpose of your application? *"
                  value={currentForm.description}
                  onChange={(e) => setCurrentForm({ ...currentForm, description: e.target.value })}
                  rows={3}
                  required
                />
              </div>

              <div>
                <RadioGroup label="Is it externally accessible? *">
                  <Radio
                    name="facing"
                    value="External"
                    checked={currentForm.facing === 'External'}
                    onChange={(e) => setCurrentForm({ ...currentForm, facing: e.target.value })}
                    label="Yes"
                  />
                  <Radio
                    name="facing"
                    value="Internal"
                    checked={currentForm.facing === 'Internal'}
                    onChange={(e) => setCurrentForm({ ...currentForm, facing: e.target.value })}
                    label="No"
                  />
                </RadioGroup>
              </div>

              <div>
                <Select
                  label="Where is it hosted? *"
                  value={currentForm.serverEnvironment || ''}
                  onChange={(e) => setCurrentForm({ ...currentForm, serverEnvironment: e.target.value })}
                  required
                  options={[
                    { value: '', label: 'Select hosting location' },
                    { value: 'Cloud', label: 'Cloud' },
                    { value: 'On-Prem', label: 'On-Prem' },
                    { value: 'Both', label: 'Both' },
                  ]}
                />
              </div>

              <div>
                <RadioGroup label="How critical is this application to your business? (5 Being most critical) *">
                  {[1, 2, 3, 4, 5].map(num => (
                    <Radio
                      key={num}
                      name="businessCriticality"
                      value={num.toString()}
                      checked={currentForm.businessCriticality === num.toString()}
                      onChange={(e) => setCurrentForm({ ...currentForm, businessCriticality: e.target.value })}
                      label={num.toString()}
                    />
                  ))}
                </RadioGroup>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What is most critical about this application? *
                </label>
                <div className="space-y-2">
                  <Checkbox
                    id="critical-availability"
                    label="Availability"
                    checked={currentForm.criticalAspects?.includes('Availability')}
                    onChange={() => handleCriticalAspectChange('Availability')}
                  />
                  <Checkbox
                    id="critical-data-handling"
                    label="Data Handling"
                    checked={currentForm.criticalAspects?.includes('Data Handling')}
                    onChange={() => handleCriticalAspectChange('Data Handling')}
                  />
                  <Checkbox
                    id="critical-confidentiality"
                    label="Confidentiality"
                    checked={currentForm.criticalAspects?.includes('Confidentiality')}
                    onChange={() => handleCriticalAspectChange('Confidentiality')}
                  />
                  <Checkbox
                    id="critical-integrity"
                    label="Integrity"
                    checked={currentForm.criticalAspects?.includes('Integrity')}
                    onChange={() => handleCriticalAspectChange('Integrity')}
                  />
                  <div className="ml-6 mt-2">
                    <Input
                      label="Other"
                      value={currentForm.criticalAspectsOther}
                      onChange={(e) => setCurrentForm({ ...currentForm, criticalAspectsOther: e.target.value })}
                      placeholder="Please specify"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Textarea
                  label="Please provide development team contact info"
                  value={currentForm.devTeamContact}
                  onChange={(e) => setCurrentForm({ ...currentForm, devTeamContact: e.target.value })}
                  rows={3}
                  placeholder="Name, email, phone, etc."
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
