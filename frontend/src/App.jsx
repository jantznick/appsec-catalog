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
import { AdminApplications } from './pages/AdminApplications.jsx';

function App() {
  const { init, isAuthenticated } = useAuthStore();

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
          path="/admin/applications"
          element={
            <ProtectedRoute>
              <Layout>
                <AdminApplications />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Redirect authenticated users to dashboard */}
        <Route
          path="*"
          element={
            isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
