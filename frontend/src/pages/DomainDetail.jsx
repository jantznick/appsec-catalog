import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { toast } from '../components/ui/Toast.jsx';
import { LoadingPage } from '../components/ui/Loading.jsx';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table.jsx';
import useAuthStore from '../store/authStore.js';

export function DomainDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuthStore();
  const [domain, setDomain] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDomain();
    }
  }, [id]);

  const loadDomain = async () => {
    try {
      setLoading(true);
      const data = await api.getDomain(id);
      setDomain(data);
    } catch (error) {
      toast.error('Failed to load hosting domain');
      console.error(error);
      navigate('/domains');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingPage message="Loading hosting domain..." />;
  }

  if (!domain) {
    return null;
  }

  return (
    <div>
      <div className="mb-8">
        <button
          onClick={() => navigate('/domains')}
          className="text-blue-600 hover:text-blue-700 mb-4"
        >
          ← Back to Hosting Domains
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{domain.name}</h1>
            <p className="text-gray-600">
              Hosting domain {domain.company?.name && `• Company: ${domain.company.name}`}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Associated Applications ({domain.applications?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent padding="none">
          {domain.applications && domain.applications.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application Name</TableHead>
                  <TableHead>Owner</TableHead>
                  {isAdmin() && <TableHead>Company</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {domain.applications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Link
                        to={`/applications/${application.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {application.name}
                      </Link>
                    </TableCell>
                    <TableCell>{application.owner || '—'}</TableCell>
                    {isAdmin() && (
                      <TableCell>
                        {application.company ? (
                          <Link
                            to={`/companies/${application.company.id}`}
                            className="text-gray-700 hover:text-blue-600"
                          >
                            {application.company.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        application.status === 'onboarded' 
                          ? 'bg-green-100 text-green-800'
                          : application.status === 'pending_technical'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {application.status || 'onboarded'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/applications/${application.id}`}
                        className="text-blue-600 hover:text-blue-700 text-sm"
                      >
                        View →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-4 text-center text-gray-500">
              No applications hosted on this domain
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

