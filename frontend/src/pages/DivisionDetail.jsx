import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Textarea } from '../components/ui/Textarea.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';

export function DivisionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [division, setDivision] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id && isAdmin()) {
      loadDivision();
      loadStats();
    }
  }, [id, isAdmin]);

  const loadDivision = async () => {
    try {
      setLoading(true);
      const data = await api.getDivision(id);
      setDivision(data);
      setFormData({
        name: data.name || '',
        description: data.description || '',
      });
    } catch (error) {
      toast.error('Failed to load division');
      console.error(error);
      navigate('/divisions');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getDivisionStats(id);
      setStats(data);
    } catch (error) {
      console.error('Failed to load division stats:', error);
    }
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Division name is required');
      return;
    }

    try {
      setSaving(true);
      await api.updateDivision(id, formData);
      toast.success('Division updated successfully');
      setShowEditModal(false);
      await loadDivision();
    } catch (error) {
      toast.error(error.message || 'Failed to update division');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin()) {
    return (
      <div>
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500">You do not have permission to view this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <LoadingPage message="Loading division..." />;
  }

  if (!division) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/divisions')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Divisions
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800 mb-2">{division.name}</h1>
            {division.description && (
              <p className="text-gray-600">{division.description}</p>
            )}
          </div>
          <Button variant="primary" onClick={handleEdit}>
            Edit Division
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Average Score</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.averageScore !== null ? (
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-1 ${
                    stats.averageScore >= 76 ? 'text-green-600' :
                    stats.averageScore >= 51 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {stats.averageScore}/100
                  </div>
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    stats.averageScore >= 76 ? 'bg-green-100 text-green-800' :
                    stats.averageScore >= 51 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {stats.averageScore >= 76 ? 'Excellent' : stats.averageScore >= 51 ? 'Good' : 'Needs Improvement'}
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-400">No data</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Companies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-semibold text-gray-800">{stats.companyCount}</div>
                <div className="text-xs text-gray-500 mt-1">Total companies</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <div className="text-3xl font-semibold text-gray-800">{stats.applicationCount}</div>
                <div className="text-xs text-gray-500 mt-1">Total applications</div>
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Best and Worst Companies */}
      {stats && (stats.bestCompany || stats.worstCompany) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {stats.bestCompany && (
            <Card className="border-green-200 bg-green-50/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-green-600">🏆</span>
                  Best Performing Company
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link to={`/companies/${stats.bestCompany.id}`} className="block">
                  <div className="text-lg font-semibold text-gray-800 mb-2 hover:text-blue-600">
                    {stats.bestCompany.name}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className={`text-2xl font-bold ${
                        stats.bestCompany.averageScore >= 76 ? 'text-green-600' :
                        stats.bestCompany.averageScore >= 51 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stats.bestCompany.averageScore}/100
                      </div>
                      <div className="text-xs text-gray-500">Average Score</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-gray-800">
                        {stats.bestCompany.applicationCount}
                      </div>
                      <div className="text-xs text-gray-500">Applications</div>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {stats.worstCompany && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="text-red-600">⚠️</span>
                  Needs Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link to={`/companies/${stats.worstCompany.id}`} className="block">
                  <div className="text-lg font-semibold text-gray-800 mb-2 hover:text-blue-600">
                    {stats.worstCompany.name}
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <div className={`text-2xl font-bold ${
                        stats.worstCompany.averageScore >= 76 ? 'text-green-600' :
                        stats.worstCompany.averageScore >= 51 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {stats.worstCompany.averageScore}/100
                      </div>
                      <div className="text-xs text-gray-500">Average Score</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold text-gray-800">
                        {stats.worstCompany.applicationCount}
                      </div>
                      <div className="text-xs text-gray-500">Applications</div>
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Companies in Division</CardTitle>
        </CardHeader>
        <CardContent>
          {stats && stats.companies.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Applications</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.companies.map((company) => (
                  <TableRow 
                    key={company.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => navigate(`/companies/${company.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium text-blue-600 hover:text-blue-700">
                        {company.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      {company.averageScore !== null ? (
                        <span className={`text-sm font-medium ${
                          company.averageScore >= 76 ? 'text-green-600' :
                          company.averageScore >= 51 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {company.averageScore}/100
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{company.applicationCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">No companies in this division yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {showEditModal && (
        <Modal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setFormData({
              name: division.name || '',
              description: division.description || '',
            });
          }}
          title="Edit Division"
        >
          <form onSubmit={handleSave}>
            <div className="space-y-4">
              <Input
                label="Division Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder="e.g., Engineering, Sales, Operations"
              />
              <Textarea
                label="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Optional description of this division"
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setFormData({
                      name: division.name || '',
                      description: division.description || '',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving}>
                  Update
                </Button>
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

