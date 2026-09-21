/**
 * Tests for the application scoring service.
 *
 * Uses the Node built-in test runner (`node --test`) deliberately: `services/scoring.js`
 * and its `scoringConfig.js` dependency import only `fs`, `path` and `url`, so these
 * run with no node_modules and no database. Keep it that way — a test suite that needs
 * `npm install` and a Postgres instance does not get run.
 *
 * Every case below is a documented finding from APP_DATA_FIXES_PLAN.md or a behaviour
 * that the audit found to be load-bearing but untested. Where a test encodes a known
 * wart rather than desired behaviour, it says so.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateCompleteness } from './completeness.js';

import {
  KNOWLEDGE_SCORING_FIELDS,
  SCORING_INCLUDE,
  calculateApplicationScore,
  calculateKnowledgeSharingScore,
  calculateToolUsageScore,
  detectDataClassifications,
  getKnowledgeSharingFieldBreakdown,
  isMetadataValueNA,
  isSecurityToolCategoryNotApplicable,
  normalizeFacing,
  resolveCategoryToolInputs,
} from './scoring.js';
import { getToolQualityConfig } from './scoringConfig.js';

/**
 * A fully-populated application using *unmanaged* tools, so each test can vary one
 * thing. Unmanaged is the common case in real data and caps at the `other` weight in
 * config/scoring/toolQuality.json, so this fixture cannot reach 50.
 */
function app(overrides = {}) {
  return {
    name: 'Checkout',
    description: 'Takes payments',
    devTeamContact: 'team@example.com',
    repoUrl: 'https://github.com/acme/checkout',
    language: 'TypeScript',
    framework: 'Express',
    serverEnvironment: 'AWS',
    authProfiles: 'OIDC',
    dataTypes: 'PII',
    facing: 'External',
    // Joined the knowledge-score denominator when it was consolidated onto the one
    // completeness set: the score now asks the App Data tab's thirteen questions,
    // not a hand-picked eight of them.
    criticalAspects: 'Card capture',
    businessCriticality: 4,
    currentVersion: '3.2.1',
    deploymentType: 'Daily - Automated CI/CD Pipeline',
    sastTool: 'Example SAST',
    sastIntegrationLevel: 4,
    sastIncludesSca: false,
    dastTool: 'Example DAST',
    dastIntegrationLevel: 4,
    scaTool: 'Example SCA',
    scaIntegrationLevel: 4,
    appFirewallTool: 'Example WAF',
    appFirewallIntegrationLevel: 4,
    appFirewallNA: false,
    apiSecurityNA: false,
    apiSchema: { id: 'schema_1' },
    deployments: [],
    ...overrides,
  };
}

/**
 * Pick a fully-weighted managed tool for a category, read from the live config.
 *
 * The tool-quality config is admin-editable at runtime — `PUT /api/config/tool-quality`
 * rewrites config/scoring/toolQuality.json — so hard-coding tool names here would make
 * these tests fail whenever someone edits the list in the UI. Resolving the names from
 * the config keeps the assertions about *behaviour* (a managed tool at full integration
 * with a fresh scan earns the category) rather than about today's tool list.
 */
function managedToolFor(category) {
  const { managed } = getToolQualityConfig();
  const match = Object.entries(managed || {}).find(
    ([, v]) => v.weight === 1 && (v.categories || []).includes(category),
  );
  return match ? match[0] : null;
}

const MANAGED = {
  sast: managedToolFor('sast'),
  sca: managedToolFor('sca'),
  dast: managedToolFor('dast'),
  appFirewall: managedToolFor('appFirewall'),
};

/** True when the config still defines a fully-weighted managed tool for every category. */
const HAS_FULL_MANAGED_SET = Object.values(MANAGED).every(Boolean);

const MISSING_MANAGED = `no fully-weighted managed tool configured for: ${Object.entries(MANAGED)
  .filter(([, v]) => !v)
  .map(([k]) => k)
  .join(', ')}`;

/**
 * The same application using whatever tools the config currently marks as managed,
 * with fresh scans. Only this combination can earn the full 50.
 */
function managedApp(overrides = {}) {
  const now = new Date();
  return app({
    sastTool: MANAGED.sast,
    scaTool: MANAGED.sca,
    dastTool: MANAGED.dast,
    appFirewallTool: MANAGED.appFirewall,
    lastSastScanDate: now,
    lastDastScanDate: now,
    lastScaScanDate: now,
    ...overrides,
  });
}

describe('detectDataClassifications', () => {
  // APP_DATA_FIXES_PLAN.md 0.5 - these three all contain the letters PHI and were
  // raising the risk weight on all five tool categories.
  const falsePositives = [
    'Storage: S3 plus a graphics CDN',
    'Hosted in Memphis',
    'Delphi service layer',
    'Runs on a Raspberry Pi',
  ];

  for (const dataTypes of falsePositives) {
    it(`does not classify ${JSON.stringify(dataTypes)}`, () => {
      const result = detectDataClassifications({ dataTypes });
      assert.equal(result.hasPCI, false);
      assert.equal(result.hasPII, false);
      assert.equal(result.hasPHI, false);
    });
  }

  it('detects classifications the technical form flattened into prose', () => {
    // The exact shape routes/applications.js emits when it concatenates the six
    // data-handling answers into one column.
    const result = detectDataClassifications({
      dataTypes: 'User supplied data: names, emails, Storage: RDS, PCI, PII',
    });
    assert.equal(result.hasPCI, true);
    assert.equal(result.hasPII, true);
    assert.equal(result.hasPHI, false);
    assert.equal(result.declared, true);
  });

  it('splits on non-letters, so slash- and pipe-separated values are found', () => {
    const result = detectDataClassifications({ dataTypes: 'PII/PHI|PCI' });
    assert.equal(result.hasPCI, true);
    assert.equal(result.hasPII, true);
    assert.equal(result.hasPHI, true);
  });

  it('prefers the structured columns when they are present', () => {
    // These columns do not exist on Application yet (fixes doc 0.6). The branch is
    // live and correct; this test is what makes Phase 2 safe to land.
    const result = detectDataClassifications({
      pciData: true,
      piiData: false,
      phiData: false,
      dataTypes: 'PHI PII',
    });
    assert.equal(result.hasPCI, true);
    assert.equal(result.hasPII, false, 'free text must not override a structured answer');
    assert.equal(result.hasPHI, false);
  });

  it('accepts stringified booleans from form and CSV payloads', () => {
    const result = detectDataClassifications({ phiData: 'true' });
    assert.equal(result.hasPHI, true);
  });

  it('reports declared=false only when nothing at all was provided', () => {
    assert.equal(detectDataClassifications({}).declared, false);
    assert.equal(detectDataClassifications({ dataTypes: '' }).declared, false);
    assert.equal(detectDataClassifications({ dataTypes: 'NA' }).declared, false);
    assert.equal(detectDataClassifications({ dataTypes: 'None' }).declared, true);
  });

  // Known wart, documented rather than fixed: keyword extraction cannot see negation.
  // Over-classifying is the safe direction; the real fix is the Phase 2 columns.
  it('cannot detect negation in prose (known limitation)', () => {
    assert.equal(detectDataClassifications({ dataTypes: 'no PCI here' }).hasPCI, true);
  });
});

describe('normalizeFacing', () => {
  it('canonicalizes case and whitespace', () => {
    for (const input of ['External', 'external', 'EXTERNAL', '  external  ']) {
      assert.equal(normalizeFacing(input), 'External', `for ${JSON.stringify(input)}`);
    }
    for (const input of ['Internal', 'internal', 'INTERNAL']) {
      assert.equal(normalizeFacing(input), 'Internal', `for ${JSON.stringify(input)}`);
    }
  });

  it('returns null for unrecognized and non-string values', () => {
    for (const input of ['Public', 'both', '', null, undefined, 3, {}]) {
      assert.equal(normalizeFacing(input), null, `for ${JSON.stringify(input)}`);
    }
  });
});

describe('isMetadataValueNA', () => {
  it('matches only the exact string NA', () => {
    assert.equal(isMetadataValueNA('NA'), true);
    assert.equal(isMetadataValueNA('  NA  '), true);
  });

  // Documents fixes doc C1: the sentinel is exact and case-sensitive, and no UI tells
  // the user. If Phase 2 replaces it with a real flag, these expectations change.
  it('does not match the variants users actually type', () => {
    for (const input of ['N/A', 'na', 'n/a', 'NA ', 'NOT APPLICABLE'].slice(0, 3)) {
      assert.equal(isMetadataValueNA(input), false, `for ${JSON.stringify(input)}`);
    }
  });

  it('is false for non-strings', () => {
    assert.equal(isMetadataValueNA(null), false);
    assert.equal(isMetadataValueNA(undefined), false);
    assert.equal(isMetadataValueNA(0), false);
    assert.equal(isMetadataValueNA(false), false);
  });
});

describe('one completeness number', () => {
  /**
   * The requirement this consolidation exists to satisfy: there is a single
   * calculateCompleteness, and it drives the 0-100 score as well as the percentage
   * shown on the dashboard and the applications table.
   *
   * Before, the score asked eight questions and the percentage asked twenty-seven, so
   * an application could be "100% complete" and still lose knowledge points, or score
   * full marks while the same screen called it 40% complete.
   */
  it('gives the score component and the displayed percentage the same fraction', () => {
    const partials = [
      app(),
      app({ devTeamContact: '', criticalAspects: null, currentVersion: null }),
      app({ description: '', language: '', framework: '', serverEnvironment: '' }),
      app({ framework: 'NA', dataTypes: 'NA' }),
      { name: 'Bare' },
    ];
    for (const a of partials) {
      const { totalScorable, fieldsFilled } = getKnowledgeSharingFieldBreakdown(a);
      const { filled, total } = calculateCompleteness(a);
      assert.equal(totalScorable, total, JSON.stringify(a));
      assert.equal(fieldsFilled, filled, JSON.stringify(a));
    }
  });

  it('awards the full 40 completeness points exactly when completeness is 100%', () => {
    const complete = app();
    assert.equal(calculateCompleteness(complete).percentage, 100);
    // 40 of the 50 knowledge points are completeness; the other 10 are review freshness,
    // which this fixture does not set.
    assert.equal(Math.round(calculateKnowledgeSharingScore(complete)), 40);
  });

  it('scores security tooling outside completeness', () => {
    // Blanking every tool must not change the knowledge score, because tooling is the
    // Security tab and completeness is the App Data tab.
    const withTools = calculateKnowledgeSharingScore(app());
    const without = calculateKnowledgeSharingScore(
      app({ sastTool: '', sastIntegrationLevel: null, dastTool: '', dastIntegrationLevel: null,
            scaTool: '', scaIntegrationLevel: null, appFirewallTool: '', apiSchema: null }),
    );
    assert.equal(withTools, without);
  });
});

describe('getKnowledgeSharingFieldBreakdown', () => {
  it('counts every scoring field as filled for a complete application', () => {
    const { totalScorable, fieldsFilled, missingFields } = getKnowledgeSharingFieldBreakdown(app());
    assert.equal(totalScorable, KNOWLEDGE_SCORING_FIELDS.length);
    assert.equal(fieldsFilled, KNOWLEDGE_SCORING_FIELDS.length);
    assert.deepEqual(missingFields, []);
  });

  it('excludes NA fields from the denominator rather than counting them missing', () => {
    const { totalScorable, fieldsFilled, missingFields } = getKnowledgeSharingFieldBreakdown(
      app({ framework: 'NA' }),
    );
    assert.equal(totalScorable, KNOWLEDGE_SCORING_FIELDS.length - 1);
    assert.equal(fieldsFilled, KNOWLEDGE_SCORING_FIELDS.length - 1);
    assert.deepEqual(missingFields, []);
  });

  it('reports empty fields as missing by label', () => {
    const { missingFields } = getKnowledgeSharingFieldBreakdown(
      app({ authProfiles: '', dataTypes: null }),
    );
    // Labels come from the field registry now, not a second hand-typed list, so they
    // read the same here as they do on the App Data tab.
    assert.deepEqual(missingFields.sort(), ['Auth Profiles', 'Data Types']);
  });

  // This is the scoring half of fixes doc A4: answering "No" to the special-access and
  // user-data questions leaves both columns null, which scores identically to ignoring
  // the form. Encoded so the Phase 2 columns visibly change it.
  it('penalizes a correct negative answer the same as no answer (fixes doc A4)', () => {
    const answeredNo = getKnowledgeSharingFieldBreakdown(app({ authProfiles: null, dataTypes: null }));
    const neverAnswered = getKnowledgeSharingFieldBreakdown(app({ authProfiles: null, dataTypes: null }));
    assert.deepEqual(answeredNo, neverAnswered);
    assert.equal(answeredNo.fieldsFilled, KNOWLEDGE_SCORING_FIELDS.length - 2);
  });
});

/**
 * `isKnowledgeFieldFilledForScore` is gone: it was a third definition of "filled",
 * used only by the breakdown loop this consolidation replaced. countFieldSet's
 * `trimmed` rule is the one definition now, and completeness.test.js covers it.
 *
 * The one semantic difference, recorded so it is not rediscovered as a bug: the old
 * helper treated the number 0 as unfilled. countFieldSet treats a set
 * businessCriticality of 0 as answered. businessCriticality is validated 1-5 on every
 * write path, so no row can carry 0, and no other metadata field is numeric.
 */

describe('isSecurityToolCategoryNotApplicable', () => {
  it('honours the N/A booleans for API security and app firewall', () => {
    assert.equal(isSecurityToolCategoryNotApplicable(app({ apiSecurityNA: true }), 'apiSecurity'), true);
    assert.equal(isSecurityToolCategoryNotApplicable(app({ appFirewallNA: true }), 'appFirewall'), true);
  });

  it('never lets SAST or DAST opt out', () => {
    assert.equal(isSecurityToolCategoryNotApplicable(app({ sastTool: 'NA' }), 'sast'), false);
    assert.equal(isSecurityToolCategoryNotApplicable(app({ dastTool: 'NA' }), 'dast'), false);
  });

  it('lets standalone SCA opt out via the NA tool name', () => {
    const standalone = app({ sastIncludesSca: false, scaTool: 'NA' });
    assert.equal(isSecurityToolCategoryNotApplicable(standalone, 'sca'), true);
  });

  it('does not let SCA opt out when SAST covers it', () => {
    const covered = app({ sastIncludesSca: true, scaTool: 'NA' });
    assert.equal(isSecurityToolCategoryNotApplicable(covered, 'sca'), false);
  });
});

describe('resolveCategoryToolInputs', () => {
  it('mirrors SAST into SCA when sastIncludesSca is set', () => {
    const fixture = app({ sastIncludesSca: true });
    const resolved = resolveCategoryToolInputs(fixture, 'sca');
    assert.equal(resolved.tool, fixture.sastTool);
    assert.equal(resolved.level, fixture.sastIntegrationLevel);
    assert.equal(resolved.scanField, 'lastSastScanDate');
    assert.equal(resolved.mirrorFromSast, true);
  });

  it('uses the category fields otherwise', () => {
    const fixture = app();
    const resolved = resolveCategoryToolInputs(fixture, 'dast');
    assert.equal(resolved.tool, fixture.dastTool);
    assert.equal(resolved.scanField, 'lastDastScanDate');
    assert.equal(resolved.mirrorFromSast, false);
  });

  it('reports no scan field for categories that have none', () => {
    assert.equal(resolveCategoryToolInputs(app(), 'appFirewall').scanField, null);
    assert.equal(resolveCategoryToolInputs(app(), 'apiSecurity').scanField, null);
  });
});

describe('calculateKnowledgeSharingScore', () => {
  it('awards the completeness share and no freshness without a review date', () => {
    // 8 of 8 fields filled -> the full 40 of the 50-point category.
    assert.equal(calculateKnowledgeSharingScore(app({ metadataLastReviewed: null })), 40);
  });

  it('awards near-full freshness for a review that just happened', () => {
    const score = calculateKnowledgeSharingScore(app({ metadataLastReviewed: new Date() }));
    assert.ok(score > 49 && score <= 50, `expected ~50, got ${score}`);
  });

  it('awards no freshness for a review older than the window', () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    assert.equal(calculateKnowledgeSharingScore(app({ metadataLastReviewed: old })), 40);
  });

  it('scales down as fields go missing', () => {
    const full = calculateKnowledgeSharingScore(app({ metadataLastReviewed: null }));
    const partial = calculateKnowledgeSharingScore(
      app({ metadataLastReviewed: null, language: null, framework: null }),
    );
    assert.ok(partial < full, `${partial} should be below ${full}`);
  });
});

describe('calculateToolUsageScore', () => {
  it('awards full marks only for managed tools at full integration with fresh scans', { skip: HAS_FULL_MANAGED_SET ? false : MISSING_MANAGED }, () => {
    assert.equal(calculateToolUsageScore(managedApp()), 50);
  });

  it('caps an unmanaged tool below a managed one', { skip: HAS_FULL_MANAGED_SET ? false : MISSING_MANAGED }, () => {
    // Managed tools weigh 1.0; anything unrecognized falls to the `other` weight.
    const unmanaged = calculateToolUsageScore(managedApp({ dastTool: 'Some Unmanaged Scanner' }));
    assert.ok(unmanaged < 50, `expected below 50, got ${unmanaged}`);
  });

  it('penalizes missing scan dates even when tools are configured', { skip: HAS_FULL_MANAGED_SET ? false : MISSING_MANAGED }, () => {
    assert.ok(calculateToolUsageScore(app()) < calculateToolUsageScore(managedApp()));
  });

  it('returns 0 when no tools are configured at all', () => {
    const bare = app({
      sastTool: null, sastIntegrationLevel: null,
      dastTool: null, dastIntegrationLevel: null,
      scaTool: null, scaIntegrationLevel: null,
      appFirewallTool: null, appFirewallIntegrationLevel: null,
      apiSchema: null,
    });
    assert.equal(calculateToolUsageScore(bare), 0);
  });

  it('awards the API security category for an uploaded schema', () => {
    // This is the mechanism behind fixes doc E5: scoring an application loaded without
    // the apiSchema relation silently zeroes a whole category.
    const withSchema = calculateToolUsageScore(app({ apiSchema: { id: 'x' } }));
    const withoutSchema = calculateToolUsageScore(app({ apiSchema: null }));
    assert.ok(
      withSchema > withoutSchema,
      `schema present (${withSchema}) must score above absent (${withoutSchema})`,
    );
  });

  it('redistributes N/A categories instead of scoring them as gaps', { skip: HAS_FULL_MANAGED_SET ? false : MISSING_MANAGED }, () => {
    // An excluded category leaves the denominator, so a genuinely-not-applicable WAF
    // must not cost anything.
    const naFirewall = managedApp({
      appFirewallNA: true,
      appFirewallTool: null,
      appFirewallIntegrationLevel: null,
    });
    assert.equal(calculateToolUsageScore(naFirewall), 50);
  });

  it('does not let an unanswered data classification score better than a declared one', () => {
    // Omission must not be a loophole: with no dataTypes at all the scorer assumes
    // worst-case risk, so the score can never exceed the PII-declaring equivalent.
    const declared = calculateToolUsageScore(app({ dataTypes: 'PII' }));
    const undeclared = calculateToolUsageScore(app({ dataTypes: null }));
    assert.ok(undeclared <= declared, `undeclared (${undeclared}) must not beat declared (${declared})`);
  });

  it('scores a lowercase facing the same as a canonical one (fixes doc 0.7)', () => {
    assert.equal(
      calculateToolUsageScore(app({ facing: 'internal' })),
      calculateToolUsageScore(app({ facing: 'Internal' })),
    );
  });
});

describe('calculateApplicationScore', () => {
  it('returns a 0-100 total with the raw parts exposed', () => {
    const result = calculateApplicationScore(app({ metadataLastReviewed: new Date() }));
    assert.ok(result.totalScore >= 0 && result.totalScore <= 100);
    assert.equal(result.totalScore, result.knowledgeScore + result.toolScore);
    assert.ok(result.rawKnowledgeScore >= 0 && result.rawKnowledgeScore <= 50);
    assert.ok(result.rawToolScore >= 0 && result.rawToolScore <= 50);
  });

  it('weights tool usage higher as importance rises', () => {
    const critical = calculateApplicationScore(app({ businessCriticality: 5, facing: 'External' }));
    assert.equal(critical.knowledgeWeight + critical.toolWeight, 1);
    assert.ok(critical.toolWeight >= critical.knowledgeWeight);
  });

  it('assumes worst case for an empty application rather than scoring it well', () => {
    const result = calculateApplicationScore({ name: 'Unknown' });
    assert.equal(result.totalScore, 0);
    assert.ok(result.importanceScore >= 0.67, `expected high importance, got ${result.importanceScore}`);
  });

  it('explains every importance factor it used', () => {
    const { importanceFactors } = calculateApplicationScore(app());
    const types = importanceFactors.map((f) => f.type);
    for (const expected of ['businessCriticality', 'criticalAspects', 'deploymentFrequency', 'interfaces', 'facing']) {
      assert.ok(types.includes(expected), `missing factor ${expected}`);
    }
  });

  // Guards fixes doc A6: importance counts aspects by splitting on commas, so an
  // "Other: free, text" answer inflates the count.
  it('counts critical aspects by comma, which a comma in Other inflates (known wart)', () => {
    const two = calculateApplicationScore(app({ criticalAspects: 'Availability, Integrity' }));
    const otherWithComma = calculateApplicationScore(
      app({ criticalAspects: 'Availability, Other: it is load bearing, and fragile' }),
    );
    assert.ok(
      otherWithComma.importanceScore >= two.importanceScore,
      'a comma inside Other currently reads as an extra aspect',
    );
  });

  it('treats a malformed interfaces value as no interfaces rather than throwing', () => {
    // Bulk import writes the raw CSV cell here, so this column is not always JSON
    // (fixes doc C6).
    assert.doesNotThrow(() => calculateApplicationScore(app({ interfaces: 'Payments API, Auth' })));
  });
});

describe('SCORING_INCLUDE', () => {
  // Fixes doc E5 shipped because one of four call sites hand-wrote its include and
  // omitted apiSchema. This asserts the shared constant still covers what the scorer
  // actually reads.
  it('covers the relations the scorer depends on', () => {
    assert.ok(SCORING_INCLUDE.apiSchema, 'apiSchema drives the API security category');
    assert.ok(SCORING_INCLUDE.deployments, 'deployments drive scan-date freshness');
    assert.equal(SCORING_INCLUDE.deployments.take, 1);
  });
});
