/**
 * If a field is exactly the text "NA" (after trim), do not count it in completeness totals
 * (matches backend knowledge scoring: empty still counts; "NA" opts out of that field).
 * @param {unknown} value
 * @returns {boolean}
 */
function isStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

/**
 * Calculate the completeness percentage of an application
 * @param {Object} application - The application object
 * @returns {Object} - { filled, total, percentage }
 */
export function calculateCompleteness(application) {
  const includeStandaloneSca = !application.sastIncludesSca;
  const fields = [
    'name',
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

  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

  return {
    filled,
    total,
    percentage,
  };
}
