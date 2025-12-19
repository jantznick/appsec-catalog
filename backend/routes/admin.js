import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

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
      applicationsByStatus,
      verifiedUsers,
      unverifiedUsers,
    ] = await Promise.all([
      prisma.company.count(),
      prisma.application.count(),
      prisma.user.count(),
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
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

// ADMIN-5: Get all applications with filtering (admin only)
router.get('/applications', async (req, res) => {
  try {
    const { companyId, status, search } = req.query;

    let whereClause = {};

    // Filter by company
    if (companyId) {
      whereClause.companyId = companyId;
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

export default router;


