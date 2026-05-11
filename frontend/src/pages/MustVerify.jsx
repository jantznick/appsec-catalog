import useAuthStore from '../store/authStore.js';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button.jsx';

export function MustVerify() {
  const { user, logout } = useAuthStore();

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

        {user?.isAdmin && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 mb-3">
              <strong>Admin Access:</strong> As an administrator, you can verify users from the Users management page.
            </p>
            <Link to="/users">
              <Button variant="primary" className="w-full">
                Go to Users Management
              </Button>
            </Link>
          </div>
        )}

        <div className="pt-6 border-t border-gray-200">
          <Button
            variant="outline"
            onClick={logout}
            className="w-full"
          >
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
}

