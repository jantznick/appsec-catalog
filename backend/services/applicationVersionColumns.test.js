/**
 * The registry's versioned field list must be writable to ApplicationVersion.
 *
 * WHY THIS TEST EXISTS
 *
 * `createApplicationVersion` spreads `pickVersionedMetadata(application)` straight into
 * `prisma.applicationVersion.create`. Every field marked `versioned: true` in the
 * registry therefore has to be a real column on that model.
 *
 * When Phase 6a added seven fields to the registry as `versioned: true` without adding
 * the columns, the create began throwing — and `createApplicationVersion` catches,
 * logs, and returns null on purpose ("versioning is supplementary, don't fail the main
 * operation"). So version history and the pending-approval queue stopped working
 * silently: no exception reached a caller, no snapshot was written, and nothing in the
 * UI said so. The approval queue simply had nothing in it.
 *
 * Reads the schema as text, because importing Prisma here would pull a database
 * dependency into a suite that deliberately has none.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { VERSIONED_METADATA_FIELDS, APPROVABLE_METADATA_FIELDS } from './applicationFields.js';

const schemaSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma'),
  'utf8',
);

/** Scalar field names declared on a Prisma model. */
function modelColumns(modelName) {
  const afterHeader = schemaSource.split(new RegExp(`^model ${modelName} \\{`, 'm'))[1];
  assert.ok(afterHeader, `model ${modelName} not found in schema.prisma`);
  const body = afterHeader.split(/^\}/m)[0];
  return new Set([...body.matchAll(/^\s{2}(\w+)\s+/gm)].map((m) => m[1]));
}

describe('ApplicationVersion carries every versioned field', () => {
  it('has a column for each versioned registry field', () => {
    const columns = modelColumns('ApplicationVersion');
    const missing = VERSIONED_METADATA_FIELDS.filter((key) => !columns.has(key));
    assert.deepEqual(
      missing,
      [],
      'a versioned field with no column makes every snapshot create throw, and the error is swallowed',
    );
  });

  it('has a column for each approvable field, since approval writes them back', () => {
    // APPROVABLE is a subset of VERSIONED, so this should follow — but it is the
    // direction that corrupts data rather than just losing history, so assert it.
    const columns = modelColumns('ApplicationVersion');
    const missing = APPROVABLE_METADATA_FIELDS.filter((key) => !columns.has(key));
    assert.deepEqual(missing, []);
  });

  it('does not snapshot metadataLastReviewed', () => {
    // Deliberately excluded: it records when the record was reviewed, not what the
    // record said. pickVersionedMetadata omits it by being versioned:false.
    assert.ok(!VERSIONED_METADATA_FIELDS.includes('metadataLastReviewed'));
  });

  /**
   * Bookkeeping on the snapshot row itself, rather than a copy of a metadata field.
   * Everything outside this list is expected to correspond to a registry entry.
   */
  const SNAPSHOT_BOOKKEEPING = new Set([
    'id', 'applicationId', 'application', 'versionNumber', 'createdBy', 'user',
    'requesterEmail', 'createdAt', 'changeSource', 'approvalStatus', 'approvedBy',
    'approver', 'approvedAt', 'approvedFields', 'approvalNotes', 'rejectionReason',
  ]);

  it('has no snapshot column the registry does not know about', () => {
    // The same failure with the arrow reversed. A column here with no registry entry
    // is never written by pickVersionedMetadata, never compared by compareVersions and
    // never applied on approval — so it exists, looks like history, and silently holds
    // nothing. The other direction (a versioned field with no column) is caught above;
    // nothing caught this one until now.
    const columns = modelColumns('ApplicationVersion');
    const versioned = new Set(VERSIONED_METADATA_FIELDS);
    const orphans = [...columns].filter(
      (c) => !versioned.has(c) && !SNAPSHOT_BOOKKEEPING.has(c),
    );
    assert.deepEqual(
      orphans,
      [],
      'these ApplicationVersion columns are silently un-versioned: add a registry entry or drop the column',
    );
  });

  it('every versioned field is also a column on Application', () => {
    // The other direction of the same trap: a registry field that is not on the
    // source model reads as undefined and snapshots as null, quietly blanking it.
    const columns = modelColumns('Application');
    const missing = VERSIONED_METADATA_FIELDS.filter((key) => !columns.has(key));
    assert.deepEqual(missing, []);
  });
});
