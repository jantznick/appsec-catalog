import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore.js';
import { AdminStats } from '../components/dashboard/AdminStats.jsx';
import { UserStats } from '../components/dashboard/UserStats.jsx';
import { api } from '../lib/api.js';

export function Dashboard() {
  const { isAdmin, user, loading } = useAuthStore();
  const [companyName, setCompanyName] = useState(null);

  const loadCompanyName = async (companyId) => {
    if (!companyId) return;
    try {
      const company = await api.getCompany(companyId);
      setCompanyName(company.name);
    } catch (error) {
      console.error('Failed to load company name:', error);
    }
  };

  useEffect(() => {
    if (!user || user.isAdmin || !user.companyId) {
      setCompanyName(null);
      return;
    }
    // Prefer name from /api/auth/me (avoids extra round-trip; works even if session lags DB briefly)
    if (user.company?.name) {
      setCompanyName(user.company.name);
      return;
    }
    loadCompanyName(user.companyId);
  }, [user]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {isAdmin() ? 'Admin Dashboard' : companyName ? `Dashboard - ${companyName}` : 'Dashboard'}
        </h1>
        <p className="text-gray-600">
          {isAdmin() ? 'Overview of the entire system' : 'Welcome to AppSec Catalog'}
        </p>
      </div>

      {isAdmin() ? <AdminStats /> : <UserStats />}
    </div>
  );
}

