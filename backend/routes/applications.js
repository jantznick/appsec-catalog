import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { calculateApplicationScore } from '../services/scoring.js';
import { isValidDomain, normalizeDomain } from '../utils/domainValidation.js';

const router = express.Router();

// Public: Create application(s) with executive info only (no auth required)
// Accepts either a single application object or an array of applications
router.post('/onboard/executive', async (req, res) => {
  try {
    const { companySlug, applications } = req.body;

    // Validate required fields
    if (!companySlug) {
      return res.status(400).json({ 
        error: 'Company slug is required' 
      });
    }

    // Support both single application (backward compatibility) and array of applications
    const appsToCreate = Array.isArray(applications) ? applications : [req.body];
    
    if (appsToCreate.length === 0) {
      return res.status(400).json({ 
        error: 'At least one application is required' 
      });
    }

    // Validate all applications have required fields
    for (const app of appsToCreate) {
      if (!app.name || app.name.trim() === '') {
        return res.status(400).json({ 
          error: 'Application name is required for all applications' 
        });
      }
    }

    // Find company by slug
    const company = await prisma.company.findFirst({
      where: { slug: companySlug },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Create all applications
    const createdApplications = await Promise.all(
      appsToCreate.map(app => {
        // Process criticalAspects - convert array to comma-separated string if needed
        let criticalAspects = null;
        if (app.criticalAspects) {
          if (Array.isArray(app.criticalAspects)) {
            criticalAspects = app.criticalAspects.filter(a => a && a.trim()).join(', ');
          } else {
            criticalAspects = app.criticalAspects.trim() || null;
          }
        }

        return prisma.application.create({
          data: {
            name: app.name.trim(),
            companyId: company.id,
            description: app.description?.trim() || null,
            facing: app.facing?.trim() || null,
            serverEnvironment: app.serverEnvironment?.trim() || null,
            businessCriticality: app.businessCriticality ? parseInt(app.businessCriticality) : null,
            criticalAspects: criticalAspects,
            devTeamContact: app.devTeamContact?.trim() || null,
            status: 'pending_technical', // Needs technical form completion
          },
        });
      })
    );

    // Return single application for backward compatibility, or array for multiple
    if (appsToCreate.length === 1) {
      res.status(201).json({
        application: createdApplications[0],
        message: 'Application submitted successfully. Please complete the technical form.',
      });
    } else {
      res.status(201).json({
        applications: createdApplications,
        message: `${createdApplications.length} applications submitted successfully. Please complete the technical forms.`,
      });
    }
  } catch (error) {
    console.error('Error creating application(s) via executive form:', error);
    res.status(500).json({ 
      error: 'Failed to submit application(s)',
      message: 'An error occurred while submitting your application(s)'
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
      repoUrl,
      deploymentFrequency,
      deploymentMethod,
      requiresSpecialAccess,
      authInfo,
      handlesUserData,
      userDataTypes,
      userDataStorage,
      hasInterfaces,
      interfaces,
      pciData,
      piiData,
      phiData,
      hasSecurityTesting,
      securityTestingDescription,
      additionalNotes,
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

    // Process deploymentType - concatenate frequency and method
    let deploymentType = null;
    const deploymentParts = [];
    if (deploymentFrequency && deploymentFrequency.trim()) {
      deploymentParts.push(deploymentFrequency.trim());
    }
    if (deploymentMethod && deploymentMethod.trim()) {
      deploymentParts.push(deploymentMethod.trim());
    }
    if (deploymentParts.length > 0) {
      deploymentType = deploymentParts.join(' - ');
    }

    // Process authProfiles - concatenate requiresSpecialAccess and authInfo
    let authProfiles = null;
    const authParts = [];
    if (requiresSpecialAccess === 'Yes' || requiresSpecialAccess === true) {
      authParts.push('Requires special access permissions');
      if (authInfo && authInfo.trim()) {
        authParts.push(authInfo.trim());
      }
    }
    if (authParts.length > 0) {
      authProfiles = authParts.join(': ');
    }

    // Process dataTypes - concatenate all data-related fields
    let dataTypes = null;
    const dataParts = [];
    if (handlesUserData === 'Yes' || handlesUserData === true) {
      if (userDataTypes && userDataTypes.trim()) {
        dataParts.push(`User supplied data: ${userDataTypes.trim()}`);
      }
      if (userDataStorage && userDataStorage.trim()) {
        dataParts.push(`Storage: ${userDataStorage.trim()}`);
      }
    }
    if (pciData === true || pciData === 'true') {
      dataParts.push('PCI');
    }
    if (piiData === true || piiData === 'true') {
      dataParts.push('PII');
    }
    if (phiData === true || phiData === 'true') {
      dataParts.push('PHI');
    }
    if (dataParts.length > 0) {
      dataTypes = dataParts.join(', ');
    }

    // Process interfaces
    let interfacesJson = null;
    if (hasInterfaces === 'Yes' || hasInterfaces === true) {
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
    }

    // Process description - concatenate additionalNotes to existing description
    let description = existing.description || '';
    if (additionalNotes && additionalNotes.trim()) {
      if (description) {
        description = description + '\n\n\n' + additionalNotes.trim();
      } else {
        description = additionalNotes.trim();
      }
    }

    // Update application with technical details
    const updateData = {
      repoUrl: repoUrl?.trim() || null,
      deploymentType: deploymentType || existing.deploymentType,
      authProfiles: authProfiles || existing.authProfiles,
      dataTypes: dataTypes || existing.dataTypes,
      interfaces: interfacesJson || existing.interfaces,
      description: description || null,
      securityTestingDescription: securityTestingDescription?.trim() || null,
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
    };

    const application = await prisma.application.update({
      where: { id },
      data: updateData,
    });

    // Recalculate and save score after update
    try {
      const scores = calculateApplicationScore(application);
      await prisma.score.create({
        data: {
          applicationId: application.id,
          knowledgeScore: scores.knowledgeScore,
          toolScore: scores.toolScore,
          totalScore: scores.totalScore,
        },
      });
    } catch (error) {
      console.error('Error saving score after update:', error);
    }

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
        applicationDomains: {
          include: {
            domain: true,
          },
        },
      },
    });

    // Transform domains to a simpler format
    if (application) {
      application.domains = application.applicationDomains.map(ad => ad.domain);
      delete application.applicationDomains;
    }

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

    // Save score to database
    try {
      await prisma.score.create({
        data: {
          applicationId: application.id,
          knowledgeScore: scores.knowledgeScore,
          toolScore: scores.toolScore,
          totalScore: scores.totalScore,
        },
      });
    } catch (error) {
      // Log but don't fail the request if score saving fails
      console.error('Error saving score to database:', error);
    }

    // Calculate breakdown for knowledge sharing
    const knowledgeFields = [
      'description',
      'devTeamContact',
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

    // Save updated score to database
    try {
      await prisma.score.create({
        data: {
          applicationId: updated.id,
          knowledgeScore: scores.knowledgeScore,
          toolScore: scores.toolScore,
          totalScore: scores.totalScore,
        },
      });
    } catch (error) {
      console.error('Error saving score to database:', error);
    }

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
      businessCriticality,
      criticalAspects,
      devTeamContact,
      securityTestingDescription,
      additionalNotes,
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

    // Process criticalAspects - convert array to comma-separated string if needed
    let criticalAspectsStr = null;
    if (criticalAspects) {
      if (Array.isArray(criticalAspects)) {
        criticalAspectsStr = criticalAspects.filter(a => a && a.trim()).join(', ');
      } else {
        criticalAspectsStr = criticalAspects.trim() || null;
      }
    }

    const application = await prisma.application.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
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
        businessCriticality: businessCriticality ? parseInt(businessCriticality) : null,
        criticalAspects: criticalAspectsStr,
        devTeamContact: devTeamContact?.trim() || null,
        securityTestingDescription: securityTestingDescription?.trim() || null,
        additionalNotes: additionalNotes?.trim() || null,
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
      repoUrl,
      language,
      framework,
      serverEnvironment,
      facing,
      deploymentType,
      authProfiles,
      dataTypes,
      interfaces,
      businessCriticality,
      criticalAspects,
      devTeamContact,
      securityTestingDescription,
      additionalNotes,
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

    // Process criticalAspects - convert array to comma-separated string if needed
    let criticalAspectsStr = undefined;
    if (criticalAspects !== undefined) {
      if (Array.isArray(criticalAspects)) {
        criticalAspectsStr = criticalAspects.filter(a => a && a.trim()).join(', ');
      } else if (criticalAspects) {
        criticalAspectsStr = criticalAspects.trim() || null;
      } else {
        criticalAspectsStr = null;
      }
    }

    const application = await prisma.application.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(repoUrl !== undefined && { repoUrl: repoUrl?.trim() || null }),
        ...(language !== undefined && { language: language?.trim() || null }),
        ...(framework !== undefined && { framework: framework?.trim() || null }),
        ...(serverEnvironment !== undefined && { serverEnvironment: serverEnvironment?.trim() || null }),
        ...(facing !== undefined && { facing: facing?.trim() || null }),
        ...(deploymentType !== undefined && { deploymentType: deploymentType?.trim() || null }),
        ...(authProfiles !== undefined && { authProfiles: authProfiles?.trim() || null }),
        ...(dataTypes !== undefined && { dataTypes: dataTypes?.trim() || null }),
        ...(interfaces !== undefined && { interfaces: interfacesJson }),
        ...(businessCriticality !== undefined && { businessCriticality: businessCriticality ? parseInt(businessCriticality) : null }),
        ...(criticalAspects !== undefined && { criticalAspects: criticalAspectsStr }),
        ...(devTeamContact !== undefined && { devTeamContact: devTeamContact?.trim() || null }),
        ...(securityTestingDescription !== undefined && { securityTestingDescription: securityTestingDescription?.trim() || null }),
        ...(additionalNotes !== undefined && { additionalNotes: additionalNotes?.trim() || null }),
        ...(sastTool !== undefined && { sastTool: sastTool?.trim() || null }),
        ...(sastIntegrationLevel !== undefined && { sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null }),
        ...(dastTool !== undefined && { dastTool: dastTool?.trim() || null }),
        ...(dastIntegrationLevel !== undefined && { dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null }),
        ...(appFirewallTool !== undefined && { appFirewallTool: appFirewallTool?.trim() || null }),
        ...(appFirewallIntegrationLevel !== undefined && { appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null }),
        ...(apiSecurityTool !== undefined && { apiSecurityTool: apiSecurityTool?.trim() || null }),
        ...(apiSecurityIntegrationLevel !== undefined && { apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null }),
        ...(apiSecurityNA !== undefined && { apiSecurityNA: apiSecurityNA }),
        ...(status !== undefined && { status }),
      },
      include: {
        company: true,
      },
    });

    // Recalculate and save score after update
    try {
      const scores = calculateApplicationScore(application);
      await prisma.score.create({
        data: {
          applicationId: application.id,
          knowledgeScore: scores.knowledgeScore,
          toolScore: scores.toolScore,
          totalScore: scores.totalScore,
        },
      });
    } catch (error) {
      console.error('Error saving score after update:', error);
    }

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

// Add domain to application
router.post('/:id/domains', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { domainName } = req.body;

    if (!domainName || typeof domainName !== 'string') {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    // Validate domain format
    if (!isValidDomain(domainName)) {
      return res.status(400).json({ 
        error: 'Invalid domain format. Domain must be in format example.com or subdomain.example.com (no http:// or https://)' 
      });
    }

    // Get application and check access
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify applications in your company',
      });
    }

    // Normalize domain name
    const normalizedDomain = normalizeDomain(domainName);

    // Find or create domain within the company
    let domain = await prisma.domain.findUnique({
      where: {
        name_companyId: {
          name: normalizedDomain,
          companyId: application.companyId,
        },
      },
    });

    if (!domain) {
      // Create new domain
      domain = await prisma.domain.create({
        data: {
          name: normalizedDomain,
          companyId: application.companyId,
        },
      });
    }

    // Check if association already exists
    const existingAssociation = await prisma.applicationDomain.findUnique({
      where: {
        applicationId_domainId: {
          applicationId: id,
          domainId: domain.id,
        },
      },
    });

    if (existingAssociation) {
      return res.status(400).json({ error: 'Domain is already associated with this application' });
    }

    // Create association
    await prisma.applicationDomain.create({
      data: {
        applicationId: id,
        domainId: domain.id,
      },
    });

    // Return updated application with domains
    const updatedApplication = await prisma.application.findUnique({
      where: { id },
      include: {
        applicationDomains: {
          include: {
            domain: true,
          },
        },
      },
    });

    const domains = updatedApplication.applicationDomains.map(ad => ad.domain);

    res.json({ domain, domains });
  } catch (error) {
    console.error('Error adding domain to application:', error);
    res.status(500).json({ error: 'Failed to add domain to application' });
  }
});

// Remove domain from application
router.delete('/:id/domains/:domainId', requireAuth, async (req, res) => {
  try {
    const { id, domainId } = req.params;

    // Get application and check access
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access (admin or member of same company)
    if (!req.session.isAdmin && req.session.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify applications in your company',
      });
    }

    // Verify domain exists and belongs to the same company
    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    if (domain.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'Domain does not belong to the same company as the application',
      });
    }

    // Delete the association
    await prisma.applicationDomain.delete({
      where: {
        applicationId_domainId: {
          applicationId: id,
          domainId: domainId,
        },
      },
    });

    // Return updated domains list
    const updatedApplication = await prisma.application.findUnique({
      where: { id },
      include: {
        applicationDomains: {
          include: {
            domain: true,
          },
        },
      },
    });

    const domains = updatedApplication.applicationDomains.map(ad => ad.domain);

    res.json({ domains, message: 'Domain removed from application' });
  } catch (error) {
    console.error('Error removing domain from application:', error);
    res.status(500).json({ error: 'Failed to remove domain from application' });
  }
});

export default router;

