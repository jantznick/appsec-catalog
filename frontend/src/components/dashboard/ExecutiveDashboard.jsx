import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { LoadingPage } from '../ui/Loading.jsx';
import { toast } from '../ui/Toast.jsx';
import useScopeStore from '../../store/scopeStore.js';

const tierStyles = {
  coverage: 'bg-navy-700',
  risk: 'bg-blue-600',
  compliance: 'bg-indigo-600',
  maturity: 'bg-teal-600',
};

function TierPanel({ title, subtitle, tone, children }) {
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

function TierMetric({ label, value, detail, tone = 'default', children }) {
  const valueColor = {
    default: 'text-gray-900',
    positive: 'text-green-700',
    warning: 'text-yellow-700',
    negative: 'text-red-700',
    accent: 'text-blue-700',
  }[tone] || 'text-gray-900';

  return (
    <div className="px-5 py-5">
      <p className="text-sm font-medium leading-snug text-gray-600">{label}</p>
      <div className={`mt-2 text-3xl font-bold ${valueColor}`}>{value}</div>
      {detail ? <p className="mt-1 text-xs text-gray-500">{detail}</p> : null}
      {children}
    </div>
  );
}

function ProgressMetric({ label, numerator, denominator, percentage, detail }) {
  return (
    <div className="flex items-center gap-4 px-5 py-5">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--color-blue-500) ${percentage || 0}%, var(--color-gray-100) 0)`,
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-sm font-bold text-gray-900">
          {percentage == null ? '—' : `${percentage}%`}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-gray-600">{label}</p>
        <p className="mt-1 text-xs text-gray-500">{numerator} of {denominator}{detail ? ` · ${detail}` : ''}</p>
      </div>
    </div>
  );
}

export function ExecutiveDashboard() {
  const scopeCompanyId = useScopeStore((state) => (state.mode === 'company' ? state.companyId : ''));
  const scopeDivisionId = useScopeStore((state) => (state.mode === 'division' ? state.divisionId : ''));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getExecutiveDashboard({ companyId: scopeCompanyId, divisionId: scopeDivisionId })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error.message || 'Failed to load executive dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scopeCompanyId, scopeDivisionId]);

  if (loading) return <LoadingPage message="Loading executive dashboard..." />;
  if (!data) return null;

  const coverage = data.coverage;
  const scores = data.scores;
  const compliance = data.compliance || {};
  const maturity = data.maturity || {};
  const statuses = data.applications.byStatus || {};
  const attentionRows = (data.applicationRows || [])
    .filter((application) => !application.wizConfigured || application.score !== null)
    .sort((a, b) => {
      if (a.wizConfigured !== b.wizConfigured) return a.wizConfigured ? 1 : -1;
      return (a.score ?? 101) - (b.score ?? 101);
    })
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <TierPanel
          title="Program Coverage"
          subtitle="Applications, participation, and security testing"
          tone="coverage"
        >
          <TierMetric
            label="Applications onboarded"
            value={coverage.totalApplications}
            detail={`${statuses.onboarded || 0} currently onboarded`}
            tone="accent"
          />
          {data.companies ? (
            <TierMetric
              label="Companies participating"
              value={`${data.companies.participating} of ${data.companies.total}`}
              detail={`${data.companies.withoutApplications} companies without applications`}
              tone={data.companies.withoutApplications > 0 ? 'warning' : 'positive'}
            />
          ) : null}
          <ProgressMetric
            label="Security testing coverage"
            numerator={coverage.securityTestingApplications}
            denominator={coverage.totalApplications}
            percentage={coverage.securityTestingCoveragePercentage}
            detail="SAST, DAST, or SCA configured"
          />
          <div className="grid grid-cols-3 gap-3 px-5 py-5 text-center">
            {[
              ['SAST', coverage.securityTestingByType?.sast || 0],
              ['DAST', coverage.securityTestingByType?.dast || 0],
              ['SCA', coverage.securityTestingByType?.sca || 0],
            ].map(([label, count]) => (
              <div key={label} className="rounded-lg bg-gray-50 px-2 py-3">
                <p className="text-xl font-semibold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500">{label} apps</p>
              </div>
            ))}
          </div>
          <ProgressMetric
            label="Wiz application coverage"
            numerator={coverage.wizConfiguredApplications}
            denominator={coverage.totalApplications}
            percentage={coverage.wizConfigurationPercentage}
            detail="Application: tag configured"
          />
        </TierPanel>

        <TierPanel
          title="Risk Reduction"
          subtitle="Current risk posture and remediation signals"
          tone="risk"
        >
          <TierMetric
            label="Lowest application score"
            value={data.applications.highestRisk?.score ?? '—'}
            detail={data.applications.highestRisk?.name || 'No scored applications'}
            tone="negative"
          />
          <TierMetric
            label="Applications needing Wiz setup"
            value={coverage.wizUnconfiguredApplications}
            detail="Unknown Wiz coverage until tagged"
            tone={coverage.wizUnconfiguredApplications > 0 ? 'warning' : 'positive'}
          />
          <TierMetric
            label="High-risk findings"
            value="—"
            detail="Wiz tag-based findings pending"
          />
          <TierMetric
            label="Mean time to remediation"
            value="—"
            detail="Historical remediation data not available yet"
          />
        </TierPanel>

        <TierPanel
          title="Compliance"
          subtitle="Policy adherence, controls, and evidence"
          tone="compliance"
        >
          <ProgressMetric
            label="Policy adherence"
            numerator={compliance.meetingControls ?? '—'}
            denominator={compliance.totalControls ?? '—'}
            percentage={compliance.compliancePercentage}
            detail={compliance.totalControls ? 'Meeting field-mapped controls' : 'No active controls configured'}
          />
          <TierMetric
            label="Applications with compliant policies"
            value={compliance.applicationsWithPolicies ? `${compliance.compliantApplications} of ${compliance.applicationsWithPolicies}` : '—'}
            detail={compliance.applicationsWithPolicies ? 'All applicable controls meeting' : 'Policies have not been assigned or configured'}
            tone={compliance.applicationsWithPolicies && compliance.compliantApplications === compliance.applicationsWithPolicies ? 'positive' : 'warning'}
          />
          <TierMetric
            label="Policy exceptions"
            value={compliance.overrideCount ?? '—'}
            detail="Manual control overrides currently recorded"
          />
          <TierMetric
            label="Evidence completeness"
            value="—"
            detail="Requires an evidence model and freshness rules"
          />
        </TierPanel>

        <TierPanel
          title="Maturity"
          subtitle="Program maturity and score progression"
          tone="maturity"
        >
          <TierMetric
            label="Average application score"
            value={scores.averageScore == null ? '—' : `${scores.averageScore}/100`}
            detail={scores.averageScore == null ? 'No scored applications yet' : `${scores.scoredApplicationCount} applications scored`}
            tone="accent"
          />
          <TierMetric
            label="Average SAMM score"
            value={maturity.averageScore == null ? '—' : `${maturity.averageScore}/${maturity.scale?.maximum || 3}`}
            detail={maturity.status === 'not_assessed' ? 'No SAMM assessments recorded' : `${maturity.assessmentCount} assessments`}
          />
          <TierMetric
            label="Functions assessed"
            value={`${maturity.assessedFunctions || 0} of ${maturity.functions?.length || 5}`}
            detail={maturity.functions?.join(' · ')}
          />
          <TierMetric label="Quarter-over-quarter trend" value="—" detail="Historical assessment snapshots not yet available" />
          <TierMetric label="Evidence completeness" value="—" detail="Assessment evidence model not yet available" />
        </TierPanel>
      </div>

      <section className="rounded-xl border border-white/10 bg-surface shadow-lg shadow-black/20">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Leadership attention</h2>
            <p className="mt-1 text-xs text-gray-500">Applications with coverage gaps or available risk scores.</p>
          </div>
          <Link to="/applications" className="text-sm text-blue-700 hover:text-blue-800">
            View applications →
          </Link>
        </div>
        <div className="p-5">
          {attentionRows.length === 0 ? (
            <p className="text-sm text-gray-500">No application-level attention items yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Application</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Wiz coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {attentionRows.map((application) => (
                    <tr key={application.id}>
                      <td className="px-3 py-3">
                        <Link to={`/applications/${application.id}`} className="font-medium text-blue-700 hover:text-blue-800">
                          {application.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{application.companyName || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{application.score == null ? '—' : `${application.score}/100`}</td>
                      <td className="px-3 py-3">
                        <span className={application.wizConfigured ? 'text-green-700' : 'text-yellow-700'}>
                          {application.wizConfigured ? 'Configured' : 'Needs setup'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
