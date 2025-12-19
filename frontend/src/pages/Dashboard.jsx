import useAuthStore from '../store/authStore.js';
import { AdminStats } from '../components/dashboard/AdminStats.jsx';
import { UserStats } from '../components/dashboard/UserStats.jsx';

export function Dashboard() {
  const { isAdmin } = useAuthStore();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isAdmin() ? 'Admin Dashboard' : 'Dashboard'}
        </h1>
        <p className="text-gray-600">
          {isAdmin() ? 'Overview of the entire system' : 'Welcome to AppSec Catalog'}
        </p>
      </div>

      {isAdmin() ? <AdminStats /> : <UserStats />}
    </div>
  );
}

