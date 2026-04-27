import { prisma } from '../prisma/client.js';

/**
 * Create a new version snapshot of an application's metadata
 * @param {string} applicationId - The application ID
 * @param {string|null} userId - User ID who made the change (null for system/automated)
 * @param {string} changeSource - Source of the change (e.g., "web_form", "technical_form", "api", "bulk_import", "deployment_token")
 * @param {string} status - Version status: "pending", "approved", "rejected" (default: "approved")
 * @returns {Promise<Object>} The created version record
 */
export async function createApplicationVersion(applicationId, userId = null, changeSource = 'api', status = 'approved') {
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
        approvalStatus: status, // pending, approved, or rejected
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
        sastIncludesSca: application.sastIncludesSca,
        dastTool: application.dastTool,
        dastIntegrationLevel: application.dastIntegrationLevel,
        scaTool: application.scaTool,
        scaIntegrationLevel: application.scaIntegrationLevel,
        appFirewallTool: application.appFirewallTool,
        appFirewallIntegrationLevel: application.appFirewallIntegrationLevel,
        apiSecurityTool: application.apiSecurityTool,
        apiSecurityIntegrationLevel: application.apiSecurityIntegrationLevel,
        apiSecurityNA: application.apiSecurityNA,
        appFirewallNA: application.appFirewallNA,
        currentVersion: application.currentVersion,
        deploymentEnvironment: application.deploymentEnvironment,
        gitBranch: application.gitBranch,
        lastDastScanDate: application.lastDastScanDate,
        lastSastScanDate: application.lastSastScanDate,
        lastScaScanDate: application.lastScaScanDate,
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
    'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
    'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
    'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
    'appFirewallNA',
    'currentVersion', 'deploymentEnvironment', 'gitBranch',
    'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
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

/**
 * Create a version from provided data (for pending versions from forms)
 * @param {string} applicationId - The application ID
 * @param {Object} versionData - The data to store in the version
 * @param {string|null} userId - User ID who made the change
 * @param {string} changeSource - Source of the change
 * @param {string} status - Version status (default: "pending")
 * @returns {Promise<Object>} The created version record
 */
export async function createVersionFromData(applicationId, versionData, userId = null, changeSource = 'api', status = 'pending', requesterEmail = null) {
  try {
    // Get the current highest version number for this application
    const latestVersion = await prisma.applicationVersion.findFirst({
      where: { applicationId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    // Create the version with provided data
    const version = await prisma.applicationVersion.create({
      data: {
        applicationId,
        versionNumber: nextVersionNumber,
        createdBy: userId,
        requesterEmail: requesterEmail?.trim() || null,
        changeSource,
        approvalStatus: status,
        // Store all metadata fields from versionData
        name: versionData.name?.trim() || null,
        description: versionData.description?.trim() || null,
        owner: versionData.owner?.trim() || null,
        repoUrl: versionData.repoUrl?.trim() || null,
        language: versionData.language?.trim() || null,
        framework: versionData.framework?.trim() || null,
        serverEnvironment: versionData.serverEnvironment?.trim() || null,
        facing: versionData.facing?.trim() || null,
        deploymentType: versionData.deploymentType?.trim() || null,
        authProfiles: versionData.authProfiles?.trim() || null,
        dataTypes: versionData.dataTypes?.trim() || null,
        status: versionData.status?.trim() || null, // Application status field (not version status)
        businessCriticality: versionData.businessCriticality ? parseInt(versionData.businessCriticality) : null,
        criticalAspects: versionData.criticalAspects?.trim() || null,
        devTeamContact: versionData.devTeamContact?.trim() || null,
        securityTestingDescription: versionData.securityTestingDescription?.trim() || null,
        additionalNotes: versionData.additionalNotes?.trim() || null,
        sastTool: versionData.sastTool?.trim() || null,
        sastIntegrationLevel: versionData.sastIntegrationLevel ? parseInt(versionData.sastIntegrationLevel) : null,
        sastIncludesSca: versionData.sastIncludesSca === true || versionData.sastIncludesSca === 'true',
        dastTool: versionData.dastTool?.trim() || null,
        dastIntegrationLevel: versionData.dastIntegrationLevel ? parseInt(versionData.dastIntegrationLevel) : null,
        scaTool: versionData.scaTool?.trim() || null,
        scaIntegrationLevel: versionData.scaIntegrationLevel ? parseInt(versionData.scaIntegrationLevel) : null,
        appFirewallTool: versionData.appFirewallTool?.trim() || null,
        appFirewallIntegrationLevel: versionData.appFirewallIntegrationLevel ? parseInt(versionData.appFirewallIntegrationLevel) : null,
        apiSecurityTool: versionData.apiSecurityTool?.trim() || null,
        apiSecurityIntegrationLevel: versionData.apiSecurityIntegrationLevel ? parseInt(versionData.apiSecurityIntegrationLevel) : null,
        apiSecurityNA: versionData.apiSecurityNA || false,
        appFirewallNA: versionData.appFirewallNA || false,
        currentVersion: versionData.currentVersion?.trim() || null,
        deploymentEnvironment: versionData.deploymentEnvironment?.trim() || null,
        gitBranch: versionData.gitBranch?.trim() || null,
        lastDastScanDate: versionData.lastDastScanDate ? new Date(versionData.lastDastScanDate) : null,
        lastSastScanDate: versionData.lastSastScanDate ? new Date(versionData.lastSastScanDate) : null,
        lastScaScanDate: versionData.lastScaScanDate ? new Date(versionData.lastScaScanDate) : null,
        interfaces: versionData.interfaces || null,
      },
    });

    return version;
  } catch (error) {
    console.error('Error creating version from data:', error);
    throw error;
  }
}

/**
 * Apply approved version fields to the application
 * @param {string} applicationId - The application ID
 * @param {Object} version - The approved version object
 * @param {Array<string>|null} approvedFields - Array of field names to apply (null = all fields)
 * @returns {Promise<Object>} The updated application
 */
export async function applyApprovedVersion(applicationId, version, approvedFields = null) {
  try {
    const updateData = {};

    // If approvedFields is null, apply all fields
    // Otherwise, only apply the specified fields
    const fieldsToApply = approvedFields || [
      'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
      'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
      'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
      'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
      'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
      'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
      'appFirewallNA',
      'currentVersion', 'deploymentEnvironment', 'gitBranch',
      'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
    ];

    for (const field of fieldsToApply) {
      if (version[field] !== undefined) {
        updateData[field] = version[field];
      }
    }

    const updated = await prisma.application.update({
      where: { id: applicationId },
      data: updateData,
    });

    return updated;
  } catch (error) {
    console.error('Error applying approved version:', error);
    throw error;
  }
}

