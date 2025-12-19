import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Select } from '../components/ui/Select.jsx';
import useAuthStore from '../store/authStore.js';

export function CompanyNew() {
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    domains: '',
    engManager: '',
    language: '',
    framework: '',
    serverEnvironment: '',
    facing: '',
    deploymentType: '',
    authProfiles: '',
    dataTypes: '',
  });

  // Redirect if not admin
  if (!isAdmin()) {
    navigate('/companies');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Company name is required');
      return;
    }

    try {
      setSaving(true);
      const company = await api.createCompany(formData);
      toast.success('Company created successfully');
      navigate(`/companies/${company.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create company');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/companies')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Companies
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Company</h1>
        <p className="text-gray-600">Add a new company to the system</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  label="Company Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
                <Textarea
                  label="Email Domains (comma-separated)"
                  value={formData.domains}
                  onChange={(e) => setFormData({ ...formData, domains: e.target.value })}
                  placeholder="example.com, subdomain.example.com"
                  helperText="Email domains that will automatically assign users to this company (different from hosting domains where applications are hosted)"
                />
                <Input
                  label="Engineering Manager"
                  value={formData.engManager}
                  onChange={(e) => setFormData({ ...formData, engManager: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Default Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                These settings will be used as defaults when onboarding new applications.
              </p>
              <div className="space-y-4">
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
                />
                <Input
                  label="Auth Profiles"
                  value={formData.authProfiles}
                  onChange={(e) => setFormData({ ...formData, authProfiles: e.target.value })}
                />
                <Input
                  label="Data Types"
                  value={formData.dataTypes}
                  onChange={(e) => setFormData({ ...formData, dataTypes: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/companies')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={saving}
          >
            Create Company
          </Button>
        </div>
      </form>
    </div>
  );
}


