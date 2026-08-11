import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import { AdminStats } from '../components/dashboard/AdminStats.jsx';
import { ExecutiveDashboard } from '../components/dashboard/ExecutiveDashboard.jsx';
import {
  ApplicationOwnerDashboard,
  DeveloperDashboard,
  ProgramOperationsDashboard,
} from '../components/dashboard/PersonaDashboards.jsx';
import { Dropdown, DropdownItem } from '../components/ui/Dropdown.jsx';
import { api } from '../lib/api.js';
import { FiChevronDown, FiGrid } from 'react-icons/fi';

const DASHBOARDS = [
  {
    id: 'executive',
    label: 'Executive',
    description: 'Program outcomes, risk reduction, compliance, and maturity.',
    placeholder: 'This is the executive dashboard.',
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Integrations, documentation, findings, and engineering actions.',
    placeholder: 'This is the developer dashboard.',
  },
  {
    id: 'application-owner',
    label: 'Application Owner',
    description: 'Application health, onboarding completeness, and security posture.',
    placeholder: 'This is the application owner dashboard.',
  },
  {
    id: 'program-operations',
    label: 'Program Operations',
    description: 'Coverage gaps, remediation progress, evidence, and follow-up work.',
    placeholder: 'This is the program operations dashboard.',
  },
];

const ADMIN_DASHBOARD = {
  id: 'platform-administration',
  label: 'Platform Administration',
  description: 'Companies, users, approvals, divisions, and platform configuration.',
};

function getDashboards(isAdmin) {
  return isAdmin ? [...DASHBOARDS, ADMIN_DASHBOARD] : DASHBOARDS;
}

function getTemporaryDefaultDashboard(isAdmin) {
  // Until user roles exist, preserve the existing admin dashboard and give
  // company users the developer-oriented landing view.
  return isAdmin ? ADMIN_DASHBOARD.id : 'developer';
}

function DashboardSwitcher({ dashboards, activeDashboard, navigate }) {
  return (
    <Dropdown
      align="right"
      trigger={(
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-blue-400/60 hover:bg-gray-100"
          aria-label="Change dashboard view"
        >
          <FiGrid className="h-4 w-4 text-blue-500" />
          <span>{activeDashboard.label}</span>
          <FiChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      )}
    >
      <div className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Dashboard view
      </div>
      {dashboards.map((dashboard) => (
        <DropdownItem
          key={dashboard.id}
          onClick={() => navigate(`/dashboard/${dashboard.id}`)}
          className={dashboard.id === activeDashboard.id ? 'bg-blue-100 text-blue-800' : ''}
        >
          {dashboard.label}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}

function PlaceholderDashboard({ dashboard }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-surface px-6 py-16 text-center shadow-lg shadow-black/20">
      <p className="text-xl font-semibold text-gray-900">{dashboard.placeholder}</p>
      <p className="mx-auto mt-3 max-w-xl text-sm text-gray-500">
        {dashboard.description} The data and widgets for this view will be defined and verified next.
      </p>
    </div>
  );
}

export function Dashboard() {
  const { isAdmin, user } = useAuthStore();
  const { dashboardType } = useParams();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState(null);

  const admin = isAdmin();
  const dashboards = getDashboards(admin);
  const defaultDashboard = getTemporaryDefaultDashboard(admin);
  const requestedDashboard = dashboards.find((dashboard) => dashboard.id === dashboardType);

  useEffect(() => {
    if (!dashboardType) {
      navigate(`/dashboard/${defaultDashboard}`, { replace: true });
    } else if (!requestedDashboard) {
      navigate(`/dashboard/${defaultDashboard}`, { replace: true });
    }
  }, [dashboardType, defaultDashboard, navigate, requestedDashboard]);

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

  const activeDashboard = requestedDashboard || dashboards.find((dashboard) => dashboard.id === defaultDashboard);

  if (!activeDashboard) return null;

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-gray-900">
            {activeDashboard.label} Dashboard
          </h1>
          <p className="text-gray-600">
            {companyName ? `${companyName} · ` : ''}{activeDashboard.description}
          </p>
        </div>
        <DashboardSwitcher
          dashboards={dashboards}
          activeDashboard={activeDashboard}
          navigate={navigate}
        />
      </div>

      {activeDashboard.id === ADMIN_DASHBOARD.id ? (
        <AdminStats />
      ) : activeDashboard.id === 'executive' ? (
        <ExecutiveDashboard />
      ) : activeDashboard.id === 'developer' ? (
        <DeveloperDashboard />
      ) : activeDashboard.id === 'application-owner' ? (
        <ApplicationOwnerDashboard />
      ) : activeDashboard.id === 'program-operations' ? (
        <ProgramOperationsDashboard />
      ) : (
        <PlaceholderDashboard dashboard={activeDashboard} />
      )}
    </div>
  );
}
