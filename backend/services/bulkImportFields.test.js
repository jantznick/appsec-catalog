/**
 * Every field the CSV importer offers must actually be written by the import.
 *
 * WHY THIS TEST EXISTS
 *
 * `BulkImportApplicationsModal` used to carry its own hand-typed list of importable
 * fields. It now derives that list from the served registry: every `approvable` field
 * except `status` (the route hard-codes it) and `interfaces` (a JSON array that a CSV
 * cell cannot express safely), plus `hostingDomains`, which is not an Application
 * column at all — the route parses the cell into Domain rows.
 *
 * Deriving it fixes one direction of drift and opens another. The mapping screen now
 * offers whatever the registry marks approvable, and `buildBulkImportRow` decides what
 * is written. A field present in the first and absent from the second is invisible: the
 * importer maps the column, the upload succeeds, and the value is silently dropped.
 * That is exactly what happened to the Phase 6a secrets and IaC fields when they were
 * added to the model and the route but not to the modal's list.
 *
 * Reads the route as text because importing it needs a database connection, and this
 * suite deliberately has none.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { APPLICATION_METADATA_FIELDS, APPROVABLE_METADATA_FIELDS } from './applicationFields.js';

const routeSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'routes', 'applications.js'),
  'utf8',
);

/** Mirrors NOT_IMPORTABLE in BulkImportApplicationsModal.jsx. */
const NOT_IMPORTABLE = new Set(['status', 'interfaces']);

/** The keys assigned in the object literal `buildBulkImportRow` returns. */
function bulkImportRowKeys() {
  const start = routeSource.indexOf('function buildBulkImportRow(');
  assert.ok(start > -1, 'buildBulkImportRow not found in routes/applications.js');

  // The function's single `return {` ... matching `};` at the function's indentation.
  const returnAt = routeSource.indexOf('\n  return {', start);
  assert.ok(returnAt > -1, 'buildBulkImportRow has no object return');
  const end = routeSource.indexOf('\n  };', returnAt);
  assert.ok(end > -1, 'could not find the end of the returned object');

  const body = routeSource.slice(returnAt, end);
  // Top-level keys only: two spaces of function indent plus two of object indent.
  // `name: x` and the shorthand `criticalAspects,` both count as written.
  return new Set([...body.matchAll(/^ {4}(\w+)\s*[:,]/gm)].map((m) => m[1]));
}

describe('the CSV importer writes every field it offers', () => {
  const offered = APPLICATION_METADATA_FIELDS.filter(
    (f) => APPROVABLE_METADATA_FIELDS.includes(f.key) && !NOT_IMPORTABLE.has(f.key),
  ).map((f) => f.key);

  it('offers a non-trivial list', () => {
    // Guards the two assertions below against a derivation that silently yields nothing.
    assert.ok(offered.length > 20, `expected the importer to offer many fields, got ${offered.length}`);
    assert.ok(offered.includes('name'), 'name is the one required import field');
  });

  it('assigns every offered field in buildBulkImportRow', () => {
    const written = bulkImportRowKeys();
    const dropped = offered.filter((key) => !written.has(key));
    assert.deepEqual(
      dropped,
      [],
      'the mapping screen offers these columns but the import never writes them',
    );
  });

  it('hard-codes status rather than importing it', () => {
    // The reason status is excluded from the offered list. If the route stops setting
    // it, an imported row has no status and the exclusion becomes a data loss instead.
    assert.match(routeSource.slice(routeSource.indexOf('function buildBulkImportRow(')), /status: 'onboarded',/);
  });
});
