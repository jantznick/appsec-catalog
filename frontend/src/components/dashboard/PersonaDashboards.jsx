import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { LoadingPage } from '../ui/Loading.jsx';
import { toast } from '../ui/Toast.jsx';
import useScopeStore from '../../store/scopeStore.js';

const tierStyles = {
  blue: 'bg-blue-600',
  navy: 'bg-navy-700',
  purple: 'bg-indigo-600',
  teal: 'bg-teal-600',
};

function Tier({ title, subtitle, tone = 'blue', children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-white/10 bg-surface shadow-lg shadow-black/20">
      <div className={`px-5 py-4 ${tierStyles[tone]}`}>
        <h2 className="text-lg font-bold tracking-wide text-white">{title}</h2>
        <p className="mt-1 text-xs text-white/70">{subtitle}</p>
      </div>
      <div className="divide-y divide-white/10">{children}</div>
    </section>
  );
}

function Metric({ label, value = '—', detail, tone = 'default' }) {
  const colors = {
    default: 'text-gray-900',
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
  };
  return (
    <div className="px-5 py-5">
      <p className="text-sm font-medium leading-snug text-gray-600">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${colors[tone] || colors.default}`}>{value}</p>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
    </div>
  );
}

function ActionLink({ to, title, detail }) {
  return (
    <Link to={to} className="block px-5 py-4 transition-colors hover:bg-gray-100">
      <p className="text-sm font-semibold text-blue-700">{title} →</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </Link>
  );
}

function DashboardGrid({ children }) {
  return <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">{children}</div>;
}

// Shared loader that follows the executive dashboard pattern: react to scope
// changes, surface load errors as toasts, and hand the component the payload.
function useDashboardData(fetcher, errorMessage) {
  const scopeCompanyId = useScopeStore((state) => (state.mode === 'company' ? state.companyId : ''));
  const scopeDivisionId = useScopeStore((state) => (state.mode === 'division' ? state.divisionId : ''));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher({ companyId: scopeCompanyId, divisionId: scopeDivisionId })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || errorMessage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeCompanyId, scopeDivisionId]);

  return { data, loading };
}

const num = (value) => (value == null ? '—' : value);
const pct = (value) => (value == null ? '—' : `${value}%`);

export function DeveloperDashboard() {
  const { data, loading } = useDashboardData(api.getDeveloperDashboard, 'Failed to load developer dashboard');
  if (loading) return <LoadingPage message="Loading developer dashboard..." />;
  if (!data) return null;

  const portfolio = data.portfolio || {};
  const integrations = data.integrations || {};
  const build = data.buildSecurity || {};

  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="My Engineering Portfolio" subtitle="Applications, repositories, and delivery context" tone="navy">
          <Metric label="Applications in scope" value={num(portfolio.applicationsInScope)} tone="blue" />
          <Metric
            label="Repositories connected"
            value={num(portfolio.repositoriesConnected)}
            detail="Distinct source-control repos linked"
          />
          <Metric
            label="Branches with security data"
            value={num(portfolio.branchesWithSecurityData)}
            detail="Branch known with scan or dependency data"
          />
          <ActionLink to="/applications" title="View applications" detail="Open the application catalog and repository context." />
        </Tier>
        <Tier title="Security Findings" subtitle="Developer-prioritized issues and remediation" tone="blue">
          <Metric label="Critical findings" detail="Wiz SAST mapping pending" tone="yellow" />
          <Metric label="High findings" detail="Wiz SAST mapping pending" />
          <Metric label="Findings past target" detail="Wiz SAST mapping pending" />
          <ActionLink to="/dependencies" title="Review dependencies" detail="Inspect dependency risk and available advisory context." />
        </Tier>
        <Tier title="Integrations & Documentation" subtitle="Get connected and understand the workflow" tone="purple">
          <Metric
            label="Applications missing integrations"
            value={num(integrations.applicationsMissingIntegrations)}
            detail="No repo or tool link connected"
            tone={integrations.applicationsMissingIntegrations ? 'yellow' : 'green'}
          />
          <Metric
            label="Repositories needing setup"
            value={num(integrations.repositoriesNeedingSetup)}
            detail="Repo URL captured but not connected"
          />
          <Metric label="Integration errors" detail="Sync error tracking not yet available" />
          <ActionLink to="/docs" title="Open documentation" detail="Find integration guides and security requirements." />
        </Tier>
        <Tier title="Build Security In" subtitle="Controls across the delivery lifecycle" tone="teal">
          <Metric
            label="CI/CD control adoption"
            value={pct(build.cicdControlPercentage)}
            detail={`${num(build.cicdControlApplications)} apps with deployment tokens`}
          />
          <Metric
            label="SAST coverage"
            value={pct(build.sastCoveragePercentage)}
            detail={`${num(build.sastApplications)} apps with SAST configured`}
          />
          <Metric
            label="SCA coverage"
            value={pct(build.scaCoveragePercentage)}
            detail={`${num(build.scaApplications)} apps with SCA configured`}
          />
          <ActionLink to="/deployment-tokens" title="Manage deployment access" detail="Configure tokens for CI/CD integration." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Finding counts remain placeholders until Wiz SAST repository mappings are defined; the remaining metrics are derived from Atlas inventory and integrations." />
    </div>
  );
}

export function ApplicationOwnerDashboard() {
  const { data, loading } = useDashboardData(api.getApplicationOwnerDashboard, 'Failed to load application owner dashboard');
  if (loading) return <LoadingPage message="Loading application owner dashboard..." />;
  if (!data) return null;

  const health = data.health || {};
  const onboarding = data.onboarding || {};
  const testing = data.securityTesting || {};
  const actions = data.actions || {};

  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="Application Health" subtitle="Posture across the applications in scope" tone="navy">
          <Metric
            label="Average application score"
            value={health.averageScore == null ? '—' : `${health.averageScore}/100`}
            detail={health.averageScore == null ? 'No scored applications yet' : `${health.scoredApplicationCount} of ${health.totalApplications} scored`}
            tone="blue"
          />
          <Metric label="Open critical findings" detail="Wiz SAST mapping pending" />
          <Metric label="Open high findings" detail="Wiz SAST mapping pending" />
          <ActionLink to="/applications" title="Open application catalog" detail="Select an application to review its full posture." />
        </Tier>
        <Tier title="Onboarding & Completeness" subtitle="Keep application information current" tone="blue">
          <Metric
            label="Onboarding completeness"
            value={pct(onboarding.averageCompleteness)}
            detail="Average metadata completeness"
          />
          <Metric
            label="Metadata review status"
            value={pct(onboarding.reviewPercentage)}
            detail={`${num(onboarding.reviewedApplications)} applications reviewed`}
          />
          <Metric
            label="Threat model status"
            value={num(onboarding.threatModeledApplications)}
            detail={`${num(onboarding.threatModelApprovedApplications)} approved`}
          />
          <ActionLink to="/applications" title="Complete application details" detail="Find missing metadata and review outstanding fields." />
        </Tier>
        <Tier title="Security Testing" subtitle="Testing coverage for applications in scope" tone="purple">
          <Metric
            label="SAST configured"
            value={num(testing.sastApplications)}
            detail={`of ${num(testing.totalApplications)} applications`}
          />
          <Metric
            label="DAST configured"
            value={num(testing.dastApplications)}
            detail={`of ${num(testing.totalApplications)} applications`}
          />
          <Metric
            label="SCA configured"
            value={num(testing.scaApplications)}
            detail={`of ${num(testing.totalApplications)} applications`}
          />
          <ActionLink to="/docs" title="Learn about testing" detail="Review the security testing expectations." />
        </Tier>
        <Tier title="Actions & Evidence" subtitle="The next work required from the owner" tone="teal">
          <Metric
            label="Policy exceptions"
            value={num(actions.policyExceptions)}
            detail="Manual control overrides recorded"
          />
          <Metric label="Evidence needing refresh" detail="Requires an evidence model and freshness rules" />
          <ActionLink to="/whats-new" title="Review recent changes" detail="See the latest Atlas workflow and product updates." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Metrics aggregate across the applications currently in scope. Per-owner scoping and finding counts arrive with role-based access and Wiz SAST." />
    </div>
  );
}

export function ProgramOperationsDashboard() {
  const { data, loading } = useDashboardData(api.getProgramOperationsDashboard, 'Failed to load program operations dashboard');
  if (loading) return <LoadingPage message="Loading program operations dashboard..." />;
  if (!data) return null;

  const coverage = data.coverage || {};
  const governance = data.governance || {};
  const quality = data.dataQuality || {};

  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="Program Coverage" subtitle="Where the program is connected and complete" tone="navy">
          <Metric
            label="Applications onboarded"
            value={num(coverage.applicationsOnboarded)}
            detail={`of ${num(coverage.totalApplications)} total`}
            tone="blue"
          />
          <Metric
            label="Wiz configuration coverage"
            value={pct(coverage.wizConfigurationPercentage)}
            detail={`${num(coverage.wizConfiguredApplications)} applications tagged`}
          />
          <Metric
            label="Security testing coverage"
            value={pct(coverage.securityTestingCoveragePercentage)}
            detail={`${num(coverage.securityTestingApplications)} applications with SAST/DAST/SCA`}
          />
          <ActionLink to="/applications" title="Find coverage gaps" detail="Review applications requiring program follow-up." />
        </Tier>
        <Tier title="Remediation Operations" subtitle="Work that needs attention across the program" tone="blue">
          <Metric label="Open critical findings" detail="Wiz SAST mapping pending" tone="yellow" />
          <Metric label="Open high findings" detail="Wiz SAST mapping pending" />
          <Metric label="Mean time to remediation" detail="Historical remediation data not available yet" />
          <ActionLink to="/applications" title="Review risk concentration" detail="Sort and prioritize applications by posture." />
        </Tier>
        <Tier title="Governance" subtitle="Policies, approvals, and evidence" tone="purple">
          <Metric
            label="Policy adherence"
            value={pct(governance.compliancePercentage)}
            detail={governance.totalControls ? `${governance.meetingControls} of ${governance.totalControls} controls meeting` : 'No active controls configured'}
          />
          <Metric
            label="Policy exceptions"
            value={num(governance.policyExceptions)}
            detail="Manual control overrides recorded"
          />
          <Metric label="Evidence completeness" detail="Requires an evidence model and freshness rules" />
          <ActionLink to="/settings" title="Open program settings" detail="Review scoring, policy, and integration configuration." />
        </Tier>
        <Tier title="Data Quality" subtitle="Confidence in the program inventory" tone="teal">
          <Metric
            label="Applications never reviewed"
            value={num(quality.applicationsNeverReviewed)}
            detail="No metadata review recorded"
            tone={quality.applicationsNeverReviewed ? 'yellow' : 'green'}
          />
          <Metric
            label="Stale integrations"
            value={num(quality.staleIntegrations)}
            detail={`Repos not synced in ${num(quality.staleThresholdDays)} days`}
          />
          <Metric
            label="Missing required metadata"
            value={num(quality.applicationsMissingMetadata)}
            detail="Applications below full completeness"
          />
          <ActionLink to="/applications" title="Review inventory quality" detail="Open the catalog to correct application records." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Remediation MTTR and finding counts remain placeholders pending Wiz history; coverage, governance, and data-quality metrics are derived from Atlas today." />
    </div>
  );
}

function PreviewNotice({ text }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-surface px-5 py-4 text-sm text-gray-500">
      {text}
    </div>
  );
}
