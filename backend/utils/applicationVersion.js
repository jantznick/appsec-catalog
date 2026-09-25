import { prisma } from '../prisma/client.js';
import {
  APPROVABLE_METADATA_FIELDS,
  compareVersions,
  pickVersionedMetadata,
} from '../services/applicationFields.js';
import {
  parseSubmittedFields,
  resolveFieldsToApply,
  serializeSubmittedFields,
} from '../services/versionSubmission.js';

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
/**
 * Create a pending version from a form submission.
 *
 * `versionData` must already be a COMPLETE snapshot (see buildSubmission): every
 * metadata field, with the submitted values spread over the application's current ones.
 * No coercion happens here — it happened per-field against the registry's declared type,
 * which is what lets a submitted-but-empty field arrive as a deliberate null instead of
 * being turned back into the stored value.
 *
 * @param {string} applicationId
 * @param {Object} versionData Complete metadata snapshot.
 * @param {string|null} userId
 * @param {string} changeSource
 * @param {string} status
 * @param {string|null} requesterEmail
 * @param {string[]|null} submittedFields Fields this submission actually carried. Null
 *   records nothing and makes the version behave like a pre-column one on approval.
 * @returns {Promise<Object>} The created version record
 */
export async function createVersionFromData(
  applicationId,
  versionData,
  userId = null,
  changeSource = 'api',
  status = 'pending',
  requesterEmail = null,
  submittedFields = null,
) {
  try {
    const latestVersion = await prisma.applicationVersion.findFirst({
      where: { applicationId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });

    const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    const version = await prisma.applicationVersion.create({
      data: {
        applicationId,
        versionNumber: nextVersionNumber,
        createdBy: userId,
        requesterEmail: requesterEmail?.trim() || null,
        changeSource,
        approvalStatus: status,
        submittedFields: submittedFields ? serializeSubmittedFields(submittedFields) : null,
        // Every metadata field, from the single registry.
        ...pickVersionedMetadata(versionData),
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

    // Three filters, in order:
    //
    //   approvedFields    what the admin ticked (null = everything offered; an explicit
    //                     empty array approves nothing, which must not read as all)
    //   approvable        derived fields are never written back, even if named — applying
    //                     an old scan date would regress the tool score's freshness
    //   submittedFields   only what this submission actually carried, so approving a
    //                     stale version cannot revert a field nobody touched
    //
    // A version predating the submittedFields column parses as null and skips the last
    // filter, preserving the old behaviour for anything already queued.
    const fieldsToApply = resolveFieldsToApply(
      parseSubmittedFields(version.submittedFields),
      approvedFields || null,
      APPROVABLE_METADATA_FIELDS,
    );

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

