import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore.js';
import { api } from '../lib/api.js';

export function MustVerify() {
  const { user, logout } = useAuthStore();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only admins and company members can see pending users
    if (user?.isAdmin || user?.companyId) {
      loadPendingUsers();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadPendingUsers = async () => {
    try {
      const users = await api.getPendingUsers();
      setPendingUsers(users || []);
    } catch (error) {
      console.error('Failed to load pending users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId) => {
    try {
      await api.verifyUser(userId);
      // Reload pending users
      await loadPendingUsers();
      // Refresh current user to check if they're now verified
      const authStore = useAuthStore.getState();
      await authStore.init();
    } catch (error) {
      alert(error.message || 'Failed to verify user');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Account Verification Required
          </h1>
          <p className="text-gray-600">
            Your account is pending verification. Please wait for an administrator or company member to verify your account.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Email:</strong> {user?.email}
          </p>
          {user?.company && (
            <p className="text-sm text-blue-800 mt-1">
              <strong>Company:</strong> {user.company.name}
            </p>
          )}
        </div>

        {(user?.isAdmin || user?.companyId) && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Pending Users in Your Company
            </h2>
            {loading ? (
              <div className="text-center py-8 text-gray-600">Loading...</div>
            ) : pendingUsers.length === 0 ? (
              <p className="text-gray-600 text-center py-4">
                No pending users in your company.
              </p>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((pendingUser) => (
                  <div
                    key={pendingUser.id}
                    className="flex items-center justify-between bg-gray-50 rounded-lg p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{pendingUser.email}</p>
                      {pendingUser.company && (
                        <p className="text-sm text-gray-600">{pendingUser.company.name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleVerify(pendingUser.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Verify
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

