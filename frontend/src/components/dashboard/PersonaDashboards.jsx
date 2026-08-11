import { Link } from 'react-router-dom';

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

export function DeveloperDashboard() {
  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="My Engineering Portfolio" subtitle="Applications, repositories, and delivery context" tone="navy">
          <Metric label="Applications in scope" detail="Application assignment data coming later" tone="blue" />
          <Metric label="Repositories connected" />
          <Metric label="Branches with security data" />
          <ActionLink to="/applications" title="View applications" detail="Open the application catalog and repository context." />
        </Tier>
        <Tier title="Security Findings" subtitle="Developer-prioritized issues and remediation" tone="blue">
          <Metric label="Critical findings" detail="Wiz SAST mapping pending" tone="yellow" />
          <Metric label="High findings" />
          <Metric label="Findings past target" />
          <ActionLink to="/dependencies" title="Review dependencies" detail="Inspect dependency risk and available advisory context." />
        </Tier>
        <Tier title="Integrations & Documentation" subtitle="Get connected and understand the workflow" tone="purple">
          <Metric label="Applications missing integrations" />
          <Metric label="Repositories needing setup" />
          <Metric label="Integration errors" />
          <ActionLink to="/docs" title="Open documentation" detail="Find integration guides and security requirements." />
        </Tier>
        <Tier title="Build Security In" subtitle="Controls across the delivery lifecycle" tone="teal">
          <Metric label="CI/CD control adoption" />
          <Metric label="SAST coverage" />
          <Metric label="SCA coverage" />
          <ActionLink to="/deployment-tokens" title="Manage deployment access" detail="Configure tokens for CI/CD integration." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Developer metrics will become application- and repository-scoped once application assignments and Wiz SAST repository mappings are defined." />
    </div>
  );
}

export function ApplicationOwnerDashboard() {
  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="Application Health" subtitle="The current posture of your application" tone="navy">
          <Metric label="Application security score" detail="Score available after application selection" tone="blue" />
          <Metric label="Open critical findings" />
          <Metric label="Open high findings" />
          <ActionLink to="/applications" title="Open application catalog" detail="Select an application to review its full posture." />
        </Tier>
        <Tier title="Onboarding & Completeness" subtitle="Keep application information current" tone="blue">
          <Metric label="Onboarding completeness" />
          <Metric label="Metadata review status" />
          <Metric label="Threat model status" />
          <ActionLink to="/applications" title="Complete application details" detail="Find missing metadata and review outstanding fields." />
        </Tier>
        <Tier title="Security Testing" subtitle="Testing coverage for the application" tone="purple">
          <Metric label="SAST configured" />
          <Metric label="DAST configured" />
          <Metric label="SCA configured" />
          <ActionLink to="/docs" title="Learn about testing" detail="Review the security testing expectations." />
        </Tier>
        <Tier title="Actions & Evidence" subtitle="The next work required from the owner" tone="teal">
          <Metric label="Pending approvals" />
          <Metric label="Policy exceptions" />
          <Metric label="Evidence needing refresh" />
          <ActionLink to="/whats-new" title="Review recent changes" detail="See the latest Atlas workflow and product updates." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Application-owner metrics will be populated once role-based application scope and owner permissions are introduced." />
    </div>
  );
}

export function ProgramOperationsDashboard() {
  return (
    <div className="space-y-6">
      <DashboardGrid>
        <Tier title="Program Coverage" subtitle="Where the program is connected and complete" tone="navy">
          <Metric label="Applications onboarded" tone="blue" />
          <Metric label="Wiz configuration coverage" />
          <Metric label="Security testing coverage" />
          <ActionLink to="/applications" title="Find coverage gaps" detail="Review applications requiring program follow-up." />
        </Tier>
        <Tier title="Remediation Operations" subtitle="Work that needs attention across the program" tone="blue">
          <Metric label="Open critical findings" tone="yellow" />
          <Metric label="Open high findings" />
          <Metric label="Mean time to remediation" />
          <ActionLink to="/applications" title="Review risk concentration" detail="Sort and prioritize applications by posture." />
        </Tier>
        <Tier title="Governance" subtitle="Policies, approvals, and evidence" tone="purple">
          <Metric label="Policy adherence" />
          <Metric label="Pending approvals" />
          <Metric label="Evidence completeness" />
          <ActionLink to="/settings" title="Open program settings" detail="Review scoring, policy, and integration configuration." />
        </Tier>
        <Tier title="Data Quality" subtitle="Confidence in the program inventory" tone="teal">
          <Metric label="Applications never reviewed" />
          <Metric label="Stale integrations" />
          <Metric label="Missing required metadata" />
          <ActionLink to="/applications" title="Review inventory quality" detail="Open the catalog to correct application records." />
        </Tier>
      </DashboardGrid>
      <PreviewNotice text="Program Operations will eventually combine Atlas inventory quality with provider sync health and remediation history." />
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
