import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';

export function Applications() {
  const { isAdmin } = useAuthStore();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCompany, setFilterCompany] = useState('');
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    loadApplications();
    if (isAdmin()) {
      loadCompanies();
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [filterCompany]);

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
      const data = await api.getApplications();
      let filtered = Array.isArray(data) ? data : [];
      
      // Filter by company if selected (admin only)
      if (filterCompany && isAdmin()) {
        filtered = filtered.filter(app => app.companyId === filterCompany);
      }
      
      setApplications(filtered);
    } catch (error) {
      toast.error('Failed to load applications');
      console.error(error);
    } finally {
      setLoading(false);
    }
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
            {isAdmin() ? 'Manage all applications' : 'View your company applications'}
          </p>
        </div>
        <Link to="/applications/new">
          <Button variant="primary">New Application</Button>
        </Link>
      </div>

      {isAdmin() && companies.length > 0 && (
        <Card className="mb-6">
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Filter by Company:</label>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

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
                    <TableCell>{app.company?.name || '—'}</TableCell>
                    <TableCell>{app.owner || '—'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        app.status === 'onboarded' 
                          ? 'bg-green-100 text-green-800'
                          : app.status === 'pending_technical'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {app.status || 'onboarded'}
                      </span>
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

