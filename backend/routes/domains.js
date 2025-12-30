import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all domains (admin sees all, non-admin sees their company's domains)
router.get('/', requireAuth, async (req, res) => {
  try {
    let whereClause = {};

    // Filter by company (user's company or admin sees all)
    if (!req.session.isAdmin) {
      if (!req.session.companyId) {
        return res.json([]);
      }
      whereClause.companyId = req.session.companyId;
    }

    const domains = await prisma.domain.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
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
    console.error('Error fetching domains:', error);
    res.status(500).json({ error: 'Failed to fetch domains' });
  }
});

// Get domain detail with associated applications
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const domain = await prisma.domain.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        applicationDomains: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
                description: true,
                owner: true,
                status: true,
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== domain.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access domains in your company',
      });
    }

    // Transform to include applications directly
    const domainWithApplications = {
      ...domain,
      applications: domain.applicationDomains.map(ad => ad.application),
    };
    delete domainWithApplications.applicationDomains;

    res.json(domainWithApplications);
  } catch (error) {
    console.error('Error fetching domain:', error);
    res.status(500).json({ error: 'Failed to fetch domain' });
  }
});

export default router;







