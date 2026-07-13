import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore.js';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { ToastContainer } from './components/ui/Toast.jsx';
import { PendingApprovalsProvider } from './contexts/PendingApprovalsContext.jsx';
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
import { Products } from './pages/Products.jsx';
import { ProductDetail } from './pages/ProductDetail.jsx';
import { OnboardManager } from './pages/OnboardManager.jsx';
import { OnboardApplication } from './pages/OnboardApplication.jsx';
import { Users } from './pages/Users.jsx';
import { AcceptInvitation } from './pages/AcceptInvitation.jsx';
import { Domains } from './pages/Domains.jsx';
import { DomainDetail } from './pages/DomainDetail.jsx';
import { DeploymentTokens } from './pages/DeploymentTokens.jsx';
import { PendingApprovals } from './pages/PendingApprovals.jsx';
import { Divisions } from './pages/Divisions.jsx';
import { DivisionDetail } from './pages/DivisionDetail.jsx';
import { PolicyControls } from './pages/PolicyControls.jsx';
import { PolicyViewer } from './pages/PolicyViewer.jsx';
import { IntegrationSettings } from './pages/IntegrationSettings.jsx';
import { SecurityFindingsExportJobs } from './pages/SecurityFindingsExportJobs.jsx';
import { SettingsDeploy } from './pages/SettingsDeploy.jsx';
import { SettingsApiTokens } from './pages/SettingsApiTokens.jsx';
import { ProductUpdatesAdmin } from './pages/ProductUpdatesAdmin.jsx';
import { WhatsNew } from './pages/WhatsNew.jsx';

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
      <PendingApprovalsProvider>
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
          path="/docs/*"
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
          path="/onboard"
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
          path="/settings/deploy"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsDeploy />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/api-tokens"
          element={
            <ProtectedRoute>
              <Layout>
                <SettingsApiTokens />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/product-updates"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductUpdatesAdmin />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/whats-new"
          element={
            <ProtectedRoute>
              <Layout>
                <WhatsNew />
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
          path="/products"
          element={
            <ProtectedRoute>
              <Layout>
                <Products />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/products/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ProductDetail />
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
        <Route
          path="/domains"
          element={
            <ProtectedRoute>
              <Layout>
                <Domains />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/domains/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <DomainDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/deployment-tokens"
          element={
            <ProtectedRoute>
              <Layout>
                <DeploymentTokens />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/pending-approvals"
          element={
            <ProtectedRoute>
              <Layout>
                <PendingApprovals />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/divisions"
          element={
            <ProtectedRoute>
              <Layout>
                <Divisions />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/divisions/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <DivisionDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/policy-controls"
          element={
            <ProtectedRoute>
              <Layout>
                <PolicyControls />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/policies/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PolicyViewer />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/integrations"
          element={
            <ProtectedRoute>
              <Layout>
                <IntegrationSettings />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/export-jobs"
          element={
            <ProtectedRoute>
              <Layout>
                <SecurityFindingsExportJobs />
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
      </PendingApprovalsProvider>
    </BrowserRouter>
  );
}

export default App;
