import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { generateSlug, ensureUniqueSlug } from '../utils/slug.js';
import { buildIntegrationSummaryForCompanyId } from '../integrations/summaryForCompany.js';
import { aggregateCompletenessForCompany } from '../utils/portfolioCompleteness.js';
import { buildCompanySecurityCoverage } from '../utils/companySecurityCoverage.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

function escapeCsvField(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseApplicationInterfaceTargetIds(interfacesJson, appById) {
  if (!interfacesJson) return [];
  try {
    const v = JSON.parse(interfacesJson);
    if (!Array.isArray(v)) return [];
    const ids = [];
    for (const item of v) {
      if (item == null) continue;
      let raw =
        typeof item === 'string'
          ? item.trim()
          : typeof item === 'object' && item !== null && item.applicationId != null
            ? String(item.applicationId).trim()
            : typeof item === 'object' && item !== null && item.id != null
              ? String(item.id).trim()
              : null;
      if (!raw) continue;
      if (appById.has(raw)) {
        ids.push(raw);
        continue;
      }
      for (const app of appById.values()) {
        if (app?.name && String(app.name).trim() === raw) {
          ids.push(app.id);
          break;
        }
      }
    }
    return [...new Set(ids)];
  } catch {
    return [];
  }
}

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
    const auth = getAuthContext(req);
    if (auth.isAdmin) {
      // Admin sees all companies
      const { divisionId } = req.query;
      
      const whereClause = {};
      if (divisionId) {
        whereClause.divisionId = divisionId;
      }
      
      const companies = await prisma.company.findMany({
        where: whereClause,
        include: {
          division: {
            select: {
              id: true,
              name: true,
            },
          },
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

      const scopedCredRows = await prisma.integrationCredential.findMany({
        where: { scope: 'COMPANY', companyId: { not: null } },
        select: { companyId: true },
      });
      const companyIdsWithScopedIntegrations = new Set(
        [...new Set(scopedCredRows.map((r) => r.companyId))].filter(Boolean),
      );

      return res.json(
        companies.map((c) => ({
          ...c,
          hasCompanyScopedIntegrations: companyIdsWithScopedIntegrations.has(c.id),
        })),
      );
    } else {
      // Regular user sees only their company
      if (!auth.companyId) {
        return res.json([]);
      }
      const company = await prisma.company.findUnique({
        where: { id: auth.companyId },
        include: {
          division: {
            select: {
              id: true,
              name: true,
            },
          },
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

/**
 * CSV summary: company, product names (comma-separated), counts, application names, count.
 * Admin: any companies. Members: only their company (other IDs rejected).
 */
router.post('/export-portfolio', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const rawIds = req.body?.companyIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return res.status(400).json({ error: 'companyIds must be a non-empty array' });
    }
    const companyIds = [...new Set(rawIds.map((id) => String(id).trim()).filter(Boolean))];
    if (companyIds.length === 0) {
      return res.status(400).json({ error: 'No valid company IDs' });
    }

    let allowedIds = companyIds;
    if (!auth.isAdmin) {
      if (!auth.companyId) {
        return res.status(403).json({ error: 'Permission denied' });
      }
      const foreign = companyIds.filter((id) => id !== auth.companyId);
      if (foreign.length > 0) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only export your own company',
        });
      }
      allowedIds = companyIds.filter((id) => id === auth.companyId);
    }

    const companies = await prisma.company.findMany({
      where: { id: { in: allowedIds } },
      select: {
        id: true,
        name: true,
        products: { select: { name: true }, orderBy: { name: 'asc' } },
        applications: {
          orderBy: { name: 'asc' },
          select: {
            name: true,
            description: true,
            repoUrl: true,
            devTeamContact: true,
            businessCriticality: true,
            criticalAspects: true,
            language: true,
            framework: true,
            serverEnvironment: true,
            currentVersion: true,
            facing: true,
            deploymentType: true,
            authProfiles: true,
            dataTypes: true,
            sastTool: true,
            sastIntegrationLevel: true,
            dastTool: true,
            dastIntegrationLevel: true,
            scaTool: true,
            scaIntegrationLevel: true,
            sastIncludesSca: true,
            appFirewallTool: true,
            appFirewallIntegrationLevel: true,
            apiSecurityTool: true,
            apiSecurityIntegrationLevel: true,
            apiSecurityNA: true,
            appFirewallNA: true,
          },
        },
      },
    });

    if (companies.length !== allowedIds.length) {
      return res.status(400).json({ error: 'One or more companies were not found' });
    }

    const byId = new Map(companies.map((c) => [c.id, c]));
    const ordered = allowedIds.map((id) => byId.get(id)).filter(Boolean);

    const header =
      'company,products,productCount,applications,applicationCount,metadataCompleteness,securityCompleteness';
    const rows = ordered.map((c) => {
      const productNames = c.products.map((p) => p.name);
      const appNames = c.applications.map((a) => a.name);
      const productsCell = productNames.join(', ');
      const appsCell = appNames.join(', ');
      const { metadataCompleteness, securityCompleteness } = aggregateCompletenessForCompany(
        c.applications,
      );
      return [
        escapeCsvField(c.name),
        escapeCsvField(productsCell),
        String(productNames.length),
        escapeCsvField(appsCell),
        String(appNames.length),
        escapeCsvField(metadataCompleteness),
        escapeCsvField(securityCompleteness),
      ].join(',');
    });

    const csv = `${header}\r\n${rows.join('\r\n')}\r\n`;
    const filename = 'company-portfolio-export.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    console.error('Error building portfolio export CSV:', error);
    res.status(500).json({ error: 'Failed to build CSV' });
  }
});

// Get company average score
router.get('/:id/average-score', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    // Check if user has access (admin or member of company)
    if (!auth.isAdmin && auth.companyId !== id) {
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

function safeAsciiFilename(s) {
  if (!s || typeof s !== 'string') {
    return 'company';
  }
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (t || 'company').slice(0, 80);
}

/** Admin or company members: CSV of app name and technical onboarding form URL for each application. */
router.get('/:id/technical-onboarding-form-links', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    if (!auth.isAdmin && auth.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    let company = await prisma.company.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (!company.slug) {
      const baseSlug = generateSlug(company.name);
      const slug = await ensureUniqueSlug(baseSlug, company.id);
      company = await prisma.company.update({
        where: { id: company.id },
        data: { slug },
        select: { id: true, name: true, slug: true },
      });
    }

    const applications = await prisma.application.findMany({
      where: { companyId: id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const rows = [
      'app name,form link',
      ...applications.map(
        (app) =>
          `${escapeCsvField(app.name)},${escapeCsvField(
            `${frontendUrl}/onboard/${company.slug}/application/${app.id}`,
          )}`,
      ),
    ];
    const csv = `${rows.join('\r\n')}\r\n`;

    const base = safeAsciiFilename(company.name);
    const filename = `technical-onboarding-form-links-${base}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (error) {
    console.error('Error building technical onboarding form links CSV:', error);
    res.status(500).json({ error: 'Failed to build CSV' });
  }
});

/** Portfolio map: all applications, product groupings, mappings, flows, and ingress (read-only). */
router.get('/:id/portfolio-architecture', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    if (!auth.isAdmin && auth.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    const company = await prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const [applications, productRows] = await Promise.all([
      prisma.application.findMany({
        where: { companyId: id },
        select: {
          id: true,
          name: true,
          facing: true,
          description: true,
          interfaces: true,
        },
        orderBy: { name: 'asc' },
      }),
      prisma.product.findMany({
        where: { companyId: id },
        include: {
          applications: {
            select: {
              applicationId: true,
              componentType: { select: { name: true } },
              customComponentLabel: true,
            },
          },
          dataFlows: {
            select: {
              id: true,
              productId: true,
              sourceApplicationId: true,
              targetApplicationId: true,
              flowName: true,
              direction: true,
              requiresApiKey: true,
            },
          },
          ingressPoints: {
            select: {
              id: true,
              productId: true,
              applicationId: true,
              channel: true,
              requiresApiKey: true,
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const products = productRows.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    }));

    const appById = new Map(applications.map((a) => [a.id, a]));

    const mappings = [];
    const dataFlows = [];
    const ingressPoints = [];

    for (const p of productRows) {
      for (const row of p.applications) {
        const app = appById.get(row.applicationId);
        const interfaceTargetApplicationIds = parseApplicationInterfaceTargetIds(
          app?.interfaces ?? null,
          appById
        );
        mappings.push({
          productId: p.id,
          applicationId: row.applicationId,
          componentTypeName: row.componentType?.name ?? null,
          customComponentLabel: row.customComponentLabel,
          interfaceTargetApplicationIds,
        });
      }
      for (const f of p.dataFlows) {
        dataFlows.push({ ...f });
      }
      for (const ing of p.ingressPoints) {
        ingressPoints.push({ ...ing });
      }
    }

    res.json({
      applications,
      products,
      mappings,
      dataFlows,
      ingressPoints,
    });
  } catch (error) {
    console.error('Error fetching portfolio architecture:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio architecture' });
  }
});

/** Security tool coverage by category (SAST, SCA, DAST, WAF, API) for company detail. */
router.get('/:id/security-coverage', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    if (!auth.isAdmin && auth.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access your own company',
      });
    }

    const applications = await prisma.application.findMany({
      where: { companyId: id },
      select: {
        id: true,
        name: true,
        sastTool: true,
        sastIntegrationLevel: true,
        sastIncludesSca: true,
        dastTool: true,
        dastIntegrationLevel: true,
        scaTool: true,
        scaIntegrationLevel: true,
        appFirewallTool: true,
        appFirewallIntegrationLevel: true,
        appFirewallNA: true,
        apiSecurityTool: true,
        apiSecurityIntegrationLevel: true,
        apiSecurityNA: true,
        lastSastScanDate: true,
        lastDastScanDate: true,
        lastScaScanDate: true,
      },
      orderBy: { name: 'asc' },
    });

    const payload = buildCompanySecurityCoverage(applications);
    res.json(payload);
  } catch (error) {
    console.error('Error building company security coverage:', error);
    res.status(500).json({ error: 'Failed to fetch security coverage' });
  }
});

// COMP-2: Get company detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    // Check if user has access (admin or member of company)
    if (!auth.isAdmin && auth.companyId !== id) {
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
        divisionId: true,
        division: {
          select: {
            id: true,
            name: true,
          },
        },
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
        companyToolLinks: {
          select: {
            id: true,
            provider: true,
            filter: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const isAdminSession = !!auth.isAdmin;
    const integrationSummary = await buildIntegrationSummaryForCompanyId(prisma, id, isAdminSession);

    res.json({ ...company, integrationSummary });
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Failed to fetch company' });
  }
});

// Get domains for a company
router.get('/:id/domains', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const auth = getAuthContext(req);

    // Check if user has access (admin or member of company)
    if (!auth.isAdmin && auth.companyId !== id) {
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
      divisionId,
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
        divisionId: divisionId || null,
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
    const auth = getAuthContext(req);
    const {
      name,
      domains,
      divisionId,
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
    if (!auth.isAdmin && auth.companyId !== id) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update your own company',
      });
    }

    // Only admins can change name and domains
    let updateData = {};
    if (name && name.trim() !== existing.name) {
      if (!auth.isAdmin) {
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

    if (domains !== undefined && !auth.isAdmin) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Only admins can change company domains',
      });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...updateData,
        ...(domains !== undefined && auth.isAdmin && { domains: domains?.trim() || null }),
        ...(divisionId !== undefined && auth.isAdmin && { divisionId: divisionId || null }),
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

