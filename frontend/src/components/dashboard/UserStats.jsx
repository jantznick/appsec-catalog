import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../../store/authStore.js';
import { api } from '../../lib/api.js';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { LoadingPage } from '../ui/Loading.jsx';

export function UserStats() {
  const { user } = useAuthStore();
  const [scoreData, setScoreData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCompanyScores = async () => {
      if (!user?.companyId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await api.getCompanyAverageScore(user.companyId);
        setScoreData(data);
      } catch (error) {
        console.error('Failed to load company scores:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCompanyScores();
  }, [user]);

  if (loading) {
    return <LoadingPage message="Loading dashboard..." />;
  }

  if (!scoreData) {
    return null;
  }

  return (
    <>
      {/* Score Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Average Score Card */}
        {scoreData.averageScore !== null && (
          <Link to={`/applications?companyId=${user.companyId}`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Average Score 📊</CardTitle>
                  <Link
                    to="/docs/scoring-methodology"
                    className="text-xs text-blue-600 hover:text-blue-700"
                    target="_blank"
                    onClick={(e) => e.stopPropagation()}
                  >
                    How? →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-3xl font-bold mb-1 ${
                    scoreData.averageScore >= 76 ? 'text-green-600' :
                    scoreData.averageScore >= 51 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {scoreData.averageScore}/100
                  </div>
                  <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                    scoreData.averageScore >= 76 ? 'bg-green-100 text-green-800' :
                    scoreData.averageScore >= 51 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {scoreData.averageScore >= 76 ? 'Excellent' : scoreData.averageScore >= 51 ? 'Good' : 'Needs Improvement'}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}

          {/* Highest Score Card */}
          {scoreData.highestApplication && (
            <Link to={`/applications/${scoreData.highestApplication.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-sm">Highest Score 👑</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-1 text-green-600">
                      {scoreData.highestApplication.score}/100
                    </div>
                    <div className="text-sm text-blue-600 hover:text-blue-700 block truncate" title={scoreData.highestApplication.name}>
                      {scoreData.highestApplication.name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Lowest Score Card */}
          {scoreData.lowestApplication && (
            <Link to={`/applications/${scoreData.lowestApplication.id}`}>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-sm">Lowest Score 🗑️</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-3xl font-bold mb-1 text-red-600">
                      {scoreData.lowestApplication.score}/100
                    </div>
                    <div className="text-sm text-blue-600 hover:text-blue-700 block truncate" title={scoreData.lowestApplication.name}>
                      {scoreData.lowestApplication.name}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

      {/* View All Applications Link */}
      <div className="text-center mb-8">
        <Link
          to={`/applications?companyId=${user.companyId}`}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          View all applications →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full">
          <div className="flex-grow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Applications</h2>
            <p className="text-gray-600 mb-4">
              View and manage applications in your company.
            </p>
          </div>
          <Link to="/applications" className="mt-auto">
            <Button variant="primary" className="w-full">
              Manage Applications
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full">
          <div className="flex-grow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Users</h2>
            <p className="text-gray-600 mb-4">
              View and manage users in your company.
            </p>
          </div>
          <Link to="/users" className="mt-auto">
            <Button variant="primary" className="w-full">
              Manage Users
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full">
          <div className="flex-grow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Domains</h2>
            <p className="text-gray-600 mb-4">
              View and manage hosting domains for your company's applications.
            </p>
          </div>
          <Link to="/domains" className="mt-auto">
            <Button variant="primary" className="w-full">
              Manage Domains
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 flex flex-col h-full">
          <div className="flex-grow">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Documentation</h2>
            <p className="text-gray-600 mb-4">
              Access comprehensive guides and resources for application security.
            </p>
          </div>
          <Link to="/docs" className="mt-auto">
            <Button variant="primary" className="w-full">
              View Documentation
            </Button>
          </Link>
        </div>
      </div>
    </>
  );
}


