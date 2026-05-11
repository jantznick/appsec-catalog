import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { user, loading, isAuthenticated, isVerified } = useAuthStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (!isVerified()) {
    return <Navigate to="/must-verify" replace />;
  }
  // User is authenticated and verified - render the protected content
  return <>{children}</>;
}

