import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { evaluateAllControls } from '../services/policy.js';
import { calculateCompleteness } from '../services/completeness.js';

const router = express.Router();

// Repos / scans not synced within this window are treated as stale.
const STALE_INTEGRATION_DAYS = 30;

function hasConfiguredValue(value) {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== 'NA';
}

function percentage(part, whole) {
  return whole ? Math.round((part / whole) * 100) : null;
}

function daysSince(date) {
  if (!date) return null;
  return (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Load every in-scope application with the relations the persona dashboards
 * need, then attach the latest risk score for each. Returns enriched rows with
 * derived booleans plus the raw applications (used for compliance evaluation).
 */
async function loadScopedApplications(req) {
  const applications = await prisma.application.findMany({
    where: getScopeWhere(req),
    include: {
      company: { select: { id: true, name: true, divisionId: true } },
      applicationToolLinks: { where: { provider: 'WIZ' }, select: { filter: true } },
      apiSchema: { select: { id: true } },
      threatModel: { select: { status: true } },
      deploymentTokens: { select: { id: true } },
      policyControlOverrides: { select: { id: true } },
      scmRepoLink: {
        select: {
          repo: {
            select: {
              id: true,
              defaultBranch: true,
              lastSyncedAt: true,
              _count: { select: { dependencies: true } },
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const applicationIds = applications.map((application) => application.id);
  const scores = applicationIds.length
    ? await prisma.score.findMany({
        where: { applicationId: { in: applicationIds } },
        select: { applicationId: true, totalScore: true, calculatedAt: true },
        orderBy: { calculatedAt: 'desc' },
      })
    : [];
  const latestScoreByApplication = new Map();
  for (const score of scores) {
    if (!latestScoreByApplication.has(score.applicationId)) {
      latestScoreByApplication.set(score.applicationId, score);
    }
  }

  const rows = applications.map((application) => {
    const wizFilter = application.applicationToolLinks[0]?.filter;
    const repo = application.scmRepoLink?.repo || null;
    const dependencyCount = repo?._count?.dependencies || 0;
    const hasScanData = Boolean(
      application.lastSastScanDate || application.lastDastScanDate || application.lastScaScanDate,
    );
    const branch = application.gitBranch || repo?.defaultBranch || null;
    const securityTesting = {
      sast: hasConfiguredValue(application.sastTool),
      dast: hasConfiguredValue(application.dastTool),
      sca: hasConfiguredValue(application.scaTool),
    };
    const score = latestScoreByApplication.get(application.id);
    return {
      id: application.id,
      name: application.name,
      companyId: application.companyId,
      companyName: application.company?.name || null,
      status: application.status || 'onboarded',
      wizConfigured: Boolean(wizFilter && typeof wizFilter === 'object' && wizFilter.tagValue),
      hasRepo: Boolean(repo),
      repoId: repo?.id || null,
      repoSynced: Boolean(repo?.lastSyncedAt),
      repoStale: repo ? daysSince(repo.lastSyncedAt) === null || daysSince(repo.lastSyncedAt) > STALE_INTEGRATION_DAYS : false,
      dependencyCount,
      hasScanData,
      // A branch counts as having security data once a branch is known and
      // either scans have run or dependency inventory was collected for it.
      branchWithSecurityData: Boolean(branch) && (hasScanData || dependencyCount > 0),
      hasToolLink: application.applicationToolLinks.length > 0,
      repoUrl: application.repoUrl || null,
      securityTesting,
      securityTestingConfigured: Object.values(securityTesting).some(Boolean),
      hasDeploymentToken: application.deploymentTokens.length > 0,
      threatModelStatus: application.threatModel?.status || null,
      overrideCount: application.policyControlOverrides.length,
      reviewed: Boolean(application.metadataLastReviewed),
      pendingApproval: (application.status || '').startsWith('pending'),
      completeness: calculateCompleteness(application).percentage,
      score: score?.totalScore ?? null,
    };
  });

  return { applications, rows };
}

/** Distinct connected repositories across a set of enriched rows. */
function countConnectedRepos(rows) {
  return new Set(rows.filter((row) => row.repoId).map((row) => row.repoId)).size;
}

/**
 * Evaluate field-mapped policy controls across the given applications and roll
 * the results up into a program-wide compliance summary. Mirrors the executive
 * dashboard so the numbers agree across views.
 */
async function summarizeCompliance(applications) {
  const results = await Promise.all(applications.map(async (application) => {
    try {
      return await evaluateAllControls(application);
    } catch (error) {
      console.error('Error evaluating dashboard compliance:', application.id, error);
      return null;
    }
  }));
  const summary = results.filter(Boolean).reduce((acc, result) => {
    acc.applicationsWithPolicies += result.summary.total_policies > 0 ? 1 : 0;
    acc.totalControls += result.summary.total;
    acc.meetingControls += result.summary.meeting;
    acc.compliantApplications += result.summary.all_policies_compliant ? 1 : 0;
    return acc;
  }, { applicationsWithPolicies: 0, totalControls: 0, meetingControls: 0, compliantApplications: 0 });
  summary.compliancePercentage = percentage(summary.meetingControls, summary.totalControls);
  summary.status = summary.totalControls ? 'available' : 'needs_configuration';
  return summary;
}

function getScopeWhere(req) {
  const auth = getAuthContext(req);
  const requestedCompanyId = typeof req.query.companyId === 'string' ? req.query.companyId : null;
  const requestedDivisionId = typeof req.query.divisionId === 'string' ? req.query.divisionId : null;

  if (!auth?.isAdmin) {
    return auth?.companyId ? { companyId: auth.companyId } : { id: '__no_company_access__' };
  }
  if (requestedCompanyId) return { companyId: requestedCompanyId };
  if (requestedDivisionId) return { company: { divisionId: requestedDivisionId } };
  return {};
}

router.get('/executive', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const appWhere = getScopeWhere(req);
    const applications = await prisma.application.findMany({
      where: appWhere,
      include: {
        company: { select: { id: true, name: true, divisionId: true } },
        applicationToolLinks: {
          where: { provider: 'WIZ' },
          select: { filter: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const applicationIds = applications.map((application) => application.id);
    const scores = applicationIds.length
      ? await prisma.score.findMany({
          where: { applicationId: { in: applicationIds } },
          select: { applicationId: true, totalScore: true, calculatedAt: true },
          orderBy: { calculatedAt: 'desc' },
        })
      : [];

    const latestScoreByApplication = new Map();
    for (const score of scores) {
      if (!latestScoreByApplication.has(score.applicationId)) {
        latestScoreByApplication.set(score.applicationId, score);
      }
    }

    const applicationRows = applications.map((application) => {
      const wizFilter = application.applicationToolLinks[0]?.filter;
      const wizConfigured = Boolean(
        wizFilter && typeof wizFilter === 'object' && wizFilter.tagValue,
      );
      const score = latestScoreByApplication.get(application.id);
      const securityTesting = {
        sast: hasConfiguredValue(application.sastTool),
        dast: hasConfiguredValue(application.dastTool),
        sca: hasConfiguredValue(application.scaTool),
      };
      return {
        id: application.id,
        name: application.name,
        companyId: application.companyId,
        companyName: application.company?.name || null,
        status: application.status || 'onboarded',
        wizConfigured,
        securityTestingConfigured: Object.values(securityTesting).some(Boolean),
        securityTesting,
        score: score?.totalScore ?? null,
        scoreCalculatedAt: score?.calculatedAt ?? null,
      };
    });

    const scored = applicationRows.filter((application) => application.score !== null);
    const configured = applicationRows.filter((application) => application.wizConfigured);
    const securityTesting = applicationRows.filter((application) => application.securityTestingConfigured);
    const securityTestingByType = ['sast', 'dast', 'sca'].reduce((counts, type) => {
      counts[type] = applicationRows.filter((application) => application.securityTesting[type]).length;
      return counts;
    }, {});
    const scoreValues = scored.map((application) => application.score);
    const averageScore = scoreValues.length
      ? Math.round(scoreValues.reduce((sum, score) => sum + score, 0) / scoreValues.length)
      : null;

    const highest = [...scored].sort((a, b) => b.score - a.score)[0] || null;
    const lowest = [...scored].sort((a, b) => a.score - b.score)[0] || null;
    const byStatus = applicationRows.reduce((counts, application) => {
      counts[application.status] = (counts[application.status] || 0) + 1;
      return counts;
    }, {});

    // Policy controls are already field-mapped in Atlas, so the executive
    // summary can use the same evaluation path as the application detail view.
    // Each application is evaluated independently so one malformed policy does
    // not make the entire dashboard unavailable.
    const complianceResults = await Promise.all(applications.map(async (application) => {
      try {
        return await evaluateAllControls(application);
      } catch (error) {
        console.error('Error evaluating dashboard compliance:', application.id, error);
        return null;
      }
    }));
    const evaluatedCompliance = complianceResults.filter(Boolean);
    const compliance = evaluatedCompliance.reduce((summary, result) => {
      summary.applicationsEvaluated += 1;
      summary.applicationsWithPolicies += result.summary.total_policies > 0 ? 1 : 0;
      summary.totalControls += result.summary.total;
      summary.meetingControls += result.summary.meeting;
      summary.notMeetingControls += result.summary.not_meeting;
      summary.compliantApplications += result.summary.all_policies_compliant ? 1 : 0;
      summary.policiesEvaluated += result.summary.total_policies;
      summary.compliantPolicies += result.summary.compliant_policies;
      result.policies.forEach((policy) => {
        summary.policyNames.add(policy.policy.name);
        policy.controls.forEach((control) => {
          if (control.details?.override) summary.overrideCount += 1;
        });
      });
      return summary;
    }, {
      applicationsEvaluated: 0,
      applicationsWithPolicies: 0,
      totalControls: 0,
      meetingControls: 0,
      notMeetingControls: 0,
      compliantApplications: 0,
      policiesEvaluated: 0,
      compliantPolicies: 0,
      overrideCount: 0,
      policyNames: new Set(),
    });
    compliance.policyCount = compliance.policyNames.size;
    delete compliance.policyNames;
    compliance.compliancePercentage = compliance.totalControls
      ? Math.round((compliance.meetingControls / compliance.totalControls) * 100)
      : null;
    compliance.status = compliance.totalControls ? 'available' : 'needs_configuration';
    // Evidence is intentionally null until Atlas has an evidence model and
    // freshness rules; zero would incorrectly imply that evidence is missing.
    compliance.evidenceCompletenessPercentage = null;

    const maturityCompanyIds = [...new Set(applicationRows.map((application) => application.companyId).filter(Boolean))];
    const completedAssessments = maturityCompanyIds.length
      ? await prisma.sammAssessment.findMany({
          where: { companyId: { in: maturityCompanyIds }, status: 'completed' },
          include: { responses: { select: { score: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const latestMaturityByCompany = new Map();
    for (const assessment of completedAssessments) {
      if (!latestMaturityByCompany.has(assessment.companyId)) latestMaturityByCompany.set(assessment.companyId, assessment);
    }
    const maturityResponses = [...latestMaturityByCompany.values()].flatMap((assessment) => assessment.responses);
    const maturityScoreValues = maturityResponses.map((response) => response.score).filter((score) => score !== null);
    const maturity = {
      model: 'SAMM',
      scale: { minimum: 0, maximum: 3 },
      functions: ['Governance', 'Design', 'Implementation', 'Verification', 'Operations'],
      assessmentCount: latestMaturityByCompany.size,
      assessedFunctions: latestMaturityByCompany.size ? Math.min(5, Math.round(maturityScoreValues.length / 3)) : 0,
      averageScore: maturityScoreValues.length
        ? Number((maturityScoreValues.reduce((sum, score) => sum + score, 0) / maturityScoreValues.length).toFixed(2))
        : null,
      evidenceCompletenessPercentage: null,
      status: latestMaturityByCompany.size ? 'available' : 'not_assessed',
    };

    const response = {
      coverage: {
        totalApplications: applicationRows.length,
        wizConfiguredApplications: configured.length,
        wizUnconfiguredApplications: applicationRows.length - configured.length,
        wizConfigurationPercentage: applicationRows.length
          ? Math.round((configured.length / applicationRows.length) * 100)
          : null,
        securityTestingApplications: securityTesting.length,
        securityTestingByType,
        securityTestingCoveragePercentage: applicationRows.length
          ? Math.round((securityTesting.length / applicationRows.length) * 100)
          : null,
      },
      applications: {
        byStatus,
        highestRisk: lowest,
        highestScore: highest,
      },
      scores: {
        averageScore,
        scoredApplicationCount: scored.length,
      },
      compliance,
      maturity,
      scope: {
        companyId: req.query.companyId || null,
        divisionId: req.query.divisionId || null,
        restrictedToUserCompany: !getAuthContext(req)?.isAdmin,
      },
      applicationRows,
    };

    if (auth?.isAdmin) {
      const companyWhere = req.query.companyId
        ? { id: req.query.companyId }
        : req.query.divisionId
          ? { divisionId: req.query.divisionId }
          : {};
      const companies = await prisma.company.findMany({
        where: companyWhere,
        select: { id: true, applications: { select: { id: true } } },
      });
      const participating = companies.filter((company) => company.applications.length > 0).length;
      response.companies = {
        total: companies.length,
        participating,
        withoutApplications: companies.length - participating,
        participationPercentage: companies.length
          ? Math.round((participating / companies.length) * 100)
          : null,
      };
    }

    res.json(response);
  } catch (error) {
    console.error('Error fetching executive dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch executive dashboard' });
  }
});

// Developer view: engineering portfolio, integration hygiene, and the build-time
// controls we can derive today. Findings tiles stay null until Wiz SAST lands.
router.get('/developer', requireAuth, async (req, res) => {
  try {
    const { rows } = await loadScopedApplications(req);
    const total = rows.length;
    const withRepo = rows.filter((row) => row.hasRepo);
    const missingIntegrations = rows.filter((row) => !row.hasRepo && !row.hasToolLink);
    // A repo URL was captured but never connected to a synced SCM repo.
    const reposNeedingSetup = rows.filter((row) => !row.hasRepo && hasConfiguredValue(row.repoUrl));
    const sastApps = rows.filter((row) => row.securityTesting.sast);
    const scaApps = rows.filter((row) => row.securityTesting.sca);
    const cicdApps = rows.filter((row) => row.hasDeploymentToken);

    res.json({
      portfolio: {
        applicationsInScope: total,
        repositoriesConnected: countConnectedRepos(rows),
        branchesWithSecurityData: rows.filter((row) => row.branchWithSecurityData).length,
      },
      integrations: {
        applicationsMissingIntegrations: missingIntegrations.length,
        repositoriesNeedingSetup: reposNeedingSetup.length,
      },
      buildSecurity: {
        cicdControlApplications: cicdApps.length,
        cicdControlPercentage: percentage(cicdApps.length, total),
        sastApplications: sastApps.length,
        sastCoveragePercentage: percentage(sastApps.length, total),
        scaApplications: scaApps.length,
        scaCoveragePercentage: percentage(scaApps.length, total),
      },
    });
  } catch (error) {
    console.error('Error fetching developer dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch developer dashboard' });
  }
});

// Application-owner view: health, onboarding completeness, testing coverage, and
// the outstanding owner actions. Finding counts remain Wiz-dependent.
router.get('/application-owner', requireAuth, async (req, res) => {
  try {
    const { rows } = await loadScopedApplications(req);
    const total = rows.length;
    const scored = rows.filter((row) => row.score !== null);
    const averageScore = scored.length
      ? Math.round(scored.reduce((sum, row) => sum + row.score, 0) / scored.length)
      : null;
    const completenessValues = rows.map((row) => row.completeness);
    const averageCompleteness = total
      ? Math.round(completenessValues.reduce((sum, value) => sum + value, 0) / total)
      : null;
    const reviewed = rows.filter((row) => row.reviewed).length;
    const threatModeled = rows.filter((row) => row.threatModelStatus).length;
    const threatModelApproved = rows.filter((row) => row.threatModelStatus === 'approved').length;

    res.json({
      health: {
        averageScore,
        scoredApplicationCount: scored.length,
        totalApplications: total,
      },
      onboarding: {
        averageCompleteness,
        reviewedApplications: reviewed,
        reviewPercentage: percentage(reviewed, total),
        threatModeledApplications: threatModeled,
        threatModelApprovedApplications: threatModelApproved,
      },
      securityTesting: {
        sastApplications: rows.filter((row) => row.securityTesting.sast).length,
        dastApplications: rows.filter((row) => row.securityTesting.dast).length,
        scaApplications: rows.filter((row) => row.securityTesting.sca).length,
        totalApplications: total,
      },
      actions: {
        policyExceptions: rows.reduce((sum, row) => sum + row.overrideCount, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching application-owner dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch application-owner dashboard' });
  }
});

// Program-operations view: coverage, governance, and inventory data quality.
// Remediation MTTR / finding counts stay null pending Wiz history.
router.get('/program-operations', requireAuth, async (req, res) => {
  try {
    const { applications, rows } = await loadScopedApplications(req);
    const total = rows.length;
    const onboarded = rows.filter((row) => row.status === 'onboarded').length;
    const wizConfigured = rows.filter((row) => row.wizConfigured).length;
    const securityTesting = rows.filter((row) => row.securityTestingConfigured).length;
    const neverReviewed = rows.filter((row) => !row.reviewed).length;
    const staleIntegrations = rows.filter((row) => row.hasRepo && row.repoStale).length;
    const missingMetadata = rows.filter((row) => row.completeness < 100).length;
    const compliance = await summarizeCompliance(applications);

    res.json({
      coverage: {
        applicationsOnboarded: onboarded,
        totalApplications: total,
        wizConfiguredApplications: wizConfigured,
        wizConfigurationPercentage: percentage(wizConfigured, total),
        securityTestingApplications: securityTesting,
        securityTestingCoveragePercentage: percentage(securityTesting, total),
      },
      governance: {
        compliancePercentage: compliance.compliancePercentage,
        meetingControls: compliance.meetingControls,
        totalControls: compliance.totalControls,
        policyExceptions: rows.reduce((sum, row) => sum + row.overrideCount, 0),
      },
      dataQuality: {
        applicationsNeverReviewed: neverReviewed,
        staleIntegrations,
        staleThresholdDays: STALE_INTEGRATION_DAYS,
        applicationsMissingMetadata: missingMetadata,
      },
    });
  } catch (error) {
    console.error('Error fetching program-operations dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch program-operations dashboard' });
  }
});

export default router;
