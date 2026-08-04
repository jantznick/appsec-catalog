import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AuthModal } from './AuthModal.jsx';
import { Dropdown, DropdownItem } from './ui/Dropdown.jsx';
import { api } from '../lib/api.js';
import { useToastStore } from './ui/Toast.jsx';
import { usePendingApprovals } from '../contexts/PendingApprovalsContext.jsx';

function DropdownSectionLabel({ children }) {
  return (
    <div className="px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
      {children}
    </div>
  );
}

export function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isAuthenticated, loading } = useAuthStore();
  const { globalPendingCount } = usePendingApprovals();
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

  // Company label for non-admins: prefer /me payload, fallback to GET company (session must allow access)
  useEffect(() => {
    if (!user || !user.companyId || user.isAdmin) {
      setCompanyName(null);
      return;
    }
    if (user.company?.name) {
      setCompanyName(user.company.name);
      return;
    }
    loadCompanyName(user.companyId);
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
              <Link to="/" className="text-xl font-bold text-gray-800">
                AppSec Catalog
              </Link>
              <div className="hidden md:flex items-center space-x-4">
                {isAuthenticated() && (
                  <Link
                    to="/dashboard"
                    className="text-sm text-gray-700 hover:text-gray-800 px-3 py-2 rounded-md"
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
                {isAuthenticated() && (
                  <Link
                    to="/whats-new"
                    className="text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md"
                  >
                    What&apos;s New
                  </Link>
                )}
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
                      <>
                        <DropdownSectionLabel>Company</DropdownSectionLabel>
                        <DropdownItem
                          onClick={() => {
                            navigate(`/companies/${user.companyId}`);
                          }}
                        >
                          {companyName}
                        </DropdownItem>
                      </>
                    ) : isAdmin() ? (
                      <>
                        <DropdownSectionLabel>Admin</DropdownSectionLabel>
                        <DropdownItem
                          onClick={() => {
                            navigate('/settings');
                          }}
                        >
                          Settings
                        </DropdownItem>
                        <DropdownItem
                          onClick={() => {
                            navigate('/pending-approvals');
                          }}
                          className="relative"
                        >
                          <span>Pending approvals</span>
                          {globalPendingCount > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                              {globalPendingCount > 99 ? '99+' : globalPendingCount}
                            </span>
                          )}
                        </DropdownItem>
                      </>
                    ) : null}
                    <DropdownSectionLabel>Catalog</DropdownSectionLabel>
                    <DropdownItem
                      onClick={() => {
                        navigate('/applications');
                      }}
                    >
                      Applications
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        navigate('/products');
                      }}
                    >
                      Products
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
                        navigate('/companies');
                      }}
                    >
                      Companies
                    </DropdownItem>
                    <DropdownItem
                      onClick={() => {
                        navigate('/dependencies');
                      }}
                    >
                      Dependencies
                    </DropdownItem>
                    {!isAdmin() && (
                      <>
                        <DropdownSectionLabel>Settings</DropdownSectionLabel>
                        <DropdownItem
                          onClick={() => {
                            navigate('/settings');
                          }}
                        >
                          Settings
                        </DropdownItem>
                      </>
                    )}
                    <DropdownSectionLabel>Updates</DropdownSectionLabel>
                    <DropdownItem
                      onClick={() => {
                        navigate('/whats-new');
                      }}
                    >
                      What&apos;s New
                    </DropdownItem>
                  </Dropdown>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{user.email}</span>
                    {isAdmin() && globalPendingCount > 0 && (
                      <button
                        onClick={() => {
                          const { addToast, removeToast } = useToastStore.getState();
                          const toastId = addToast({
                            type: 'warning',
                            message: `There ${globalPendingCount === 1 ? 'is' : 'are'} ${globalPendingCount} application change${globalPendingCount !== 1 ? 's' : ''} to review. Click here to view.`,
                            persistent: true,
                            clickable: true,
                            onClick: () => {
                              navigate('/pending-approvals');
                              removeToast(toastId);
                            },
                          });
                        }}
                        className="relative inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full hover:bg-red-700 transition-colors"
                        title={`${globalPendingCount} pending approval${globalPendingCount !== 1 ? 's' : ''}`}
                      >
                        {globalPendingCount > 99 ? '99+' : globalPendingCount}
                      </button>
                    )}
                  </div>
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
