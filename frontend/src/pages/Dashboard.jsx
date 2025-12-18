import { Link } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AdminDashboard } from './AdminDashboard.jsx';

export function Dashboard() {
  const { user, isAdmin } = useAuthStore();
  
  // Show admin dashboard if user is admin
  if (isAdmin()) {
    return <AdminDashboard />;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome to AppSec Catalog</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Account Status</h3>
          <p className="text-2xl font-bold text-gray-900">
            {user?.verifiedAccount ? 'Verified' : 'Pending'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Company</h3>
          <p className="text-2xl font-bold text-gray-900">
            {user?.company?.name || 'None'}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Role</h3>
          <p className="text-2xl font-bold text-gray-900">
            {isAdmin() ? 'Administrator' : 'User'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Getting Started</h2>
        <p className="text-gray-600 mb-4">
          Your account is set up and ready to use. Start by exploring the features available to you.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Documentation</h2>
        <p className="text-gray-600 mb-4">
          Access comprehensive guides and resources for application security.
        </p>
        <Link
          to="/docs"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          View Documentation
        </Link>
      </div>
    </div>
  );
}

