import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all divisions (admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const divisions = await prisma.division.findMany({
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(divisions);
  } catch (error) {
    console.error('Error fetching divisions:', error);
    res.status(500).json({ error: 'Failed to fetch divisions' });
  }
});

// Get single division (admin only)
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const division = await prisma.division.findUnique({
      where: { id },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: {
            companies: true,
          },
        },
      },
    });

    if (!division) {
      return res.status(404).json({ error: 'Division not found' });
    }

    res.json(division);
  } catch (error) {
    console.error('Error fetching division:', error);
    res.status(500).json({ error: 'Failed to fetch division' });
  }
});

// Get division stats (average score, companies with scores, etc.)
router.get('/:id/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get division with companies
    const division = await prisma.division.findUnique({
      where: { id },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!division) {
      return res.status(404).json({ error: 'Division not found' });
    }

    const companyIds = division.companies.map(c => c.id);

    if (companyIds.length === 0) {
      return res.json({
        averageScore: null,
        companyCount: 0,
        applicationCount: 0,
        userCount: 0,
        companies: [],
        bestCompany: null,
        worstCompany: null,
        message: 'No companies in this division',
      });
    }

    // Get all applications for companies in this division
    const applications = await prisma.application.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    });

    const applicationIds = applications.map(app => app.id);

    // Get application counts per company
    const appCounts = await prisma.application.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _count: {
        companyId: true,
      },
    });

    const companyApplicationCounts = {};
    appCounts.forEach(item => {
      companyApplicationCounts[item.companyId] = item._count.companyId;
    });

    // Get user counts per company
    const userCounts = await prisma.user.groupBy({
      by: ['companyId'],
      where: { companyId: { in: companyIds } },
      _count: {
        companyId: true,
      },
    });

    const companyUserCounts = {};
    userCounts.forEach(item => {
      companyUserCounts[item.companyId] = item._count.companyId;
    });

    // Get all scores for these applications, ordered by date
    let allScores = [];
    if (applicationIds.length > 0) {
      allScores = await prisma.score.findMany({
        where: {
          applicationId: { in: applicationIds },
        },
        orderBy: {
          calculatedAt: 'desc',
        },
        include: {
          application: {
            select: {
              id: true,
              companyId: true,
            },
          },
        },
      });
    }

    // Get the most recent score for each application
    const latestScoresMap = new Map();
    for (const score of allScores) {
      if (!latestScoresMap.has(score.applicationId)) {
        latestScoresMap.set(score.applicationId, score);
      }
    }

    // Calculate average score per company
    const scoresByCompany = {};
    latestScoresMap.forEach((score) => {
      const companyId = score.application.companyId;
      if (!scoresByCompany[companyId]) {
        scoresByCompany[companyId] = [];
      }
      scoresByCompany[companyId].push(score.totalScore);
    });

    // Calculate company averages
    const companyAverages = {};
    Object.keys(scoresByCompany).forEach(companyId => {
      const scores = scoresByCompany[companyId];
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      companyAverages[companyId] = Math.round(avg);
    });

    // Build company data with scores
    const companiesWithScores = division.companies.map(company => ({
      id: company.id,
      name: company.name,
      averageScore: companyAverages[company.id] || null,
      applicationCount: companyApplicationCounts[company.id] || 0,
      userCount: companyUserCounts[company.id] || 0,
    }));

    // Calculate division average
    const allCompanyScores = Object.values(companyAverages).filter(s => s !== null);
    const divisionAverage = allCompanyScores.length > 0
      ? Math.round(allCompanyScores.reduce((a, b) => a + b, 0) / allCompanyScores.length)
      : null;

    // Find best and worst companies
    const companiesWithValidScores = companiesWithScores.filter(c => c.averageScore !== null);
    const bestCompany = companiesWithValidScores.length > 0
      ? companiesWithValidScores.reduce((best, current) => 
          current.averageScore > best.averageScore ? current : best
        )
      : null;
    const worstCompany = companiesWithValidScores.length > 0
      ? companiesWithValidScores.reduce((worst, current) => 
          current.averageScore < worst.averageScore ? current : worst
        )
      : null;

    res.json({
      averageScore: divisionAverage,
      companyCount: division.companies.length,
      applicationCount: applications.length,
      userCount: Object.values(companyUserCounts).reduce((a, b) => a + b, 0),
      companies: companiesWithScores,
      bestCompany,
      worstCompany,
    });
  } catch (error) {
    console.error('Error fetching division stats:', error);
    res.status(500).json({ error: 'Failed to fetch division stats' });
  }
});

// Create division (admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Division name is required' });
    }

    const division = await prisma.division.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.status(201).json(division);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Division name already exists' });
    }
    console.error('Error creating division:', error);
    res.status(500).json({ error: 'Failed to create division' });
  }
});

// Update division (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Division name is required' });
    }

    const division = await prisma.division.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    res.json(division);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Division not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Division name already exists' });
    }
    console.error('Error updating division:', error);
    res.status(500).json({ error: 'Failed to update division' });
  }
});

// Delete division (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if division has companies
    const division = await prisma.division.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            companies: true,
          },
        },
      },
    });

    if (!division) {
      return res.status(404).json({ error: 'Division not found' });
    }

    if (division._count.companies > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete division with associated companies. Please reassign companies first.' 
      });
    }

    await prisma.division.delete({
      where: { id },
    });

    res.json({ message: 'Division deleted successfully' });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Division not found' });
    }
    console.error('Error deleting division:', error);
    res.status(500).json({ error: 'Failed to delete division' });
  }
});

export default router;

