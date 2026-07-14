/**
 * Company-level security tool coverage for the Security coverage UI.
 * Applicability rules align with frontend/src/utils/applicationCompleteness.js and
 * backend/utils/portfolioCompleteness.js (NA strings, bundled SCA, api/firewall N/A booleans).
 */

function isStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

function toolFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && isStringNA(value)) return false;
  return String(value).trim() !== '';
}

function integrationFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && isStringNA(value)) return false;
  return true;
}

function sastCovered(app) {
  return toolFilled(app.sastTool) && integrationFilled(app.sastIntegrationLevel);
}

function dastCovered(app) {
  return toolFilled(app.dastTool) && integrationFilled(app.dastIntegrationLevel);
}

function standaloneScaCovered(app) {
  return toolFilled(app.scaTool) && integrationFilled(app.scaIntegrationLevel);
}

/** SCA satisfied via SAST+SCA bundle (standalone SCA fields not required). */
function bundledScaCovered(app) {
  return !!app.sastIncludesSca && sastCovered(app);
}

function scaCovered(app) {
  if (app.sastIncludesSca) {
    return bundledScaCovered(app);
  }
  return standaloneScaCovered(app);
}

function appFirewallApplicable(app) {
  return !app.appFirewallNA;
}

function appFirewallCovered(app) {
  return (
    appFirewallApplicable(app) &&
    toolFilled(app.appFirewallTool) &&
    integrationFilled(app.appFirewallIntegrationLevel)
  );
}

function apiSecurityApplicable(app) {
  return !app.apiSecurityNA;
}

function apiSecurityCovered(app) {
  return (
    apiSecurityApplicable(app) &&
    Boolean(app.apiSchema)
  );
}

const BUNDLED_SCA_KEY = '__BUNDLED_SAST__';

function scanIso(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

/**
 * @param {Record<string, unknown>} app
 * @param {string | null} lastScanAt - ISO datetime or null when not tracked / N&A
 * @param {unknown} integrationLevel
 */
function coverageAppRow(app, lastScanAt, integrationLevel) {
  const lvl = integrationLevel;
  const n =
    lvl === null || lvl === undefined || (typeof lvl === 'number' && Number.isNaN(lvl))
      ? null
      : Number(lvl);
  return {
    id: app.id,
    name: app.name,
    lastScanAt,
    integrationLevel: n,
  };
}

/** Per-category fields for list rows (uncovered / N&A / by-tool all use the same shape). */
function rowForCategory(app, categoryId) {
  switch (categoryId) {
    case 'sast':
      return coverageAppRow(app, scanIso(app.lastSastScanDate), app.sastIntegrationLevel);
    case 'sca':
      if (app.sastIncludesSca) {
        return coverageAppRow(app, scanIso(app.lastSastScanDate), app.sastIntegrationLevel);
      }
      return coverageAppRow(app, scanIso(app.lastScaScanDate), app.scaIntegrationLevel);
    case 'dast':
      return coverageAppRow(app, scanIso(app.lastDastScanDate), app.dastIntegrationLevel);
    case 'appFirewall':
      return coverageAppRow(app, null, app.appFirewallIntegrationLevel);
    case 'apiSecurity':
      return coverageAppRow(app, null, app.apiSchema ? 4 : null);
    default:
      return coverageAppRow(app, null, null);
  }
}

/**
 * @param {Array<{ id: string, name: string }>} apps
 */
function sortAppsByName(apps) {
  return [...apps].sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' }));
}

/**
 * @param {Array<Record<string, unknown>>} applications - raw application rows from Prisma
 */
export function buildCompanySecurityCoverage(applications) {
  const n = applications.length;

  const ref = (app, categoryId) => rowForCategory(app, categoryId);

  const sastCoveredApps = [];
  const sastUncovered = [];
  const sastByTool = new Map();

  const scaCoveredApps = [];
  const scaUncovered = [];
  const scaByTool = new Map();

  const dastCoveredApps = [];
  const dastUncovered = [];
  const dastByTool = new Map();

  const wafCoveredApps = [];
  const wafUncovered = [];
  const wafNA = [];
  const wafByTool = new Map();

  const apiCoveredApps = [];
  const apiUncovered = [];
  const apiNA = [];
  const apiByTool = new Map();

  for (const app of applications) {
    if (sastCovered(app)) {
      sastCoveredApps.push(app);
      const key = String(app.sastTool).trim();
      if (!sastByTool.has(key)) sastByTool.set(key, []);
      sastByTool.get(key).push(ref(app, 'sast'));
    } else {
      sastUncovered.push(ref(app, 'sast'));
    }

    if (scaCovered(app)) {
      scaCoveredApps.push(app);
      if (app.sastIncludesSca) {
        if (!scaByTool.has(BUNDLED_SCA_KEY)) scaByTool.set(BUNDLED_SCA_KEY, []);
        scaByTool.get(BUNDLED_SCA_KEY).push(ref(app, 'sca'));
      } else {
        const key = String(app.scaTool).trim();
        if (!scaByTool.has(key)) scaByTool.set(key, []);
        scaByTool.get(key).push(ref(app, 'sca'));
      }
    } else {
      scaUncovered.push(ref(app, 'sca'));
    }

    if (dastCovered(app)) {
      dastCoveredApps.push(app);
      const key = String(app.dastTool).trim();
      if (!dastByTool.has(key)) dastByTool.set(key, []);
      dastByTool.get(key).push(ref(app, 'dast'));
    } else {
      dastUncovered.push(ref(app, 'dast'));
    }

    if (!appFirewallApplicable(app)) {
      wafNA.push(ref(app, 'appFirewall'));
    } else if (appFirewallCovered(app)) {
      wafCoveredApps.push(app);
      const key = String(app.appFirewallTool).trim();
      if (!wafByTool.has(key)) wafByTool.set(key, []);
      wafByTool.get(key).push(ref(app, 'appFirewall'));
    } else {
      wafUncovered.push(ref(app, 'appFirewall'));
    }

    if (!apiSecurityApplicable(app)) {
      apiNA.push(ref(app, 'apiSecurity'));
    } else if (apiSecurityCovered(app)) {
      apiCoveredApps.push(app);
      const key = String(app.apiSecurityTool).trim();
      if (!apiByTool.has(key)) apiByTool.set(key, []);
      apiByTool.get(key).push(ref(app, 'apiSecurity'));
    } else {
      apiUncovered.push(ref(app, 'apiSecurity'));
    }
  }

  function toolsArray(toolMap, bundledLabel) {
    const entries = [...toolMap.entries()]
      .map(([key, appList]) => ({
        key,
        label: key === BUNDLED_SCA_KEY ? bundledLabel : key,
        apps: sortAppsByName(appList),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return entries;
  }

  function category(id, label, coveredCount, naCount, uncovered, naList, toolMap, bundledLabel) {
    const gap = uncovered.length;
    const applicable = n - naCount;
    const coveredPct = applicable > 0 ? Math.round((coveredCount / applicable) * 100) : 0;
    return {
      id,
      label,
      counts: {
        totalApplications: n,
        applicable,
        covered: coveredCount,
        na: naCount,
        gap,
        coveredPct,
      },
      tools: toolsArray(toolMap, bundledLabel),
      uncovered: sortAppsByName(uncovered),
      naApps: sortAppsByName(naList),
    };
  }

  return {
    totalApplications: n,
    categories: [
      category(
        'sast',
        'SAST',
        sastCoveredApps.length,
        0,
        sastUncovered,
        [],
        sastByTool,
        ''
      ),
      category(
        'sca',
        'SCA',
        scaCoveredApps.length,
        0,
        scaUncovered,
        [],
        scaByTool,
        'Bundled with SAST'
      ),
      category(
        'dast',
        'DAST',
        dastCoveredApps.length,
        0,
        dastUncovered,
        [],
        dastByTool,
        ''
      ),
      category(
        'appFirewall',
        'Application firewall',
        wafCoveredApps.length,
        wafNA.length,
        wafUncovered,
        wafNA,
        wafByTool,
        ''
      ),
      category(
        'apiSecurity',
        'API security',
        apiCoveredApps.length,
        apiNA.length,
        apiUncovered,
        apiNA,
        apiByTool,
        ''
      ),
    ],
  };
}
