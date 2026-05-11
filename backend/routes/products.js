import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { calculateApplicationScore } from '../services/scoring.js';
import { evaluateAllControls } from '../services/policy.js';

const router = express.Router();

const DEFAULT_COMPONENT_TYPES = [
  'Frontend',
  'Backend API',
  'Internal API',
  'Data Store',
  'Worker/Job',
  'Gateway',
];

async function ensureDefaultComponentTypes(companyId) {
  const existing = await prisma.productComponentType.findMany({
    where: { companyId },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((item) => item.name.toLowerCase()));
  const toCreate = DEFAULT_COMPONENT_TYPES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (toCreate.length === 0) return;

  await prisma.productComponentType.createMany({
    data: toCreate.map((name) => ({
      companyId,
      name,
      isDefault: true,
    })),
  });
}

function normalizeProductInput(body) {
  return {
    name: body.name?.trim(),
    description: body.description?.trim() || null,
    owner: body.owner?.trim() || null,
    facing: body.facing?.trim() || null,
    status: body.status?.trim() || 'active',
    lifecycleStage: body.lifecycleStage?.trim() || null,
    businessCriticality:
      body.businessCriticality !== undefined && body.businessCriticality !== null && body.businessCriticality !== ''
        ? parseInt(body.businessCriticality, 10)
        : null,
    dataSensitivity: body.dataSensitivity?.trim() || null,
    complianceNotes: body.complianceNotes?.trim() || null,
  };
}

async function getProductForUser(productId, session) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      company: {
        select: { id: true, name: true },
      },
      applications: {
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          application: {
            select: {
              id: true,
              name: true,
              description: true,
              companyId: true,
              status: true,
              facing: true,
              interfaces: true,
            },
          },
          componentType: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      dataFlows: {
        orderBy: [{ createdAt: 'asc' }],
        include: {
          sourceApplication: {
            select: {
              id: true,
              name: true,
            },
          },
          targetApplication: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      ingressPoints: {
        orderBy: [{ createdAt: 'asc' }],
        include: {
          application: {
            select: {
              id: true,
              name: true,
              facing: true,
            },
          },
        },
      },
    },
  });

  if (!product) return null;
  if (!session.isAdmin && session.companyId !== product.companyId) return 'forbidden';
  return product;
}

function normalizeFlowInput(body) {
  return {
    sourceApplicationId: body.sourceApplicationId,
    targetApplicationId: body.targetApplicationId,
    flowName: body.flowName?.trim() || null,
    dataClassification: body.dataClassification?.trim() || null,
    protocol: body.protocol?.trim() || null,
    direction: body.direction?.trim() || 'unidirectional',
    requiresApiKey: Boolean(body.requiresApiKey),
    notes: body.notes?.trim() || null,
  };
}

async function validateProductFlowApplications(productId, companyId, sourceApplicationId, targetApplicationId) {
  if (!sourceApplicationId || !targetApplicationId) {
    return { error: 'sourceApplicationId and targetApplicationId are required', status: 400 };
  }
  if (sourceApplicationId === targetApplicationId) {
    return { error: 'Source and target applications must be different', status: 400 };
  }

  const [sourceApp, targetApp] = await Promise.all([
    prisma.application.findUnique({ where: { id: sourceApplicationId }, select: { id: true, companyId: true } }),
    prisma.application.findUnique({ where: { id: targetApplicationId }, select: { id: true, companyId: true } }),
  ]);

  if (!sourceApp || !targetApp) {
    return { error: 'Source and target applications must exist', status: 404 };
  }
  if (sourceApp.companyId !== companyId || targetApp.companyId !== companyId) {
    return { error: 'Both applications must belong to the same company as the product', status: 400 };
  }

  const mappingCount = await prisma.productApplication.count({
    where: {
      productId,
      applicationId: { in: [sourceApplicationId, targetApplicationId] },
    },
  });
  if (mappingCount < 2) {
    return { error: 'Both applications must be mapped to this product', status: 400 };
  }

  return { ok: true };
}

// Get products (admin: all or filter by companyId, non-admin: own company only)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { companyId } = req.query;

    let where = {};
    if (req.session.isAdmin) {
      if (companyId) where.companyId = companyId;
    } else if (req.session.companyId) {
      where.companyId = req.session.companyId;
    } else {
      return res.json([]);
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        company: {
          select: { id: true, name: true },
        },
        _count: {
          select: { applications: true },
        },
      },
      orderBy: [{ company: { name: 'asc' } }, { name: 'asc' }],
    });

    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product
router.post('/', requireAuth, async (req, res) => {
  try {
    const payload = normalizeProductInput(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (
      payload.businessCriticality !== null &&
      (Number.isNaN(payload.businessCriticality) || payload.businessCriticality < 1 || payload.businessCriticality > 5)
    ) {
      return res.status(400).json({ error: 'businessCriticality must be a number between 1 and 5' });
    }

    const companyId = req.body.companyId || req.session.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'Company is required' });
    }

    if (!req.session.isAdmin && req.session.companyId !== companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only create products for your company',
      });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const product = await prisma.product.create({
      data: {
        companyId,
        ...payload,
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A product with this name already exists for this company' });
    }
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// Component types list (declared before /:id route)
router.get('/component-types', requireAuth, async (req, res) => {
  try {
    const queryCompanyId = req.query.companyId;
    const companyId = req.session.isAdmin
      ? (queryCompanyId || req.session.companyId)
      : req.session.companyId;

    if (!companyId) return res.json([]);
    if (!req.session.isAdmin && queryCompanyId && queryCompanyId !== req.session.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view component types for your company',
      });
    }

    await ensureDefaultComponentTypes(companyId);

    const types = await prisma.productComponentType.findMany({
      where: { companyId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });

    return res.json(types);
  } catch (error) {
    console.error('Error fetching product component types:', error);
    return res.status(500).json({ error: 'Failed to fetch product component types' });
  }
});

// Create component type
router.post('/component-types', requireAuth, async (req, res) => {
  try {
    const name = req.body.name?.trim();
    if (!name) return res.status(400).json({ error: 'Component type name is required' });

    const companyId = req.body.companyId || req.session.companyId;
    if (!companyId) return res.status(400).json({ error: 'Company is required' });

    if (!req.session.isAdmin && req.session.companyId !== companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only create component types for your company',
      });
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const type = await prisma.productComponentType.create({
      data: {
        companyId,
        name,
        isDefault: false,
      },
    });

    return res.status(201).json(type);
  } catch (error) {
    console.error('Error creating product component type:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'This component type already exists for this company' });
    }
    return res.status(500).json({ error: 'Failed to create product component type' });
  }
});

// Get single product
// Get product score (average of mapped application scores)
router.get('/:id/score', requireAuth, async (req, res) => {
  try {
    const product = await getProductForUser(req.params.id, req.session);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product === 'forbidden') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view products in your company',
      });
    }

    const applicationIds = (product.applications || [])
      .map((a) => a.applicationId)
      .filter(Boolean);

    if (applicationIds.length === 0) {
      // Persist a score record (0/0/0) for history consistency
      const saved = await prisma.productScore.create({
        data: {
          productId: product.id,
          avgKnowledgeScore: 0,
          avgToolScore: 0,
          avgTotalScore: 0,
        },
      });
      return res.json({
        productId: product.id,
        applicationCount: 0,
        avgKnowledgeScore: 0,
        avgToolScore: 0,
        avgTotalScore: 0,
        avgPolicyCompliancePercent: null,
        calculatedAt: saved.calculatedAt,
      });
    }

    // Fetch applications with the minimal related data needed for scoring (deployments affect scan freshness).
    const apps = await prisma.application.findMany({
      where: { id: { in: applicationIds } },
      include: {
        company: {
          select: {
            id: true,
            divisionId: true,
          },
        },
        deployments: {
          orderBy: { deployedAt: 'desc' },
          take: 1,
        },
      },
    });

    const byId = new Map(apps.map((a) => [a.id, a]));
    const orderedApps = applicationIds.map((id) => byId.get(id)).filter(Boolean);

    const complianceResults = await Promise.all(
      orderedApps.map((app) => evaluateAllControls(app)),
    );
    const policyPercents = complianceResults.map((r) => r.summary.compliance_percentage);
    const avgPolicyCompliancePercent =
      policyPercents.length > 0
        ? Math.round(policyPercents.reduce((a, b) => a + b, 0) / policyPercents.length)
        : null;

    const scored = orderedApps.map((app) => ({
      applicationId: app.id,
      name: app.name,
      ...calculateApplicationScore(app),
    }));

    const sum = scored.reduce(
      (acc, s) => {
        acc.knowledge += s.totalScore !== undefined ? s.knowledgeScore : 0;
        acc.tool += s.totalScore !== undefined ? s.toolScore : 0;
        acc.total += s.totalScore || 0;
        return acc;
      },
      { knowledge: 0, tool: 0, total: 0 },
    );

    const avgKnowledgeScore = Math.round(sum.knowledge / scored.length);
    const avgToolScore = Math.round(sum.tool / scored.length);
    const avgTotalScore = Math.round(sum.total / scored.length);

    const saved = await prisma.productScore.create({
      data: {
        productId: product.id,
        avgKnowledgeScore,
        avgToolScore,
        avgTotalScore,
      },
    });

    return res.json({
      productId: product.id,
      applicationCount: scored.length,
      avgKnowledgeScore,
      avgToolScore,
      avgTotalScore,
      avgPolicyCompliancePercent,
      calculatedAt: saved.calculatedAt,
      applications: scored.map((s, i) => ({
        applicationId: s.applicationId,
        name: s.name,
        totalScore: s.totalScore,
        policyCompliancePercent: policyPercents[i] ?? null,
      })),
    });
  } catch (error) {
    console.error('Error fetching product score:', error);
    return res.status(500).json({ error: 'Failed to fetch product score' });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  try {
    const product = await getProductForUser(req.params.id, req.session);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product === 'forbidden') {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view products in your company',
      });
    }

    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Update product
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== existing.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update products in your company',
      });
    }

    const payload = normalizeProductInput(req.body);
    if (payload.name !== undefined && !payload.name) {
      return res.status(400).json({ error: 'Product name is required' });
    }
    if (
      payload.businessCriticality !== null &&
      payload.businessCriticality !== undefined &&
      (Number.isNaN(payload.businessCriticality) || payload.businessCriticality < 1 || payload.businessCriticality > 5)
    ) {
      return res.status(400).json({ error: 'businessCriticality must be a number between 1 and 5' });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(payload.name !== undefined && { name: payload.name }),
        ...(req.body.description !== undefined && { description: payload.description }),
        ...(req.body.owner !== undefined && { owner: payload.owner }),
        ...(req.body.facing !== undefined && { facing: payload.facing }),
        ...(req.body.status !== undefined && { status: payload.status }),
        ...(req.body.lifecycleStage !== undefined && { lifecycleStage: payload.lifecycleStage }),
        ...(req.body.businessCriticality !== undefined && {
          businessCriticality: payload.businessCriticality,
        }),
        ...(req.body.dataSensitivity !== undefined && { dataSensitivity: payload.dataSensitivity }),
        ...(req.body.complianceNotes !== undefined && { complianceNotes: payload.complianceNotes }),
      },
      include: {
        company: {
          select: { id: true, name: true },
        },
      },
    });

    return res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A product with this name already exists for this company' });
    }
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product (admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    await prisma.product.delete({
      where: { id: req.params.id },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Add application to product
router.post('/:id/applications', requireAuth, async (req, res) => {
  try {
    const {
      applicationId,
      componentTypeId,
      customComponentLabel,
      displayOrder,
      markAsIngress,
      ingressChannel,
      connectFromApplicationId,
      flowName,
      dataClassification,
      protocol,
      direction,
      requiresApiKey,
      notes,
    } = req.body;

    if (!applicationId) {
      return res.status(400).json({ error: 'applicationId is required' });
    }

    const trimmedCustomLabel = customComponentLabel?.trim() || null;
    if (!componentTypeId && !trimmedCustomLabel) {
      return res.status(400).json({
        error: 'Either componentTypeId or customComponentLabel is required',
      });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify products in your company',
      });
    }

    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, companyId: true, name: true, status: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.companyId !== product.companyId) {
      return res.status(400).json({ error: 'Application must belong to the same company as the product' });
    }

    if (componentTypeId) {
      const type = await prisma.productComponentType.findUnique({
        where: { id: componentTypeId },
      });
      if (!type) {
        return res.status(404).json({ error: 'Component type not found' });
      }
      if (type.companyId !== product.companyId) {
        return res.status(400).json({ error: 'Component type must belong to the same company as the product' });
      }
    }

    const existingMappings = await prisma.productApplication.findMany({
      where: { productId: product.id },
      select: { applicationId: true },
    });

    if (connectFromApplicationId) {
      if (connectFromApplicationId === applicationId) {
        return res.status(400).json({ error: 'connectFromApplicationId must be different from applicationId' });
      }
      const isMapped = existingMappings.some((m) => m.applicationId === connectFromApplicationId);
      if (!isMapped) {
        return res.status(400).json({ error: 'connectFromApplicationId must already be mapped to this product' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const mapping = await tx.productApplication.create({
        data: {
          productId: product.id,
          applicationId,
          componentTypeId: componentTypeId || null,
          customComponentLabel: trimmedCustomLabel,
          displayOrder:
            displayOrder !== undefined && displayOrder !== null && displayOrder !== ''
              ? parseInt(displayOrder, 10)
              : 0,
        },
        include: {
          application: true,
          componentType: true,
        },
      });

      let createdFlow = null;
      let createdIngress = null;
      if (connectFromApplicationId) {
        createdFlow = await tx.productDataFlow.create({
          data: {
            productId: product.id,
            sourceApplicationId: connectFromApplicationId,
            targetApplicationId: applicationId,
            flowName: flowName?.trim() || null,
            dataClassification: dataClassification?.trim() || null,
            protocol: protocol?.trim() || null,
            direction: direction?.trim() || 'unidirectional',
            requiresApiKey: Boolean(requiresApiKey),
            notes: notes?.trim() || null,
          },
          include: {
            sourceApplication: { select: { id: true, name: true } },
            targetApplication: { select: { id: true, name: true } },
          },
        });
      }

      if (markAsIngress) {
        createdIngress = await tx.productIngressPoint.upsert({
          where: {
            productId_applicationId_channel: {
              productId: product.id,
              applicationId,
              channel: ingressChannel?.trim() || 'default',
            },
          },
          update: {
            requiresApiKey: Boolean(requiresApiKey),
          },
          create: {
            productId: product.id,
            applicationId,
            channel: ingressChannel?.trim() || 'default',
              requiresApiKey: Boolean(requiresApiKey),
          },
          include: {
            application: {
              select: { id: true, name: true, facing: true },
            },
          },
        });
      }

      return { mapping, createdFlow, createdIngress };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error adding application to product:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Application is already mapped to this product' });
    }
    return res.status(500).json({ error: 'Failed to add application to product' });
  }
});

// Update mapping for application in product
router.put('/:id/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const { id, applicationId } = req.params;
    const { componentTypeId, customComponentLabel, displayOrder } = req.body;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify products in your company',
      });
    }

    const existing = await prisma.productApplication.findFirst({
      where: { productId: id, applicationId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Product application mapping not found' });
    }

    const trimmedCustomLabel = customComponentLabel?.trim() || null;
    const finalComponentTypeId =
      componentTypeId !== undefined ? (componentTypeId || null) : existing.componentTypeId;
    const finalCustomLabel =
      customComponentLabel !== undefined ? trimmedCustomLabel : existing.customComponentLabel;

    if (!finalComponentTypeId && !finalCustomLabel) {
      return res.status(400).json({
        error: 'Either componentTypeId or customComponentLabel is required',
      });
    }

    if (finalComponentTypeId) {
      const type = await prisma.productComponentType.findUnique({
        where: { id: finalComponentTypeId },
      });
      if (!type) return res.status(404).json({ error: 'Component type not found' });
      if (type.companyId !== product.companyId) {
        return res.status(400).json({ error: 'Component type must belong to the same company as the product' });
      }
    }

    const mapping = await prisma.productApplication.update({
      where: {
        productId_applicationId: {
          productId: id,
          applicationId,
        },
      },
      data: {
        ...(componentTypeId !== undefined && { componentTypeId: componentTypeId || null }),
        ...(customComponentLabel !== undefined && { customComponentLabel: trimmedCustomLabel }),
        ...(displayOrder !== undefined && {
          displayOrder:
            displayOrder !== null && displayOrder !== ''
              ? parseInt(displayOrder, 10)
              : 0,
        }),
      },
      include: {
        application: true,
        componentType: true,
      },
    });

    return res.json(mapping);
  } catch (error) {
    console.error('Error updating product application mapping:', error);
    return res.status(500).json({ error: 'Failed to update product application mapping' });
  }
});

// Remove application from product
router.delete('/:id/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const { id, applicationId } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify products in your company',
      });
    }

    await prisma.$transaction([
      prisma.productIngressPoint.deleteMany({
        where: { productId: id, applicationId },
      }),
      prisma.productApplication.delete({
        where: {
          productId_applicationId: {
            productId: id,
            applicationId,
          },
        },
      }),
    ]);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error removing application from product:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Product application mapping not found' });
    }
    return res.status(500).json({ error: 'Failed to remove application from product' });
  }
});

// List ingress points for a product
router.get('/:id/ingress-points', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view ingress points in your company',
      });
    }

    const ingressPoints = await prisma.productIngressPoint.findMany({
      where: { productId: id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        application: {
          select: { id: true, name: true, facing: true },
        },
      },
    });

    return res.json(ingressPoints);
  } catch (error) {
    console.error('Error fetching product ingress points:', error);
    return res.status(500).json({ error: 'Failed to fetch product ingress points' });
  }
});

// Add ingress point for a product (application must be mapped)
router.post('/:id/ingress-points', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { applicationId, channel, requiresApiKey } = req.body;
    if (!applicationId) return res.status(400).json({ error: 'applicationId is required' });

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify ingress points in your company',
      });
    }

    const mapping = await prisma.productApplication.findFirst({
      where: { productId: id, applicationId },
      select: { id: true },
    });
    if (!mapping) {
      return res.status(400).json({ error: 'Application must be mapped to this product first' });
    }

    const ingressPoint = await prisma.productIngressPoint.upsert({
      where: {
        productId_applicationId_channel: {
          productId: id,
          applicationId,
          channel: channel?.trim() || 'default',
        },
      },
      update: {
        requiresApiKey: Boolean(requiresApiKey),
      },
      create: {
        productId: id,
        applicationId,
        channel: channel?.trim() || 'default',
        requiresApiKey: Boolean(requiresApiKey),
      },
      include: {
        application: {
          select: { id: true, name: true, facing: true },
        },
      },
    });

    return res.status(201).json(ingressPoint);
  } catch (error) {
    console.error('Error creating product ingress point:', error);
    return res.status(500).json({ error: 'Failed to create product ingress point' });
  }
});

// Remove ingress point for a product
router.delete('/:id/ingress-points/:ingressId', requireAuth, async (req, res) => {
  try {
    const { id, ingressId } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify ingress points in your company',
      });
    }

    const existing = await prisma.productIngressPoint.findUnique({ where: { id: ingressId } });
    if (!existing || existing.productId !== id) {
      return res.status(404).json({ error: 'Ingress point not found' });
    }

    await prisma.productIngressPoint.delete({ where: { id: ingressId } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product ingress point:', error);
    return res.status(500).json({ error: 'Failed to delete product ingress point' });
  }
});

// List data flows for a product
router.get('/:id/data-flows', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view product data flows in your company',
      });
    }

    const flows = await prisma.productDataFlow.findMany({
      where: { productId: id },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        sourceApplication: { select: { id: true, name: true } },
        targetApplication: { select: { id: true, name: true } },
      },
    });

    return res.json(flows);
  } catch (error) {
    console.error('Error fetching product data flows:', error);
    return res.status(500).json({ error: 'Failed to fetch product data flows' });
  }
});

// Create data flow for a product
router.post('/:id/data-flows', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify product data flows in your company',
      });
    }

    const payload = normalizeFlowInput(req.body);
    const validation = await validateProductFlowApplications(
      id,
      product.companyId,
      payload.sourceApplicationId,
      payload.targetApplicationId
    );
    if (validation.error) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const flow = await prisma.productDataFlow.create({
      data: {
        productId: id,
        ...payload,
      },
      include: {
        sourceApplication: { select: { id: true, name: true } },
        targetApplication: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(flow);
  } catch (error) {
    console.error('Error creating product data flow:', error);
    return res.status(500).json({ error: 'Failed to create product data flow' });
  }
});

// Update data flow for a product
router.put('/:id/data-flows/:flowId', requireAuth, async (req, res) => {
  try {
    const { id, flowId } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify product data flows in your company',
      });
    }

    const existing = await prisma.productDataFlow.findUnique({ where: { id: flowId } });
    if (!existing || existing.productId !== id) {
      return res.status(404).json({ error: 'Data flow not found' });
    }

    const payload = normalizeFlowInput(req.body);
    const finalSourceId = req.body.sourceApplicationId !== undefined ? payload.sourceApplicationId : existing.sourceApplicationId;
    const finalTargetId = req.body.targetApplicationId !== undefined ? payload.targetApplicationId : existing.targetApplicationId;
    const validation = await validateProductFlowApplications(
      id,
      product.companyId,
      finalSourceId,
      finalTargetId
    );
    if (validation.error) {
      return res.status(validation.status).json({ error: validation.error });
    }

    const flow = await prisma.productDataFlow.update({
      where: { id: flowId },
      data: {
        ...(req.body.sourceApplicationId !== undefined && { sourceApplicationId: payload.sourceApplicationId }),
        ...(req.body.targetApplicationId !== undefined && { targetApplicationId: payload.targetApplicationId }),
        ...(req.body.flowName !== undefined && { flowName: payload.flowName }),
        ...(req.body.dataClassification !== undefined && { dataClassification: payload.dataClassification }),
        ...(req.body.protocol !== undefined && { protocol: payload.protocol }),
        ...(req.body.direction !== undefined && { direction: payload.direction }),
        ...(req.body.notes !== undefined && { notes: payload.notes }),
      },
      include: {
        sourceApplication: { select: { id: true, name: true } },
        targetApplication: { select: { id: true, name: true } },
      },
    });

    return res.json(flow);
  } catch (error) {
    console.error('Error updating product data flow:', error);
    return res.status(500).json({ error: 'Failed to update product data flow' });
  }
});

// Delete data flow for a product
router.delete('/:id/data-flows/:flowId', requireAuth, async (req, res) => {
  try {
    const { id, flowId } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!req.session.isAdmin && req.session.companyId !== product.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify product data flows in your company',
      });
    }

    const existing = await prisma.productDataFlow.findUnique({ where: { id: flowId } });
    if (!existing || existing.productId !== id) {
      return res.status(404).json({ error: 'Data flow not found' });
    }

    await prisma.productDataFlow.delete({ where: { id: flowId } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting product data flow:', error);
    return res.status(500).json({ error: 'Failed to delete product data flow' });
  }
});

export default router;
