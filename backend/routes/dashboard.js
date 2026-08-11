import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

function hasConfiguredValue(value) {
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== 'NA';
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
      select: {
        id: true,
        name: true,
        status: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        sastTool: true,
        dastTool: true,
        scaTool: true,
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

export default router;
