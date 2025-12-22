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

// Public: Get applications by company slug (for technical onboarding form interface selection)
// NOTE: Must come BEFORE /public/:id because Express matches routes in order
// More specific routes must come before more general ones
router.get('/public/company/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Find company by slug
    const company = await prisma.company.findFirst({
      where: { slug },
      select: { id: true, name: true },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get all applications for this company (only name and id for interface selection)
    const applications = await prisma.application.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    res.json(applications);
  } catch (error) {
    console.error('Error fetching company applications:', error);
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
    let interfaceAppIds = [];
    if (hasInterfaces === 'Yes' || hasInterfaces === true) {
      if (interfaces && Array.isArray(interfaces) && interfaces.length > 0) {
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

    // Update reciprocal interfaces if interfaces were changed
    if (hasInterfaces === 'Yes' || hasInterfaces === true) {
      if (interfaceAppIds.length > 0) {
        try {
          const currentAppId = application.id;
          
          // For each interface application, add this application to their interfaces
          for (const interfaceAppId of interfaceAppIds) {
            const interfaceApp = await prisma.application.findUnique({
              where: { id: interfaceAppId },
            });
            
            if (interfaceApp && interfaceApp.interfaces) {
              try {
                const existingInterfaces = JSON.parse(interfaceApp.interfaces);
                if (!Array.isArray(existingInterfaces)) {
                  await prisma.application.update({
                    where: { id: interfaceAppId },
                    data: {
                      interfaces: JSON.stringify([currentAppId]),
                    },
                  });
                } else if (!existingInterfaces.includes(currentAppId)) {
                  existingInterfaces.push(currentAppId);
                  await prisma.application.update({
                    where: { id: interfaceAppId },
                    data: {
                      interfaces: JSON.stringify(existingInterfaces),
                    },
                  });
                }
              } catch (e) {
                await prisma.application.update({
                  where: { id: interfaceAppId },
                  data: {
                    interfaces: JSON.stringify([currentAppId]),
                  },
                });
              }
            } else if (interfaceApp) {
              await prisma.application.update({
                where: { id: interfaceAppId },
                data: {
                  interfaces: JSON.stringify([currentAppId]),
                },
              });
            }
          }
          
          // Remove this app from interfaces that are no longer in the list
          if (existing.interfaces) {
            try {
              const oldInterfaceIds = JSON.parse(existing.interfaces);
              if (Array.isArray(oldInterfaceIds)) {
                const removedIds = oldInterfaceIds.filter(id => !interfaceAppIds.includes(id));
                for (const removedId of removedIds) {
                  const removedApp = await prisma.application.findUnique({
                    where: { id: removedId },
                  });
                  if (removedApp && removedApp.interfaces) {
                    try {
                      const removedAppInterfaces = JSON.parse(removedApp.interfaces);
                      if (Array.isArray(removedAppInterfaces)) {
                        const updated = removedAppInterfaces.filter(id => id !== currentAppId);
                        await prisma.application.update({
                          where: { id: removedId },
                          data: {
                            interfaces: updated.length > 0 ? JSON.stringify(updated) : null,
                          },
                        });
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        } catch (error) {
          console.error('Error updating reciprocal interfaces:', error);
          // Don't fail the request if reciprocal update fails
        }
      } else if (existing.interfaces) {
        // If interfaces were cleared, remove this app from all interface apps
        try {
          const oldInterfaceIds = JSON.parse(existing.interfaces);
          if (Array.isArray(oldInterfaceIds)) {
            for (const oldInterfaceId of oldInterfaceIds) {
              const oldInterfaceApp = await prisma.application.findUnique({
                where: { id: oldInterfaceId },
              });
              if (oldInterfaceApp && oldInterfaceApp.interfaces) {
                try {
                  const oldInterfaces = JSON.parse(oldInterfaceApp.interfaces);
                  if (Array.isArray(oldInterfaces)) {
                    const updated = oldInterfaces.filter(id => id !== application.id);
                    await prisma.application.update({
                      where: { id: oldInterfaceId },
                      data: {
                        interfaces: updated.length > 0 ? JSON.stringify(updated) : null,
                      },
                    });
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }

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
    let interfaceAppIds = [];
    if (interfaces !== undefined) {
      if (interfaces && Array.isArray(interfaces) && interfaces.length > 0) {
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

    // Update reciprocal interfaces if interfaces were changed
    if (interfaces !== undefined && interfaceAppIds.length > 0) {
      try {
        // Get current application's ID
        const currentAppId = application.id;
        
        // For each interface application, add this application to their interfaces
        for (const interfaceAppId of interfaceAppIds) {
          const interfaceApp = await prisma.application.findUnique({
            where: { id: interfaceAppId },
          });
          
          if (interfaceApp && interfaceApp.interfaces) {
            try {
              const existingInterfaces = JSON.parse(interfaceApp.interfaces);
              if (!Array.isArray(existingInterfaces)) {
                // If not an array, initialize it
                await prisma.application.update({
                  where: { id: interfaceAppId },
                  data: {
                    interfaces: JSON.stringify([currentAppId]),
                  },
                });
              } else if (!existingInterfaces.includes(currentAppId)) {
                // Add current app to interface app's interfaces
                existingInterfaces.push(currentAppId);
                await prisma.application.update({
                  where: { id: interfaceAppId },
                  data: {
                    interfaces: JSON.stringify(existingInterfaces),
                  },
                });
              }
            } catch (e) {
              // If parsing fails, create new array
              await prisma.application.update({
                where: { id: interfaceAppId },
                data: {
                  interfaces: JSON.stringify([currentAppId]),
                },
              });
            }
          } else if (interfaceApp) {
            // No interfaces yet, create new
            await prisma.application.update({
              where: { id: interfaceAppId },
              data: {
                interfaces: JSON.stringify([currentAppId]),
              },
            });
          }
        }
        
        // Also remove this app from interfaces that are no longer in the list
        if (existing.interfaces) {
          try {
            const oldInterfaceIds = JSON.parse(existing.interfaces);
            if (Array.isArray(oldInterfaceIds)) {
              const removedIds = oldInterfaceIds.filter(id => !interfaceAppIds.includes(id));
              for (const removedId of removedIds) {
                const removedApp = await prisma.application.findUnique({
                  where: { id: removedId },
                });
                if (removedApp && removedApp.interfaces) {
                  try {
                    const removedAppInterfaces = JSON.parse(removedApp.interfaces);
                    if (Array.isArray(removedAppInterfaces)) {
                      const updated = removedAppInterfaces.filter(id => id !== currentAppId);
                      await prisma.application.update({
                        where: { id: removedId },
                        data: {
                          interfaces: updated.length > 0 ? JSON.stringify(updated) : null,
                        },
                      });
                    }
                  } catch (e) {
                    // Ignore parse errors
                  }
                }
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      } catch (error) {
        console.error('Error updating reciprocal interfaces:', error);
        // Don't fail the request if reciprocal update fails
      }
    } else if (interfaces !== undefined && interfaces.length === 0 && existing.interfaces) {
      // If interfaces were cleared, remove this app from all interface apps
      try {
        const oldInterfaceIds = JSON.parse(existing.interfaces);
        if (Array.isArray(oldInterfaceIds)) {
          for (const oldInterfaceId of oldInterfaceIds) {
            const oldInterfaceApp = await prisma.application.findUnique({
              where: { id: oldInterfaceId },
            });
            if (oldInterfaceApp && oldInterfaceApp.interfaces) {
              try {
                const oldInterfaces = JSON.parse(oldInterfaceApp.interfaces);
                if (Array.isArray(oldInterfaces)) {
                  const updated = oldInterfaces.filter(id => id !== application.id);
                  await prisma.application.update({
                    where: { id: oldInterfaceId },
                    data: {
                      interfaces: updated.length > 0 ? JSON.stringify(updated) : null,
                    },
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

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

// Bulk import applications
router.post('/bulk-import', requireAuth, async (req, res) => {
  try {
    const { companyId, applications } = req.body;

    console.log('=== BULK IMPORT REQUEST ===');
    console.log('Company ID:', companyId);
    console.log('Number of applications:', applications?.length || 0);
    console.log('Raw applications data:', JSON.stringify(applications, null, 2));

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!applications || !Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({ error: 'Applications array is required and must not be empty' });
    }

    // Check if user has access to this company
    if (!req.session.isAdmin && req.session.companyId !== companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only import applications for your company',
      });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    console.log('Company found:', company.name);

    // Validate all applications have required fields
    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      if (!app.name || app.name.trim() === '') {
        return res.status(400).json({ 
          error: `Application at row ${i + 1} is missing required field: name` 
        });
      }
    }

    // Create all applications
    const createdApplications = await Promise.all(
      applications.map(async (app, index) => {
        console.log(`\n--- Processing Application ${index + 1} ---`);
        console.log('Raw app data:', JSON.stringify(app, null, 2));
        // Process criticalAspects - convert array to comma-separated string if needed
        let criticalAspects = null;
        if (app.criticalAspects) {
          if (Array.isArray(app.criticalAspects)) {
            criticalAspects = app.criticalAspects.filter(a => a && a.trim()).join(', ');
          } else {
            criticalAspects = app.criticalAspects.trim() || null;
          }
        }

        // Process interfaces if provided
        let interfacesJson = null;
        if (app.interfaces) {
          if (Array.isArray(app.interfaces)) {
            interfacesJson = JSON.stringify(app.interfaces);
          } else if (typeof app.interfaces === 'string') {
            interfacesJson = app.interfaces;
          }
        }

        // Process hosting domains - accept multiple domains (comma, semicolon, or newline separated)
        const domainNames = [];
        console.log(`Checking for hosting domains in app ${index + 1}:`, app.hostingDomains, app.domains);
        if (app.hostingDomains || app.domains) {
          const domainString = String(app.hostingDomains || app.domains).trim();
          console.log(`Processing hosting domains for app ${index + 1}: "${domainString}"`);
          if (domainString) {
            // Split by comma, semicolon, or newline, then clean up each domain
            const domains = domainString
              .split(/[,;\n]/)
              .map(domain => domain.trim())
              .filter(domain => domain.length > 0);
            
            console.log(`Split into ${domains.length} domain(s):`, domains);
            
            // Validate and normalize each domain
            for (const domain of domains) {
              // Remove http://, https://, and www. if present
              let cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0] // Remove path if present
                .trim();
              
              console.log(`Cleaned domain: "${domain}" -> "${cleanDomain}"`);
              
              if (cleanDomain && isValidDomain(cleanDomain)) {
                const normalized = normalizeDomain(cleanDomain);
                domainNames.push(normalized);
                console.log(`Valid domain added: "${normalized}"`);
              } else {
                console.log(`Invalid domain skipped: "${cleanDomain}"`);
              }
            }
          }
        }
        console.log(`Total valid domains for app ${index + 1}: ${domainNames.length}`, domainNames);

        // Prepare database insert data
        const dbData = {
          name: app.name.trim(),
          companyId: companyId,
          description: app.description?.trim() || null,
          owner: app.owner?.trim() || null,
          repoUrl: app.repoUrl?.trim() || null,
          language: app.language?.trim() || null,
          framework: app.framework?.trim() || null,
          serverEnvironment: app.serverEnvironment?.trim() || null,
          facing: app.facing?.trim() || null,
          deploymentType: app.deploymentType?.trim() || null,
          authProfiles: app.authProfiles?.trim() || null,
          dataTypes: app.dataTypes?.trim() || null,
          interfaces: interfacesJson,
          businessCriticality: app.businessCriticality ? parseInt(app.businessCriticality) : null,
          criticalAspects: criticalAspects,
          devTeamContact: app.devTeamContact?.trim() || null,
          securityTestingDescription: app.securityTestingDescription?.trim() || null,
          additionalNotes: app.additionalNotes?.trim() || null,
          sastTool: app.sastTool?.trim() || null,
          sastIntegrationLevel: app.sastIntegrationLevel ? parseInt(app.sastIntegrationLevel) : null,
          dastTool: app.dastTool?.trim() || null,
          dastIntegrationLevel: app.dastIntegrationLevel ? parseInt(app.dastIntegrationLevel) : null,
          appFirewallTool: app.appFirewallTool?.trim() || null,
          appFirewallIntegrationLevel: app.appFirewallIntegrationLevel ? parseInt(app.appFirewallIntegrationLevel) : null,
          apiSecurityTool: app.apiSecurityTool?.trim() || null,
          apiSecurityIntegrationLevel: app.apiSecurityIntegrationLevel ? parseInt(app.apiSecurityIntegrationLevel) : null,
          apiSecurityNA: app.apiSecurityNA || false,
          status: 'onboarded',
        };

        console.log('Processed DB insert data:', JSON.stringify(dbData, null, 2));
        console.log('DB Command: prisma.application.create({ data: <above> })');

        const created = await prisma.application.create({
          data: dbData,
        });

        // Associate hosting domains with the application
        if (domainNames.length > 0) {
          for (const domainName of domainNames) {
            try {
              // Find or create domain within the company
              let domain = await prisma.domain.findUnique({
                where: {
                  name_companyId: {
                    name: domainName,
                    companyId: companyId,
                  },
                },
              });

              if (!domain) {
                domain = await prisma.domain.create({
                  data: {
                    name: domainName,
                    companyId: companyId,
                  },
                });
              }

              // Create association if it doesn't exist
              await prisma.applicationDomain.upsert({
                where: {
                  applicationId_domainId: {
                    applicationId: created.id,
                    domainId: domain.id,
                  },
                },
                update: {},
                create: {
                  applicationId: created.id,
                  domainId: domain.id,
                },
              });
            } catch (error) {
              console.error(`Error associating domain ${domainName} with application ${created.id}:`, error);
              // Continue with other domains even if one fails
            }
          }
        }

        console.log('Successfully created application:', created.id, created.name);
        return created;
      })
    );

    console.log('\n=== BULK IMPORT COMPLETE ===');
    console.log(`Successfully created ${createdApplications.length} application(s)`);
    console.log('Created application IDs:', createdApplications.map(a => a.id));

    res.status(201).json({
      count: createdApplications.length,
      applications: createdApplications,
      message: `Successfully imported ${createdApplications.length} application(s)`,
    });
  } catch (error) {
    console.error('\n=== BULK IMPORT ERROR ===');
    console.error('Error details:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to import applications',
      message: error.message || 'An error occurred while importing applications'
    });
  }
});

// Generate technical onboarding form link
router.post('/:id/generate-technical-link', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get application with company
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Check if user has access
    if (!req.session.isAdmin && req.session.companyId !== application.companyId) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only generate links for applications in your company',
      });
    }

    // Ensure company has a slug
    let company = application.company;
    if (!company.slug) {
      const { generateSlug, ensureUniqueSlug } = await import('../utils/slug.js');
      const baseSlug = generateSlug(company.name);
      const slug = await ensureUniqueSlug(baseSlug, company.id);
      
      company = await prisma.company.update({
        where: { id: company.id },
        data: { slug },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      });
    }

    // Generate the technical form link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const technicalFormUrl = `${frontendUrl}/onboard/${company.slug}/application/${application.id}`;

    res.json({
      applicationId: application.id,
      applicationName: application.name,
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      technicalFormUrl,
    });
  } catch (error) {
    console.error('Error generating technical form link:', error);
    res.status(500).json({ 
      error: 'Failed to generate technical form link',
      message: error.message 
    });
  }
});

// Delete application (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if application exists
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

    // Delete the application (cascade will handle related records)
    await prisma.application.delete({
      where: { id },
    });

    res.json({
      message: `Application "${application.name}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting application:', error);
    
    // Handle foreign key constraint errors
    if (error.code === 'P2003') {
      return res.status(400).json({
        error: 'Cannot delete application',
        message: 'This application has related records that prevent deletion. Please remove all related data first.',
      });
    }

    res.status(500).json({
      error: 'Failed to delete application',
      message: error.message,
    });
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

