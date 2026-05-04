/**
 * Portfolio CSV completeness — aligned with:
 * - Basic / Technical Information on Application detail (App Data tab)
 * - Security tool completeness in frontend/src/utils/applicationCompleteness.js
 */

function isStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

/** Basic Information card (ApplicationDetail). */
const BASIC_INFO_FIELDS = [
  'name',
  'description',
  'repoUrl',
  'devTeamContact',
  'criticalAspects',
];

/**
 * Technical Information card (scalar fields only; hosting domains omitted).
 */
const TECHNICAL_INFO_FIELDS = [
  'language',
  'framework',
  'serverEnvironment',
  'currentVersion',
  'facing',
  'deploymentType',
  'authProfiles',
  'dataTypes',
];

function countBasicTechnicalMetadata(app) {
  let filled = 0;
  let total = 0;

  for (const field of BASIC_INFO_FIELDS) {
    const value = app[field];
    if (isStringNA(value)) continue;
    total += 1;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      filled += 1;
    }
  }

  {
    const v = app.businessCriticality;
    if (!isStringNA(v)) {
      total += 1;
      if (v !== null && v !== undefined) {
        filled += 1;
      }
    }
  }

  for (const field of TECHNICAL_INFO_FIELDS) {
    const value = app[field];
    if (isStringNA(value)) continue;
    total += 1;
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      filled += 1;
    }
  }

  return { filled, total };
}

/**
 * Security tool fields only (no application-to-application interfaces).
 * Matches frontend `calculateCompleteness` security portion.
 * @param {Record<string, unknown>} application
 * @returns {{ filled: number, total: number }}
 */
export function countSecurityCompletenessFields(application) {
  const includeStandaloneSca = !application.sastIncludesSca;
  const fields = [
    'sastTool',
    'sastIntegrationLevel',
    'dastTool',
    'dastIntegrationLevel',
    ...(includeStandaloneSca ? ['scaTool', 'scaIntegrationLevel'] : []),
    'appFirewallTool',
    'appFirewallIntegrationLevel',
    'apiSecurityTool',
    'apiSecurityIntegrationLevel',
    'apiSecurityNA',
    'appFirewallNA',
  ];

  let filled = 0;
  let total = 0;

  for (const field of fields) {
    const value = application[field];

    if (field === 'apiSecurityNA' || field === 'appFirewallNA') {
      if (isStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) {
        filled += 1;
      }
      continue;
    }

    if (
      field === 'sastIntegrationLevel' ||
      field === 'dastIntegrationLevel' ||
      field === 'scaIntegrationLevel' ||
      field === 'appFirewallIntegrationLevel' ||
      field === 'apiSecurityIntegrationLevel'
    ) {
      if (isStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) {
        filled += 1;
      }
      continue;
    }

    if (isStringNA(value)) {
      continue;
    }

    total += 1;

    if (value !== null && value !== undefined && value !== '') {
      filled += 1;
    }
  }

  return { filled, total };
}

/**
 * @param {Array<Record<string, unknown>>} applications
 * @returns {{ metadataCompleteness: string, securityCompleteness: string }}
 */
function formatAvgPct(pcts) {
  if (!pcts.length) return '';
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  return `${avg}%`;
}

export function aggregateCompletenessForCompany(applications) {
  if (!applications.length) {
    return { metadataCompleteness: '', securityCompleteness: '' };
  }

  const metaPcts = [];
  const secPcts = [];

  for (const app of applications) {
    const meta = countBasicTechnicalMetadata(app);
    if (meta.total > 0) {
      metaPcts.push(Math.round((meta.filled / meta.total) * 100));
    } else {
      metaPcts.push(0);
    }

    const sec = countSecurityCompletenessFields(app);
    if (sec.total > 0) {
      secPcts.push(Math.round((sec.filled / sec.total) * 100));
    } else {
      secPcts.push(0);
    }
  }

  return {
    metadataCompleteness: formatAvgPct(metaPcts),
    securityCompleteness: formatAvgPct(secPcts),
  };
}
