import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { requirePermission, companyFrom, companyScopeFilter, can } from '../middleware/rbac.js';
import {
  SCORING_INCLUDE,
  calculateApplicationScore,
  getKnowledgeSharingFieldBreakdown,
  isMetadataValueNA,
  isSecurityToolCategoryNotApplicable,
  resolveCategoryToolInputs,
} from '../services/scoring.js';
import { evaluateAllControls } from '../services/policy.js';
import { isValidDomain, normalizeDomain } from '../utils/domainValidation.js';
import { getApexDomain } from '../utils/domainApex.js';
import { generateDeploymentToken, hashDeploymentToken, verifyDeploymentToken } from '../utils/deploymentToken.js';
import { createApplicationVersion, createVersionFromData, applyApprovedVersion } from '../utils/applicationVersion.js';
import { syncReciprocalInterfaces, parseInterfaceIds } from '../utils/applicationInterfaces.js';
import {
  SPLITTABLE_METADATA_FIELDS,
  SPLITTABLE_METADATA_FIELD_SET,
  SPLIT_METADATA_MODES,
} from '../utils/applicationSplitFields.js';
import { buildIntegrationSummaryForCompanyId } from '../integrations/summaryForCompany.js';
import { getIntegrationsKey } from '../utils/integrationCrypto.js';
import {
  assertSupportedProvider,
  PROVIDER_WIZ,
} from '../integrations/constants.js';
import {
  resolveIntegrationForCompany,
  validateWizFilter,
  normalizeWizFilter,
  validateWizApplicationFilter,
  normalizeWizApplicationFilter,
} from '../integrations/resolve.js';
import { listWizTagsForFolder } from '../integrations/wiz.js';
import { integrationLog } from '../integrations/log.js';
import { getAuthContext, resolveChangeSource } from '../middleware/authContext.js';
import { apiSchemaSummary, buildApiSchemaVisualization, validateAndNormalizeApiSchema } from '../services/apiSchema.js';
import {
  getThreatModelOptions,
  serializeThreatModel,
  getMissingRecommendedArchetypes,
  normalizeThreats,
  normalizeActors,
  normalizeDataTypes,
  normalizeArchetype,
  isValidModelStatus,
} from '../services/threatModel.js';
import { generateThreatModelDraft } from '../services/threatModelAi.js';
import { AiError } from '../services/ai/index.js';

/**
 * Get or create system user for automated notes
 */
async function getSystemUser() {
  const systemEmail = 'system@appsec-catalog.local';
  try {
    let systemUser = await prisma.user.findUnique({
      where: { email: systemEmail },
    });

    if (!systemUser) {
      // Create system user if it doesn't exist
      systemUser = await prisma.user.create({
        data: {
          email: systemEmail,
          isAdmin: false,
          verifiedAccount: true,
        },
      });
    }

    return systemUser;
  } catch (error) {
    console.error('Error getting system user:', error);
    return null;
  }
}

/**
 * Helper function to create a note
 * @param {string|null} userId - User ID who created the note (null for system user)
 * @param {string} content - Note content
 * @param {string} companyId - Optional company ID
 * @param {string} applicationId - Optional application ID
 */
async function createNote(userId, content, companyId = null, applicationId = null) {
  try {
    // If no user ID provided, use system user
    let finalUserId = userId;
    if (!finalUserId) {
      const systemUser = await getSystemUser();
      if (!systemUser) {
        console.error('Cannot create note: system user not available');
        return;
      }
      finalUserId = systemUser.id;
    }

    await prisma.note.create({
      data: {
        content: content.trim(),
        createdBy: finalUserId,
        companyId: companyId,
        applicationId: applicationId,
      },
    });
  } catch (error) {
    console.error('Error creating automatic note:', error);
    // Don't throw - notes are supplementary, don't fail the main operation
  }
}

/** Business criticality is a 1-5 scale. Reject anything else instead of silently coercing it. */
const BUSINESS_CRITICALITY_MIN = 1;
const BUSINESS_CRITICALITY_MAX = 5;

/**
 * @param {unknown} value
 * @returns {number|null} the parsed rating, or null when not provided
 * @throws {Error} with statusCode 400 when provided but not an integer in range
 */
function parseBusinessCriticality(value) {
  if (value === null || value === undefined || value === '') return null;

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < BUSINESS_CRITICALITY_MIN ||
    parsed > BUSINESS_CRITICALITY_MAX
  ) {
    const error = new Error(
      `businessCriticality must be a whole number from ${BUSINESS_CRITICALITY_MIN} to ${BUSINESS_CRITICALITY_MAX}`,
    );
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

/**
 * Get field names that were provided in a request
 */
function getProvidedFields(data, fieldMapping = {}) {
  const providedFields = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && value !== undefined && value !== '') {
      const fieldName = fieldMapping[key] || key;
      providedFields.push(fieldName);
    }
  }
  return providedFields;
}

const router = express.Router();

/**
 * Persist a score only when it differs from the latest stored one.
 *
 * `Score` is a history table: a row means "the score changed at this time". Writing a
 * row per calculation instead makes the history a record of page views, and the
 * dashboards read every row for every application to find the newest.
 */
async function recordScoreIfChanged(applicationId, scores) {
  try {
    const latest = await prisma.score.findFirst({
      where: { applicationId },
      orderBy: { calculatedAt: 'desc' },
      select: { knowledgeScore: true, toolScore: true, totalScore: true },
    });

    if (
      latest &&
      latest.knowledgeScore === scores.knowledgeScore &&
      latest.toolScore === scores.toolScore &&
      latest.totalScore === scores.totalScore
    ) {
      return;
    }

    await prisma.score.create({
      data: {
        applicationId,
        knowledgeScore: scores.knowledgeScore,
        toolScore: scores.toolScore,
        totalScore: scores.totalScore,
      },
    });
  } catch (error) {
    // Scores are recomputed on read; a failed history write must not fail the request.
    console.error('Error saving score to database:', error);
  }
}

/**
 * Load an application and check `permission` against its owning company.
 * Throws a tagged error that sendAccessError turns into a 404 or 403.
 */
async function getApplicationForAccess(req, applicationId, permission) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      companyId: true,
    },
  });

  if (!application) {
    const error = new Error('Application not found');
    error.statusCode = 404;
    throw error;
  }

  if (!(await can(req, permission, application.companyId))) {
    const error = new Error('You do not have permission to do that with this application');
    error.statusCode = 403;
    throw error;
  }

  return application;
}

function sendAccessError(res, error) {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 404 ? 'Application not found' : 'Permission denied',
    message: error.message,
  });
}

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
            businessCriticality: parseBusinessCriticality(app.businessCriticality),
            criticalAspects: criticalAspects,
            devTeamContact: app.devTeamContact?.trim() || null,
            status: 'pending_technical', // Needs technical form completion
          },
        });
      })
    );

    // Create automatic note for executive form submission
    try {
      const appNames = createdApplications.map(app => app.name).join(', ');
      const fieldMapping = {
        name: 'Name',
        description: 'Description',
        facing: 'Facing',
        serverEnvironment: 'Server Environment',
        businessCriticality: 'Business Criticality',
        criticalAspects: 'Critical Aspects',
        devTeamContact: 'Dev Team Contact',
      };
      
      // Get fields that were provided in the first application (representative sample)
      const firstApp = appsToCreate[0];
      const providedFields = getProvidedFields(firstApp, fieldMapping);
      
      const userId = req.session?.userId || null; // Use system user if no session
      const noteContent = `Executive form submitted. Created ${createdApplications.length} application(s): ${appNames}. Fields provided: ${providedFields.join(', ')}.`;
      
      await createNote(userId, noteContent, company.id, null);
    } catch (error) {
      console.error('Error creating note for executive form:', error);
      // Don't fail the request if note creation fails
    }

    // Create initial versions for all created applications
    for (const app of createdApplications) {
      await createApplicationVersion(app.id, req.session?.userId || null, 'executive_form');
    }

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
    if (error.statusCode === 400) {
      return res.status(400).json({ error: 'Invalid application data', message: error.message });
    }
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
    // Limited to the companies where the caller can read applications.
    const scope = await companyScopeFilter(req, 'application.read');
    if (!scope) {
      return res.json([]);
    }
    let whereClause = { ...scope };

    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        apiSchema: { select: { id: true } },
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

// Public: Get application by ID (for the technical onboarding form).
//
// UNAUTHENTICATED. Anyone holding an application id can call this, so it returns the
// minimum the technical form needs to render: the name it puts in its heading.
//
// The form is not allowed to prefill anything it collects itself. Security tooling,
// integration levels, scan dates, data handling, auth details, interfaces and contacts
// are all deliberately absent - submitting the form with a field blank leaves the
// stored value untouched (see PUT /public/:id), so nothing is lost by omitting them.
//
// Pass ?companySlug= to scope the lookup, so an id cannot be read through an unrelated
// company's onboarding link.
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { companySlug } = req.query;

    const application = await prisma.application.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        company: {
          select: {
            slug: true,
          },
        },
      },
    });

    // Same response for "no such application" and "wrong company", so the endpoint
    // cannot be used to test whether an id exists under a different slug.
    if (!application || (companySlug && application.company?.slug !== companySlug)) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({
      id: application.id,
      name: application.name,
    });
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
      requesterEmail,
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
      sastIncludesSca,
      dastTool,
      dastIntegrationLevel,
      scaTool,
      scaIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
      appFirewallNA,
    } = req.body;

    // Validate required email
    if (!requesterEmail || !requesterEmail.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(requesterEmail.trim())) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

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
            // Give the placeholder a v1 so its history starts from a real
            // baseline instead of diffing the first edit against nothing.
            await createApplicationVersion(interfaceApp.id, null, 'auto_created');
          }

          interfaceAppIds.push(interfaceApp.id);
        }

        interfacesJson = JSON.stringify(interfaceAppIds);
      }
    }

    // `additionalNotes` has its own column. It used to be appended onto `description`
    // instead, which grew the business purpose on every resubmission and mixed the
    // manager's text with the engineer's. The description is the manager's answer and
    // this form does not ask for it, so leave it alone.
    const submittedNotes = additionalNotes?.trim() || null;

    // Instead of updating the application directly, create a pending version
    // Merge new data with existing data to create a complete snapshot
    const versionData = {
      name: existing.name,
      description: existing.description,
      owner: existing.owner,
      repoUrl: repoUrl?.trim() || existing.repoUrl,
      language: existing.language,
      framework: existing.framework,
      serverEnvironment: existing.serverEnvironment,
      facing: existing.facing,
      deploymentType: deploymentType || existing.deploymentType,
      authProfiles: authProfiles || existing.authProfiles,
      dataTypes: dataTypes || existing.dataTypes,
      interfaces: interfacesJson || existing.interfaces,
      status: 'onboarded', // Mark as fully onboarded
      businessCriticality: existing.businessCriticality,
      criticalAspects: existing.criticalAspects,
      devTeamContact: existing.devTeamContact,
      securityTestingDescription: securityTestingDescription?.trim() || existing.securityTestingDescription,
      additionalNotes: submittedNotes || existing.additionalNotes,
      sastTool: sastTool?.trim() || existing.sastTool,
      sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : existing.sastIntegrationLevel,
      sastIncludesSca:
        sastIncludesSca === undefined
          ? existing.sastIncludesSca
          : sastIncludesSca === true || sastIncludesSca === 'true',
      dastTool: dastTool?.trim() || existing.dastTool,
      dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : existing.dastIntegrationLevel,
      scaTool: scaTool?.trim() || existing.scaTool,
      scaIntegrationLevel: scaIntegrationLevel
        ? parseInt(scaIntegrationLevel)
        : existing.scaIntegrationLevel,
      appFirewallTool: appFirewallTool?.trim() || existing.appFirewallTool,
      appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : existing.appFirewallIntegrationLevel,
      apiSecurityTool: apiSecurityTool?.trim() || existing.apiSecurityTool,
      apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : existing.apiSecurityIntegrationLevel,
      apiSecurityNA: apiSecurityNA === true || apiSecurityNA === 'true' || existing.apiSecurityNA,
      appFirewallNA:
        appFirewallNA === true || appFirewallNA === 'true' || existing.appFirewallNA,
      currentVersion: existing.currentVersion,
      deploymentEnvironment: existing.deploymentEnvironment,
      gitBranch: existing.gitBranch,
      lastDastScanDate: existing.lastDastScanDate,
      lastSastScanDate: existing.lastSastScanDate,
      lastScaScanDate: existing.lastScaScanDate,
    };

    // Create pending version instead of updating application
    const pendingVersion = await createVersionFromData(
      id,
      versionData,
      null, // No user ID for technical form submissions
      'technical_form',
      'pending',
      requesterEmail.trim() // Store the requester email directly
    );

    // Don't update the application - it will be updated when admin approves the version
    const application = existing;

    // Note: Reciprocal interface updates will happen when the version is approved
    // For now, we just store the interfaces in the pending version
    // This will be handled in the approval endpoint

    // Create automatic note for technical form submission
    try {
      const fieldMapping = {
        repoUrl: 'Repository URL',
        deploymentFrequency: 'Deployment Frequency',
        deploymentMethod: 'Deployment Method',
        requiresSpecialAccess: 'Requires Special Access',
        authInfo: 'Auth Info',
        handlesUserData: 'Handles User Data',
        userDataTypes: 'User Data Types',
        userDataStorage: 'User Data Storage',
        hasInterfaces: 'Has Interfaces',
        interfaces: 'Interfaces',
        pciData: 'PCI Data',
        piiData: 'PII Data',
        phiData: 'PHI Data',
        hasSecurityTesting: 'Has Security Testing',
        securityTestingDescription: 'Security Testing Description',
        additionalNotes: 'Additional Notes',
        sastTool: 'SAST Tool',
        sastIntegrationLevel: 'SAST Integration Level',
        sastIncludesSca: 'SAST includes SCA',
        dastTool: 'DAST Tool',
        dastIntegrationLevel: 'DAST Integration Level',
        scaTool: 'SCA Tool',
        scaIntegrationLevel: 'SCA Integration Level',
        appFirewallTool: 'App Firewall Tool',
        appFirewallIntegrationLevel: 'App Firewall Integration Level',
        apiSecurityTool: 'Legacy API Security Tool',
        apiSecurityIntegrationLevel: 'Legacy API Security Integration Level',
        apiSecurityNA: 'API Security N/A',
        appFirewallNA: 'App Firewall N/A',
      };
      
      const providedFields = getProvidedFields(req.body, fieldMapping);
      
      if (providedFields.length > 0) {
        const userId = req.session?.userId || null; // Use system user if no session
        const noteContent = `Technical form submitted for application "${application.name}". Pending admin approval. Fields provided: ${providedFields.join(', ')}.`;
        await createNote(userId, noteContent, null, application.id);
      }
    } catch (error) {
      console.error('Error creating note for technical form:', error);
      // Don't fail the request if note creation fails
    }

    res.json({
      application,
      version: pendingVersion,
      message: 'Technical form submitted successfully. Changes are pending admin approval.',
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Get application score - MUST come before /:id route
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
        ...SCORING_INCLUDE,
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'application.read', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access applications in your company',
      });
    }

    // Calculate score. This endpoint deliberately does not write a Score row: the
    // score is derived from the application, so viewing one is not a change. Rows are
    // written by the endpoints that actually mutate the application.
    const scores = calculateApplicationScore(application);

    // Calculate breakdown for knowledge sharing (same rules as calculateKnowledgeSharingScore, including "NA" exclusions)
    const { totalScorable, fieldsFilled, missingFields } =
      getKnowledgeSharingFieldBreakdown(application);
    const completenessFor40 =
      totalScorable > 0
        ? Math.round((fieldsFilled / totalScorable) * 40)
        : 0;

    // Calculate tool recommendations
    const toolCategories = [
      { key: 'sast', label: 'SAST', toolField: 'sastTool', levelField: 'sastIntegrationLevel', scanField: 'lastSastScanDate' },
      { key: 'dast', label: 'DAST', toolField: 'dastTool', levelField: 'dastIntegrationLevel', scanField: 'lastDastScanDate' },
      { key: 'sca', label: 'SCA', toolField: 'scaTool', levelField: 'scaIntegrationLevel', scanField: 'lastScaScanDate' },
      { key: 'appFirewall', label: 'Application Firewall', toolField: 'appFirewallTool', levelField: 'appFirewallIntegrationLevel', scanField: null },
      { key: 'apiSecurity', label: 'API Security', toolField: null, levelField: null, scanField: null },
    ];

    const toolRecommendations = toolCategories.map((category) => {
      const displayLabel =
        category.key === 'sca' && application.sastIncludesSca
          ? 'SCA (same as SAST)'
          : category.label;
      const resolved = resolveCategoryToolInputs(application, category.key);
      const tool = resolved.tool;
      const level = resolved.level;
      const scanField = resolved.scanField;
      const scanDate = scanField ? application[scanField] : null;
      const isNotApplicable = isSecurityToolCategoryNotApplicable(
        application,
        category.key,
      );
      const isRealToolConfig =
        !isNotApplicable &&
        tool &&
        typeof tool === 'string' &&
        tool.trim() !== '' &&
        !isMetadataValueNA(tool) &&
        level !== null &&
        level !== undefined;

      let status = 'complete';
      let recommendation = null;

      if (isNotApplicable) {
        status = 'complete';
        recommendation = null;
      } else if (category.key === 'apiSecurity') {
        if (application.apiSchema) {
          status = 'complete';
          recommendation = null;
        } else {
          status = 'missing';
          recommendation = 'Add OpenAPI/Swagger schema';
        }
      } else if (!tool || level === null || level === undefined) {
        status = 'missing';
        recommendation = `Add ${displayLabel} tool and integration level`;
      } else if (level < 2) {
        status = 'low';
        recommendation = `Increase ${displayLabel} integration level (currently level ${level})`;
      } else if (scanField && scanDate) {
        // Check if scan is recent relative to deployments
        if (application.deployments && application.deployments.length > 0) {
          const lastDeployment = application.deployments[0];
          const scanDateObj = new Date(scanDate);
          const deployDateObj = new Date(lastDeployment.deployedAt);
          const daysDiff = (scanDateObj.getTime() - deployDateObj.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysDiff < -1 || daysDiff > 1) {
            status = 'stale';
            recommendation = `Update ${displayLabel} scan date (should be within 1 day of last deployment)`;
          }
        }
      } else if (scanField && !scanDate) {
        status = 'missing-scan';
        recommendation = `Add ${displayLabel} scan date`;
      }

      return {
        category: displayLabel,
        tool,
        level,
        status,
        recommendation,
        isNotApplicable,
        isRealToolConfig: category.key === 'apiSecurity' ? !!application.apiSchema && !isNotApplicable : isRealToolConfig,
      };
    });

    // Tools with a real product + level (excludes "NA" / not-applicable rows)
    const configuredTools = toolRecommendations
      .filter((t) => t.isRealToolConfig)
      .map((t) => t.category);

    const notApplicableToolCategories = toolRecommendations
      .filter((t) => t.isNotApplicable)
      .map((t) => t.category);

    // Check metadata review status
    let reviewRecommendation = null;
    if (!application.metadataLastReviewed) {
      reviewRecommendation = 'Request metadata review from AppSec team';
    } else {
      const reviewDate = new Date(application.metadataLastReviewed);
      const daysSinceReview = (Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show recommendation if it's been more than 5 months (approximately 150 days)
      if (daysSinceReview > 150) {
        reviewRecommendation = 'Request metadata review (last reviewed more than 5 months ago)';
      }
    }

    // Check importance data completeness
    const importanceFields = [
      { key: 'businessCriticality', label: 'Business Criticality' },
      { key: 'criticalAspects', label: 'Critical Aspects' },
      { key: 'deploymentType', label: 'Deployment Type' },
      { key: 'facing', label: 'Facing (Internal/External)' },
    ];
    const missingImportanceFields = importanceFields
      .filter(
        (field) =>
          !isMetadataValueNA(application[field.key]) && !application[field.key],
      )
      .map((f) => f.label);

    res.json({
      ...scores,
      breakdown: {
        knowledgeSharing: {
          fieldsFilled,
          totalFields: totalScorable,
          completenessScore: completenessFor40,
          reviewScore: scores.knowledgeScore - completenessFor40,
          lastReviewed: application.metadataLastReviewed,
          missingFields,
        },
        tools: toolRecommendations,
        configuredTools: configuredTools || [],
        notApplicableToolCategories: notApplicableToolCategories || [],
        reviewRecommendation,
        missingImportanceFields: missingImportanceFields.length > 0 ? missingImportanceFields : null,
        importance: {
          importanceScore: scores.importanceScore,
          importanceFactors: scores.importanceFactors || [],
          knowledgeWeight: scores.knowledgeWeight,
          toolWeight: scores.toolWeight,
          rawKnowledgeScore: scores.rawKnowledgeScore,
          rawToolScore: scores.rawToolScore,
        },
      },
    });
  } catch (error) {
    console.error('Error calculating application score:', error);
    res.status(500).json({ error: 'Failed to calculate score' });
  }
});

// Get application policy compliance - MUST come before /:id route
router.get('/:id/policy-compliance', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            divisionId: true,
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'application.read', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access applications in your company',
      });
    }

    // Evaluate all policy controls
    const compliance = await evaluateAllControls(application);

    res.json(compliance);
  } catch (error) {
    console.error('Error evaluating policy compliance:', error);
    res.status(500).json({ error: 'Failed to evaluate policy compliance' });
  }
});

// Get all policy control overrides for an application (Admin only)
router.get('/:id/policy-overrides', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get all overrides for this application
    const overrides = await prisma.policyControlOverride.findMany({
      where: {
        applicationId: id,
      },
      include: {
        control: {
          select: {
            id: true,
            controlId: true,
            name: true,
          },
        },
        note: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        overriddenAt: 'desc',
      },
    });

    res.json(overrides);
  } catch (error) {
    console.error('Error fetching policy overrides:', error);
    res.status(500).json({ error: 'Failed to fetch policy overrides' });
  }
});

// Create or update a policy control override (Admin only)
router.post('/:id/policy-overrides', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: applicationId } = req.params;
    const { controlId, isCompliant, noteContent } = req.body;

    // Validate required fields
    if (!controlId) {
      return res.status(400).json({ error: 'controlId is required' });
    }
    if (typeof isCompliant !== 'boolean') {
      return res.status(400).json({ error: 'isCompliant must be a boolean' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Verify control exists and get policy info
    const control = await prisma.policyControl.findUnique({
      where: { id: controlId },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!control) {
      return res.status(404).json({ error: 'Policy control not found' });
    }

    // Check if override already exists
    const existingOverride = await prisma.policyControlOverride.findUnique({
      where: {
        applicationId_controlId: {
          applicationId,
          controlId,
        },
      },
      include: {
        note: true,
      },
    });

    let noteId = null;

    // Create or update note if noteContent is provided
    if (noteContent && noteContent.trim()) {
      if (existingOverride && existingOverride.noteId) {
        // Update existing note
        await prisma.note.update({
          where: { id: existingOverride.noteId },
          data: {
            content: noteContent.trim(),
          },
        });
        noteId = existingOverride.noteId;
      } else {
        // Create new note with prefix
        const prefix = `Manual Override Added for ${control.name} of ${control.policy.name}:\n\n`;
        const note = await prisma.note.create({
          data: {
            content: prefix + noteContent.trim(),
            createdBy: getAuthContext(req)?.userId,
            applicationId: applicationId,
          },
        });
        noteId = note.id;
      }
    } else if (existingOverride && existingOverride.noteId) {
      // If no note content provided but note exists, keep the existing note
      noteId = existingOverride.noteId;
    }

    // Create or update override
    const override = await prisma.policyControlOverride.upsert({
      where: {
        applicationId_controlId: {
          applicationId,
          controlId,
        },
      },
      create: {
        applicationId,
        controlId,
        isCompliant,
        noteId,
        overriddenBy: getAuthContext(req)?.userId,
      },
      update: {
        isCompliant,
        noteId,
        overriddenBy: getAuthContext(req)?.userId,
      },
      include: {
        control: {
          select: {
            id: true,
            controlId: true,
            name: true,
          },
        },
        note: {
          select: {
            id: true,
            content: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    res.json(override);
  } catch (error) {
    console.error('Error creating/updating policy override:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Override already exists for this control' });
    }
    res.status(500).json({ error: 'Failed to create/update policy override' });
  }
});

// Delete a policy control override (Admin only)
router.delete('/:id/policy-overrides/:controlId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id: applicationId, controlId } = req.params;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get existing override to check for note
    const existingOverride = await prisma.policyControlOverride.findUnique({
      where: {
        applicationId_controlId: {
          applicationId,
          controlId,
        },
      },
      include: {
        note: true,
      },
    });

    if (!existingOverride) {
      return res.status(404).json({ error: 'Override not found' });
    }

    // Delete the override (note will be deleted via cascade if it's only linked to this override)
    // But we want to keep the note if it's a general application note, so we'll just unlink it
    await prisma.policyControlOverride.delete({
      where: {
        applicationId_controlId: {
          applicationId,
          controlId,
        },
      },
    });

    // Note: The note will remain in the timeline even if the override is deleted
    // This is intentional - the note provides context in the timeline

    res.json({ message: 'Override deleted successfully' });
  } catch (error) {
    console.error('Error deleting policy override:', error);
    res.status(500).json({ error: 'Failed to delete policy override' });
  }
});

// Application–integration tag/folder list (uses company’s API credentials; must be before GET /:id)
router.get('/:id/integrations/:provider/tags', requireAuth, async (req, res) => {
  try {
    getIntegrationsKey();
  } catch (e) {
    return res.status(503).json({ error: 'Integration encryption not configured', message: e.message });
  }
  try {
    const { id: applicationId, provider } = req.params;
    assertSupportedProvider(provider);

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, companyId: true },
    });
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (!(await can(req, 'application.read', app.companyId))) {
      return res.status(403).json({ error: 'Permission denied', message: 'You cannot access this application' });
    }

    const companyId = app.companyId;
    const resolved = await resolveIntegrationForCompany(companyId, provider);
    if (!resolved) {
      return res.status(400).json({
        error: 'No integration configured',
        message: 'Save API credentials for this provider (enterprise or company) first.',
      });
    }
    if (!(await can(req, 'integration.manage', companyId))) {
      return res.status(403).json({ error: 'Permission denied', message: 'You cannot list tags for this application' });
    }

    if (provider === PROVIDER_WIZ) {
      const companyLink = await prisma.companyToolLink.findUnique({
        where: { companyId_provider: { companyId, provider } },
      });
      const folderId = companyLink?.filter?.folderId;
      if (!folderId || typeof folderId !== 'string') {
        return res.status(400).json({
          error: 'Company Wiz folder is not linked',
          message: 'Link the company to a Wiz folder before selecting an application tag.',
        });
      }
      const tags = await listWizTagsForFolder(resolved.decrypted, resolved.baseUrl, folderId);
      integrationLog('info', {
        layer: 'api',
        op: 'GET_application_integration_tags',
        provider,
        applicationId,
        companyId,
        folderId,
        itemCount: tags.length,
      });
      return res.json({ tags });
    }
    return res.status(400).json({ error: 'Provider not implemented' });
  } catch (error) {
    integrationLog('error', {
      layer: 'api',
      op: 'GET_application_integration_tags',
      provider: req.params.provider,
      applicationId: req.params.id,
      error: error.message || String(error),
      httpStatus: error.statusCode,
    });
    console.error('List application integration tags error:', error);
    if (error.statusCode === 400) return res.status(400).json({ error: error.message });
    if (error.statusCode === 403) {
      return res.status(403).json({ error: 'Vendor API denied', message: error.message });
    }
    if (error.statusCode === 502) {
      return res.status(502).json({ error: 'Vendor API error', message: error.message });
    }
    res.status(500).json({ error: 'Failed to list tags' });
  }
});

router.put('/:id/integrations/:provider/link', requireAuth, async (req, res) => {
  try {
    const { id: applicationId, provider } = req.params;
    assertSupportedProvider(provider);

    const app = await prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, companyId: true },
    });
    if (!app) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (!(await can(req, 'application.edit', app.companyId))) {
      return res.status(403).json({ error: 'Permission denied', message: 'You cannot access this application' });
    }

    const companyId = app.companyId;
    const resolved = await resolveIntegrationForCompany(companyId, provider);
    if (!resolved) {
      return res.status(400).json({
        error: 'No integration configured',
        message: 'Configure API credentials before setting a link.',
      });
    }
    if (!(await can(req, 'integration.manage', companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot set an integration link for this application',
      });
    }

    let filter;
    if (provider === PROVIDER_WIZ) {
      const companyLink = await prisma.companyToolLink.findUnique({
        where: { companyId_provider: { companyId, provider } },
      });
      const companyFolderId = companyLink?.filter?.folderId;
      if (!companyFolderId || typeof companyFolderId !== 'string') {
        return res.status(400).json({
          error: 'Company Wiz folder is not linked',
          message: 'Link the company to a Wiz folder before linking an application tag.',
        });
      }
      const normalized = normalizeWizApplicationFilter({
        ...req.body,
        folderId: companyFolderId,
        folderName: req.body?.folderName || companyLink.filter?.folderName,
      });
      const v = validateWizApplicationFilter(normalized);
      if (!v.ok) {
        return res.status(400).json({ error: v.message });
      }
      const tags = await listWizTagsForFolder(resolved.decrypted, resolved.baseUrl, companyFolderId);
      if (!tags.some((tag) => tag.uuid === normalized.tagValue)) {
        return res.status(400).json({
          error: 'Wiz tag is not available in the company folder',
          message: 'Select a tag returned from the company-scoped Wiz tag list.',
        });
      }
      filter = normalized;
    } else {
      return res.status(400).json({ error: 'Provider not implemented' });
    }

    const link = await prisma.applicationToolLink.upsert({
      where: { applicationId_provider: { applicationId, provider } },
      create: { applicationId, provider, filter },
      update: { filter },
    });

    res.json({
      ok: true,
      link: {
        id: link.id,
        provider: link.provider,
        filter: link.filter,
        updatedAt: link.updatedAt,
      },
    });
  } catch (error) {
    console.error('Save application integration link error:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save application integration link' });
  }
});

// API schema: metadata for the current OpenAPI/Swagger schema
router.get('/:id/api-schema', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    const schema = await prisma.applicationApiSchema.findUnique({
      where: { applicationId: req.params.id },
    });

    res.json({ schema: apiSchemaSummary(schema) });
  } catch (error) {
    console.error('Get API schema error:', error);
    sendAccessError(res, error);
  }
});

// API schema: upload/paste text content for the current OpenAPI/Swagger schema
router.put('/:id/api-schema', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.edit');

    const normalized = validateAndNormalizeApiSchema({
      content: req.body?.content,
      filename: req.body?.filename,
      contentType: req.body?.contentType,
    });

    const schema = await prisma.applicationApiSchema.upsert({
      where: { applicationId: req.params.id },
      create: {
        applicationId: req.params.id,
        ...normalized,
        uploadedById: auth.userId,
      },
      update: {
        ...normalized,
        uploadedById: auth.userId,
        uploadedAt: new Date(),
      },
    });

    res.json({ schema: apiSchemaSummary(schema) });
  } catch (error) {
    console.error('Save API schema error:', error);
    if (error.statusCode) return sendAccessError(res, error);
    res.status(400).json({
      error: 'Failed to save API schema',
      message: error.message,
    });
  }
});

router.delete('/:id/api-schema', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    await prisma.applicationApiSchema.delete({
      where: { applicationId: req.params.id },
    }).catch((error) => {
      if (error.code === 'P2025') return null;
      throw error;
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete API schema error:', error);
    sendAccessError(res, error);
  }
});

router.get('/:id/api-schema/download', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    const schema = await prisma.applicationApiSchema.findUnique({
      where: { applicationId: req.params.id },
      include: {
        application: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!schema) {
      return res.status(404).json({ error: 'API schema not found' });
    }

    const appNameSlug = (schema.application?.name || 'application')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'application';
    const extension = schema.format === 'json' ? 'json' : 'yaml';
    const safeFilename = `${appNameSlug}-api-schema.${extension}`;
    res.setHeader('Content-Type', schema.contentType || 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.send(schema.content);
  } catch (error) {
    console.error('Download API schema error:', error);
    sendAccessError(res, error);
  }
});

router.get('/:id/api-schema/visualization', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    const schema = await prisma.applicationApiSchema.findUnique({
      where: { applicationId: req.params.id },
    });

    if (!schema) {
      return res.status(404).json({ error: 'API schema not found' });
    }

    res.json({ visualization: buildApiSchemaVisualization(schema) });
  } catch (error) {
    console.error('API schema visualization error:', error);
    if (error.statusCode) return sendAccessError(res, error);
    res.status(400).json({
      error: 'Failed to visualize API schema',
      message: error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Threat model (Shostack 4-question frame). One model per application, with
// component child nodes. Threats stored as JSON arrays on each node.
// ---------------------------------------------------------------------------

const THREAT_MODEL_INCLUDE = { components: { orderBy: { orderIndex: 'asc' } } };

// Static options library (archetypes, STRIDE prompts, actor/data-type lists).
router.get('/threat-model/options', requireAuth, (req, res) => {
  res.json(getThreatModelOptions());
});

// Get the threat model for an application.
router.get('/:id/threat-model', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    const model = await prisma.threatModel.findUnique({
      where: { applicationId: req.params.id },
      include: THREAT_MODEL_INCLUDE,
    });

    res.json(serializeThreatModel(model));
  } catch (error) {
    console.error('Get threat model error:', error);
    sendAccessError(res, error);
  }
});

// AI co-pilot: draft a threat model for this application. Persists NOTHING —
// returns suggestions the user reviews and accepts through the normal endpoints.
router.post('/:id/threat-model/ai-draft', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.edit');

    // Full application record for grounding the prompt.
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const existing = await prisma.threatModel.findUnique({
      where: { applicationId: req.params.id },
      include: THREAT_MODEL_INCLUDE,
    });
    const { model } = serializeThreatModel(existing);

    const result = await generateThreatModelDraft({
      application,
      model,
      userId: auth?.userId || null,
    });

    res.json({
      draft: result.draft,
      meta: {
        aiRequestId: result.aiRequestId,
        model: result.model,
        usage: result.usage,
        cost: result.cost,
      },
    });
  } catch (error) {
    // AI-layer errors (config, access, model) carry a status + code.
    if (error instanceof AiError) {
      return res.status(error.status || 500).json({
        error: error.message,
        code: error.code,
        reason: error.reason,
      });
    }
    if (error.statusCode) {
      return sendAccessError(res, error);
    }
    console.error('Threat model AI draft error:', error);
    res.status(error.status || 500).json({ error: 'Failed to generate draft', message: error.message });
  }
});

// Create/update the root threat model (question 1 + app-level threats + status).
router.put('/:id/threat-model', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.edit');

    const body = req.body || {};
    // Partial update: only touch fields present in the request body.
    const data = {};
    if (body.scope !== undefined) {
      data.scope = typeof body.scope === 'string' ? body.scope.slice(0, 8000) : null;
    }
    if (body.actors !== undefined) data.actors = JSON.stringify(normalizeActors(body.actors));
    if (body.dataTypes !== undefined) data.dataTypes = JSON.stringify(normalizeDataTypes(body.dataTypes));
    if (body.threats !== undefined) data.threats = JSON.stringify(normalizeThreats(body.threats));

    if (body.status !== undefined) {
      if (!isValidModelStatus(body.status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      data.status = body.status;
    }

    if (body.reviewer !== undefined) {
      data.reviewer = typeof body.reviewer === 'string' ? body.reviewer.slice(0, 300) || null : null;
    }

    // "Mark reviewed now" toggle from the UI.
    if (body.markReviewed === true) {
      data.lastReviewedAt = new Date();
    } else if (body.lastReviewedAt === null) {
      data.lastReviewedAt = null;
    }

    const model = await prisma.threatModel.upsert({
      where: { applicationId: req.params.id },
      create: {
        applicationId: req.params.id,
        createdById: auth.userId,
        status: data.status || 'draft',
        ...data,
      },
      update: data,
      include: THREAT_MODEL_INCLUDE,
    });

    // Auto-create a matching component for anything checked in question 1
    // (data types / actors) that doesn't already have one. Create-only — a
    // component you deleted comes back on the next save while the box stays checked.
    const serialized = serializeThreatModel(model).model;
    const missing = getMissingRecommendedArchetypes(serialized, serialized.components);
    if (missing.length > 0) {
      let nextIndex =
        serialized.components.reduce((max, c) => Math.max(max, c.orderIndex ?? 0), -1) + 1;
      await prisma.threatModelComponent.createMany({
        data: missing.map((r) => ({
          threatModelId: model.id,
          name: r.label,
          archetype: r.archetype,
          orderIndex: nextIndex++,
          threats: JSON.stringify([]),
        })),
      });
      const refreshed = await prisma.threatModel.findUnique({
        where: { id: model.id },
        include: THREAT_MODEL_INCLUDE,
      });
      return res.json(serializeThreatModel(refreshed));
    }

    res.json(serializeThreatModel(model));
  } catch (error) {
    console.error('Save threat model error:', error);
    if (error.statusCode) return sendAccessError(res, error);
    res.status(400).json({ error: 'Failed to save threat model', message: error.message });
  }
});

// Ensure a threat model row exists, returning it. Used before adding components.
async function ensureThreatModel(applicationId, userId) {
  return prisma.threatModel.upsert({
    where: { applicationId },
    create: { applicationId, createdById: userId, status: 'draft' },
    update: {},
  });
}

// Add a component node.
router.post('/:id/threat-model/components', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.edit');

    const body = req.body || {};
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
    if (!name) {
      return res.status(400).json({ error: 'Component name is required' });
    }

    const model = await ensureThreatModel(req.params.id, auth.userId);

    const last = await prisma.threatModelComponent.findFirst({
      where: { threatModelId: model.id },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    await prisma.threatModelComponent.create({
      data: {
        threatModelId: model.id,
        name,
        archetype: normalizeArchetype(body.archetype),
        orderIndex: (last?.orderIndex ?? -1) + 1,
        scope: typeof body.scope === 'string' ? body.scope.slice(0, 8000) : null,
        threats: JSON.stringify(normalizeThreats(body.threats)),
        reviewed: body.reviewed === true,
      },
    });

    const full = await prisma.threatModel.findUnique({
      where: { id: model.id },
      include: THREAT_MODEL_INCLUDE,
    });
    res.status(201).json(serializeThreatModel(full));
  } catch (error) {
    console.error('Add threat model component error:', error);
    if (error.statusCode) return sendAccessError(res, error);
    res.status(400).json({ error: 'Failed to add component', message: error.message });
  }
});

// Update a component node.
router.put('/:id/threat-model/components/:componentId', requireAuth, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.edit');

    const model = await prisma.threatModel.findUnique({
      where: { applicationId: req.params.id },
      select: { id: true },
    });
    if (!model) return res.status(404).json({ error: 'Threat model not found' });

    const existing = await prisma.threatModelComponent.findFirst({
      where: { id: req.params.componentId, threatModelId: model.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Component not found' });

    const body = req.body || {};
    const data = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : '';
      if (!name) return res.status(400).json({ error: 'Component name is required' });
      data.name = name;
    }
    if (body.archetype !== undefined) data.archetype = normalizeArchetype(body.archetype);
    if (body.scope !== undefined) {
      data.scope = typeof body.scope === 'string' ? body.scope.slice(0, 8000) : null;
    }
    if (body.threats !== undefined) data.threats = JSON.stringify(normalizeThreats(body.threats));
    if (body.reviewed !== undefined) data.reviewed = body.reviewed === true;
    if (body.orderIndex !== undefined && Number.isInteger(body.orderIndex)) {
      data.orderIndex = body.orderIndex;
    }

    await prisma.threatModelComponent.update({
      where: { id: req.params.componentId },
      data,
    });

    const full = await prisma.threatModel.findUnique({
      where: { id: model.id },
      include: THREAT_MODEL_INCLUDE,
    });
    res.json(serializeThreatModel(full));
  } catch (error) {
    console.error('Update threat model component error:', error);
    if (error.statusCode) return sendAccessError(res, error);
    res.status(400).json({ error: 'Failed to update component', message: error.message });
  }
});

// Delete a component node.
router.delete('/:id/threat-model/components/:componentId', requireAuth, requireAdmin, async (req, res) => {
  try {
    await getApplicationForAccess(req, req.params.id, 'application.read');

    const model = await prisma.threatModel.findUnique({
      where: { applicationId: req.params.id },
      select: { id: true },
    });
    if (!model) return res.status(404).json({ error: 'Threat model not found' });

    await prisma.threatModelComponent
      .delete({ where: { id: req.params.componentId } })
      .catch((error) => {
        if (error.code === 'P2025') return null;
        throw error;
      });

    const full = await prisma.threatModel.findUnique({
      where: { id: model.id },
      include: THREAT_MODEL_INCLUDE,
    });
    res.json(serializeThreatModel(full));
  } catch (error) {
    console.error('Delete threat model component error:', error);
    sendAccessError(res, error);
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
        applicationToolLinks: {
          select: {
            id: true,
            provider: true,
            filter: true,
            updatedAt: true,
          },
        },
        scmRepoLink: {
          include: {
            repo: {
              include: {
                dependencies: {
                  orderBy: [{ isFramework: 'desc' }, { name: 'asc' }],
                },
              },
            },
          },
        },
        apiSchema: {
          select: {
            id: true,
            filename: true,
            contentType: true,
            format: true,
            sizeBytes: true,
            sha256: true,
            uploadedById: true,
            uploadedAt: true,
            updatedAt: true,
          },
        },
        contacts: true,
        applicationDomains: {
          include: {
            domain: true,
          },
        },
        deployments: {
          orderBy: { deployedAt: 'desc' },
          take: 10, // Get last 10 deployments for the detail view
        },
        productApplications: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Transform domains to a simpler format
    if (application.applicationDomains) {
      application.domains = application.applicationDomains.map(ad => ad.domain);
      delete application.applicationDomains;
    } else {
      application.domains = [];
    }

    // Backward-compatible product shape for UI consumers expecting a single product
    if (application.productApplications && application.productApplications.length > 0) {
      application.products = application.productApplications
        .map((pa) => pa.product)
        .filter(Boolean);
      application.product = application.products[0] || null;
    } else {
      application.products = [];
      application.product = null;
    }
    delete application.productApplications;

    // Check if user has access (admin or member of same company)
    const auth = getAuthContext(req);
    if (!(await can(req, 'application.read', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access applications in your company',
      });
    }

    const integrationSummary = await buildIntegrationSummaryForCompanyId(
      prisma,
      application.companyId,
      !!auth.isAdmin,
    );
    application.integrationSummary = integrationSummary;

    // Auto-populate current deployment info from most recent deployment
    if (application.deployments && application.deployments.length > 0) {
      const latestDeployment = application.deployments[0]; // Already sorted by deployedAt desc
      // Only override if the fields are not manually set (null/empty means use latest deployment)
      if (!application.currentVersion && latestDeployment.version) {
        application.currentVersion = latestDeployment.version;
      }
      if (!application.deploymentEnvironment && latestDeployment.environment) {
        application.deploymentEnvironment = latestDeployment.environment;
      }
      if (!application.gitBranch && latestDeployment.gitBranch) {
        application.gitBranch = latestDeployment.gitBranch;
      }
    }

    res.json(application);
  } catch (error) {
    console.error('Error fetching application:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
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
      include: SCORING_INCLUDE,
    });

    // Recalculate score
    const scores = calculateApplicationScore(updated);
    await recordScoreIfChanged(updated.id, scores);

    // Create review log entry
    try {
      await prisma.applicationMetadataReview.create({
        data: {
          applicationId: updated.id,
          reviewedBy: getAuthContext(req)?.userId,
        },
      });
    } catch (error) {
      console.error('Error creating review log entry:', error);
      // Don't fail the request if review log creation fails
    }

    // Create automatic note for review
    try {
      const reviewer = await prisma.user.findUnique({
        where: { id: getAuthContext(req)?.userId },
        select: { email: true },
      });
      
      const reviewerEmail = reviewer?.email || 'Unknown';
      const noteContent = `Application "${updated.name}" was reviewed by ${reviewerEmail}.`;
      
      await createNote(getAuthContext(req)?.userId, noteContent, null, updated.id);
    } catch (error) {
      console.error('Error creating note for review:', error);
      // Don't fail the request if note creation fails
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
      sastIncludesSca,
      dastTool,
      dastIntegrationLevel,
      scaTool,
      scaIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
      appFirewallNA,
      currentVersion,
      deploymentEnvironment,
      gitBranch,
      lastDastScanDate,
      lastSastScanDate,
      lastScaScanDate,
    } = req.body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Application name is required' });
    }

    // Determine company ID
    let finalCompanyId = companyId;
    if (!finalCompanyId) {
      const auth = getAuthContext(req);
      if (auth?.companyId) {
        finalCompanyId = auth.companyId;
      } else {
        return res.status(400).json({ error: 'Company is required' });
      }
    }

    // Check if user has access to this company
    const auth = getAuthContext(req);
    if (!(await can(req, 'application.create', finalCompanyId))) {
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
          // Give the placeholder a v1 so its history starts from a real
          // baseline instead of diffing the first edit against nothing.
          await createApplicationVersion(interfaceApp.id, getAuthContext(req)?.userId || null, 'auto_created');
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
        businessCriticality: parseBusinessCriticality(businessCriticality),
        criticalAspects: criticalAspectsStr,
        devTeamContact: devTeamContact?.trim() || null,
        securityTestingDescription: securityTestingDescription?.trim() || null,
        additionalNotes: additionalNotes?.trim() || null,
        sastTool: sastTool?.trim() || null,
        sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null,
        sastIncludesSca: sastIncludesSca === true || sastIncludesSca === 'true',
        dastTool: dastTool?.trim() || null,
        dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null,
        scaTool: scaTool?.trim() || null,
        scaIntegrationLevel: scaIntegrationLevel ? parseInt(scaIntegrationLevel) : null,
        appFirewallTool: appFirewallTool?.trim() || null,
        appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null,
        apiSecurityTool: apiSecurityTool?.trim() || null,
        apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null,
        apiSecurityNA: apiSecurityNA || false,
        appFirewallNA: appFirewallNA || false,
        currentVersion: currentVersion?.trim() || null,
        deploymentEnvironment: deploymentEnvironment?.trim() || null,
        gitBranch: gitBranch?.trim() || null,
        lastDastScanDate: lastDastScanDate ? new Date(lastDastScanDate) : null,
        lastSastScanDate: lastSastScanDate ? new Date(lastSastScanDate) : null,
        lastScaScanDate: lastScaScanDate ? new Date(lastScaScanDate) : null,
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

    // Create initial version
    await createApplicationVersion(
      application.id,
      getAuthContext(req)?.userId || null,
      resolveChangeSource(req, 'web_form')
    );

    res.status(201).json(application);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: 'Invalid application data', message: error.message });
    }
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
      companyId,
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
      sastIncludesSca,
      dastTool,
      dastIntegrationLevel,
      scaTool,
      scaIntegrationLevel,
      appFirewallTool,
      appFirewallIntegrationLevel,
      apiSecurityTool,
      apiSecurityIntegrationLevel,
      apiSecurityNA,
      appFirewallNA,
      status,
      currentVersion,
      deploymentEnvironment,
      gitBranch,
      lastDastScanDate,
      lastSastScanDate,
      lastScaScanDate,
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
    const auth = getAuthContext(req);
    if (!(await can(req, 'application.edit', existing.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only update applications in your company',
      });
    }

    let finalCompanyId = existing.companyId;
    let targetCompany = existing.company;
    const isCompanyChanging = companyId !== undefined && companyId !== existing.companyId;

    if (companyId !== undefined) {
      // Moving an application between companies is a system-admin action: it
      // takes the record out of reach of everyone scoped to the old company.
      if (isCompanyChanging && !auth.isAdmin) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Only admins can change an application company',
        });
      }

      if (!companyId || typeof companyId !== 'string' || companyId.trim() === '') {
        return res.status(400).json({ error: 'Company is required' });
      }

      targetCompany = await prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!targetCompany) {
        return res.status(404).json({ error: 'Company not found' });
      }

      finalCompanyId = targetCompany.id;
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
              companyId: finalCompanyId,
            },
          });

          if (!interfaceApp) {
            interfaceApp = await prisma.application.create({
              data: {
                name: interfaceName.trim(),
                companyId: finalCompanyId,
                description: `Auto-created interface application`,
                status: 'onboarded',
              },
            });
            // Give the placeholder a v1 so its history starts from a real
            // baseline instead of diffing the first edit against nothing.
            await createApplicationVersion(interfaceApp.id, getAuthContext(req)?.userId || null, 'auto_created');
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
        ...(companyId !== undefined && { companyId: finalCompanyId }),
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
        ...(businessCriticality !== undefined && { businessCriticality: parseBusinessCriticality(businessCriticality) }),
        ...(criticalAspects !== undefined && { criticalAspects: criticalAspectsStr }),
        ...(devTeamContact !== undefined && { devTeamContact: devTeamContact?.trim() || null }),
        ...(securityTestingDescription !== undefined && { securityTestingDescription: securityTestingDescription?.trim() || null }),
        ...(additionalNotes !== undefined && { additionalNotes: additionalNotes?.trim() || null }),
        ...(sastTool !== undefined && { sastTool: sastTool?.trim() || null }),
        ...(sastIntegrationLevel !== undefined && { sastIntegrationLevel: sastIntegrationLevel ? parseInt(sastIntegrationLevel) : null }),
        ...(sastIncludesSca !== undefined && {
          sastIncludesSca: sastIncludesSca === true || sastIncludesSca === 'true',
        }),
        ...(dastTool !== undefined && { dastTool: dastTool?.trim() || null }),
        ...(dastIntegrationLevel !== undefined && { dastIntegrationLevel: dastIntegrationLevel ? parseInt(dastIntegrationLevel) : null }),
        ...(scaTool !== undefined && { scaTool: scaTool?.trim() || null }),
        ...(scaIntegrationLevel !== undefined && { scaIntegrationLevel: scaIntegrationLevel ? parseInt(scaIntegrationLevel) : null }),
        ...(appFirewallTool !== undefined && { appFirewallTool: appFirewallTool?.trim() || null }),
        ...(appFirewallIntegrationLevel !== undefined && { appFirewallIntegrationLevel: appFirewallIntegrationLevel ? parseInt(appFirewallIntegrationLevel) : null }),
        ...(apiSecurityTool !== undefined && { apiSecurityTool: apiSecurityTool?.trim() || null }),
        ...(apiSecurityIntegrationLevel !== undefined && { apiSecurityIntegrationLevel: apiSecurityIntegrationLevel ? parseInt(apiSecurityIntegrationLevel) : null }),
        ...(apiSecurityNA !== undefined && { apiSecurityNA: apiSecurityNA }),
        ...(appFirewallNA !== undefined && { appFirewallNA: appFirewallNA }),
        ...(currentVersion !== undefined && { currentVersion: currentVersion?.trim() || null }),
        ...(deploymentEnvironment !== undefined && { deploymentEnvironment: deploymentEnvironment?.trim() || null }),
        ...(gitBranch !== undefined && { gitBranch: gitBranch?.trim() || null }),
        ...(lastDastScanDate !== undefined && { lastDastScanDate: lastDastScanDate ? new Date(lastDastScanDate) : null }),
        ...(lastSastScanDate !== undefined && { lastSastScanDate: lastSastScanDate ? new Date(lastSastScanDate) : null }),
        ...(lastScaScanDate !== undefined && { lastScaScanDate: lastScaScanDate ? new Date(lastScaScanDate) : null }),
        ...(status !== undefined && { status }),
      },
      include: {
        company: true,
      },
    });

    if (isCompanyChanging) {
      try {
        await prisma.applicationDomain.deleteMany({
          where: {
            applicationId: application.id,
            domain: {
              companyId: {
                not: finalCompanyId,
              },
            },
          },
        });

        await prisma.applicationDeploymentToken.deleteMany({
          where: {
            applicationId: application.id,
            token: {
              companyId: {
                not: finalCompanyId,
              },
            },
          },
        });

        await prisma.productApplication.deleteMany({
          where: {
            applicationId: application.id,
            product: {
              companyId: {
                not: finalCompanyId,
              },
            },
          },
        });

        await prisma.productIngressPoint.deleteMany({
          where: {
            applicationId: application.id,
            product: {
              companyId: {
                not: finalCompanyId,
              },
            },
          },
        });

        await prisma.productDataFlow.deleteMany({
          where: {
            OR: [
              { sourceApplicationId: application.id },
              { targetApplicationId: application.id },
            ],
            product: {
              companyId: {
                not: finalCompanyId,
              },
            },
          },
        });

        const noteContent = `Application moved from ${existing.company.name} to ${targetCompany.name}. Company-scoped domains, deployment tokens, and product mappings from the previous company were removed.`;
        await createNote(getAuthContext(req)?.userId, noteContent, null, application.id);
      } catch (error) {
        console.error('Error cleaning up company-scoped application links:', error);
      }
    }

    // Update reciprocal interfaces if interfaces were changed. Counterpart apps
    // get their own version snapshot inside the helper — the write lands on their
    // metadata, so it belongs in their history too.
    if (interfaces !== undefined) {
      await syncReciprocalInterfaces({
        currentAppId: application.id,
        nextInterfaceIds: interfaceAppIds,
        previousInterfaceIds: parseInterfaceIds(existing.interfaces),
        userId: getAuthContext(req)?.userId || null,
        changeSource: 'interface_link',
      });
    }

    // Recalculate and save score after update
    try {
      // Fetch application with deployments for scoring
      const appWithDeployments = await prisma.application.findUnique({
        where: { id: application.id },
        include: SCORING_INCLUDE,
      });
      const scores = calculateApplicationScore(appWithDeployments);
      await recordScoreIfChanged(application.id, scores);
    } catch (error) {
      console.error('Error saving score after update:', error);
    }

    // Create version snapshot after update
    await createApplicationVersion(
      application.id,
      getAuthContext(req)?.userId || null,
      resolveChangeSource(req, 'web_form')
    );

    res.json(application);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: 'Invalid application data', message: error.message });
    }
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Split an application in two: rename the original and create a second application
// alongside it, optionally carrying over the original's metadata. Only scalar
// metadata is copied — see utils/applicationSplitFields.js for what that covers.
router.post('/:id/split', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { originalName, newName, metadataMode = 'all', fields } = req.body;

    const existing = await prisma.application.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const auth = getAuthContext(req);
    if (!(await can(req, 'application.edit', existing.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only split applications in your company',
      });
    }

    const finalOriginalName =
      typeof originalName === 'string' && originalName.trim() ? originalName.trim() : existing.name;
    const finalNewName = typeof newName === 'string' ? newName.trim() : '';

    if (!finalNewName) {
      return res.status(400).json({ error: 'A name for the new application is required' });
    }

    if (finalNewName.toLowerCase() === finalOriginalName.toLowerCase()) {
      return res.status(400).json({
        error: 'The new application must have a different name than the original',
      });
    }

    if (!SPLIT_METADATA_MODES.includes(metadataMode)) {
      return res.status(400).json({
        error: `metadataMode must be one of: ${SPLIT_METADATA_MODES.join(', ')}`,
      });
    }

    let fieldsToCopy = [];
    if (metadataMode === 'all') {
      fieldsToCopy = [...SPLITTABLE_METADATA_FIELDS];
    } else if (metadataMode === 'selected') {
      if (!Array.isArray(fields)) {
        return res.status(400).json({
          error: 'fields must be an array of metadata field names when metadataMode is "selected"',
        });
      }
      const unknownFields = fields.filter((field) => !SPLITTABLE_METADATA_FIELD_SET.has(field));
      if (unknownFields.length > 0) {
        return res.status(400).json({
          error: 'Unknown metadata field(s) requested',
          message: `These fields cannot be copied by a split: ${unknownFields.join(', ')}`,
        });
      }
      // De-duplicate so a repeated field name can't blow up the copy
      fieldsToCopy = [...new Set(fields)];
    }

    // Neither half of the split may collide with another application in the company
    const nameConflict = await prisma.application.findFirst({
      where: {
        companyId: existing.companyId,
        id: { not: id },
        OR: [
          { name: { equals: finalOriginalName, mode: 'insensitive' } },
          { name: { equals: finalNewName, mode: 'insensitive' } },
        ],
      },
      select: { name: true },
    });

    if (nameConflict) {
      return res.status(409).json({
        error: 'Application name already in use',
        message: `Another application in this company is already named "${nameConflict.name}"`,
      });
    }

    const copiedMetadata = {};
    for (const field of fieldsToCopy) {
      copiedMetadata[field] = existing[field];
    }

    const { original, created } = await prisma.$transaction(async (tx) => {
      const updatedOriginal = await tx.application.update({
        where: { id },
        data: { name: finalOriginalName },
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
      });

      const newApplication = await tx.application.create({
        data: {
          ...copiedMetadata,
          name: finalNewName,
          companyId: existing.companyId,
          status: existing.status,
        },
        include: {
          company: {
            select: { id: true, name: true },
          },
        },
      });

      return { original: updatedOriginal, created: newApplication };
    });

    const changeSource = auth?.authType === 'apiKey' ? 'api' : 'web_form';
    await createApplicationVersion(original.id, auth?.userId || null, changeSource);
    await createApplicationVersion(created.id, auth?.userId || null, changeSource);

    let metadataSummary;
    if (metadataMode === 'all') {
      metadataSummary = 'All metadata was copied to the new application.';
    } else if (metadataMode === 'none') {
      metadataSummary = 'No metadata was copied to the new application.';
    } else {
      metadataSummary = fieldsToCopy.length
        ? `Metadata copied to the new application: ${fieldsToCopy.join(', ')}.`
        : 'No metadata was copied to the new application.';
    }

    const renameNote =
      finalOriginalName === existing.name
        ? ''
        : ` This application was renamed from "${existing.name}" to "${finalOriginalName}" as part of the split.`;

    await createNote(
      auth?.userId,
      `Application split: "${created.name}" was created from this application.${renameNote} ${metadataSummary} Domains, deployments, product links, interfaces, threat model and API schema stayed with this application.`,
      null,
      original.id
    );

    await createNote(
      auth?.userId,
      `Created by splitting "${existing.name}" (now "${original.name}"). ${metadataSummary}`,
      null,
      created.id
    );

    res.status(201).json({
      application: original,
      newApplication: created,
      copiedFields: fieldsToCopy,
    });
  } catch (error) {
    console.error('Error splitting application:', error);
    res.status(500).json({ error: 'Failed to split application' });
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

    // Narrow to the requested company, else to everything the caller can read.
    const scope = await companyScopeFilter(req, 'application.read');
    if (!scope) {
      return res.json([]);
    }
    Object.assign(whereClause, scope);
    if (companyId) {
      whereClause.AND = [...(whereClause.AND ?? []), { companyId }];
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

    if (!(await can(req, 'domain.edit', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only modify applications in your company',
      });
    }

    // Normalize domain name
    const normalizedDomain = normalizeDomain(domainName);

    // Find or create domain within the company
    let domain = await prisma.domain.findFirst({
      where: {
        companyId: application.companyId,
        name: {
          equals: normalizedDomain,
          mode: 'insensitive',
        },
      },
    });

    if (!domain) {
      // Create new domain
      domain = await prisma.domain.create({
        data: {
          name: normalizedDomain,
          apexDomain: getApexDomain(normalizedDomain),
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

    // Validate required fields
    if (!companyId) {
      return res.status(400).json({ error: 'Company ID is required' });
    }

    if (!applications || !Array.isArray(applications) || applications.length === 0) {
      return res.status(400).json({ error: 'Applications array is required and must not be empty' });
    }

    if (!(await can(req, 'application.create', companyId))) {
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
        if (app.hostingDomains || app.domains) {
          const domainString = String(app.hostingDomains || app.domains).trim();
          if (domainString) {
            // Split by comma, semicolon, or newline, then clean up each domain
            const domains = domainString
              .split(/[,;\n]/)
              .map(domain => domain.trim())
              .filter(domain => domain.length > 0);
            
            // Validate and normalize each domain
            for (const domain of domains) {
              // Remove http://, https://, and www. if present
              let cleanDomain = domain
                .replace(/^https?:\/\//, '')
                .replace(/^www\./, '')
                .split('/')[0] // Remove path if present
                .trim();
              
              if (cleanDomain && isValidDomain(cleanDomain)) {
                const normalized = normalizeDomain(cleanDomain);
                domainNames.push(normalized);
              }
            }
          }
        }
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
          businessCriticality: parseBusinessCriticality(app.businessCriticality),
          criticalAspects: criticalAspects,
          devTeamContact: app.devTeamContact?.trim() || null,
          securityTestingDescription: app.securityTestingDescription?.trim() || null,
          additionalNotes: app.additionalNotes?.trim() || null,
          sastTool: app.sastTool?.trim() || null,
          sastIntegrationLevel: app.sastIntegrationLevel ? parseInt(app.sastIntegrationLevel) : null,
          sastIncludesSca: app.sastIncludesSca === true || app.sastIncludesSca === 'true',
          dastTool: app.dastTool?.trim() || null,
          dastIntegrationLevel: app.dastIntegrationLevel ? parseInt(app.dastIntegrationLevel) : null,
          scaTool: app.scaTool?.trim() || null,
          scaIntegrationLevel: app.scaIntegrationLevel ? parseInt(app.scaIntegrationLevel) : null,
          appFirewallTool: app.appFirewallTool?.trim() || null,
          appFirewallIntegrationLevel: app.appFirewallIntegrationLevel ? parseInt(app.appFirewallIntegrationLevel) : null,
          apiSecurityTool: app.apiSecurityTool?.trim() || null,
          apiSecurityIntegrationLevel: app.apiSecurityIntegrationLevel ? parseInt(app.apiSecurityIntegrationLevel) : null,
          apiSecurityNA: app.apiSecurityNA || false,
          appFirewallNA: app.appFirewallNA || false,
          status: 'onboarded',
        };

        const created = await prisma.application.create({
          data: dbData,
        });

        // Associate hosting domains with the application
        if (domainNames.length > 0) {
          for (const domainName of domainNames) {
            try {
              // Find or create domain within the company
              let domain = await prisma.domain.findFirst({
                where: {
                  companyId: companyId,
                  name: {
                    equals: domainName,
                    mode: 'insensitive',
                  },
                },
              });

              if (!domain) {
                domain = await prisma.domain.create({
                  data: {
                    name: domainName,
                    apexDomain: getApexDomain(domainName),
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

        return created;
      })
    );

    // Create automatic note for bulk import
    try {
      const appNames = createdApplications.map(app => app.name).join(', ');
      
      // Get field names that were provided in the bulk import
      // Check the first application as a representative sample
      const firstApp = applications[0];
      const fieldMapping = {
        name: 'Name',
        description: 'Description',
        owner: 'Owner',
        repoUrl: 'Repository URL',
        language: 'Language',
        framework: 'Framework',
        serverEnvironment: 'Server Environment',
        facing: 'Facing',
        deploymentType: 'Deployment Type',
        authProfiles: 'Auth Profiles',
        dataTypes: 'Data Types',
        interfaces: 'Interfaces',
        businessCriticality: 'Business Criticality',
        criticalAspects: 'Critical Aspects',
        devTeamContact: 'Dev Team Contact',
        securityTestingDescription: 'Security Testing Description',
        additionalNotes: 'Additional Notes',
        sastTool: 'SAST Tool',
        sastIntegrationLevel: 'SAST Integration Level',
        sastIncludesSca: 'SAST includes SCA',
        dastTool: 'DAST Tool',
        dastIntegrationLevel: 'DAST Integration Level',
        scaTool: 'SCA Tool',
        scaIntegrationLevel: 'SCA Integration Level',
        appFirewallTool: 'App Firewall Tool',
        appFirewallIntegrationLevel: 'App Firewall Integration Level',
        apiSecurityTool: 'Legacy API Security Tool',
        apiSecurityIntegrationLevel: 'Legacy API Security Integration Level',
        apiSecurityNA: 'API Security N/A',
        appFirewallNA: 'App Firewall N/A',
        hostingDomains: 'Hosting Domains',
        domains: 'Domains',
      };
      
      const providedFields = getProvidedFields(firstApp, fieldMapping);
      
      const noteContent = `Bulk application upload completed. Created ${createdApplications.length} application(s): ${appNames}. Fields provided in upload: ${providedFields.join(', ')}.`;
      
      await createNote(getAuthContext(req)?.userId, noteContent, companyId, null);
    } catch (error) {
      console.error('Error creating note for bulk import:', error);
      // Don't fail the request if note creation fails
    }

    // Create initial versions for all bulk imported applications
    for (const app of createdApplications) {
      await createApplicationVersion(app.id, getAuthContext(req)?.userId || null, 'bulk_import');
    }

    console.log(
      `Bulk import: created ${createdApplications.length} application(s) for company ${companyId}`,
    );

    res.status(201).json({
      count: createdApplications.length,
      applications: createdApplications,
      message: `Successfully imported ${createdApplications.length} application(s)`,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: 'Invalid application data', message: error.message });
    }
    console.error('Bulk import failed:', error);
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

    if (!(await can(req, 'application.edit', application.companyId))) {
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
router.delete('/:id/domains/:domainId', requireAuth, requirePermission('domain.delete', companyFrom.application('id')), async (req, res) => {
  try {
    const { id, domainId } = req.params;

    // Get application and check access
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'domain.delete', application.companyId))) {
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

// Get all deployments for an application
router.get('/:id/deployments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if application exists and user has access
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'deployment.read', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only access deployments for applications in your company',
      });
    }

    // Get deployments ordered by most recent first
    const deployments = await prisma.deployment.findMany({
      where: { applicationId: id },
      orderBy: { deployedAt: 'desc' },
    });

    res.json(deployments);
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// Create a new deployment
router.post('/:id/deployments', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { deployedAt, environment, version, gitBranch, deployedBy, notes } = req.body;

    // Validate required fields
    if (!environment || !environment.trim()) {
      return res.status(400).json({ error: 'Environment is required' });
    }

    // Check if application exists and user has access
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'deployment.manage', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only create deployments for applications in your company',
      });
    }

    // Create deployment
    const deployment = await prisma.deployment.create({
      data: {
        applicationId: id,
        deployedAt: deployedAt ? new Date(deployedAt) : new Date(),
        environment: environment.trim(),
        version: version?.trim() || null,
        gitBranch: gitBranch?.trim() || null,
        deployedBy: deployedBy?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    // Auto-update application's current deployment info from this new deployment
    // Only update if the fields are currently null/empty (meaning they should be auto-populated)
    const currentApp = await prisma.application.findUnique({
      where: { id },
      select: { currentVersion: true, deploymentEnvironment: true, gitBranch: true },
    });

    const updateData = {};
    if (!currentApp.currentVersion && deployment.version) {
      updateData.currentVersion = deployment.version;
    }
    if (!currentApp.deploymentEnvironment && deployment.environment) {
      updateData.deploymentEnvironment = deployment.environment;
    }
    if (!currentApp.gitBranch && deployment.gitBranch) {
      updateData.gitBranch = deployment.gitBranch;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.application.update({
        where: { id },
        data: updateData,
      });
      // currentVersion / deploymentEnvironment / gitBranch are versioned metadata,
      // so auto-populating them from a deployment belongs in the history.
      await createApplicationVersion(id, getAuthContext(req)?.userId || null, 'deployment');
    }

    res.status(201).json(deployment);
  } catch (error) {
    console.error('Error creating deployment:', error);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

// Delete a deployment
router.delete('/:id/deployments/:deploymentId', requireAuth, requirePermission('deployment.delete', companyFrom.application('id')), async (req, res) => {
  try {
    const { id, deploymentId } = req.params;

    // Check if deployment exists
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        application: true,
      },
    });

    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    // Verify deployment belongs to the application
    if (deployment.applicationId !== id) {
      return res.status(400).json({ error: 'Deployment does not belong to this application' });
    }

    if (!(await can(req, 'deployment.manage', deployment.application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only delete deployments for applications in your company',
      });
    }

    // Delete deployment
    await prisma.deployment.delete({
      where: { id: deploymentId },
    });

    res.json({ message: 'Deployment deleted successfully' });
  } catch (error) {
    console.error('Error deleting deployment:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

// ============================================================================
// DEPLOYMENT TOKEN MANAGEMENT
// ============================================================================

// Create a deployment token for an application
// POST /api/applications/:id/deployment-tokens
router.post('/:id/deployment-tokens', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    // Check if application exists
    const application = await prisma.application.findUnique({
      where: { id },
      include: { company: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'deployment.manage', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only create deployment tokens for applications in your company',
      });
    }

    // Generate token
    const plaintextToken = generateDeploymentToken();
    const tokenHash = await hashDeploymentToken(plaintextToken);

    // Create token
    const token = await prisma.deploymentToken.create({
      data: {
        token: plaintextToken, // Store plaintext for display (as per schema)
        tokenHash: tokenHash, // Store hash for verification
        name: name?.trim() || null,
        createdBy: getAuthContext(req)?.userId || null,
        companyId: application.companyId,
        applications: {
          create: {
            applicationId: id,
          },
        },
      },
      include: {
        applications: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(201).json({
      ...token,
      // Token is already in the response from the create
    });
  } catch (error) {
    console.error('Error creating deployment token:', error);
    res.status(500).json({ error: 'Failed to create deployment token' });
  }
});

// List deployment tokens for an application
// GET /api/applications/:id/deployment-tokens
router.get('/:id/deployment-tokens', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if application exists
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (!(await can(req, 'deployment.read', application.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You can only view deployment tokens for applications in your company',
      });
    }

    // Get tokens for this application
    const tokens = await prisma.deploymentToken.findMany({
      where: {
        applications: {
          some: {
            applicationId: id,
          },
        },
        companyId: application.companyId,
      },
      include: {
        applications: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tokens);
  } catch (error) {
    console.error('Error fetching deployment tokens:', error);
    res.status(500).json({ error: 'Failed to fetch deployment tokens' });
  }
});

// ============================================================================
// VERSION HISTORY (system admin only)
// ============================================================================

// Global pending versions endpoints (must come before :id routes)
router.get('/versions/pending/count', requireAuth, requireAdmin, async (req, res) => {
  try {
    const count = await prisma.applicationVersion.count({
      where: {
        approvalStatus: 'pending',
      },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching pending versions count:', error);
    res.status(500).json({ error: 'Failed to fetch pending versions count' });
  }
});

router.get('/versions/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const pendingVersions = await prisma.applicationVersion.findMany({
      where: {
        approvalStatus: 'pending',
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            company: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    res.json(pendingVersions);
  } catch (error) {
    console.error('Error fetching pending versions:', error);
    res.status(500).json({ error: 'Failed to fetch pending versions' });
  }
});

// Application-specific version routes (most specific first to avoid route conflicts)
router.get('/:id/versions/pending/count', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    const count = await prisma.applicationVersion.count({
      where: {
        applicationId: id,
        approvalStatus: 'pending',
      },
    });
    res.json({ count });
  } catch (error) {
    console.error('Error fetching pending versions count for application:', error);
    res.status(500).json({ error: 'Failed to fetch pending versions count' });
  }
});

router.get('/:id/versions/compare/:v1/:v2', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, v1, v2 } = req.params;
    const version1Num = parseInt(v1);
    const version2Num = parseInt(v2);

    if (isNaN(version1Num) || isNaN(version2Num)) {
      return res.status(400).json({ error: 'Invalid version numbers' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get both versions
    const [version1, version2] = await Promise.all([
      prisma.applicationVersion.findFirst({
        where: {
          applicationId: id,
          versionNumber: version1Num,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.applicationVersion.findFirst({
        where: {
          applicationId: id,
          versionNumber: version2Num,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    if (!version1 || !version2) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    // Import compare function
    const { compareVersions } = await import('../utils/applicationVersion.js');
    const comparison = compareVersions(version1, version2);

    res.json({
      version1,
      version2,
      comparison,
    });
  } catch (error) {
    console.error('Error comparing application versions:', error);
    res.status(500).json({ error: 'Failed to compare application versions' });
  }
});

// Get version history for an application
router.get('/:id/versions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get all versions ordered by version number (descending - newest first)
    const versions = await prisma.applicationVersion.findMany({
      where: { applicationId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        approver: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });

    res.json(versions);
  } catch (error) {
    console.error('Error fetching application versions:', error);
    res.status(500).json({ error: 'Failed to fetch application versions' });
  }
});

// Get a specific version by version number
router.get('/:id/versions/:versionNumber', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, versionNumber } = req.params;
    const versionNum = parseInt(versionNumber);

    if (isNaN(versionNum)) {
      return res.status(400).json({ error: 'Invalid version number' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get the specific version
    const version = await prisma.applicationVersion.findFirst({
      where: {
        applicationId: id,
        versionNumber: versionNum,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    res.json(version);
  } catch (error) {
    console.error('Error fetching application version:', error);
    res.status(500).json({ error: 'Failed to fetch application version' });
  }
});

// Compare two versions
router.get('/:id/versions/compare/:v1/:v2', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, v1, v2 } = req.params;
    const version1Num = parseInt(v1);
    const version2Num = parseInt(v2);

    if (isNaN(version1Num) || isNaN(version2Num)) {
      return res.status(400).json({ error: 'Invalid version numbers' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get both versions
    const [version1, version2] = await Promise.all([
      prisma.applicationVersion.findFirst({
        where: {
          applicationId: id,
          versionNumber: version1Num,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
      prisma.applicationVersion.findFirst({
        where: {
          applicationId: id,
          versionNumber: version2Num,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),
    ]);

    if (!version1 || !version2) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    // Import compare function
    const { compareVersions } = await import('../utils/applicationVersion.js');
    const comparison = compareVersions(version1, version2);

    res.json({
      version1,
      version2,
      comparison,
    });
  } catch (error) {
    console.error('Error comparing application versions:', error);
    res.status(500).json({ error: 'Failed to compare application versions' });
  }
});

// ============================================================================
// REVIEW HISTORY (Admin only)
// ============================================================================

// Get review history for an application
router.get('/:id/reviews', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get all reviews ordered by review date (newest first)
    const reviews = await prisma.applicationMetadataReview.findMany({
      where: { applicationId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { reviewedAt: 'desc' },
    });

    res.json(reviews);
  } catch (error) {
    console.error('Error fetching application reviews:', error);
    res.status(500).json({ error: 'Failed to fetch application reviews' });
  }
});

// Approve or reject a version (Admin only)
router.post('/:id/versions/:versionId/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const { action, approvedFields, rejectionReason, approvalNotes } = req.body; // action: 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    // Verify application exists
    const application = await prisma.application.findUnique({
      where: { id },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Get the version
    const version = await prisma.applicationVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.applicationId !== id) {
      return res.status(404).json({ error: 'Version not found' });
    }

    if (version.approvalStatus !== 'pending') {
      return res.status(400).json({ error: 'Version is not pending approval' });
    }

    if (action === 'approve') {
      // Update version status
      const approvedFieldsStr = approvedFields && Array.isArray(approvedFields) 
        ? approvedFields.join(',') 
        : null;

      await prisma.applicationVersion.update({
        where: { id: versionId },
        data: {
          approvalStatus: 'approved',
          approvedBy: getAuthContext(req)?.userId,
          approvedAt: new Date(),
          approvedFields: approvedFieldsStr,
          approvalNotes: approvalNotes?.trim() || null,
        },
      });

      // Apply approved fields to the application
      const fieldsToApply = approvedFields && Array.isArray(approvedFields) && approvedFields.length > 0
        ? approvedFields
        : null; // null means apply all fields

      await applyApprovedVersion(id, version, fieldsToApply);

      // Handle reciprocal interfaces if interfaces were approved. Add-only here:
      // approving a version links the counterparts it names, it does not unlink
      // ones the pending version happened to omit.
      if (!fieldsToApply || fieldsToApply.includes('interfaces')) {
        await syncReciprocalInterfaces({
          currentAppId: application.id,
          nextInterfaceIds: parseInterfaceIds(version.interfaces),
          previousInterfaceIds: [],
          userId: getAuthContext(req)?.userId || null,
          changeSource: 'interface_link',
        });
      }

      // Recalculate and save score after update
      try {
        const appWithDeployments = await prisma.application.findUnique({
          where: { id },
          include: SCORING_INCLUDE,
        });
        const scores = calculateApplicationScore(appWithDeployments);
        await recordScoreIfChanged(id, scores);
      } catch (error) {
        console.error('Error saving score after approval:', error);
      }

      // Create automatic note
      try {
        const auth = getAuthContext(req);
        const approver = await prisma.user.findUnique({
          where: { id: auth?.userId },
          select: { email: true },
        });
        const fieldsStr = approvedFieldsStr || 'all fields';
        const notesStr = approvalNotes ? ` Notes: ${approvalNotes}.` : '';
        const noteContent = `Version ${version.versionNumber} approved by ${approver?.email || 'Unknown'}. Approved fields: ${fieldsStr}.${notesStr}`;
        await createNote(auth?.userId, noteContent, null, id);
      } catch (error) {
        console.error('Error creating note for approval:', error);
      }

      res.json({
        message: 'Version approved and applied successfully',
        version: await prisma.applicationVersion.findUnique({
          where: { id: versionId },
          include: {
            user: { select: { id: true, email: true } },
            approver: { select: { id: true, email: true } },
          },
        }),
      });
    } else {
      // Reject the version
      await prisma.applicationVersion.update({
        where: { id: versionId },
        data: {
          approvalStatus: 'rejected',
          approvedBy: getAuthContext(req)?.userId,
          approvedAt: new Date(),
          rejectionReason: rejectionReason?.trim() || null,
        },
      });

      // Create automatic note
      try {
        const auth = getAuthContext(req);
        const approver = await prisma.user.findUnique({
          where: { id: auth?.userId },
          select: { email: true },
        });
        const reasonStr = rejectionReason ? ` Reason: ${rejectionReason}` : '';
        const noteContent = `Version ${version.versionNumber} rejected by ${approver?.email || 'Unknown'}.${reasonStr}`;
        await createNote(auth?.userId, noteContent, null, id);
      } catch (error) {
        console.error('Error creating note for rejection:', error);
      }

      res.json({
        message: 'Version rejected successfully',
        version: await prisma.applicationVersion.findUnique({
          where: { id: versionId },
          include: {
            user: { select: { id: true, email: true } },
            approver: { select: { id: true, email: true } },
          },
        }),
      });
    }
  } catch (error) {
    console.error('Error approving/rejecting version:', error);
    res.status(500).json({ error: 'Failed to approve/reject version' });
  }
});

export default router;
