import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { getApexDomain } from '../utils/domainApex.js';
import { isValidDomain, normalizeDomain } from '../utils/domainValidation.js';

const router = express.Router();

function deriveDomainRelationships(targetDomain, relatedDomains) {
  const targetName = (targetDomain.name || '').trim().toLowerCase();
  const apexDomainName = (targetDomain.apexDomain || getApexDomain(targetName) || '').trim().toLowerCase() || null;
  const isApexDomain = !!apexDomainName && targetName === apexDomainName;

  const parent = !isApexDomain && apexDomainName
    ? relatedDomains.find((domain) => (domain.name || '').trim().toLowerCase() === apexDomainName) || null
    : null;

  const children = isApexDomain
    ? relatedDomains.filter((candidate) => (candidate.name || '').trim().toLowerCase() !== targetName)
    : [];

  const siblings = !isApexDomain && apexDomainName
    ? relatedDomains.filter((candidate) => (
      (candidate.name || '').trim().toLowerCase() !== targetName
      && (candidate.name || '').trim().toLowerCase() !== apexDomainName
    ))
    : [];

  return {
    apexDomainName,
    isApexDomain,
    parent,
    children,
    siblings,
  };
}

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

// Create a domain
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      name,
      companyId: requestedCompanyId,
      description,
      owner,
      status,
    } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    if (!isValidDomain(name)) {
      return res.status(400).json({
        error: 'Invalid domain format. Domain must be in format example.com or subdomain.example.com (no http:// or https://)',
      });
    }

    const companyId = req.session.isAdmin ? requestedCompanyId : req.session.companyId;

    if (!companyId) {
      return res.status(400).json({
        error: 'Company is required',
        message: 'Select a company before creating a domain',
      });
    }

    const normalizedName = normalizeDomain(name);
    if (status !== undefined && status !== null && typeof status !== 'string') {
      return res.status(400).json({ error: 'Status must be a string' });
    }
    const normalizedStatus = status?.trim() || 'unknown';

    const domain = await prisma.domain.create({
      data: {
        name: normalizedName,
        companyId,
        apexDomain: getApexDomain(normalizedName),
        description: description?.trim() || null,
        owner: owner?.trim() || null,
        status: normalizedStatus,
      },
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
    });

    res.status(201).json(domain);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Domain already exists for this company' });
    }
    console.error('Error creating domain:', error);
    res.status(500).json({ error: 'Failed to create domain' });
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

    const effectiveApexDomain = domain.apexDomain || getApexDomain(domain.name);

    const relatedDomains = await prisma.domain.findMany({
      where: {
        companyId: domain.companyId,
        ...(effectiveApexDomain
          ? { apexDomain: effectiveApexDomain }
          : { id: domain.id }),
      },
      select: {
        id: true,
        name: true,
        description: true,
        owner: true,
        status: true,
        apexDomain: true,
        createdAt: true,
        updatedAt: true,
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

    const relationships = deriveDomainRelationships(domain, relatedDomains);

    // Transform to include applications directly
    const domainWithApplications = {
      ...domain,
      applications: domain.applicationDomains.map(ad => ad.application),
      apexDomain: effectiveApexDomain,
      relatedDomains,
      relationships,
    };
    delete domainWithApplications.applicationDomains;

    res.json(domainWithApplications);
  } catch (error) {
    console.error('Error fetching domain:', error);
    res.status(500).json({ error: 'Failed to fetch domain' });
  }
});

// Update domain metadata (admin only)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, owner, status } = req.body;

    const existingDomain = await prisma.domain.findUnique({
      where: { id },
    });

    if (!existingDomain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    const updateData = {};

    if (name !== undefined) {
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Domain name is required' });
      }
      if (!isValidDomain(name)) {
        return res.status(400).json({
          error: 'Invalid domain format. Domain must be in format example.com or subdomain.example.com (no http:// or https://)',
        });
      }
      const normalizedName = normalizeDomain(name);
      updateData.name = normalizedName;
      updateData.apexDomain = getApexDomain(normalizedName);
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string' });
      }
      updateData.description = description?.trim() || null;
    }

    if (owner !== undefined) {
      if (owner !== null && typeof owner !== 'string') {
        return res.status(400).json({ error: 'Owner must be a string' });
      }
      updateData.owner = owner?.trim() || null;
    }

    if (status !== undefined) {
      if (status !== null && typeof status !== 'string') {
        return res.status(400).json({ error: 'Status must be a string' });
      }
      updateData.status = status?.trim() || 'unknown';
    }

    const updatedDomain = await prisma.domain.update({
      where: { id },
      data: updateData,
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
    });

    res.json(updatedDomain);
  } catch (error) {
    if (error?.code === 'P2002') {
      return res.status(400).json({ error: 'Domain already exists for this company' });
    }
    console.error('Error updating domain:', error);
    res.status(500).json({ error: 'Failed to update domain' });
  }
});

export default router;







