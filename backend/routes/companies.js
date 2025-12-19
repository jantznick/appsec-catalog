import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateSlug, ensureUniqueSlug } from '../utils/slug.js';

const router = express.Router();

// Public: Get company by slug (for onboarding forms)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const company = await prisma.company.findFirst({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        language: true,
        framework: true,
        serverEnvironment: true,
        facing: true,
        deploymentType: true,
        authProfiles: true,
        dataTypes: true,
        engManager: true,
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error fetching company by slug:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Public: List all companies (for onboarding company selection)
router.get('/public', async (req, res) => {
  try {
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    res.json(companies);
  } catch (error) {
    console.error('Error fetching public companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Public: Create company (for onboarding - minimal data)
router.post('/public', async (req, res) => {
  try {
    const { name } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check if company name already exists
    const existing = await prisma.company.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    // Generate unique slug (required for new companies)
    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug);

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        slug, // Required for new companies
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    res.status(201).json(company);
  } catch (error) {
    console.error('Error creating public company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});


// COMP-1: Get company list
// Admin: all companies, Regular user: only their company
router.get('/', requireAuth, async (req, res) => {
  try {
    if (req.session.isAdmin) {
      // Admin sees all companies
      const companies = await prisma.company.findMany({
        include: {
          _count: {
            select: {
              users: true,
              applications: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });
      return res.json(companies);
    } else {
      // Regular user sees only their company
      if (!req.session.companyId) {
        return res.json([]);
      }
      const company = await prisma.company.findUnique({
        where: { id: req.session.companyId },
        include: {
          _count: {
            select: {
              users: true,
              applications: true,
            },
          },
        },
      });
      return res.json(company ? [company] : []);
    }
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Get company average score
router.get('/:id/average-score', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access (admin or member of company)
    if (!req.session.isAdmin && req.session.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    // Get all applications for this company
    const applications = await prisma.application.findMany({
      where: { companyId: id },
      select: { id: true },
    });

    if (applications.length === 0) {
      return res.json({
        averageScore: null,
        applicationCount: 0,
        message: 'No applications found for this company',
      });
    }

    const applicationIds = applications.map(app => app.id);

    // Get all scores for these applications, ordered by date
    const allScores = await prisma.score.findMany({
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
            name: true,
          },
        },
      },
    });

    if (allScores.length === 0) {
      return res.json({
        averageScore: null,
        applicationCount: applications.length,
        message: 'No scores found for applications in this company',
      });
    }

    // Get the most recent score for each application
    const latestScoresMap = new Map();
    for (const score of allScores) {
      if (!latestScoresMap.has(score.applicationId)) {
        latestScoresMap.set(score.applicationId, score);
      }
    }
    const latestScores = Array.from(latestScoresMap.values());

    const totalScore = latestScores.reduce((sum, score) => sum + score.totalScore, 0);
    const averageScore = Math.round(totalScore / latestScores.length);

    // Find highest and lowest scoring applications
    let highestScore = latestScores[0];
    let lowestScore = latestScores[0];
    
    for (const score of latestScores) {
      if (score.totalScore > highestScore.totalScore) {
        highestScore = score;
      }
      if (score.totalScore < lowestScore.totalScore) {
        lowestScore = score;
      }
    }

    res.json({
      averageScore,
      applicationCount: applications.length,
      scoredApplicationCount: latestScores.length,
      highestApplication: {
        id: highestScore.application.id,
        name: highestScore.application.name,
        score: highestScore.totalScore,
      },
      lowestApplication: {
        id: lowestScore.application.id,
        name: lowestScore.application.name,
        score: lowestScore.totalScore,
      },
    });
  } catch (error) {
    console.error('Error calculating company average score:', error);
    res.status(500).json({ error: 'Failed to calculate average score' });
  }
});

// COMP-2: Get company detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access (admin or member of company)
    if (!req.session.isAdmin && req.session.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        domains: true,
        engManager: true,
        language: true,
        framework: true,
        serverEnvironment: true,
        facing: true,
        deploymentType: true,
        authProfiles: true,
        dataTypes: true,
        users: {
          select: {
            id: true,
            email: true,
            verifiedAccount: true,
            isAdmin: true,
          },
          orderBy: {
            email: 'asc',
          },
        },
        _count: {
          select: {
            applications: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Get domains for a company
router.get('/:id/domains', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user has access (admin or member of company)
    if (!req.session.isAdmin && req.session.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    // Get all domains for this company
    const domains = await prisma.domain.findMany({
      where: { companyId: id },
      include: {
        _count: {
          select: {
            applicationDomains: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(domains);
  } catch (error) {
    console.error('Error fetching company domains:', error);
    res.status(500).json({ error: 'Failed to fetch company domains' });
  }
});

// COMP-3: Create company (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      name,
      domains,
      engManager,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
    } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check if company name already exists
    const existing = await prisma.company.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return res.status(400).json({ error: 'Company name already exists' });
    }

    // Generate unique slug (required for new companies)
    const baseSlug = generateSlug(name.trim());
    const slug = await ensureUniqueSlug(baseSlug);

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        slug, // Required for new companies
        domains: domains?.trim() || null,
        engManager: engManager?.trim() || null,
        language: language?.trim() || null,
        framework: framework?.trim() || null,
        serverEnvironment: serverEnvironment?.trim() || null,
        facing: facing?.trim() || null,
        deploymentType: deploymentType?.trim() || null,
        authProfiles: authProfiles?.trim() || null,
        dataTypes: dataTypes?.trim() || null,
      },
    });

    res.status(201).json(company);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// COMP-4: Update company (Admin only)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      domains,
      engManager,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
    } = req.body;

    // Check if company exists
    const existing = await prisma.company.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user has access (admin or member of company)
    if (!req.session.isAdmin && req.session.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update your own company',
      });
    }

    // Only admins can change name and domains
    let updateData = {};
    if (name && name.trim() !== existing.name) {
      if (!req.session.isAdmin) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Only admins can change company name',
        });
      }

      const duplicate = await prisma.company.findUnique({
        where: { name: name.trim() },
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Company name already exists' });
      }

      // Regenerate slug when name changes
      const baseSlug = generateSlug(name.trim());
      const slug = await ensureUniqueSlug(baseSlug, id);
      updateData.name = name.trim();
      updateData.slug = slug;
    }

    if (domains !== undefined && !req.session.isAdmin) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only admins can change company domains',
      });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...updateData,
        ...(domains !== undefined && req.session.isAdmin && { domains: domains?.trim() || null }),
        ...(engManager !== undefined && { engManager: engManager?.trim() || null }),
        ...(language !== undefined && { language: language?.trim() || null }),
        ...(framework !== undefined && { framework: framework?.trim() || null }),
        ...(serverEnvironment !== undefined && { serverEnvironment: serverEnvironment?.trim() || null }),
        ...(facing !== undefined && { facing: facing?.trim() || null }),
        ...(deploymentType !== undefined && { deploymentType: deploymentType?.trim() || null }),
        ...(authProfiles !== undefined && { authProfiles: authProfiles?.trim() || null }),
        ...(dataTypes !== undefined && { dataTypes: dataTypes?.trim() || null }),
      },
    });

    res.json(company);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// COMP-5: Assign user to company (Admin only)
router.post('/:id/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: companyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's company
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { companyId },
      select: {
        id: true,
        email: true,
        verifiedAccount: true,
        isAdmin: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error('Error assigning user to company:', error);
    res.status(500).json({ error: 'Failed to assign user to company' });
  }
});

// COMP-6: Remove user from company (Admin only)
router.delete('/:id/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: companyId, userId } = req.params;

    // Check if company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if user exists and belongs to this company
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.companyId !== companyId) {
      return res.status(400).json({
        error: 'User does not belong to this company',
      });
    }

    // Remove user from company
    await prisma.user.update({
      where: { id: userId },
      data: { companyId: null },
    });

    res.json({ message: 'User removed from company successfully' });
  } catch (error) {
    console.error('Error removing user from company:', error);
    res.status(500).json({ error: 'Failed to remove user from company' });
  }
});

export default router;

