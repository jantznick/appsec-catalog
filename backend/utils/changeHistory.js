import { prisma } from '../prisma/client.js';

/**
 * Scalar fields worth diffing per entity type, excluding relations, ids, and timestamps.
 * `Policy` and `PolicyControl` include derived fields (divisionIds/companyIds, fields) that
 * aren't columns on the row itself but are set inline in the same create/update transaction.
 */
export const TRACKED_FIELDS = {
  Application: [
    'name', 'description', 'owner', 'repoUrl', 'companyId', 'language', 'framework',
    'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes', 'status',
    'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
    'dastTool', 'dastIntegrationLevel',
    'scaTool', 'scaIntegrationLevel',
    'appFirewallTool', 'appFirewallIntegrationLevel', 'appFirewallNA',
    'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
    'currentVersion', 'deploymentEnvironment', 'gitBranch',
    'lastSastScanDate', 'lastDastScanDate', 'lastScaScanDate',
    'interfaces', 'businessCriticality', 'criticalAspects', 'devTeamContact',
    'securityTestingDescription', 'additionalNotes', 'metadataLastReviewed',
  ],
  Product: ['name', 'description', 'owner', 'facing', 'status', 'lifecycleStage', 'businessCriticality', 'dataSensitivity', 'complianceNotes'],
  Domain: ['name', 'description', 'owner', 'status', 'apexDomain'],
  Company: ['name', 'slug', 'domains', 'divisionId', 'engManager', 'language', 'framework', 'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes'],
  Policy: ['name', 'description', 'scope', 'isActive', 'displayOrder', 'targetingRules', 'divisionIds', 'companyIds'],
  PolicyControl: ['controlId', 'name', 'description', 'category', 'evaluationLogic', 'isActive', 'displayOrder', 'policyId', 'fields'],
  SammAssessment: ['status', 'ownerName', 'notes', 'reviewerId', 'submittedAt', 'reviewedAt', 'nextDueAt'],
  Note: ['content'],
};

function normalize(field, value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (field.toLowerCase().includes('date') || field === 'submittedAt' || field === 'reviewedAt' || field === 'nextDueAt') {
    return new Date(value).toISOString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort());
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value).trim();
}

/**
 * Compare two plain objects over a fixed set of fields.
 * @returns {{changedFields: string[], diff: Object}}
 */
export function diffEntities(before, after, fields) {
  const changedFields = [];
  const diff = {};

  for (const field of fields) {
    const val1 = before?.[field];
    const val2 = after?.[field];

    if (normalize(field, val1) !== normalize(field, val2)) {
      changedFields.push(field);
      diff[field] = { from: val1 ?? null, to: val2 ?? null };
    }
  }

  return { changedFields, diff };
}

function pick(obj, fields) {
  const result = {};
  for (const field of fields) {
    if (obj?.[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}

/**
 * Record a create/update/delete against the generic ChangeHistory audit trail.
 * Fire-and-forget: never throws, so a logging failure can't break the real write.
 * Skips writing entirely for no-op updates (empty diff).
 *
 * @param {Object} params
 * @param {string} params.entityType - Key into TRACKED_FIELDS (e.g. "Product")
 * @param {string} params.entityId
 * @param {'create'|'update'|'delete'} params.action
 * @param {string|null} [params.userId] - User ID who made the change (null for unauthenticated)
 * @param {string} [params.changeSource] - e.g. "web_form", "api", "bulk_import", "public_form"
 * @param {string|null} [params.companyId] - Denormalized company scope for filtering
 * @param {Object|null} [params.before] - Entity state before the change (update/delete)
 * @param {Object|null} [params.after] - Entity state after the change (create/update)
 * @returns {Promise<Object|null>} The created ChangeHistory row, or null if skipped/failed
 */
export async function recordChange({ entityType, entityId, action, userId = null, changeSource = 'api', companyId = null, before = null, after = null }) {
  try {
    const fields = TRACKED_FIELDS[entityType] || Object.keys(after || before || {});

    let changedFields = null;
    let diff = null;
    let snapshot = null;

    if (action === 'update') {
      const result = diffEntities(before, after, fields);
      if (result.changedFields.length === 0) {
        return null;
      }
      changedFields = result.changedFields;
      diff = result.diff;
    } else if (action === 'create') {
      snapshot = pick(after, fields);
    } else if (action === 'delete') {
      snapshot = pick(before, fields);
    }

    return await prisma.changeHistory.create({
      data: {
        entityType,
        entityId,
        action,
        changedBy: userId,
        changeSource,
        companyId,
        changedFields,
        diff,
        snapshot,
      },
    });
  } catch (error) {
    console.error(`Error recording change history for ${entityType}:${entityId}:`, error);
    return null;
  }
}
