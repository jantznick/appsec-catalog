import { prisma } from '../prisma/client.js';
import {
  APPROVABLE_METADATA_FIELDS,
  compareVersions,
  isApprovableMetadataField,
  pickVersionedMetadata,
} from '../services/applicationFields.js';

// Re-exported so existing importers keep working. The implementation lives in
// services/applicationFields.js, which imports no Prisma and is therefore unit
// testable; this module cannot be.
export { compareVersions };

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
        // Every metadata field, from the single registry. metadataLastReviewed is
        // deliberately not part of a snapshot.
        ...pickVersionedMetadata(application),
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
        // currentVersion, gitBranch and deploymentEnvironment are not here any more.
        // The first two live on ApplicationEnvironment and are versioned:false; the
        // third was deleted with its column. Writing them would throw on a column
        // that no longer exists, and createApplicationVersion swallows that error and
        // returns null — so version history and the pending-approval queue would stop
        // working silently rather than loudly.
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

    // null/undefined means "apply every approvable field"; an explicit list means only
    // those. An empty array therefore applies nothing, which is deliberate — approving
    // zero fields must not be read as approving all of them.
    const requestedFields = approvedFields || APPROVABLE_METADATA_FIELDS;

    // Derived fields are never applied, even if a caller names them explicitly. Their
    // value in a snapshot is a historical record, not something to write back: applying
    // an old scan date over the current one would silently regress the freshness
    // component of the tool score.
    const fieldsToApply = requestedFields.filter(isApprovableMetadataField);

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

