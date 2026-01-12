import { prisma } from '../prisma/client.js';

/**
 * Create a new version snapshot of an application's metadata
 * @param {string} applicationId - The application ID
 * @param {string|null} userId - User ID who made the change (null for system/automated)
 * @param {string} changeSource - Source of the change (e.g., "web_form", "technical_form", "api", "bulk_import", "deployment_token")
 * @returns {Promise<Object>} The created version record
 */
export async function createApplicationVersion(applicationId, userId = null, changeSource = 'api') {
  try {
    // Get the current application state
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new Error(`Application not found: ${applicationId}`);
    }

    // Get the current highest version number for this application
    const latestVersion = await prisma.applicationVersion.findFirst({
      where: { applicationId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Create the version snapshot (excluding metadataLastReviewed as per requirements)
    const version = await prisma.applicationVersion.create({
      data: {
        applicationId,
        versionNumber: nextVersionNumber,
        createdBy: userId,
        changeSource,
        // Copy all metadata fields
        name: application.name,
        description: application.description,
        owner: application.owner,
        repoUrl: application.repoUrl,
        language: application.language,
        framework: application.framework,
        serverEnvironment: application.serverEnvironment,
        facing: application.facing,
        deploymentType: application.deploymentType,
        authProfiles: application.authProfiles,
        dataTypes: application.dataTypes,
        status: application.status,
        businessCriticality: application.businessCriticality,
        criticalAspects: application.criticalAspects,
        devTeamContact: application.devTeamContact,
        securityTestingDescription: application.securityTestingDescription,
        additionalNotes: application.additionalNotes,
        sastTool: application.sastTool,
        sastIntegrationLevel: application.sastIntegrationLevel,
        dastTool: application.dastTool,
        dastIntegrationLevel: application.dastIntegrationLevel,
        appFirewallTool: application.appFirewallTool,
        appFirewallIntegrationLevel: application.appFirewallIntegrationLevel,
        apiSecurityTool: application.apiSecurityTool,
        apiSecurityIntegrationLevel: application.apiSecurityIntegrationLevel,
        apiSecurityNA: application.apiSecurityNA,
        currentVersion: application.currentVersion,
        deploymentEnvironment: application.deploymentEnvironment,
        gitBranch: application.gitBranch,
        lastDastScanDate: application.lastDastScanDate,
        lastSastScanDate: application.lastSastScanDate,
        interfaces: application.interfaces,
      },
    });

    return version;
  } catch (error) {
    console.error('Error creating application version:', error);
    // Don't throw - versioning is supplementary, don't fail the main operation
    return null;
  }
}

/**
 * Compare two versions and return the fields that changed
 * @param {Object} version1 - First version object
 * @param {Object} version2 - Second version object
 * @returns {Object} Object with changedFields array and diff object
 */
export function compareVersions(version1, version2) {
  const changedFields = [];
  const diff = {};

  // List of fields to compare (excluding metadata fields like id, createdAt, etc.)
  const fieldsToCompare = [
    'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
    'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
    'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
    'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel',
    'dastTool', 'dastIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
    'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
    'currentVersion', 'deploymentEnvironment', 'gitBranch',
    'lastDastScanDate', 'lastSastScanDate', 'interfaces',
  ];

  for (const field of fieldsToCompare) {
    const val1 = version1[field];
    const val2 = version2[field];

    // Handle different data types
    let val1Normalized;
    let val2Normalized;

    // Handle dates - compare as ISO strings
    if (field.includes('Date') || field.includes('date')) {
      val1Normalized = val1 ? new Date(val1).toISOString() : null;
      val2Normalized = val2 ? new Date(val2).toISOString() : null;
    }
    // Handle booleans
    else if (typeof val1 === 'boolean' || typeof val2 === 'boolean') {
      val1Normalized = val1 === true ? 'true' : (val1 === false ? 'false' : null);
      val2Normalized = val2 === true ? 'true' : (val2 === false ? 'false' : null);
    }
    // Handle numbers
    else if (typeof val1 === 'number' || typeof val2 === 'number') {
      val1Normalized = val1 !== null && val1 !== undefined ? String(val1) : null;
      val2Normalized = val2 !== null && val2 !== undefined ? String(val2) : null;
    }
    // Handle null/undefined for strings
    else {
      val1Normalized = val1 === null || val1 === undefined ? null : String(val1).trim();
      val2Normalized = val2 === null || val2 === undefined ? null : String(val2).trim();
    }

    // Compare normalized values
    if (val1Normalized !== val2Normalized) {
      changedFields.push(field);
      diff[field] = {
        from: val1,
        to: val2,
      };
    }
  }

  return {
    changedFields,
    diff,
  };
}

