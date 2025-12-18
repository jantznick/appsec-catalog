import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AuthModal } from './AuthModal.jsx';

export function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isAuthenticated } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');

  // Open auth modal when on /login or /register routes
  useEffect(() => {
    if (location.pathname === '/login') {
      setAuthMode('login');
      setShowAuthModal(true);
    } else if (location.pathname === '/register') {
      setAuthMode('register');
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    // Navigate away from /login or /register if modal is closed
    if (location.pathname === '/login' || location.pathname === '/register') {
      navigate('/');
    }
  };

  const openAuthModal = (mode) => {
    setAuthMode(mode);
    setShowAuthModal(true);
    navigate(mode === 'login' ? '/login' : '/register');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-gray-900">
                AppSec Catalog
              </Link>
              <div className="hidden md:flex items-center space-x-4">
                {isAuthenticated() && (
                  <>
                    <Link
                      to="/dashboard"
                      className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/companies"
                      className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                    >
                      Companies
                    </Link>
                    <Link
                      to="/applications"
                      className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                    >
                      Applications
                    </Link>
                  </>
                )}
                <Link
                  to="/docs"
                  className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Documentation
                </Link>
                {isAuthenticated() && isAdmin() && (
                  <Link
                    to="/components"
                    className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                  >
                    Components
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated() && user ? (
                <>
                  <span className="text-sm text-gray-700">{user.email}</span>
                  {isAdmin() && (
                    <Link
                      to="/dashboard"
                      className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded hover:bg-purple-200 transition-colors"
                    >
                      Admin
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => openAuthModal('register')}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Sign Up
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <AuthModal
        isOpen={showAuthModal}
        onClose={handleAuthModalClose}
        initialMode={authMode}
      />
    </div>
  );
}

