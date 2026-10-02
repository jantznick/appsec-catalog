import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVIRONMENT_KINDS,
  PRIMARY_ENVIRONMENT_KIND,
  REPEATABLE_ENVIRONMENT_KIND,
  environmentMatchNames,
  findEnvironmentNameConflicts,
  inferEnvironmentKind,
  isSingleSlotKind,
  normalizeEnvironmentName,
  parseEnvironmentAliases,
  serializeEnvironmentAliases,
} from './environmentNaming.js';

describe('kind cardinality', () => {
  it('makes every kind single-slot except OTHER', () => {
    for (const kind of ENVIRONMENT_KINDS) {
      assert.equal(
        isSingleSlotKind(kind),
        kind !== REPEATABLE_ENVIRONMENT_KIND,
        `${kind} slot rule`,
      );
    }
  });

  it('names PRODUCTION as the primary kind', () => {
    // Primary is derived from this and nothing else. If it ever stops being a kind
    // that a company can hold only one of, primaryInstance() becomes a tie-break.
    assert.equal(PRIMARY_ENVIRONMENT_KIND, 'PRODUCTION');
    assert.ok(isSingleSlotKind(PRIMARY_ENVIRONMENT_KIND));
  });

  it('rejects anything that is not a known kind', () => {
    assert.equal(isSingleSlotKind('PROD'), false);
    assert.equal(isSingleSlotKind(''), false);
    assert.equal(isSingleSlotKind(null), false);
  });
});

describe('parseEnvironmentAliases', () => {
  it('normalizes, trims and drops blanks', () => {
    assert.deepEqual(parseEnvironmentAliases(' Prod , PRODUCTION ,, '), ['prod', 'production']);
  });

  it('de-duplicates after normalizing, so "Prod" and "prod" are one alias', () => {
    assert.deepEqual(parseEnvironmentAliases('Prod,prod,PROD'), ['prod']);
  });

  it('returns an empty list for anything unusable', () => {
    for (const input of [null, undefined, '', '   ', ',,,', 42, {}]) {
      assert.deepEqual(parseEnvironmentAliases(input), [], String(input));
    }
  });
});

describe('serializeEnvironmentAliases', () => {
  it('round-trips through the stored column', () => {
    assert.equal(serializeEnvironmentAliases(' Prod , Live '), 'prod,live');
  });

  it('accepts an array, which is what a JSON body will send', () => {
    assert.equal(serializeEnvironmentAliases(['Prod', 'live']), 'prod,live');
  });

  it('stores null rather than an empty string, so "none" is one value not two', () => {
    assert.equal(serializeEnvironmentAliases(''), null);
    assert.equal(serializeEnvironmentAliases([]), null);
    assert.equal(serializeEnvironmentAliases(null), null);
  });
});

describe('environmentMatchNames', () => {
  it('includes the name implicitly, so callers never check both', () => {
    assert.deepEqual(
      environmentMatchNames({ name: 'production', aliases: 'prod,live' }),
      ['production', 'prod', 'live'],
    );
  });

  it('does not repeat the name when it is also listed as an alias', () => {
    assert.deepEqual(
      environmentMatchNames({ name: 'prod', aliases: 'prod,live' }),
      ['prod', 'live'],
    );
  });

  it('works with no aliases at all', () => {
    assert.deepEqual(environmentMatchNames({ name: 'prod' }), ['prod']);
    assert.deepEqual(environmentMatchNames({ name: 'prod', aliases: null }), ['prod']);
  });
});

describe('findEnvironmentNameConflicts', () => {
  // The only guard on alias uniqueness. These live comma-packed in one column, so
  // this cannot be a database index - and without it `prod` could belong to two
  // environments and a deploy would resolve to whichever row the query reached first.
  const staging = { id: 'stg', name: 'staging', aliases: 'stage,preprod' };

  it('passes a clean candidate', () => {
    assert.deepEqual(
      findEnvironmentNameConflicts({ name: 'production', aliases: 'prod' }, [staging]),
      [],
    );
  });

  it('catches a name that another environment already uses', () => {
    const conflicts = findEnvironmentNameConflicts({ name: 'staging' }, [staging]);
    assert.deepEqual(conflicts, [{ value: 'staging', conflictsWith: 'staging' }]);
  });

  it('catches a name colliding with another environment ALIAS', () => {
    // The case a plain @@unique([companyId, name]) cannot see.
    const conflicts = findEnvironmentNameConflicts({ name: 'preprod' }, [staging]);
    assert.deepEqual(conflicts, [{ value: 'preprod', conflictsWith: 'staging' }]);
  });

  it('catches an alias colliding with another environment alias', () => {
    const conflicts = findEnvironmentNameConflicts(
      { name: 'production', aliases: 'stage' },
      [staging],
    );
    assert.deepEqual(conflicts, [{ value: 'stage', conflictsWith: 'staging' }]);
  });

  it('skips the candidate\'s own row, so an edit does not conflict with itself', () => {
    assert.deepEqual(findEnvironmentNameConflicts({ ...staging }, [staging]), []);
  });

  it('reports every colliding value, not just the first', () => {
    const conflicts = findEnvironmentNameConflicts(
      { name: 'stage', aliases: 'preprod' },
      [staging],
    );
    assert.deepEqual(conflicts.map((c) => c.value), ['stage', 'preprod']);
  });

  it('compares after normalizing, so case and padding cannot sneak a duplicate past', () => {
    const conflicts = findEnvironmentNameConflicts({ name: '  STAGE  ' }, [staging]);
    assert.deepEqual(conflicts, [{ value: 'stage', conflictsWith: 'staging' }]);
  });
});

describe('inferEnvironmentKind is a seed-time default only', () => {
  it('maps the common spellings', () => {
    assert.equal(inferEnvironmentKind('prod'), 'PRODUCTION');
    assert.equal(inferEnvironmentKind('PRODUCTION'), 'PRODUCTION');
    assert.equal(inferEnvironmentKind('uat'), 'QA');
  });

  it('falls back to OTHER rather than guessing PRODUCTION', () => {
    // A typo must not quietly become production. This is also why nothing resolves a
    // deployment through this function - see resolveEnvironmentForDeployment.
    assert.equal(inferEnvironmentKind('prodution'), 'OTHER');
    assert.equal(inferEnvironmentKind('super important'), 'OTHER');
    assert.equal(inferEnvironmentKind(''), 'OTHER');
  });
});

describe('normalizeEnvironmentName', () => {
  it('trims and lowercases, and nothing else', () => {
    assert.equal(normalizeEnvironmentName('  Prod  '), 'prod');
    // Notably it does NOT alias: "production" stays "production". A company whose
    // row is named "prod" gets an Unassigned deployment, which is the signal.
    assert.equal(normalizeEnvironmentName('production'), 'production');
  });

  it('returns null for anything unusable', () => {
    for (const input of [null, undefined, '', '   ', 7]) {
      assert.equal(normalizeEnvironmentName(input), null, String(input));
    }
  });
});
