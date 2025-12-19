import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import useAuthStore from '../store/authStore.js';

export function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [averageScore, setAverageScore] = useState(null);

  // Form state
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

  useEffect(() => {
    if (id) {
      loadCompany();
      loadAverageScore();
    }
  }, [id]);

  const loadAverageScore = async () => {
    try {
      const data = await api.getCompanyAverageScore(id);
      setAverageScore(data.averageScore);
    } catch (error) {
      console.error('Failed to load average score:', error);
    }
  };

  const loadCompany = async () => {
    try {
      setLoading(true);
      const data = await api.getCompany(id);
      setCompany(data);
      setFormData({
        name: data.name || '',
        domains: data.domains || '',
        engManager: data.engManager || '',
        language: data.language || '',
        framework: data.framework || '',
        serverEnvironment: data.serverEnvironment || '',
        facing: data.facing || '',
        deploymentType: data.deploymentType || '',
        authProfiles: data.authProfiles || '',
        dataTypes: data.dataTypes || '',
      });
    } catch (error) {
      toast.error('Failed to load company');
      console.error(error);
      navigate('/companies');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin()) {
      toast.error('Only admins can edit companies');
      return;
    }

    try {
      setSaving(true);
      await api.updateCompany(id, formData);
      toast.success('Company updated successfully');
      loadCompany();
    } catch (error) {
      toast.error(error.message || 'Failed to update company');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this user from the company?')) {
      return;
    }

    try {
      await api.removeUserFromCompany(id, userId);
      toast.success('User removed from company');
      loadCompany();
    } catch (error) {
      toast.error(error.message || 'Failed to remove user');
    }
  };

  const handleAddUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setLoadingUsers(true);
      // Get all users to find the one with this email
      const users = await api.getAllUsers();
      const user = users.find(u => u.email.toLowerCase() === newUserEmail.trim().toLowerCase());

      if (!user) {
        toast.error('User not found. They may need to register first.');
        return;
      }

      await api.assignUserToCompany(id, user.id);
      toast.success('User added to company');
      setNewUserEmail('');
      setShowAddUserModal(false);
      loadCompany();
    } catch (error) {
      toast.error(error.message || 'Failed to add user');
    } finally {
      setLoadingUsers(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading company..." />;
  }

  if (!company) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/companies')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Companies
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{company.name}</h1>
        <p className="text-gray-600">Company details and settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Average Score Card */}
          {averageScore !== null && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Average Application Score</CardTitle>
                  <Link
                    to="/docs/scoring-methodology"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    target="_blank"
                  >
                    How is this calculated? →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-2 ${
                    averageScore >= 76 ? 'text-green-600' :
                    averageScore >= 51 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {averageScore}
                  </div>
                  <div className="text-sm text-gray-600">out of 100</div>
                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mt-2 ${
                    averageScore >= 76 ? 'bg-green-100 text-green-800' :
                    averageScore >= 51 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {averageScore >= 76 ? 'Excellent' : averageScore >= 51 ? 'Good' : 'Needs Improvement'}
                  </div>
                  <div className="mt-4">
                    <Link
                      to={`/applications?companyId=${id}`}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      View all applications →
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

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
                  disabled={!isAdmin()}
                  required
                />
                <Textarea
                  label="Domains (comma-separated)"
                  value={formData.domains}
                  onChange={(e) => setFormData({ ...formData, domains: e.target.value })}
                  disabled={!isAdmin()}
                  placeholder="example.com, subdomain.example.com"
                  helperText="Email domains that will automatically assign users to this company"
                />
                <Input
                  label="Engineering Manager"
                  value={formData.engManager}
                  onChange={(e) => setFormData({ ...formData, engManager: e.target.value })}
                  disabled={!isAdmin()}
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
                These settings will be used as defaults when onboarding new applications for this company.
              </p>
              <div className="space-y-4">
                <Input
                  label="Language"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  disabled={!isAdmin()}
                />
                <Input
                  label="Framework"
                  value={formData.framework}
                  onChange={(e) => setFormData({ ...formData, framework: e.target.value })}
                  disabled={!isAdmin()}
                />
                <Input
                  label="Server Environment"
                  value={formData.serverEnvironment}
                  onChange={(e) => setFormData({ ...formData, serverEnvironment: e.target.value })}
                  disabled={!isAdmin()}
                />
                <Input
                  label="Facing"
                  value={formData.facing}
                  onChange={(e) => setFormData({ ...formData, facing: e.target.value })}
                  disabled={!isAdmin()}
                  placeholder="e.g., Internal, External"
                />
                <Input
                  label="Deployment Type"
                  value={formData.deploymentType}
                  onChange={(e) => setFormData({ ...formData, deploymentType: e.target.value })}
                  disabled={!isAdmin()}
                />
                <Input
                  label="Auth Profiles"
                  value={formData.authProfiles}
                  onChange={(e) => setFormData({ ...formData, authProfiles: e.target.value })}
                  disabled={!isAdmin()}
                />
                <Input
                  label="Data Types"
                  value={formData.dataTypes}
                  onChange={(e) => setFormData({ ...formData, dataTypes: e.target.value })}
                  disabled={!isAdmin()}
                />
              </div>
            </CardContent>
          </Card>

          {isAdmin() && (
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Public Onboarding Form */}
          {company.slug && (
            <Card>
              <CardHeader>
                <CardTitle>Public Onboarding Form</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Share this link with executives to submit basic application information.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-1 block">Onboarding URL</label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={`${window.location.origin}/onboard/${company.slug}/manager`}
                        readOnly
                        className="font-mono text-sm"
                        onClick={(e) => e.target.select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/onboard/${company.slug}/manager`);
                          toast.success('Link copied to clipboard');
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                  <Link
                    to={`/onboard/${company.slug}/manager`}
                    target="_blank"
                    className="block"
                  >
                    <Button variant="primary" className="w-full">
                      View Onboarding Form
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Users */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Users ({company.users?.length || 0})</CardTitle>
                {isAdmin() && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowAddUserModal(true)}
                  >
                    Add User
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent padding="none">
              {company.users && company.users.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      {isAdmin() && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {company.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{user.email}</div>
                            <div className="text-xs text-gray-500 space-x-2">
                              {user.verifiedAccount && (
                                <span className="text-green-600">Verified</span>
                              )}
                              {user.isAdmin && (
                                <span className="text-purple-600">Admin</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {isAdmin() && (
                          <TableCell>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveUser(user.id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-center text-gray-500">
                  No users assigned
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUserModal}
        onClose={() => {
          setShowAddUserModal(false);
          setNewUserEmail('');
        }}
        title="Add User to Company"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowAddUserModal(false);
                setNewUserEmail('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddUser}
              loading={loadingUsers}
            >
              Add User
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="User Email"
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            placeholder="user@example.com"
            helperText="Enter the email address of the user to add"
            required
          />
        </div>
      </Modal>
    </div>
  );
}

