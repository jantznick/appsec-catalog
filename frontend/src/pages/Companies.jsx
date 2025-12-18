import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';

export function Companies() {
  const { isAdmin } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const data = await api.getCompanies();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading companies..." />;
  }

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Companies</h1>
          <p className="text-gray-600">
            {isAdmin() ? 'Manage all companies' : 'View your company'}
          </p>
        </div>
        {isAdmin() && (
          <Link to="/companies/new">
            <Button variant="primary">Create Company</Button>
          </Link>
        )}
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {isAdmin() ? 'No companies found. Create your first company to get started.' : 'You are not assigned to any company.'}
              </p>
              {isAdmin() && (
                <Link to="/companies/new">
                  <Button variant="primary">Create Company</Button>
                </Link>
              )}
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
                  <TableHead>Domains</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Applications</TableHead>
                  {isAdmin() && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>
                      <Link
                        to={`/companies/${company.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {company.domains || (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>{company._count?.users || 0}</TableCell>
                    <TableCell>{company._count?.applications || 0}</TableCell>
                    {isAdmin() && (
                      <TableCell>
                        <Link to={`/companies/${company.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    )}
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

