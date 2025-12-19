import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ToastContainer } from './components/ui/Toast.jsx';
import { Auth } from './pages/Auth.jsx';
import { MustVerify } from './pages/MustVerify.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Home } from './pages/Home.jsx';
import { DocsList } from './pages/DocsList.jsx';
import { Docs } from './pages/Docs.jsx';
import { ComponentsDemo } from './pages/ComponentsDemo.jsx';
import { Companies } from './pages/Companies.jsx';
import { CompanyDetail } from './pages/CompanyDetail.jsx';
import { CompanyNew } from './pages/CompanyNew.jsx';
import { Applications } from './pages/Applications.jsx';
import { ApplicationNew } from './pages/ApplicationNew.jsx';
import { ApplicationDetail } from './pages/ApplicationDetail.jsx';
import { OnboardManager } from './pages/OnboardManager.jsx';
import { OnboardApplication } from './pages/OnboardApplication.jsx';
import { Users } from './pages/Users.jsx';
import { AcceptInvitation } from './pages/AcceptInvitation.jsx';

function CatchAllRedirect() {
  const { isAuthenticated, isVerified, loading } = useAuthStore();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (isAuthenticated() && isVerified()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Navigate to="/" replace />;
}

function App() {
  const { init, isAuthenticated, isVerified } = useAuthStore();

  useEffect(() => {
    // Initialize auth state on app load
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <ToastContainer />
      <Routes>
        {/* Public routes - login/register now handled by Layout modal */}
        <Route path="/login" element={
          <Layout>
            <Home />
          </Layout>
        } />
        <Route path="/register" element={
          <Layout>
            <Home />
          </Layout>
        } />
        <Route path="/must-verify" element={<MustVerify />} />
        
        {/* Public docs routes */}
        <Route
          path="/docs"
          element={
            <Layout>
              <DocsList />
            </Layout>
          }
        />
        <Route
          path="/docs/:slug"
          element={
            <Layout>
              <Docs />
            </Layout>
          }
        />

        {/* Home page - public */}
        <Route
          path="/"
          element={
            <Layout>
              <Home />
            </Layout>
          }
        />

        {/* Public onboarding forms - no auth required */}
        <Route
          path="/onboard/:slug/manager"
          element={<OnboardManager />}
        />
        <Route
          path="/onboard/:slug/application/:applicationId"
          element={<OnboardApplication />}
        />
        <Route
          path="/invite/:token"
          element={<AcceptInvitation />}
        />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/components"
          element={
            <ProtectedRoute>
              <Layout>
                <ComponentsDemo />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <Layout>
                <Companies />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CompanyNew />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/companies/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <CompanyDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <Layout>
                <Applications />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/new"
          element={
            <ProtectedRoute>
              <Layout>
                <ApplicationNew />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ApplicationDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Layout>
                <Users />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Legacy route redirect - backward compatibility */}
        <Route
          path="/admin/applications"
          element={
            <Navigate to="/applications" replace />
          }
        />

        {/* Catch-all route - redirect authenticated users to dashboard, others to home */}
        <Route
          path="*"
          element={
            <CatchAllRedirect />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
