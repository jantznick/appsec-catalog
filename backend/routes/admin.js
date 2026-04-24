import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  getExportPreviewList,
  buildSecurityFindingsCsv,
  parseTimeRange,
} from '../services/securityFindingsExportService.js';
import { createJob, updateJob, getJob } from '../jobs/securityFindingsJobStore.js';

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

// Security findings export (Tenable WAS + Wiz SAST) — real-time vendor calls, async job
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
    const { companyIds, separateByApp, time } = req.body || {};
    if (!Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ error: 'companyIds (non-empty array) is required' });
    }
    const tr = parseTimeRange(time);
    const jobId = createJob();
    updateJob(jobId, { status: 'running', message: 'Starting…' });
    setImmediate(async () => {
      try {
        const csv = await buildSecurityFindingsCsv(
          prisma,
          {
            companyIds,
            timeRange: tr,
            separateByApp: Boolean(separateByApp),
            onProgress: (msg) => {
              updateJob(jobId, { message: msg });
            },
          },
        );
        updateJob(jobId, { status: 'complete', message: 'Done', csv });
      } catch (e) {
        console.error('security findings job', e);
        updateJob(jobId, { status: 'error', error: (e && e.message) || 'Export failed' });
      }
    });
    res.status(202).json({ jobId, message: 'Export started' });
  } catch (error) {
    console.error('security findings start', error);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

router.get('/security-findings/jobs/:id', (req, res) => {
  const j = getJob(req.params.id);
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({
    status: j.status,
    message: j.message,
    error: j.error,
  });
});

router.get('/security-findings/jobs/:id/csv', (req, res) => {
  const j = getJob(req.params.id);
  if (!j) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (j.status !== 'complete' || !j.csv) {
    return res.status(409).json({ error: 'Not ready' });
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="security-findings-${req.params.id}.csv"`);
  return res.send(j.csv);
});

export default router;


