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

/** Every field this module scores, filled. */
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
   * Golden sizes, measured against the four hand-maintained implementations on
   * main @ cb149b1. An 18,000-case differential run against those implementations
   * showed zero divergence; these sizes are the cheap regression guard.
   */
  it('has the sizes the implementations it replaced had', () => {
    const standalone = { sastIncludesSca: false };
    assert.equal(resolveFieldSet('record', standalone).length, 22);
    assert.equal(resolveFieldSet('security', standalone).length, 11);
    assert.equal(resolveFieldSet('portfolioBasic', standalone).length, 6);
    assert.equal(resolveFieldSet('portfolioTechnical', standalone).length, 8);
  });

  it('drops the standalone SCA fields when SAST covers them', () => {
    const covered = { sastIncludesSca: true };
    assert.equal(resolveFieldSet('record', covered).length, 20);
    assert.equal(resolveFieldSet('security', covered).length, 9);
    // The metadata sets have no SCA fields, so they are unaffected.
    assert.equal(resolveFieldSet('portfolioBasic', covered).length, 6);
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
