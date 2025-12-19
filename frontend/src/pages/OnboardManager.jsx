import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Alert } from '../components/ui/Alert.jsx';

export function OnboardManager() {
  const { slug } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // Will store the created application

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
      setFormData(prev => ({
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Application name is required');
      return;
    }

    try {
      setSubmitting(true);
      // Create application with executive info only (status: pending_technical)
      const result = await api.createApplicationOnboardExecutive({
        companySlug: slug,
        name: formData.name,
        description: formData.description,
        owner: formData.owner,
        repoUrl: formData.repoUrl,
        language: formData.language,
        framework: formData.framework,
        serverEnvironment: formData.serverEnvironment,
        facing: formData.facing,
        deploymentType: formData.deploymentType,
        authProfiles: formData.authProfiles,
        dataTypes: formData.dataTypes,
      });
      
      toast.success('Application submitted successfully!');
      setSubmitted(result.application);
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
                Copy this link and send it to the engineering manager of this application to finish the technical onboarding.
              </p>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Technical Form URL:</p>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${window.location.origin}/onboard/${slug}/application/${submitted.id}`}
                      readOnly
                      className="font-mono text-sm"
                      onClick={(e) => e.target.select()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/onboard/${slug}/application/${submitted.id}`);
                        toast.success('Link copied to clipboard');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <Button 
                  onClick={() => {
                    setSubmitted(null);
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
                    });
                  }} 
                  variant="outline" 
                  className="w-full"
                >
                  Submit Another Application
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
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
            Provide basic information about your application.
          </p>
        </div>

        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Input
                  label="Application Name *"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g. Customer Portal"
                />
              </div>

              <div>
                <Textarea
                  label="Description / Use Case"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <hr className="my-6" />

              <div>
                <h2 className="text-xl font-semibold text-gray-700 mb-2">Application Details</h2>
              </div>

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div>
                <Input
                  label="Necessary Auth Profiles"
                  value={formData.authProfiles}
                  onChange={(e) => setFormData({ ...formData, authProfiles: e.target.value })}
                />
              </div>

              <div>
                <Input
                  label="Data Types Collected/Stored"
                  value={formData.dataTypes}
                  onChange={(e) => setFormData({ ...formData, dataTypes: e.target.value })}
                  placeholder="e.g. PII, PCI"
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

