/**
 * Tests for submission tracking on pending versions.
 *
 * See the note at the top of scoring.test.js on why this uses `node --test` with no
 * dependencies.
 *
 * The behaviour under test is what the approval queue depends on, and its failure modes
 * are silent: a field that should be applied and is not looks identical to one that was
 * never submitted, and a field applied that should not be silently reverts someone's
 * edit. Every case below is one of those.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { APPROVABLE_METADATA_FIELDS, VERSIONED_METADATA_FIELDS } from './applicationFields.js';
import {
  buildSubmission,
  coerceSubmittedValue,
  parseSubmittedFields,
  resolveFieldsToApply,
  serializeSubmittedFields,
} from './versionSubmission.js';

describe('serializeSubmittedFields / parseSubmittedFields', () => {
  it('round-trips a field list', () => {
    const fields = ['sastTool', 'dastTool'];
    assert.deepEqual(parseSubmittedFields(serializeSubmittedFields(fields)), fields);
  });

  it('serializes an empty list as null, not an empty string', () => {
    // An empty string would parse back as [] and read as "submitted nothing", which is
    // a different claim from "we do not know what was submitted".
    assert.equal(serializeSubmittedFields([]), null);
  });

  it('drops anything that is not a registry field', () => {
    assert.equal(serializeSubmittedFields(['sastTool', 'nope', 'constructor']), 'sastTool');
  });

  it('de-duplicates', () => {
    assert.equal(serializeSubmittedFields(['sastTool', 'sastTool']), 'sastTool');
  });

  /**
   * The compatibility contract. A version created before the column existed parses as
   * null, and null must mean "unknown", not "nothing". Reading it as an empty list would
   * make every queued legacy version apply nothing on approval — silently doing less
   * than the admin asked for.
   */
  it('parses a missing value as null rather than an empty list', () => {
    assert.equal(parseSubmittedFields(null), null);
    assert.equal(parseSubmittedFields(undefined), null);
    assert.deepEqual(parseSubmittedFields(''), []);
  });

  it('tolerates whitespace in a stored value', () => {
    assert.deepEqual(parseSubmittedFields(' sastTool , dastTool '), ['sastTool', 'dastTool']);
  });
});

describe('coerceSubmittedValue', () => {
  it('trims strings and treats blank as a deliberate clear', () => {
    assert.equal(coerceSubmittedValue('  Snyk  ', 'sastTool'), 'Snyk');
    assert.equal(coerceSubmittedValue('', 'sastTool'), null);
    assert.equal(coerceSubmittedValue('   ', 'sastTool'), null);
  });

  it('keeps false as an answer rather than an absence', () => {
    // The whole unchecked-checkbox bug: false must not become "not submitted".
    assert.equal(coerceSubmittedValue(false, 'apiSecurityNA'), false);
    assert.equal(coerceSubmittedValue('false', 'apiSecurityNA'), false);
    assert.equal(coerceSubmittedValue(true, 'apiSecurityNA'), true);
    assert.equal(coerceSubmittedValue('true', 'apiSecurityNA'), true);
  });

  it('keeps integration level 0 as an answer', () => {
    // 0 is a real level ("Unknown / Nothing"), not an empty field.
    assert.equal(coerceSubmittedValue(0, 'sastIntegrationLevel'), 0);
    assert.equal(coerceSubmittedValue('0', 'sastIntegrationLevel'), 0);
  });

  it('parses integers and rejects junk rather than storing NaN', () => {
    assert.equal(coerceSubmittedValue('3', 'sastIntegrationLevel'), 3);
    assert.equal(coerceSubmittedValue(3.7, 'sastIntegrationLevel'), 3);
    assert.equal(coerceSubmittedValue('abc', 'sastIntegrationLevel'), null);
    assert.equal(coerceSubmittedValue('', 'sastIntegrationLevel'), null);
  });

  it('parses dates and rejects unparseable ones', () => {
    const iso = '2026-01-15T10:30:00.000Z';
    assert.equal(coerceSubmittedValue(iso, 'lastSastScanDate').toISOString(), iso);
    assert.equal(coerceSubmittedValue('not a date', 'lastSastScanDate'), null);
    assert.equal(coerceSubmittedValue('', 'lastSastScanDate'), null);
  });

  it('passes JSON through and treats blank as no relations', () => {
    assert.equal(coerceSubmittedValue('["a"]', 'interfaces'), '["a"]');
    assert.equal(coerceSubmittedValue('', 'interfaces'), null);
    assert.equal(coerceSubmittedValue(null, 'interfaces'), null);
  });

  it('maps null and undefined to null for every type', () => {
    for (const field of ['sastTool', 'sastIntegrationLevel', 'apiSecurityNA', 'lastSastScanDate']) {
      assert.equal(coerceSubmittedValue(null, field), null, field);
      assert.equal(coerceSubmittedValue(undefined, field), null, field);
    }
  });
});

describe('buildSubmission', () => {
  const baseline = { sastTool: 'Snyk', dastTool: 'ZAP', apiSecurityNA: true, name: 'Checkout' };

  it('keeps unsubmitted fields at their baseline value', () => {
    const { versionData, submittedFields } = buildSubmission(baseline, {});
    assert.deepEqual(versionData, baseline, 'the snapshot stays complete');
    assert.deepEqual(submittedFields, []);
  });

  it('overrides a submitted field and records it', () => {
    const { versionData, submittedFields } = buildSubmission(baseline, { sastTool: 'Semgrep' });
    assert.equal(versionData.sastTool, 'Semgrep');
    assert.equal(versionData.dastTool, 'ZAP', 'untouched fields keep the baseline');
    assert.deepEqual(submittedFields, ['sastTool']);
  });

  /**
   * The headline bug. A submitted-but-empty field must arrive as null AND be listed as
   * submitted, or it reads as "not answered" and the clear is lost — which is exactly
   * what `sastTool?.trim() || existing.sastTool` did.
   */
  it('records a cleared field as a deliberate null', () => {
    const { versionData, submittedFields } = buildSubmission(baseline, { sastTool: '' });
    assert.equal(versionData.sastTool, null);
    assert.deepEqual(submittedFields, ['sastTool'], 'the clear must be applyable');
  });

  it('distinguishes clearing from not answering', () => {
    const cleared = buildSubmission(baseline, { sastTool: '' });
    const untouched = buildSubmission(baseline, {});
    assert.notDeepEqual(cleared.submittedFields, untouched.submittedFields);
    assert.equal(cleared.versionData.sastTool, null);
    assert.equal(untouched.versionData.sastTool, 'Snyk');
  });

  it('records unchecking a box', () => {
    const { versionData, submittedFields } = buildSubmission(baseline, { apiSecurityNA: false });
    assert.equal(versionData.apiSecurityNA, false);
    assert.deepEqual(submittedFields, ['apiSecurityNA']);
  });

  it('ignores keys that are not registry fields', () => {
    const { versionData, submittedFields } = buildSubmission(baseline, {
      sastTool: 'Semgrep',
      hasSecurityTesting: 'Yes',
      constructor: 'nope',
    });
    assert.deepEqual(submittedFields, ['sastTool']);
    assert.ok(!('hasSecurityTesting' in versionData));
  });

  it('does not mutate the baseline', () => {
    const original = { ...baseline };
    buildSubmission(baseline, { sastTool: 'Semgrep' });
    assert.deepEqual(baseline, original);
  });
});

describe('resolveFieldsToApply', () => {
  const approvable = ['sastTool', 'dastTool', 'description'];

  it('applies the intersection of approved and submitted', () => {
    assert.deepEqual(
      resolveFieldsToApply(['sastTool', 'dastTool'], ['sastTool'], approvable),
      ['sastTool'],
    );
  });

  /**
   * The stale-revert fix. Approving Monday's form on Wednesday must not write back a
   * field Monday's submitter never sent, because Tuesday's admin edit is in it.
   */
  it('never applies a field the submission did not carry', () => {
    assert.deepEqual(
      resolveFieldsToApply(['sastTool'], null, approvable),
      ['sastTool'],
      'only the submitted field, even though the admin approved everything',
    );
  });

  it('never applies a non-approvable field, even if submitted and approved', () => {
    const withDerived = [...approvable];
    assert.deepEqual(
      resolveFieldsToApply(['sastTool', 'lastSastScanDate'], ['sastTool', 'lastSastScanDate'], withDerived),
      ['sastTool'],
    );
  });

  it('approves nothing when the admin ticked nothing', () => {
    // An explicit empty array must not be read as "approve everything".
    assert.deepEqual(resolveFieldsToApply(['sastTool'], [], approvable), []);
  });

  it('falls back to every approvable field for a legacy version', () => {
    // submittedFields null = a version predating the column. Preserving the old
    // behaviour matters because there are versions already sitting in the queue.
    assert.deepEqual(resolveFieldsToApply(null, null, approvable), approvable);
    assert.deepEqual(resolveFieldsToApply(null, ['dastTool'], approvable), ['dastTool']);
  });

  it('applies nothing when the submission carried nothing', () => {
    // Distinct from legacy: an empty list is a real claim, so nothing is applied.
    assert.deepEqual(resolveFieldsToApply([], null, approvable), []);
  });

  it('ignores an approved field that is neither submitted nor approvable', () => {
    assert.deepEqual(resolveFieldsToApply(['sastTool'], ['nope'], approvable), []);
  });

  it('works against the real registry lists', () => {
    const submitted = ['sastTool', 'lastSastScanDate', 'currentVersion'];
    const applied = resolveFieldsToApply(submitted, null, [...APPROVABLE_METADATA_FIELDS]);
    assert.ok(applied.includes('sastTool'));
    assert.ok(!applied.includes('lastSastScanDate'), 'derived, not approvable');
    assert.ok(!applied.includes('currentVersion'), 'derived, not approvable');
    for (const field of applied) {
      assert.ok(VERSIONED_METADATA_FIELDS.includes(field), `${field} must be versioned`);
    }
  });
});
