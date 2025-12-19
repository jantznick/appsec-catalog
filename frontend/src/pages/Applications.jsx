import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Select } from '../components/ui/Select.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';
import { calculateCompleteness } from '../utils/applicationCompleteness.js';

export function Applications() {
  const { isAdmin } = useAuthStore();
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    companyId: '',
    status: '',
    search: '',
  });

  useEffect(() => {
    if (isAdmin()) {
      loadCompanies();
    }
    loadApplications();
  }, []);

  useEffect(() => {
    // Only reload when filters change if admin (regular users don't have filters)
    if (isAdmin()) {
      loadApplications();
    }
  }, [filters]);

  const loadCompanies = async () => {
    try {
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load companies:', error);
    }
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      let data;
      
      if (isAdmin()) {
        // Use admin endpoint with server-side filtering
        data = await api.getAdminApplications(filters);
      } else {
        // Use regular endpoint (backend filters by user's company)
        data = await api.getApplications();
      }
      
      setApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <LoadingPage message="Loading applications..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Applications</h1>
          <p className="text-gray-600">
            {isAdmin() ? 'Manage applications across all companies' : 'View your company applications'}
          </p>
        </div>
        <Link to="/applications/new">
          <Button variant="primary">New Application</Button>
        </Link>
      </div>

      {/* Admin Filters */}
      {isAdmin() && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Search"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Search by name or description..."
              />
              <Select
                label="Company"
                value={filters.companyId}
                onChange={(e) => handleFilterChange('companyId', e.target.value)}
                options={[
                  { value: '', label: 'All Companies' },
                  ...companies.map(c => ({ value: c.id, label: c.name })),
                ]}
              />
              <Select
                label="Status"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                options={[
                  { value: '', label: 'All Statuses' },
                  { value: 'onboarded', label: 'Onboarded' },
                  { value: 'pending_technical', label: 'Pending Technical' },
                  { value: 'pending_executive', label: 'Pending Executive' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Applications Table */}
      {applications.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin() 
                  ? 'No applications found. Create your first application to get started.'
                  : 'No applications found in your company.'}
              </p>
              <Link to="/applications/new">
                <Button variant="primary">Create Application</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent padding="none">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        to={`/applications/${app.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {app.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {isAdmin() && app.companyId ? (
                        <Link
                          to={`/companies/${app.companyId}`}
                          className="text-gray-700 hover:text-blue-600"
                        >
                          {app.company?.name || '—'}
                        </Link>
                      ) : (
                        <span>{app.company?.name || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>{app.owner || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          app.status === 'onboarded' 
                            ? 'bg-green-100 text-green-800'
                            : app.status === 'pending_technical'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {app.status || 'onboarded'}
                        </span>
                        {(() => {
                          const completeness = calculateCompleteness(app);
                          return (
                            <span className="text-xs text-gray-500">
                              {completeness.filled}/{completeness.total} ({completeness.percentage}%)
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link to={`/applications/${app.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

