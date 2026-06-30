import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getExportPreviewList,
  parseTimeRange,
  parseExportProviders,
  assertAtLeastOneProvider,
} from '../services/securityFindingsExportService.js';
import { createSecurityFindingsJob } from '../services/securityFindingsJobRunner.js';
import { securityOverviewCsvFilename } from '../utils/securityOverviewFilename.js';
import { triggerProdDeploy } from '../services/deployService.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// ADMIN-3: Get admin stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalCompanies,
      totalApplications,
      totalUsers,
      totalDivisions,
      applicationsByStatus,
      verifiedUsers,
      unverifiedUsers,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.application.count(),
      prisma.user.count(),
      prisma.division.count(),
      prisma.application.groupBy({
        by: ['status'],
        _count: {
          status: true,
        },
      }),
      prisma.user.count({
        where: { verifiedAccount: true },
      }),
      prisma.user.count({
        where: { verifiedAccount: false },
      }),
    ]);

    // Format applications by status
    const statusCounts = {};
    applicationsByStatus.forEach((item) => {
      statusCounts[item.status || 'onboarded'] = item._count.status;
    });

    res.json({
      companies: {
        total: totalCompanies,
      },
      applications: {
        total: totalApplications,
        byStatus: statusCounts,
      },
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        unverified: unverifiedUsers,
      },
      divisions: {
        total: totalDivisions,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// ADMIN-5: Get all applications with filtering (admin only)
router.get('/applications', async (req, res) => {
  try {
    const { companyId, status, search, divisionId } = req.query;

    let whereClause = {};

    // Filter by company
    if (companyId) {
      whereClause.companyId = companyId;
    }

    // Filter by division (through company)
    if (divisionId) {
      whereClause.company = {
        divisionId: divisionId,
      };
    }

    // Filter by status
    if (status) {
      whereClause.status = status;
    }

    // Search by name or description
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            divisionId: true,
            division: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(applications);
  } catch (error) {
    console.error('Error fetching admin applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Security findings export (Tenable WAS + Wiz SAST) - real-time vendor calls, async job
router.get('/security-findings/preview', async (req, res) => {
  try {
    const companies = await getExportPreviewList(prisma, { companyIds: null });
    res.json({ companies });
  } catch (error) {
    console.error('security findings preview', error);
    res.status(500).json({ error: 'Failed to build preview' });
  }
});

router.post('/security-findings/jobs', async (req, res) => {
  try {
    const { companyIds, separateByApp, time, providers: providersBody } = req.body || {};
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ error: 'companyIds (non-empty array) is required' });
    }
    parseTimeRange(time);
    const providers = parseExportProviders(providersBody);
    assertAtLeastOneProvider(providers);
    const userId = getAuthContext(req)?.userId;
    const jobId = await createSecurityFindingsJob({
      prisma,
      userId,
      scope: 'ADMIN_MULTI',
      companyId: null,
      requestPayload: { companyIds, separateByApp: Boolean(separateByApp), time, providers },
    });
    res.status(202).json({ jobId, message: 'Export started' });
  } catch (error) {
    const err = /** @type {Error & { statusCode?: number }} */(error);
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Invalid request' });
    }
    console.error('security findings start', error);
    return res.status(500).json({ error: 'Failed to start export' });
  }
});

router.get('/security-findings/jobs/:id', async (req, res) => {
  const j = await prisma.securityFindingsJob.findFirst({
    where: { id: req.params.id, userId: getAuthContext(req)?.userId },
    select: { status: true, message: true, error: true },
  });
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  return res.json({
    status: j.status,
    message: j.message,
    error: j.error,
  });
});

router.get('/security-findings/jobs/:id/csv', async (req, res) => {
  const j = await prisma.securityFindingsJob.findFirst({
    where: { id: req.params.id, userId: getAuthContext(req)?.userId },
    select: { status: true, resultCsv: true, scope: true, companyId: true },
  });
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (j.status !== 'complete' || !j.resultCsv) {
    return res.status(409).json({ error: 'Not ready' });
  }
  let companyName = null;
  if (j.scope === 'SINGLE_COMPANY' && j.companyId) {
    companyName = (await prisma.company.findUnique({ where: { id: j.companyId }, select: { name: true } }))?.name ?? null;
  }
  const filename = securityOverviewCsvFilename({ scope: j.scope, companyName });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(j.resultCsv);
});

// Trigger a production deploy (admin only)
// POST /api/admin/deploy
router.post('/deploy', async (req, res) => {
  try {
    const { target, version } = req.body || {};
    const result = await triggerProdDeploy({ target, version });
    return res.status(202).json(result);
  } catch (error) {
    const err = /** @type {Error & { statusCode?: number; details?: unknown }} */ (error);
    if (err.statusCode === 400) {
      return res.status(400).json({ error: err.message || 'Invalid request' });
    }
    console.error('admin deploy', error);
    return res.status(500).json({
      error: err.message || 'Deploy failed',
      details: err.details,
    });
  }
});

// ADMIN: List all user API tokens (metadata only)
router.get('/api-tokens', async (req, res) => {
  try {
    const tokens = await prisma.apiToken.findMany({
      select: {
        id: true,
        userId: true,
        name: true,
        secretHint: true,
        companyId: true,
        adminAccessDisabled: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            companyId: true,
            isAdmin: true,
            verifiedAccount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ tokens });
  } catch (error) {
    console.error('Error listing all api tokens:', error);
    return res.status(500).json({ error: 'Failed to list API tokens' });
  }
});

// ADMIN: Revoke any API token
router.delete('/api-tokens/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const token = await prisma.apiToken.findUnique({
      where: { id },
      select: { id: true, revokedAt: true },
    });
    if (!token) {
      return res.status(404).json({ error: 'API token not found' });
    }
    if (token.revokedAt) {
      return res.json({ message: 'API token already revoked' });
    }
    await prisma.apiToken.update({ where: { id }, data: { revokedAt: new Date() } });
    return res.json({ message: 'API token revoked' });
  } catch (error) {
    console.error('Error revoking api token:', error);
    return res.status(500).json({ error: 'Failed to revoke API token' });
  }
});

export default router;

