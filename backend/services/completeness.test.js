/**
 * Tests for application completeness.
 *
 * See the note at the top of scoring.test.js on why this uses `node --test` with no
 * dependencies.
 *
 * `APP_DATA_FIXES_PLAN.md` 1.2 documents four disagreeing definitions of "complete":
 * this one, a hand-mirrored copy in frontend/src/utils/applicationCompleteness.js,
 * a third pair in backend/utils/portfolioCompleteness.js, and KNOWLEDGE_SCORING_FIELDS
 * in services/scoring.js. These tests pin the behaviour of this one so the collapse
 * into a single definition is a refactor with a safety net rather than a rewrite.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELD_SETS,
  SET_BLANK_RULES,
  calculateCompleteness,
  countFieldSet,
  findUnknownFieldsInSets,
  resolveFieldSet,
  toPercentage,
} from './completeness.js';

/**
 * Every field this module scores, filled. When a field joins a set, it joins here in
 * the same commit — otherwise "fully populated" quietly stops meaning 100%.
 */
function completeApp(overrides = {}) {
  return {
    name: 'Checkout',
    description: 'Takes payments',
    owner: 'Payments team',
    repoUrl: 'https://github.com/acme/checkout',
    language: 'TypeScript',
    framework: 'Express',
    serverEnvironment: 'AWS',
    facing: 'External',
    deploymentType: 'Daily - Automated CI/CD Pipeline',
    authProfiles: 'OIDC',
    dataTypes: 'PII',
    sastTool: 'Snyk',
    sastIntegrationLevel: 4,
    sastIncludesSca: false,
    dastTool: 'Tenable WAS',
    dastIntegrationLevel: 4,
    scaTool: 'Snyk',
    scaIntegrationLevel: 4,
    // Phase 6a: secrets and IaC/container scanning joined the security tooling a
    // record declares. sastIncludesSecrets:false so the standalone pair counts.
    sastIncludesSecrets: false,
    secretsScanTool: 'GitHub secret scanning',
    secretsScanIntegrationLevel: 4,
    iacContainerScanNA: false,
    iacContainerScanTool: 'Trivy',
    iacContainerScanIntegrationLevel: 4,
    appFirewallTool: 'Fastly NGWAF',
    appFirewallIntegrationLevel: 4,
    apiSchema: { id: 'schema_1' },
    apiSecurityNA: false,
    appFirewallNA: false,
    ...overrides,
  };
}

describe('calculateCompleteness', () => {
  it('reports 100% for a fully populated application', () => {
    const { filled, total, percentage } = calculateCompleteness(completeApp());
    assert.equal(filled, total);
    assert.equal(percentage, 100);
  });

  it('counts the standalone SCA fields only when SAST does not cover them', () => {
    const standalone = calculateCompleteness(completeApp({ sastIncludesSca: false }));
    const covered = calculateCompleteness(completeApp({ sastIncludesSca: true }));
    assert.equal(
      standalone.total - covered.total,
      2,
      'scaTool and scaIntegrationLevel leave the denominator when SAST includes SCA',
    );
    assert.equal(covered.percentage, 100);
  });

  it('drops NA fields from the denominator rather than counting them missing', () => {
    const base = calculateCompleteness(completeApp());
    const withNA = calculateCompleteness(completeApp({ framework: 'NA' }));
    assert.equal(withNA.total, base.total - 1);
    assert.equal(withNA.percentage, 100);
  });

  it('counts empty strings and nulls as unfilled', () => {
    const { filled, total } = calculateCompleteness(
      completeApp({ description: '', owner: null, language: undefined }),
    );
    assert.equal(total - filled, 3);
  });

  it('treats apiSchema as a relation, not a string', () => {
    const present = calculateCompleteness(completeApp({ apiSchema: { id: 'x' } }));
    const absent = calculateCompleteness(completeApp({ apiSchema: null }));
    assert.equal(present.total, absent.total);
    assert.equal(present.filled - absent.filled, 1);

    // Callers may include it as a boolean instead of the row.
    const asBoolean = calculateCompleteness(completeApp({ apiSchema: true }));
    assert.equal(asBoolean.percentage, 100);
  });

  it('counts integration level 0 as answered', () => {
    // 0 is a real integration level ("Unknown / Nothing"), not an absence.
    const { percentage } = calculateCompleteness(completeApp({ sastIntegrationLevel: 0 }));
    assert.equal(percentage, 100);
  });

  /**
   * Fixes doc C2: apiSecurityNA and appFirewallNA are declared Boolean? but carry
   * @default(false) in the schema, so they are never null on a real row and always
   * count as filled. That is two free points on every application in the system.
   *
   * This test documents the current behaviour. When Phase 2 drops the defaults, the
   * `false` case stays filled and a genuinely null value becomes unfilled — at which
   * point the second assertion below should be updated, deliberately.
   */
  it('counts the N/A booleans as filled whenever they are not null (fixes doc C2)', () => {
    const asFalse = calculateCompleteness(completeApp({ apiSecurityNA: false, appFirewallNA: false }));
    assert.equal(asFalse.percentage, 100, 'false is an answer');

    const asNull = calculateCompleteness(completeApp({ apiSecurityNA: null, appFirewallNA: null }));
    assert.equal(
      asNull.total - asNull.filled,
      2,
      'null is unfilled - but @default(false) means production rows are never null',
    );
  });

  it('never divides by zero', () => {
    // Every scorable field set to the NA sentinel empties the denominator.
    const allNA = {
      name: 'NA', description: 'NA', owner: 'NA', repoUrl: 'NA', language: 'NA',
      framework: 'NA', serverEnvironment: 'NA', facing: 'NA', deploymentType: 'NA',
      authProfiles: 'NA', dataTypes: 'NA', sastTool: 'NA', sastIntegrationLevel: 'NA',
      dastTool: 'NA', dastIntegrationLevel: 'NA', scaTool: 'NA', scaIntegrationLevel: 'NA',
      appFirewallTool: 'NA', appFirewallIntegrationLevel: 'NA', apiSchema: 'NA',
      apiSecurityNA: 'NA', appFirewallNA: 'NA',
      secretsScanTool: 'NA', secretsScanIntegrationLevel: 'NA',
      iacContainerScanTool: 'NA', iacContainerScanIntegrationLevel: 'NA', iacContainerScanNA: 'NA',
    };
    const result = calculateCompleteness(allNA);
    assert.equal(result.total, 0);
    assert.equal(result.percentage, 0);
  });

  it('reports 0% for an empty application without throwing', () => {
    const result = calculateCompleteness({});
    assert.equal(result.filled, 0);
    assert.ok(result.total > 0);
    assert.equal(result.percentage, 0);
  });
});

describe('field sets', () => {
  /**
   * Golden sizes. The original values were measured against the four hand-maintained
   * implementations on main @ cb149b1, which an 18,000-case differential run showed
   * zero divergence from.
   *
   * RE-BASELINED for POLICY_CONTROL_COVERAGE_PLAN.md Phase 6a. Secrets scanning and
   * IaC/container scanning are now part of the security tooling a record is expected
   * to declare, so four fields joined the record and security sets:
   *
   *   record    22 -> 26      security  11 -> 15
   *
   * The metadata sets are untouched, which is why portfolioBasic and portfolioTechnical
   * still read 6 and 8. Measured across the 91 dev applications, average record
   * completeness moved 35% -> 30% — purely the denominator growing, since no
   * application had any of the new fields set yet.
   */
  it('has the sizes the implementations it replaced had, plus the Phase 6a additions', () => {
    const standalone = { sastIncludesSca: false, sastIncludesSecrets: false };
    assert.equal(resolveFieldSet('record', standalone).length, 27);
    assert.equal(resolveFieldSet('security', standalone).length, 16);
    assert.equal(resolveFieldSet('portfolioBasic', standalone).length, 6);
    assert.equal(resolveFieldSet('portfolioTechnical', standalone).length, 8);
  });

  it('drops the standalone SCA fields when SAST covers them', () => {
    const covered = { sastIncludesSca: true, sastIncludesSecrets: false };
    assert.equal(resolveFieldSet('record', covered).length, 25);
    assert.equal(resolveFieldSet('security', covered).length, 14);
    // The metadata sets have no SCA fields, so they are unaffected.
    assert.equal(resolveFieldSet('portfolioBasic', covered).length, 6);
  });

  it('drops the standalone secrets fields when SAST covers them', () => {
    // Same rule as SCA, and the two are independent.
    const secretsCovered = { sastIncludesSca: false, sastIncludesSecrets: true };
    assert.equal(resolveFieldSet('record', secretsCovered).length, 25);
    assert.equal(resolveFieldSet('security', secretsCovered).length, 14);

    const bothCovered = { sastIncludesSca: true, sastIncludesSecrets: true };
    assert.equal(resolveFieldSet('record', bothCovered).length, 23);
    assert.equal(resolveFieldSet('security', bothCovered).length, 12);
  });

  it('drops the IaC tool fields when the team declares it not applicable', () => {
    // The declaration itself still counts — "we have no IaC" is a complete answer,
    // not two permanent gaps. Without this an application with no containers could
    // never reach 100% and would fail 4.6.14 forever.
    const applies = { sastIncludesSca: false, sastIncludesSecrets: false, iacContainerScanNA: false };
    const notApplicable = { ...applies, iacContainerScanNA: true };
    assert.equal(resolveFieldSet('record', applies).length, 27);
    assert.equal(resolveFieldSet('record', notApplicable).length, 25);
    assert.ok(resolveFieldSet('record', notApplicable).includes('iacContainerScanNA'));
    assert.ok(!resolveFieldSet('record', notApplicable).includes('iacContainerScanTool'));
  });

  it('names only real fields, so a typo cannot count as permanently missing', () => {
    // A misspelled key would resolve to undefined on every application and read as an
    // unfillable gap forever - silently dragging every percentage down.
    assert.deepEqual(findUnknownFieldsInSets(), []);
  });

  it('makes the security set an exact tail of the record set', () => {
    const record = resolveFieldSet('record', {});
    const security = resolveFieldSet('security', {});
    assert.deepEqual(record.slice(-security.length), security);
  });

  it('declares a blank rule for every set', () => {
    for (const name of Object.keys(FIELD_SETS)) {
      assert.ok(SET_BLANK_RULES[name], `${name} has no blank rule`);
    }
  });

  it('rejects an unknown set name rather than counting zero fields', () => {
    assert.throws(() => resolveFieldSet('nope', {}), /Unknown completeness field set/);
  });

  it('accepts an explicit field list', () => {
    const { filled, total } = countFieldSet({ name: 'x' }, ['name', 'description']);
    assert.equal(total, 2);
    assert.equal(filled, 1);
  });
});

describe('per-set blank rules', () => {
  /**
   * The two prior implementations disagreed on whitespace-only values, and the
   * difference is preserved deliberately - unifying it would move numbers already on
   * dashboards. See the note in completeness.js. If that product decision is ever made,
   * this is the test that should change.
   */
  it('counts a whitespace-only value as filled for the record set', () => {
    const { filled } = countFieldSet({ description: '   ' }, ['description']);
    // An explicit list defaults to the trimmed rule...
    assert.equal(filled, 0);
    // ...but the record set keeps the looser historical rule.
    const record = countFieldSet({ description: '   ' }, 'record');
    const empty = countFieldSet({ description: '' }, 'record');
    assert.equal(record.filled - empty.filled, 1, 'whitespace counts as filled for record');
  });

  it('counts a whitespace-only value as blank for the portfolio metadata sets', () => {
    const ws = countFieldSet({ language: '   ' }, 'portfolioTechnical');
    const empty = countFieldSet({ language: '' }, 'portfolioTechnical');
    assert.equal(ws.filled, empty.filled, 'whitespace is blank for portfolioTechnical');
  });
});

describe('toPercentage', () => {
  it('rounds and never returns NaN', () => {
    assert.equal(toPercentage(1, 3), 33);
    assert.equal(toPercentage(2, 3), 67);
    assert.equal(toPercentage(0, 0), 0);
    assert.equal(toPercentage(5, 5), 100);
  });
});
