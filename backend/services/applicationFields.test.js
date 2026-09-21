/**
 * Tests for the application metadata field registry.
 *
 * The first suite is a golden test: it pins the literal field lists that were
 * hand-maintained before the registry existed, and asserts the derived lists match them
 * exactly. That is what makes extracting the registry a provably behaviour-preserving
 * refactor rather than a rewrite — a field accidentally dropped, added or reordered
 * fails here.
 *
 * When a field is deliberately added or removed, update the golden list in the same
 * commit. Changing it should be a visible, reviewable act; that is the whole point.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  APPLICATION_METADATA_FIELDS,
  METADATA_FIELD_BY_KEY,
  METADATA_FIELD_KEYS,
  APPROVABLE_METADATA_FIELDS,
  SPLITTABLE_METADATA_FIELDS,
  VERSIONED_METADATA_FIELDS,
  compareVersions,
  isApprovableMetadataField,
  isMetadataField,
  metadataFieldLabel,
  pickVersionedMetadata,
} from './applicationFields.js';

/**
 * Verbatim copy of `fieldsToCompare` / `fieldsToApply` from utils/applicationVersion.js
 * as they stood immediately before the registry was introduced (main @ cb149b1).
 */
const GOLDEN_VERSIONED_FIELDS = [
  'name', 'description', 'owner', 'repoUrl', 'language', 'framework',
  'serverEnvironment', 'facing', 'deploymentType', 'authProfiles', 'dataTypes',
  'status', 'businessCriticality', 'criticalAspects', 'devTeamContact',
  'securityTestingDescription', 'additionalNotes', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
  'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel', 'appFirewallTool', 'appFirewallIntegrationLevel',
  'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
  'appFirewallNA',
  'currentVersion', 'deploymentEnvironment', 'gitBranch',
  'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate', 'interfaces',
];

/** Verbatim copy of SPLITTABLE_METADATA_FIELDS from utils/applicationSplitFields.js. */
const GOLDEN_SPLITTABLE_FIELDS = [
  'description', 'owner', 'repoUrl', 'language', 'framework', 'serverEnvironment',
  'facing', 'deploymentType', 'authProfiles', 'dataTypes',
  'businessCriticality', 'criticalAspects', 'devTeamContact',
  'securityTestingDescription', 'sastTool', 'sastIntegrationLevel', 'sastIncludesSca',
  'dastTool', 'dastIntegrationLevel', 'scaTool', 'scaIntegrationLevel',
  'appFirewallTool', 'appFirewallIntegrationLevel', 'appFirewallNA',
  'apiSecurityTool', 'apiSecurityIntegrationLevel', 'apiSecurityNA',
  'currentVersion', 'deploymentEnvironment', 'gitBranch',
  'lastDastScanDate', 'lastSastScanDate', 'lastScaScanDate',
  'additionalNotes',
];

/**
 * Fields added to the registry after it was extracted. The golden lists above stay a
 * verbatim copy of the pre-registry state, so the extraction remains provably
 * behaviour-preserving; anything added since is declared here instead. Adding a field
 * means adding a line here, which is the visible, reviewable act the header asks for.
 *
 * Secrets scanning and IaC/container scanning (POLICY_CONTROL_COVERAGE_PLAN.md Phase 6a)
 * plus metadataLastReviewed, a pre-existing column that was missing from the registry.
 *
 * All are approvable:false — the technical onboarding form does not post them, so a
 * pending version could only ever carry a stale copy. Same reasoning as the scan dates.
 */
const ADDED_SINCE_REGISTRY = [
  'secretsScanTool', 'secretsScanIntegrationLevel', 'sastIncludesSecrets',
  'iacContainerScanTool', 'iacContainerScanIntegrationLevel',
  'lastSecretsScanDate', 'lastIacContainerScanDate',
];

/**
 * Also added: `metadataLastReviewed`, a pre-existing column the registry did not list.
 * It is versioned:false, so it appears in METADATA_FIELD_KEYS — which is what lets a
 * policy control target it — without entering version snapshots. The
 * pickVersionedMetadata suite below pins that exclusion.
 */
const ADDED_UNVERSIONED = ['metadataLastReviewed'];

/** Of the versioned additions, the ones that are not splittable. Currently none. */
const ADDED_SINCE_REGISTRY_NOT_SPLITTABLE = [];

describe('registry matches the lists it replaced', () => {
  it('derives the versioned field list in the same order', () => {
    // The golden fields keep their original relative order; additions are appended.
    const withoutAdditions = VERSIONED_METADATA_FIELDS.filter(
      (k) => !ADDED_SINCE_REGISTRY.includes(k),
    );
    assert.deepEqual(withoutAdditions, GOLDEN_VERSIONED_FIELDS);
    assert.deepEqual(
      VERSIONED_METADATA_FIELDS.filter((k) => ADDED_SINCE_REGISTRY.includes(k)).sort(),
      [...ADDED_SINCE_REGISTRY].sort(),
      'every field added since the registry must still be versioned',
    );
  });

  it('derives the splittable field set', () => {
    // Order is not contractual for splits (the route spreads it into an object), so
    // compare as sets while still catching an added or dropped field.
    const expected = [
      ...GOLDEN_SPLITTABLE_FIELDS,
      ...ADDED_SINCE_REGISTRY.filter((k) => !ADDED_SINCE_REGISTRY_NOT_SPLITTABLE.includes(k)),
    ];
    assert.deepEqual([...SPLITTABLE_METADATA_FIELDS].sort(), expected.sort());
  });

  it('excludes the derived fields from approval', () => {
    // No intake form posts any of these six, so a pending version can only carry a
    // stale copy taken at submit time. Applying it would revert whatever a deploy,
    // a scanner integration or an admin set in the meantime. They stay versioned so
    // history still records when they changed.
    const notApprovable = VERSIONED_METADATA_FIELDS.filter((k) => !APPROVABLE_METADATA_FIELDS.includes(k));
    assert.deepEqual(notApprovable.sort(), [
      'currentVersion',
      'deploymentEnvironment',
      'gitBranch',
      'lastDastScanDate',
      'lastSastScanDate',
      'lastScaScanDate',
      // Added since; the onboarding form posts none of them either.
      ...ADDED_SINCE_REGISTRY,
    ].sort());
  });

  it('excludes exactly name, status and interfaces from splits', () => {
    // Documented in the old applicationSplitFields.js header: a split sets both names
    // itself, always copies status, and never copies relational data.
    const versioned = new Set(VERSIONED_METADATA_FIELDS);
    const splittable = new Set(SPLITTABLE_METADATA_FIELDS);
    const versionedOnly = [...versioned].filter((k) => !splittable.has(k));
    assert.deepEqual(
      versionedOnly.sort(),
      ['interfaces', 'name', 'status', ...ADDED_SINCE_REGISTRY_NOT_SPLITTABLE].sort(),
    );
    // A registry field that is not versioned is in neither set.
    for (const key of ADDED_UNVERSIONED) {
      assert.ok(isMetadataField(key), `${key} should be a registry field`);
      assert.ok(!versioned.has(key), `${key} must not be versioned`);
    }
  });
});

describe('registry integrity', () => {
  it('has no duplicate keys', () => {
    assert.equal(new Set(METADATA_FIELD_KEYS).size, METADATA_FIELD_KEYS.length);
  });

  it('gives every field a key, label, group and known type', () => {
    const types = new Set(['string', 'int', 'boolean', 'datetime', 'json']);
    for (const field of APPLICATION_METADATA_FIELDS) {
      assert.ok(field.key, 'missing key');
      assert.ok(field.label, `${field.key} has no label`);
      assert.ok(field.group, `${field.key} has no group`);
      assert.ok(types.has(field.type), `${field.key} has unknown type ${field.type}`);
      assert.equal(typeof field.versioned, 'boolean', `${field.key}.versioned`);
      assert.equal(typeof field.approvable, 'boolean', `${field.key}.approvable`);
      assert.equal(typeof field.splittable, 'boolean', `${field.key}.splittable`);
    }
  });

  it('is frozen, so a consumer cannot mutate the shared list', () => {
    assert.throws(() => APPLICATION_METADATA_FIELDS.push({ key: 'nope' }));
    assert.throws(() => {
      METADATA_FIELD_BY_KEY.name.label = 'changed';
    });
  });

  it('indexes every field by key', () => {
    for (const field of APPLICATION_METADATA_FIELDS) {
      assert.equal(METADATA_FIELD_BY_KEY[field.key], field);
    }
  });
});

describe('isApprovableMetadataField', () => {
  it('rejects derived fields and unknown keys', () => {
    assert.equal(isApprovableMetadataField('sastTool'), true);
    assert.equal(isApprovableMetadataField('lastSastScanDate'), false);
    assert.equal(isApprovableMetadataField('lastScaScanDate'), false);
    assert.equal(isApprovableMetadataField('lastDastScanDate'), false, 'written by the deploy path');
    assert.equal(isApprovableMetadataField('currentVersion'), false);
    assert.equal(isApprovableMetadataField('deploymentEnvironment'), false);
    assert.equal(isApprovableMetadataField('gitBranch'), false);
    assert.equal(isApprovableMetadataField('nope'), false);
    assert.equal(isApprovableMetadataField('constructor'), false);
  });
});

describe('isMetadataField / metadataFieldLabel', () => {
  it('recognizes real fields and rejects others', () => {
    assert.equal(isMetadataField('sastTool'), true);
    assert.equal(isMetadataField('sastTools'), false, 'a typo must not resolve');
    assert.equal(isMetadataField('companyId'), false, 'not metadata');
    // Must not be fooled by inherited object properties.
    assert.equal(isMetadataField('constructor'), false);
    assert.equal(isMetadataField('toString'), false);
  });

  it('falls back to the key for an unknown field', () => {
    assert.equal(metadataFieldLabel('sastTool'), 'SAST Tool');
    assert.equal(metadataFieldLabel('nope'), 'nope');
  });
});

describe('pickVersionedMetadata', () => {
  it('copies every versioned field and nothing else', () => {
    const row = {
      id: 'app_1',
      companyId: 'co_1',
      metadataLastReviewed: new Date(),
      name: 'Checkout',
      sastTool: 'Snyk',
    };
    const picked = pickVersionedMetadata(row);
    assert.deepEqual(Object.keys(picked), [...VERSIONED_METADATA_FIELDS]);
    assert.equal(picked.name, 'Checkout');
    assert.equal(picked.sastTool, 'Snyk');
    assert.ok(!('id' in picked));
    assert.ok(!('companyId' in picked));
    assert.ok(!('metadataLastReviewed' in picked), 'deliberately excluded from snapshots');
  });

  it('normalizes absent fields to null rather than leaving them undefined', () => {
    const picked = pickVersionedMetadata({});
    for (const key of VERSIONED_METADATA_FIELDS) {
      assert.equal(picked[key], null, `${key} should be null`);
    }
  });
});

describe('compareVersions', () => {
  it('reports no change between identical versions', () => {
    const v = { name: 'Checkout', sastTool: 'Snyk', businessCriticality: 4 };
    const { changedFields, diff } = compareVersions(v, { ...v });
    assert.deepEqual(changedFields, []);
    assert.deepEqual(diff, {});
  });

  it('reports a changed field with from and to', () => {
    const { changedFields, diff } = compareVersions({ sastTool: 'Snyk' }, { sastTool: 'Semgrep' });
    assert.deepEqual(changedFields, ['sastTool']);
    assert.deepEqual(diff.sastTool, { from: 'Snyk', to: 'Semgrep' });
  });

  it('treats null, undefined and absent as the same value', () => {
    assert.deepEqual(compareVersions({ sastTool: null }, { sastTool: undefined }).changedFields, []);
    assert.deepEqual(compareVersions({}, { sastTool: null }).changedFields, []);
  });

  it('detects clearing a value and setting one', () => {
    assert.deepEqual(compareVersions({ sastTool: 'Snyk' }, { sastTool: null }).changedFields, ['sastTool']);
    assert.deepEqual(compareVersions({ sastTool: null }, { sastTool: 'Snyk' }).changedFields, ['sastTool']);
  });

  it('ignores whitespace-only differences in strings', () => {
    assert.deepEqual(compareVersions({ sastTool: 'Snyk' }, { sastTool: '  Snyk  ' }).changedFields, []);
  });

  it('compares dates by instant, not representation', () => {
    const iso = '2026-01-15T10:30:00.000Z';
    assert.deepEqual(
      compareVersions({ lastSastScanDate: new Date(iso) }, { lastSastScanDate: iso }).changedFields,
      [],
      'a Date and its ISO string are the same instant',
    );
    assert.deepEqual(
      compareVersions({ lastSastScanDate: iso }, { lastSastScanDate: '2026-01-16T10:30:00.000Z' }).changedFields,
      ['lastSastScanDate'],
    );
  });

  it('treats an unparseable date as absent rather than throwing', () => {
    assert.doesNotThrow(() => compareVersions({ lastSastScanDate: 'not a date' }, {}));
    assert.deepEqual(compareVersions({ lastSastScanDate: 'not a date' }, {}).changedFields, []);
  });

  it('distinguishes false from null for booleans', () => {
    // This matters for the nullable N/A flags: "answered no" and "not answered" are
    // different facts, even though @default(false) currently hides the distinction.
    assert.deepEqual(compareVersions({ apiSecurityNA: false }, { apiSecurityNA: null }).changedFields, ['apiSecurityNA']);
    assert.deepEqual(compareVersions({ apiSecurityNA: false }, { apiSecurityNA: true }).changedFields, ['apiSecurityNA']);
    assert.deepEqual(compareVersions({ apiSecurityNA: true }, { apiSecurityNA: true }).changedFields, []);
  });

  it('compares ints numerically regardless of string or number form', () => {
    assert.deepEqual(compareVersions({ businessCriticality: 4 }, { businessCriticality: '4' }).changedFields, []);
    assert.deepEqual(compareVersions({ businessCriticality: 4 }, { businessCriticality: 5 }).changedFields, ['businessCriticality']);
  });

  it('never reports a non-metadata field, even when it differs', () => {
    const { changedFields } = compareVersions(
      { id: 'v1', createdBy: 'user_a', approvalStatus: 'approved', name: 'Checkout' },
      { id: 'v2', createdBy: 'user_b', approvalStatus: 'pending', name: 'Checkout' },
    );
    assert.deepEqual(changedFields, [], 'version bookkeeping is not application metadata');
  });

  it('handles null and undefined version arguments', () => {
    assert.doesNotThrow(() => compareVersions(null, undefined));
    assert.deepEqual(compareVersions(null, undefined).changedFields, []);
  });

  it('returns changed fields in canonical order', () => {
    const { changedFields } = compareVersions(
      { interfaces: '[]', name: 'A', sastTool: 'X' },
      { interfaces: '["b"]', name: 'B', sastTool: 'Y' },
    );
    // name comes first and interfaces last in the registry, whatever order the caller
    // happened to build its objects in.
    assert.deepEqual(changedFields, ['name', 'sastTool', 'interfaces']);
  });
});
