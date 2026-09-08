/**
 * Application metadata fields that a split (POST /api/applications/:id/split) can
 * carry over from the original application to the newly created one.
 *
 * Deliberately NOT in this list:
 *   - `name` / `companyId` — set explicitly by the split itself
 *   - `status` — always copied, so both halves start in the same onboarding state
 *   - `metadataLastReviewed` — the new application has never been reviewed
 *   - relational data — domains, deployments, deployment tokens, product links,
 *     interfaces, contacts, notes, threat model and API schema all stay with the
 *     original application; a split only ever copies scalar metadata.
 */
export const SPLITTABLE_METADATA_FIELDS = [
  // Basic information
  'description',
  'owner',
  'repoUrl',
  'language',
  'framework',
  'serverEnvironment',
  'facing',
  'deploymentType',
  'authProfiles',
  'dataTypes',

  // Business context
  'businessCriticality',
  'criticalAspects',
  'devTeamContact',

  // Security testing & tooling
  'securityTestingDescription',
  'sastTool',
  'sastIntegrationLevel',
  'sastIncludesSca',
  'dastTool',
  'dastIntegrationLevel',
  'scaTool',
  'scaIntegrationLevel',
  'appFirewallTool',
  'appFirewallIntegrationLevel',
  'appFirewallNA',
  'apiSecurityTool',
  'apiSecurityIntegrationLevel',
  'apiSecurityNA',

  // Deployment metadata
  'currentVersion',
  'deploymentEnvironment',
  'gitBranch',
  'lastDastScanDate',
  'lastSastScanDate',
  'lastScaScanDate',

  // Free text
  'additionalNotes',
];

export const SPLITTABLE_METADATA_FIELD_SET = new Set(SPLITTABLE_METADATA_FIELDS);

export const SPLIT_METADATA_MODES = ['all', 'none', 'selected'];
