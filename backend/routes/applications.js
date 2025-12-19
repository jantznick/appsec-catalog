import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { calculateApplicationScore } from '../services/scoring.js';

const router = express.Router();

// Public: Create application with executive info only (no auth required)
router.post('/onboard/executive', async (req, res) => {
  try {
    const {
      companySlug,
      name,
      description,
      owner,
      repoUrl,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
    } = req.body;

    // Validate required fields
    if (!companySlug || !name || name.trim() === '') {
      return res.status(400).json({ 
        error: 'Company slug and application name are required' 
      });
    }

    // Find company by slug
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Create application with executive info only (status: pending_technical)
    const application = await prisma.application.create({
      data: {
        name: name.trim(),
        companyId: company.id,
        description: description?.trim() || null,
        owner: owner?.trim() || null,
        repoUrl: repoUrl?.trim() || null,
        language: language?.trim() || null,
        framework: framework?.trim() || null,
        serverEnvironment: serverEnvironment?.trim() || null,
        facing: facing?.trim() || null,
        deploymentType: deploymentType?.trim() || null,
        authProfiles: authProfiles?.trim() || null,
        dataTypes: dataTypes?.trim() || null,
        status: 'pending_technical', // Needs technical form completion
      },
    });

    res.status(201).json({
      application,
      message: 'Application submitted successfully. Please complete the technical form.',
    });
  } catch (error) {
    console.error('Error creating application via executive form:', error);
    res.status(500).json({ 
      error: 'Failed to submit application',
      message: 'An error occurred while submitting your application'
    });
  }
});

// APP-3: Get application list
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
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Public: Get application by ID (for technical form)
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Public: Update application with technical details (for technical form)
router.put('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      interfaces,
      sastTool,
      sastIntegrationLevel,
      dastTool,
      dastIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
    } = req.body;

    // Find application
    const existing = await prisma.application.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Process interfaces
    let interfacesJson = null;
    if (interfaces && Array.isArray(interfaces) && interfaces.length > 0) {
      const interfaceAppIds = [];
      
      for (const interfaceName of interfaces) {
        if (!interfaceName || !interfaceName.trim()) continue;
        
        let interfaceApp = await prisma.application.findFirst({
          where: {
            name: interfaceName.trim(),
            companyId: existing.companyId,
          },
        });

        if (!interfaceApp) {
          interfaceApp = await prisma.application.create({
            data: {
              name: interfaceName.trim(),
              companyId: existing.companyId,
              description: `Auto-created interface application`,
              status: 'onboarded',
            },
          });
        }

        interfaceAppIds.push(interfaceApp.id);
      }

      interfacesJson = JSON.stringify(interfaceAppIds);
    }

    // Update application with technical details
    const application = await prisma.application.update({
      where: { id },
      data: {
        interfaces: interfacesJson,
        sastTool: sastTool?.trim() || null,
        sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null,
        dastTool: dastTool?.trim() || null,
        dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null,
        appFirewallTool: appFirewallTool?.trim() || null,
        appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null,
        apiSecurityTool: apiSecurityTool?.trim() || null,
        apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null,
        apiSecurityNA: apiSecurityNA === true || apiSecurityNA === 'true',
        status: 'onboarded', // Mark as fully onboarded
      },
    });

    res.json({
      application,
      message: 'Application technical details updated successfully',
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// APP-4: Get application detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        contacts: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access applications in your company',
      });
    }

    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

// Get application score
router.get('/:id/score', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access applications in your company',
      });
    }

    // Calculate score
    const scores = calculateApplicationScore(application);

    // Calculate breakdown for knowledge sharing
    const knowledgeFields = [
      'description',
      'owner',
      'repoUrl',
      'language',
      'framework',
      'serverEnvironment',
      'authProfiles',
      'dataTypes',
    ];
    const fieldsFilled = knowledgeFields.filter(field => application[field]).length;

    res.json({
      ...scores,
      breakdown: {
        knowledgeSharing: {
          fieldsFilled,
          totalFields: knowledgeFields.length,
          completenessScore: Math.round((fieldsFilled / knowledgeFields.length) * 40),
          reviewScore: scores.knowledgeScore - Math.round((fieldsFilled / knowledgeFields.length) * 40),
          lastReviewed: application.metadataLastReviewed,
        },
      },
    });
  } catch (error) {
    console.error('Error calculating application score:', error);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

// Mark application metadata as reviewed (Admin only)
router.post('/:id/review', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Update metadataLastReviewed
    const updated = await prisma.application.update({
      where: { id },
      data: {
        metadataLastReviewed: new Date(),
      },
    });

    // Recalculate score
    const scores = calculateApplicationScore(updated);

    res.json({
      application: updated,
      scores,
      message: 'Application metadata marked as reviewed',
    });
  } catch (error) {
    console.error('Error marking application as reviewed:', error);
    res.status(500).json({ error: 'Failed to mark application as reviewed' });
  }
});

// APP-1: Create application (single form submission)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      name,
      description,
      owner,
      repoUrl,
      companyId,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
      interfaces, // Array of application names
      sastTool,
      sastIntegrationLevel,
      dastTool,
      dastIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
    } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Application name is required' });
    }

    // Determine company ID
    let finalCompanyId = companyId;
    if (!finalCompanyId) {
      if (req.session.companyId) {
        finalCompanyId = req.session.companyId;
      } else {
        return res.status(400).json({ error: 'Company is required' });
      }
    }

    // Check if user has access to this company
    if (!req.session.isAdmin && req.session.companyId !== finalCompanyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only create applications for your company',
      });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: finalCompanyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Process interfaces - create applications if they don't exist
    let interfacesJson = null;
    if (interfaces && Array.isArray(interfaces) && interfaces.length > 0) {
      const interfaceAppIds = [];
      
      for (const interfaceName of interfaces) {
        if (!interfaceName || !interfaceName.trim()) continue;
        
        // Check if application exists
        let interfaceApp = await prisma.application.findFirst({
          where: {
            name: interfaceName.trim(),
            companyId: finalCompanyId,
          },
        });

        // Create if doesn't exist
        if (!interfaceApp) {
          interfaceApp = await prisma.application.create({
            data: {
              name: interfaceName.trim(),
              companyId: finalCompanyId,
              description: `Auto-created interface application`,
              status: 'onboarded',
            },
          });
        }

        interfaceAppIds.push(interfaceApp.id);
      }

      interfacesJson = JSON.stringify(interfaceAppIds);
    }

    const application = await prisma.application.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        owner: owner?.trim() || null,
        repoUrl: repoUrl?.trim() || null,
        companyId: finalCompanyId,
        language: language?.trim() || null,
        framework: framework?.trim() || null,
        serverEnvironment: serverEnvironment?.trim() || null,
        facing: facing?.trim() || null,
        deploymentType: deploymentType?.trim() || null,
        authProfiles: authProfiles?.trim() || null,
        dataTypes: dataTypes?.trim() || null,
        interfaces: interfacesJson,
        sastTool: sastTool?.trim() || null,
        sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null,
        dastTool: dastTool?.trim() || null,
        dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null,
        appFirewallTool: appFirewallTool?.trim() || null,
        appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null,
        apiSecurityTool: apiSecurityTool?.trim() || null,
        apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null,
        apiSecurityNA: apiSecurityNA || false,
        status: 'onboarded',
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(application);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

// APP-5: Update application
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      owner,
      repoUrl,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
      interfaces,
      sastTool,
      sastIntegrationLevel,
      dastTool,
      dastIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
      status,
    } = req.body;

    // Check if application exists
    const existing = await prisma.application.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access
    if (!req.session.isAdmin && req.session.companyId !== existing.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update applications in your company',
      });
    }

    // Process interfaces if provided
    let interfacesJson = existing.interfaces;
    if (interfaces !== undefined) {
      if (interfaces && Array.isArray(interfaces) && interfaces.length > 0) {
        const interfaceAppIds = [];
        
        for (const interfaceName of interfaces) {
          if (!interfaceName || !interfaceName.trim()) continue;
          
          let interfaceApp = await prisma.application.findFirst({
            where: {
              name: interfaceName.trim(),
              companyId: existing.companyId,
            },
          });

          if (!interfaceApp) {
            interfaceApp = await prisma.application.create({
              data: {
                name: interfaceName.trim(),
                companyId: existing.companyId,
                description: `Auto-created interface application`,
                status: 'onboarded',
              },
            });
          }

          interfaceAppIds.push(interfaceApp.id);
        }

        interfacesJson = JSON.stringify(interfaceAppIds);
      } else {
        interfacesJson = null;
      }
    }

    const application = await prisma.application.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(owner !== undefined && { owner: owner?.trim() || null }),
        ...(repoUrl !== undefined && { repoUrl: repoUrl?.trim() || null }),
        ...(language !== undefined && { language: language?.trim() || null }),
        ...(framework !== undefined && { framework: framework?.trim() || null }),
        ...(serverEnvironment !== undefined && { serverEnvironment: serverEnvironment?.trim() || null }),
        ...(facing !== undefined && { facing: facing?.trim() || null }),
        ...(deploymentType !== undefined && { deploymentType: deploymentType?.trim() || null }),
        ...(authProfiles !== undefined && { authProfiles: authProfiles?.trim() || null }),
        ...(dataTypes !== undefined && { dataTypes: dataTypes?.trim() || null }),
        ...(interfaces !== undefined && { interfaces: interfacesJson }),
        ...(sastTool !== undefined && { sastTool: sastTool?.trim() || null }),
        ...(sastIntegrationLevel !== undefined && { sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null }),
        ...(dastTool !== undefined && { dastTool: dastTool?.trim() || null }),
        ...(dastIntegrationLevel !== undefined && { dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null }),
        ...(appFirewallTool !== undefined && { appFirewallTool: appFirewallTool?.trim() || null }),
        ...(appFirewallIntegrationLevel !== undefined && { appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null }),
        ...(apiSecurityTool !== undefined && { apiSecurityTool: apiSecurityTool?.trim() || null }),
        ...(apiSecurityIntegrationLevel !== undefined && { apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null }),
        ...(apiSecurityNA !== undefined && { apiSecurityNA: apiSecurityNA }),
        ...(status && { status }),
      },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(application);
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Search applications for interface autocomplete
router.get('/search/name', requireAuth, async (req, res) => {
  try {
    const { q, companyId } = req.query;

    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    let whereClause = {
      name: {
        contains: q.trim(),
        mode: 'insensitive',
      },
    };

    // Filter by company if provided, otherwise user's company
    if (companyId) {
      whereClause.companyId = companyId;
    } else if (!req.session.isAdmin && req.session.companyId) {
      whereClause.companyId = req.session.companyId;
    }

    const applications = await prisma.application.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        company: {
          select: {
            name: true,
          },
        },
      },
      take: 10,
      orderBy: {
        name: 'asc',
      },
    });

    res.json(applications);
  } catch (error) {
    console.error('Error searching applications:', error);
    res.status(500).json({ error: 'Failed to search applications' });
  }
});

export default router;

