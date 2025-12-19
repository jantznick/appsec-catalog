import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AuthModal } from './AuthModal.jsx';
import { Dropdown, DropdownItem } from './ui/Dropdown.jsx';
import { api } from '../lib/api.js';

export function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isAuthenticated, loading } = useAuthStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [companyName, setCompanyName] = useState(null);

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

  const loadCompanyName = async (companyId) => {
    if (!companyId) return;
    try {
      const company = await api.getCompany(companyId);
      setCompanyName(company.name);
    } catch (error) {
      console.error('Failed to load company name:', error);
    }
  };

  // Load company name for non-admin users
  useEffect(() => {
    if (user && user.companyId && !user.isAdmin) {
      loadCompanyName(user.companyId);
    } else {
      setCompanyName(null);
    }
  }, [user]);

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
            {/* Left side: Title, Dashboard, Documentation */}
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-xl font-bold text-gray-900">
                AppSec Catalog
              </Link>
              <div className="hidden md:flex items-center space-x-4">
                {isAuthenticated() && (
                  <Link
                    to="/dashboard"
                    className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                  >
                    Dashboard
                  </Link>
                )}
                <Link
                  to="/docs"
                  className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                >
                  Documentation
                </Link>
              </div>
            </div>

            {/* Right side: Dropdown menu with email and logout */}
            <div className="flex items-center space-x-4">
              {isAuthenticated() && user ? (
                <>
                  <Dropdown
                    trigger={
                      <button className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                          />
                        </svg>
                      </button>
                    }
                    align="right"
                  >
                    {!isAdmin() && user?.companyId && companyName ? (
                      <DropdownItem
                        onClick={() => {
                          navigate(`/companies/${user.companyId}`);
                        }}
                      >
                        {companyName}
                      </DropdownItem>
                    ) : isAdmin() ? (
                      <DropdownItem
                        onClick={() => {
                          navigate('/companies');
                        }}
                      >
                        All Companies
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      onClick={() => {
                        navigate('/applications');
                      }}
                    >
                      Applications
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        navigate('/domains');
                      }}
                    >
                      Domains
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        navigate('/users');
                      }}
                    >
                      Users
                    </DropdownItem>
                    {isAdmin() && (
                      <>
                        <DropdownItem divider />
                        <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Utils
                        </div>
                        <DropdownItem
                          onClick={() => {
                            navigate('/components');
                          }}
                        >
                          Components
                        </DropdownItem>
                      </>
                    )}
                  </Dropdown>
                  <span className="text-sm text-gray-700">{user.email}</span>
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

