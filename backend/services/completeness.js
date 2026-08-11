/**
 * Backend port of frontend/src/utils/applicationCompleteness.js.
 *
 * Kept intentionally in sync with the frontend definition so that the
 * completeness numbers shown on dashboards match the per-application view.
 * When the field list changes in one place, change it in the other.
 */

/**
 * If a field is exactly the text "NA" (after trim), do not count it toward
 * completeness (matches knowledge scoring: empty still counts; "NA" opts out).
 * @param {unknown} value
 * @returns {boolean}
 */
function isStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

/**
 * Calculate the completeness of an application record.
 * `apiSchema` is treated as a truthy relation (include it as a boolean or the
 * related row); every other field is read directly off the application.
 * @param {Object} application
 * @returns {{ filled: number, total: number, percentage: number }}
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
    'apiSchema',
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
      field === 'appFirewallIntegrationLevel'
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

    if (field === 'apiSchema' ? Boolean(value) : value !== null && value !== undefined && value !== '') {
      filled += 1;
    }
  }

  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;

  return { filled, total, percentage };
}
