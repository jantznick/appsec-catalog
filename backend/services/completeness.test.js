/**
 * Tests for application completeness.
 *
 * See the note at the top of scoring.test.js on why this uses `node --test` with no
 * dependencies.
 *
 * `APP_DATA_FIXES_PLAN.md` 1.2 documented four disagreeing definitions of "complete".
 * There is now one: `FIELD_SETS.metadata`, which is exactly what the App Data tab
 * asks for. `calculateCompleteness`, the 40-point completeness component of the 0-100
 * knowledge score, the dashboard percentage and the portfolio CSV's metadata column
 * all read it, so an application has one completeness number wherever it is shown.
 *
 * What these tests are for now: keeping it that way. The set is small and easy to add
 * a field to in passing, and every addition moves published numbers.
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
 * Every field the metadata set scores, filled, plus the security fields the `security`
 * set still needs. When a field joins a set, it joins here in the same commit —
 * otherwise "fully populated" quietly stops meaning 100%.
 */
function completeApp(overrides = {}) {
  return {
    // metadata — the App Data tab
    description: 'Takes payments',
    repoUrl: 'https://github.com/acme/checkout',
    devTeamContact: 'payments@acme.test',
    criticalAspects: 'Card capture',
    businessCriticality: 4,
    language: 'TypeScript',
    framework: 'Express',
    serverEnvironment: 'AWS',
    currentVersion: '3.2.1',
    facing: 'External',
    deploymentType: 'Daily - Automated CI/CD Pipeline',
    authProfiles: 'OIDC',
    dataTypes: 'PII',
    // not scored, but present on a real row
    name: 'Checkout',
    owner: 'Payments team',
    // security — the Security tab, counted by the `security` set only
    sastTool: 'Snyk',
    sastIntegrationLevel: 4,
    sastIncludesSca: false,
    dastTool: 'Tenable WAS',
    dastIntegrationLevel: 4,
    scaTool: 'Snyk',
    scaIntegrationLevel: 4,
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

  it('scores the App Data tab and nothing else', () => {
    // The whole point of the set. Blanking every security-tooling field must not
    // change completeness, because the Security tab is not the App Data tab.
    const base = calculateCompleteness(completeApp());
    const noTooling = calculateCompleteness(
      completeApp({
        sastTool: '', sastIntegrationLevel: null, dastTool: '', dastIntegrationLevel: null,
        scaTool: '', scaIntegrationLevel: null, secretsScanTool: '',
        secretsScanIntegrationLevel: null, iacContainerScanTool: '',
        iacContainerScanIntegrationLevel: null, iacContainerScanNA: null,
        appFirewallTool: '', appFirewallIntegrationLevel: null, apiSchema: null,
        apiSecurityNA: null, appFirewallNA: null,
      }),
    );
    assert.deepEqual(noTooling, base);
  });

  it('does not score name, which is required and so can never be a gap', () => {
    // Counting it would add the same point to every application in the system.
    assert.ok(!FIELD_SETS.metadata.includes('name'));
    const named = calculateCompleteness(completeApp({ name: 'Checkout' }));
    const unnamed = calculateCompleteness(completeApp({ name: '' }));
    assert.deepEqual(unnamed, named);
  });

  it('drops NA fields from the denominator rather than counting them missing', () => {
    const base = calculateCompleteness(completeApp());
    const withNA = calculateCompleteness(completeApp({ framework: 'NA' }));
    assert.equal(withNA.total, base.total - 1);
    assert.equal(withNA.percentage, 100);
  });

  it('counts empty, whitespace-only and null as unfilled', () => {
    // `trimmed` is the metadata set's blank rule, so "   " is a gap.
    const { filled, total, missing } = calculateCompleteness(
      completeApp({ description: '', framework: '   ', language: null }),
    );
    assert.equal(total - filled, 3);
    assert.deepEqual([...missing].sort(), ['description', 'framework', 'language']);
  });

  it('names the missing fields, so scoring does not have to re-derive them', () => {
    const { missing } = calculateCompleteness(completeApp({ currentVersion: '' }));
    assert.deepEqual(missing, ['currentVersion']);
  });

  it('counts businessCriticality as answered whenever it is set', () => {
    const { percentage } = calculateCompleteness(completeApp({ businessCriticality: 1 }));
    assert.equal(percentage, 100);
    const unset = calculateCompleteness(completeApp({ businessCriticality: null }));
    assert.ok(unset.missing.includes('businessCriticality'));
  });

  it('never divides by zero', () => {
    const allNA = Object.fromEntries(FIELD_SETS.metadata.map((k) => [k, 'NA']));
    const result = calculateCompleteness(allNA);
    assert.equal(result.total, 0);
    assert.equal(result.percentage, 0);
  });

  it('reports 0% for an empty application without throwing', () => {
    const result = calculateCompleteness({});
    assert.equal(result.filled, 0);
    assert.ok(result.total > 0);
    assert.equal(result.percentage, 0);
    assert.deepEqual(result.missing, [...FIELD_SETS.metadata]);
  });
});

describe('field sets', () => {
  /**
   * Golden sizes.
   *
   * RE-BASELINED for the completeness consolidation. `record` is gone: it mixed the
   * App Data tab's questions with the Security tab's tooling and called the mixture
   * "completeness". `metadata` replaced it and is what every completeness number now
   * reads — thirteen fields, exactly the App Data tab's two cards, minus `name`
   * (required, so never a gap) and `companyId` (an assignment, not an answer).
   *
   * `security` is unchanged and is still reported separately by the portfolio CSV.
   * `portfolioBasic` and `portfolioTechnical` remain declared only so the differential
   * suite can measure the change; nothing in the application reads them.
   */
  it('has the size the App Data tab has', () => {
    const standalone = { sastIncludesSca: false, sastIncludesSecrets: false };
    assert.equal(resolveFieldSet('metadata', standalone).length, 13);
    assert.equal(resolveFieldSet('security', standalone).length, 16);
    assert.equal(resolveFieldSet('portfolioBasic', standalone).length, 6);
    assert.equal(resolveFieldSet('portfolioTechnical', standalone).length, 8);
  });

  it('is the union of the two sets it replaced, less name', () => {
    // The consolidation is meant to be exactly this and nothing more, so state it
    // rather than leaving the reader to compare two lists by eye.
    const app = { sastIncludesSca: false, sastIncludesSecrets: false };
    const union = [
      ...resolveFieldSet('portfolioBasic', app),
      ...resolveFieldSet('portfolioTechnical', app),
    ].filter((k) => k !== 'name');
    assert.deepEqual([...resolveFieldSet('metadata', app)].sort(), [...union].sort());
  });

  it('holds no security-tooling field', () => {
    const security = new Set(resolveFieldSet('security', { sastIncludesSca: false, sastIncludesSecrets: false }));
    const overlap = resolveFieldSet('metadata', {}).filter((k) => security.has(k));
    assert.deepEqual(overlap, [], 'the Security tab is not the App Data tab');
  });

  it('does not vary with the security conditionals', () => {
    // The SCA, secrets and IaC markers only ever expanded inside the security set.
    // Metadata must be the same size whatever a team answered about its tooling.
    const sizes = new Set();
    for (const sastIncludesSca of [true, false]) {
      for (const sastIncludesSecrets of [true, false]) {
        for (const iacContainerScanNA of [true, false]) {
          sizes.add(
            resolveFieldSet('metadata', { sastIncludesSca, sastIncludesSecrets, iacContainerScanNA }).length,
          );
        }
      }
    }
    assert.deepEqual([...sizes], [13]);
  });

  it('drops the standalone SCA fields from the security set when SAST covers them', () => {
    assert.equal(resolveFieldSet('security', { sastIncludesSca: true, sastIncludesSecrets: false }).length, 14);
  });

  it('drops the standalone secrets fields when SAST covers them', () => {
    // Same rule as SCA, and the two are independent.
    assert.equal(resolveFieldSet('security', { sastIncludesSca: false, sastIncludesSecrets: true }).length, 14);
    assert.equal(resolveFieldSet('security', { sastIncludesSca: true, sastIncludesSecrets: true }).length, 12);
  });

  it('drops the IaC tool fields when the team declares it not applicable', () => {
    // The declaration itself still counts — "we have no IaC" is a complete answer,
    // not two permanent gaps. Without this an application with no containers could
    // never reach 100% on its tooling and would fail 4.6.14 forever.
    const applies = { sastIncludesSca: false, sastIncludesSecrets: false, iacContainerScanNA: false };
    const notApplicable = { ...applies, iacContainerScanNA: true };
    assert.equal(resolveFieldSet('security', applies).length, 16);
    assert.equal(resolveFieldSet('security', notApplicable).length, 14);
    assert.ok(resolveFieldSet('security', notApplicable).includes('iacContainerScanNA'));
    assert.ok(!resolveFieldSet('security', notApplicable).includes('iacContainerScanTool'));
  });

  it('names only real fields, so a typo cannot count as permanently missing', () => {
    // A misspelled key would resolve to undefined on every application and read as an
    // unfillable gap forever - silently dragging every percentage down.
    assert.deepEqual(findUnknownFieldsInSets(), []);
  });

  it('declares a blank rule for every set', () => {
    for (const name of Object.keys(FIELD_SETS)) {
      assert.ok(SET_BLANK_RULES[name], `no blank rule declared for set "${name}"`);
    }
  });

  it('rejects an unknown set name', () => {
    assert.throws(() => resolveFieldSet('nope', {}), /Unknown completeness field set/);
  });
});

describe('per-set blank rules', () => {
  /**
   * The two prior implementations disagreed on whitespace-only values. The disagreement
   * is now resolved rather than preserved: `metadata` uses `trimmed`, which was always
   * the more defensible of the two — a description of three spaces is not a description.
   * `security` keeps `exact` because it is a different question and its numbers were
   * not part of the consolidation.
   */
  it('counts a whitespace-only value as blank for the metadata set', () => {
    const ws = countFieldSet({ language: '   ' }, 'metadata');
    const empty = countFieldSet({ language: '' }, 'metadata');
    assert.equal(ws.filled, empty.filled, 'whitespace is blank for metadata');
    assert.ok(ws.missing.includes('language'));
  });

  it('still counts a whitespace-only value as filled for the security set', () => {
    const ws = countFieldSet({ sastTool: '   ' }, 'security');
    const empty = countFieldSet({ sastTool: '' }, 'security');
    assert.equal(ws.filled - empty.filled, 1, 'whitespace counts as filled for security');
  });

  it('defaults an explicit field list to the trimmed rule', () => {
    const { filled } = countFieldSet({ description: '   ' }, ['description']);
    assert.equal(filled, 0);
  });
});
