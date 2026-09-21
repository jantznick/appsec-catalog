/**
 * Which security tools the 0-100 score actually grades.
 *
 * WHY THIS TEST EXISTS
 *
 * `calculateToolUsageScore` iterates a hand-written list of five categories. A tool
 * field can be added to the registry, collected on three forms, stored, versioned,
 * approved and mapped to a policy control without ever entering that list — and
 * nothing says so. The application looks fully wired and the score ignores it.
 *
 * That happened. Secrets scanning and IaC/container scanning were added in Phase 6a
 * and counted toward completeness via the `record` field set. When completeness was
 * narrowed to application metadata, that was the only number they moved, so they
 * silently stopped affecting any score at all.
 *
 * This test does not say the list is right. It says the list is a decision: a tool
 * field that is not graded has to be named here, with a reason, in the same commit
 * that adds it.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { APPLICATION_METADATA_FIELDS } from './applicationFields.js';
import {
  SCORED_TOOL_CATEGORIES,
  calculateApplicationScore,
  resolveCategoryToolInputs,
} from './scoring.js';

/**
 * Tool fields the score does not grade, and why.
 *
 * EMPTY IS THE GOAL. Every entry is a column a team could fill in that earns them
 * nothing.
 */
const UNGRADED_TOOL_FIELDS = {
  // There is no API security tool in this product. The apiSecurity category is scored
  // entirely from the uploaded OpenAPI schema (`app.apiSchema`), so this column and its
  // integration level are dead: no form renders an input for either, nothing reads
  // them, and VersionHistory and PendingApprovals hide them by name.
  apiSecurityTool: 'no such concept — apiSecurity is scored from the uploaded schema',
};

/**
 * Categories scored from something other than a `${category}Tool` column.
 * Only apiSecurity, which reads the schema relation.
 */
const NOT_TOOL_DRIVEN = new Set(['apiSecurity']);

describe('the tool score grades the tools the catalogue collects', () => {
  const toolFields = APPLICATION_METADATA_FIELDS.filter(
    (f) => f.group === 'security' && f.key.endsWith('Tool'),
  ).map((f) => f.key);

  it('finds the tool fields to check', () => {
    // Guards the assertions below against a filter that quietly matches nothing.
    assert.ok(toolFields.length >= 5, `expected several tool fields, got ${toolFields.length}`);
  });

  it('grades every tool field that is not explicitly excluded', () => {
    const graded = new Set(
      SCORED_TOOL_CATEGORIES.filter((c) => !NOT_TOOL_DRIVEN.has(c)).map((c) => `${c}Tool`),
    );
    const ungraded = toolFields.filter((k) => !graded.has(k));
    assert.deepEqual(
      ungraded.sort(),
      Object.keys(UNGRADED_TOOL_FIELDS).sort(),
      'a tool field is neither graded nor listed as ungraded — decide which',
    );
  });

  it('resolves a real field pair for every scored category', () => {
    // The category name is used to build `${category}Tool`, so a typo yields undefined
    // for every application and the category silently scores zero for the portfolio.
    const keys = new Set(APPLICATION_METADATA_FIELDS.map((f) => f.key));
    for (const category of SCORED_TOOL_CATEGORIES) {
      if (NOT_TOOL_DRIVEN.has(category)) continue;
      assert.ok(keys.has(`${category}Tool`), `no ${category}Tool field in the registry`);
      assert.ok(
        keys.has(`${category}IntegrationLevel`),
        `no ${category}IntegrationLevel field in the registry`,
      );
      const inputs = resolveCategoryToolInputs({ [`${category}Tool`]: 'x' }, category);
      assert.equal(inputs.tool, 'x', `${category} does not resolve its own tool field`);
    }
  });

  it('grades secrets and IaC/container scanning', () => {
    // They were collected on three forms, versioned, approved and policy-mapped while
    // scoring nothing at all. Stated as a number so a regression is unmistakable.
    const base = {
      name: 'Checkout', description: 'd', repoUrl: 'https://x/y', devTeamContact: 't@x',
      criticalAspects: 'Card capture', businessCriticality: 4, language: 'TS',
      framework: 'Express', serverEnvironment: 'AWS', currentVersion: '1.0',
      facing: 'External', deploymentType: 'Daily', authProfiles: 'OIDC', dataTypes: 'PII',
      sastTool: 'Snyk', sastIntegrationLevel: 4, sastIncludesSca: false,
      dastTool: 'Tenable WAS', dastIntegrationLevel: 4,
      scaTool: 'Snyk', scaIntegrationLevel: 4,
      appFirewallTool: 'Fastly NGWAF', appFirewallIntegrationLevel: 4,
      apiSchema: { id: 's1' }, apiSecurityNA: false, appFirewallNA: false, deployments: [],
      sastIncludesSecrets: false,
    };
    const without = calculateApplicationScore({
      ...base,
      secretsScanTool: '', secretsScanIntegrationLevel: null,
      iacContainerScanTool: '', iacContainerScanIntegrationLevel: null, iacContainerScanNA: null,
    });
    const with_ = calculateApplicationScore({
      ...base,
      secretsScanTool: 'Some Scanner', secretsScanIntegrationLevel: 4,
      iacContainerScanTool: 'Trivy', iacContainerScanIntegrationLevel: 4, iacContainerScanNA: false,
    });
    assert.ok(
      with_.totalScore > without.totalScore,
      `filling in secrets and IaC scanning must raise the score (${without.totalScore} -> ${with_.totalScore})`,
    );
  });

  it('does not penalise an application that has declared IaC not applicable', () => {
    // The N/A declaration removes the category from the denominator, so an application
    // with no containers is scored on the tooling it can actually have. Without this it
    // would carry a permanent zero in a category it can never fill.
    const base = {
      name: 'A', description: 'd', repoUrl: 'r', devTeamContact: 't', criticalAspects: 'c',
      businessCriticality: 4, language: 'TS', framework: 'E', serverEnvironment: 'AWS',
      currentVersion: '1', facing: 'External', deploymentType: 'Daily',
      authProfiles: 'OIDC', dataTypes: 'PII',
      sastTool: 'Snyk', sastIntegrationLevel: 4, sastIncludesSca: false,
      dastTool: 'Tenable WAS', dastIntegrationLevel: 4, scaTool: 'Snyk', scaIntegrationLevel: 4,
      secretsScanTool: 'Some Scanner', secretsScanIntegrationLevel: 4, sastIncludesSecrets: false,
      appFirewallTool: 'Fastly NGWAF', appFirewallIntegrationLevel: 4,
      apiSchema: { id: 'x' }, apiSecurityNA: false, appFirewallNA: false, deployments: [],
      iacContainerScanTool: '', iacContainerScanIntegrationLevel: null,
    };
    const unanswered = calculateApplicationScore({ ...base, iacContainerScanNA: null });
    const declaredNA = calculateApplicationScore({ ...base, iacContainerScanNA: true });
    assert.ok(
      declaredNA.totalScore > unanswered.totalScore,
      `declaring N/A must beat leaving it unanswered (${unanswered.totalScore} vs ${declaredNA.totalScore})`,
    );
  });

  it('scores a SAST tool that also covers secrets, without a standalone entry', () => {
    // Same rule as sastIncludesSca: the team was told to leave the standalone fields
    // blank, so reading them would score zero for work that is being done.
    const base = {
      name: 'A', description: 'd', repoUrl: 'r', devTeamContact: 't', criticalAspects: 'c',
      businessCriticality: 4, language: 'TS', framework: 'E', serverEnvironment: 'AWS',
      currentVersion: '1', facing: 'External', deploymentType: 'Daily',
      authProfiles: 'OIDC', dataTypes: 'PII',
      sastTool: 'Snyk', sastIntegrationLevel: 4, sastIncludesSca: false,
      dastTool: 'Tenable WAS', dastIntegrationLevel: 4, scaTool: 'Snyk', scaIntegrationLevel: 4,
      appFirewallTool: 'Fastly NGWAF', appFirewallIntegrationLevel: 4,
      apiSchema: { id: 'x' }, apiSecurityNA: false, appFirewallNA: false, deployments: [],
      iacContainerScanNA: true,
      secretsScanTool: '', secretsScanIntegrationLevel: null,
    };
    const standaloneBlank = calculateApplicationScore({ ...base, sastIncludesSecrets: false });
    const coveredBySast = calculateApplicationScore({ ...base, sastIncludesSecrets: true });
    assert.ok(
      coveredBySast.totalScore > standaloneBlank.totalScore,
      `SAST covering secrets must score (${standaloneBlank.totalScore} vs ${coveredBySast.totalScore})`,
    );
  });
});
