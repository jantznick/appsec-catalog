/**
 * Differential test: the consolidated completeness implementation against the four
 * hand-written ones it replaced.
 *
 * WHY THIS EXISTS AS A COMMITTED TEST
 *
 * Consolidating four implementations into one is the kind of change that looks more
 * correct afterwards and is therefore invisible in review. It caught a real regression
 * when it was first run as a throwaway script: the old implementations disagreed on
 * whitespace — the record and security sets counted "   " as filled (`value !== ''`)
 * while the portfolio metadata sets did not (`value.trim() !== ''`) — and a first pass
 * unified on trim, silently moving two of the four numbers on every dashboard.
 *
 * The reference implementations below are a VERBATIM copy of
 * backend/services/completeness.js and backend/utils/portfolioCompleteness.js as they
 * stood on main @ cb149b1, immediately before consolidation. They are frozen on
 * purpose: this file asserts that today's code still produces byte-identical results.
 *
 * DO NOT "fix" the reference implementations. Their warts are the point — including the
 * whitespace inconsistency, which is preserved deliberately in SET_BLANK_RULES because
 * unifying it moves numbers already on dashboards and is a product decision.
 *
 * If a deliberate behaviour change lands, this test SHOULD fail. Update it in the same
 * commit, with the new expectation stated explicitly, so the change is visible.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCompleteness,
  countFieldSet,
  resolveFieldSet,
  toPercentage,
  SET_BLANK_RULES,
} from './completeness.js';
import {
  aggregateCompletenessForCompany,
  countSecurityCompletenessFields,
} from '../utils/portfolioCompleteness.js';

/**
 * The record and security field lists as they stood before Phase 6a added secrets and
 * IaC/container scanning. Evaluating the CURRENT implementation against these lists must
 * still match the frozen reference exactly — that is what proves the additions are
 * additive and that no pre-existing field changed behaviour.
 *
 * Not a second copy of the logic: the same countFieldSet runs, just over the old list.
 */
const PRE_PHASE_6A_RECORD = [
  'name', 'description', 'owner', 'repoUrl', 'language', 'framework', 'serverEnvironment',
  'facing', 'deploymentType', 'authProfiles', 'dataTypes',
  'sastTool', 'sastIntegrationLevel', 'dastTool', 'dastIntegrationLevel', '@standaloneSca',
  'appFirewallTool', 'appFirewallIntegrationLevel', 'apiSchema', 'apiSecurityNA', 'appFirewallNA',
];

const PRE_PHASE_6A_SECURITY = [
  'sastTool', 'sastIntegrationLevel', 'dastTool', 'dastIntegrationLevel', '@standaloneSca',
  'appFirewallTool', 'appFirewallIntegrationLevel', 'apiSchema', 'apiSecurityNA', 'appFirewallNA',
];

/**
 * Current implementation, restricted to a historical field list, with the same blank
 * rule the named set uses. Shaped like refCalculateCompleteness so the two compare.
 */
function countAgainst(fieldList, app, blankRule) {
  return countFieldSet(app, fieldList, blankRule);
}

/** Same, shaped like refCalculateCompleteness, which also reports a percentage. */
function countAgainstWithPercentage(fieldList, app, blankRule) {
  const { filled, total } = countAgainst(fieldList, app, blankRule);
  return { filled, total, percentage: toPercentage(filled, total) };
}

// ---------------------------------------------------------------------------
// Reference implementation — frozen copy of main @ cb149b1. Do not modify.
// ---------------------------------------------------------------------------

function refIsStringNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}

/** services/completeness.js @ cb149b1 */
function refCalculateCompleteness(application) {
  const includeStandaloneSca = !application.sastIncludesSca;
  const fields = [
    'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
    'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
    'sastTool', 'sastIntegrationLevel', 'dastTool', 'dastIntegrationLevel',
    ...(includeStandaloneSca ? ['scaTool', 'scaIntegrationLevel'] : []),
    'appFirewallTool', 'appFirewallIntegrationLevel',
    'apiSchema', 'apiSecurityNA', 'appFirewallNA',
  ];

  let filled = 0;
  let total = 0;

  for (const field of fields) {
    const value = application[field];

    if (field === 'apiSecurityNA' || field === 'appFirewallNA') {
      if (refIsStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (
      field === 'sastIntegrationLevel' ||
      field === 'dastIntegrationLevel' ||
      field === 'scaIntegrationLevel' ||
      field === 'appFirewallIntegrationLevel'
    ) {
      if (refIsStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (refIsStringNA(value)) continue;

    total += 1;

    if (field === 'apiSchema' ? Boolean(value) : value !== null && value !== undefined && value !== '') {
      filled += 1;
    }
  }

  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percentage };
}

/** utils/portfolioCompleteness.js @ cb149b1 */
const REF_BASIC_INFO_FIELDS = ['name', 'description', 'repoUrl', 'devTeamContact', 'criticalAspects'];
const REF_TECHNICAL_INFO_FIELDS = [
  'language', 'framework', 'serverEnvironment', 'currentVersion',
  'facing', 'deploymentType', 'authProfiles', 'dataTypes',
];

function refCountBasicTechnicalMetadata(app) {
  let filled = 0;
  let total = 0;

  for (const field of REF_BASIC_INFO_FIELDS) {
    const value = app[field];
    if (refIsStringNA(value)) continue;
    total += 1;
    if (value !== null && value !== undefined && String(value).trim() !== '') filled += 1;
  }

  {
    const v = app.businessCriticality;
    if (!refIsStringNA(v)) {
      total += 1;
      if (v !== null && v !== undefined) filled += 1;
    }
  }

  for (const field of REF_TECHNICAL_INFO_FIELDS) {
    const value = app[field];
    if (refIsStringNA(value)) continue;
    total += 1;
    if (value !== null && value !== undefined && String(value).trim() !== '') filled += 1;
  }

  return { filled, total };
}

function refCountSecurityCompletenessFields(application) {
  const includeStandaloneSca = !application.sastIncludesSca;
  const fields = [
    'sastTool', 'sastIntegrationLevel', 'dastTool', 'dastIntegrationLevel',
    ...(includeStandaloneSca ? ['scaTool', 'scaIntegrationLevel'] : []),
    'appFirewallTool', 'appFirewallIntegrationLevel',
    'apiSchema', 'apiSecurityNA', 'appFirewallNA',
  ];

  let filled = 0;
  let total = 0;

  for (const field of fields) {
    const value = application[field];

    if (field === 'apiSecurityNA' || field === 'appFirewallNA') {
      if (refIsStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (
      field === 'sastIntegrationLevel' ||
      field === 'dastIntegrationLevel' ||
      field === 'scaIntegrationLevel' ||
      field === 'appFirewallIntegrationLevel'
    ) {
      if (refIsStringNA(value)) continue;
      total += 1;
      if (value !== null && value !== undefined) filled += 1;
      continue;
    }

    if (refIsStringNA(value)) continue;

    total += 1;

    if (field === 'apiSchema' ? Boolean(value) : value !== null && value !== undefined && value !== '') {
      filled += 1;
    }
  }

  return { filled, total };
}

function refFormatAvgPct(pcts) {
  if (!pcts.length) return '';
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  return `${avg}%`;
}

function refAggregateCompletenessForCompany(applications) {
  if (!applications.length) return { metadataCompleteness: '', securityCompleteness: '' };

  const metaPcts = [];
  const secPcts = [];

  for (const app of applications) {
    const meta = refCountBasicTechnicalMetadata(app);
    metaPcts.push(meta.total > 0 ? Math.round((meta.filled / meta.total) * 100) : 0);

    const sec = refCountSecurityCompletenessFields(app);
    secPcts.push(sec.total > 0 ? Math.round((sec.filled / sec.total) * 100) : 0);
  }

  return {
    metadataCompleteness: refFormatAvgPct(metaPcts),
    securityCompleteness: refFormatAvgPct(secPcts),
  };
}

// ---------------------------------------------------------------------------
// Case generation
// ---------------------------------------------------------------------------

/** Every field any of the four implementations reads. */
const FIELDS = [
  'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
  'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
  'devTeamContact', 'criticalAspects', 'businessCriticality', 'currentVersion',
  'sastTool', 'sastIntegrationLevel', 'dastTool', 'dastIntegrationLevel',
  'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
  'apiSchema', 'apiSecurityNA', 'appFirewallNA', 'sastIncludesSca',
];

/**
 * Values chosen to probe every branch: the NA sentinel and its near-misses, the
 * whitespace case that caused the original regression, falsy-but-answered values, and
 * non-string types a CSV import or an included relation can produce.
 */
const VALUES = [
  undefined, null, '', '   ', 'NA', ' NA ', 'N/A', 'na', 'value', 0, 4, false, true,
  { id: 'x' }, [],
];

/** Deterministic PRNG, so a failure is reproducible rather than flaky. */
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function generateApplications(count, seed) {
  const rnd = makeRandom(seed);
  const apps = [];
  for (let i = 0; i < count; i += 1) {
    const app = {};
    for (const field of FIELDS) {
      const value = VALUES[Math.floor(rnd() * VALUES.length)];
      if (value !== undefined) app[field] = value;
    }
    apps.push(app);
  }
  return apps;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const CASES = 6000;
const applications = generateApplications(CASES, 42);

describe('consolidated completeness matches the implementations it replaced', () => {
  it(`produces identical record completeness across ${CASES} generated applications, over the pre-Phase-6a field list`, () => {
    // Phase 6a deliberately widened the record set, so calculateCompleteness no longer
    // equals the frozen reference — the numbers moved on purpose (35% -> 30% average
    // across the 91 dev applications). What must still hold is that nothing ELSE moved:
    // the same counting logic over the old list is byte-identical to the old code.
    for (const app of applications) {
      assert.deepEqual(
        countAgainstWithPercentage(PRE_PHASE_6A_RECORD, app, SET_BLANK_RULES.record),
        refCalculateCompleteness(app),
        `record completeness diverged for ${JSON.stringify(app)}`,
      );
    }
  });

  it('widens the record set by exactly the Phase 6a fields and nothing else', () => {
    // The re-baseline, asserted rather than absorbed. Four fields when SAST covers
    // neither SCA nor secrets; two when it covers secrets.
    for (const app of applications) {
      const now = calculateCompleteness(app);
      const before = countAgainst(PRE_PHASE_6A_RECORD, app, SET_BLANK_RULES.record);
      const added = resolveFieldSet('record', app).length - resolveFieldSet(PRE_PHASE_6A_RECORD, app).length;
      assert.equal(added, app.sastIncludesSecrets ? 2 : 4, JSON.stringify(app));
      // Additions can only grow the denominator, never shrink it, and can never
      // reduce the filled count.
      assert.ok(now.total >= before.total, 'the denominator must not shrink');
      assert.ok(now.filled >= before.filled, 'the filled count must not shrink');
    }
  });

  it(`produces identical security completeness across ${CASES} generated applications, over the pre-Phase-6a field list`, () => {
    for (const app of applications) {
      assert.deepEqual(
        countAgainst(PRE_PHASE_6A_SECURITY, app, SET_BLANK_RULES.security),
        refCountSecurityCompletenessFields(app),
        `security completeness diverged for ${JSON.stringify(app)}`,
      );
    }
  });

  /**
   * The portfolio CSV reports metadata and security separately.
   *
   * `securityCompleteness` reads from the shared `security` field set, which Phase 6a
   * widened — so that number moved too, not just the per-application record figure.
   * Worth stating plainly: the portfolio CSV's security percentage changes as well.
   *
   * `metadataCompleteness` draws on portfolioBasic / portfolioTechnical, which were not
   * touched, so it must be byte-identical to the old implementation.
   */
  it(`produces identical portfolio METADATA aggregates across ${CASES} generated applications`, () => {
    for (const app of applications) {
      assert.equal(
        aggregateCompletenessForCompany([app]).metadataCompleteness,
        refAggregateCompletenessForCompany([app]).metadataCompleteness,
        `metadata aggregate diverged for ${JSON.stringify(app)}`,
      );
    }
  });

  it('produces identical metadata aggregates for multi-application portfolios', () => {
    // Averaging across applications rounds twice, so batch behaviour is not implied by
    // the single-application case.
    for (let size = 2; size <= 25; size += 1) {
      const batch = applications.slice(0, size);
      assert.equal(
        aggregateCompletenessForCompany(batch).metadataCompleteness,
        refAggregateCompletenessForCompany(batch).metadataCompleteness,
        `metadata aggregate diverged for a portfolio of ${size}`,
      );
    }
  });

  it('moves the portfolio security aggregate only downward, and only by the new fields', () => {
    // A widened denominator with no new values filled can only lower the percentage,
    // never raise it. If one of these ever rose, a pre-existing field changed meaning.
    for (let size = 1; size <= 25; size += 1) {
      const batch = applications.slice(0, size);
      const now = Number(aggregateCompletenessForCompany(batch).securityCompleteness.replace('%', ''));
      const before = Number(refAggregateCompletenessForCompany(batch).securityCompleteness.replace('%', ''));
      assert.ok(
        Number.isNaN(now) || Number.isNaN(before) || now <= before,
        `security aggregate rose from ${before} to ${now} for a portfolio of ${size}`,
      );
    }
  });

  it('agrees on the edge cases generation is unlikely to hit', () => {
    const edges = [
      {},
      { sastIncludesSca: true },
      { sastIncludesSca: false },
      // Every scorable field opted out via the NA sentinel: denominator zero.
      Object.fromEntries(FIELDS.map((f) => [f, 'NA'])),
      // The whitespace case that caused the original regression.
      Object.fromEntries(FIELDS.map((f) => [f, '   '])),
      Object.fromEntries(FIELDS.map((f) => [f, ''])),
    ];

    for (const app of edges) {
      // Compared over the pre-Phase-6a lists, for the same reason as above: the sets
      // widened deliberately, so only the unchanged fields can be asserted identical.
      assert.deepEqual(
        countAgainstWithPercentage(PRE_PHASE_6A_RECORD, app, SET_BLANK_RULES.record),
        refCalculateCompleteness(app),
        `record edge case diverged for ${JSON.stringify(app)}`,
      );
      assert.deepEqual(
        countAgainst(PRE_PHASE_6A_SECURITY, app, SET_BLANK_RULES.security),
        refCountSecurityCompletenessFields(app),
        `security edge case diverged for ${JSON.stringify(app)}`,
      );

      // And the widened sets must still be well-formed on the degenerate inputs:
      // a zero denominator must not become a division by zero or a NaN percentage.
      const now = calculateCompleteness(app);
      assert.ok(Number.isInteger(now.total) && now.total >= 0, JSON.stringify(app));
      assert.ok(Number.isInteger(now.percentage), JSON.stringify(app));
    }

    assert.deepEqual(aggregateCompletenessForCompany([]), refAggregateCompletenessForCompany([]));
  });

  it('exercises the branches it claims to', () => {
    // Guards the generator: if VALUES or FIELDS drift so that cases stop being varied,
    // the assertions above would pass vacuously.
    const results = applications.map((app) => calculateCompleteness(app));
    const distinctTotals = new Set(results.map((r) => r.total));
    const distinctPercentages = new Set(results.map((r) => r.percentage));
    assert.ok(distinctTotals.size > 3, `only ${distinctTotals.size} distinct denominators`);
    assert.ok(distinctPercentages.size > 20, `only ${distinctPercentages.size} distinct results`);
  });
});
