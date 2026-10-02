import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVIRONMENT_KINDS,
  PRIMARY_ENVIRONMENT_KIND,
  REPEATABLE_ENVIRONMENT_KIND,
  canonicalEnvironmentName,
  environmentNameRows,
  inferEnvironmentKind,
  isSingleSlotKind,
  normalizeEnvironmentName,
  parseEnvironmentAliases,
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




describe('canonicalEnvironmentName', () => {
  it('takes the kind\'s word for the four named kinds, whatever was typed', () => {
    // Every company's production environment is called "production" in Orbit, however
    // its pipelines spell it. Eighteen companies showing eighteen different words for
    // the same thing is worse on a cross-company screen than one word plus aliases.
    assert.equal(canonicalEnvironmentName('PRODUCTION', ['Super Important']), 'production');
    assert.equal(canonicalEnvironmentName('STAGING', null), 'staging');
    assert.equal(canonicalEnvironmentName('QA', ['uat']), 'qa');
    assert.equal(canonicalEnvironmentName('DEVELOPMENT', ''), 'development');
  });

  it('takes the FIRST string in its own list for OTHER', () => {
    // There is no separate name to type. `name` never decides a match - every match
    // is an EnvironmentName row - so for OTHER the label and the first thing the
    // company's pipelines send were always the same string asked for twice.
    assert.equal(canonicalEnvironmentName('OTHER', ['  Sandbox ', 'sbx']), 'sandbox');
    assert.equal(canonicalEnvironmentName('OTHER', 'demo, dem'), 'demo');
  });

  it('parses a one-element array whose element is itself comma-separated', () => {
    // REGRESSION. The route builds ["sandbox, dev"] from a single form field, and an
    // Array.isArray short-circuit took element [0] unparsed - storing "sandbox, dev"
    // as one name, which environmentNameRows then split again beside it. Three rows
    // from two names, displayed as "sandbox, dev, dev, sandbox".
    assert.equal(canonicalEnvironmentName('OTHER', ['sandbox, dev']), 'sandbox');
    assert.deepEqual(
      environmentNameRows(canonicalEnvironmentName('OTHER', ['sandbox, dev']), ['sandbox, dev']),
      ['sandbox', 'dev'],
    );
  });

  it('agrees however the same names arrive', () => {
    const expected = ['sandbox', 'dev'];
    for (const shape of [['sandbox, dev'], ['sandbox', 'dev'], 'sandbox, dev', [' Sandbox ', ' DEV ']]) {
      const canonical = canonicalEnvironmentName('OTHER', shape);
      assert.deepEqual(environmentNameRows(canonical, shape), expected, JSON.stringify(shape));
    }
  });

  it('returns null for an OTHER with no usable names', () => {
    assert.equal(canonicalEnvironmentName('OTHER', ['   ']), null);
    assert.equal(canonicalEnvironmentName('OTHER', null), null);
    assert.equal(canonicalEnvironmentName('OTHER', []), null);
  });

  it('returns null for an unknown kind rather than inventing one', () => {
    assert.equal(canonicalEnvironmentName('PROD', ['prod']), null);
  });
});


describe('environmentNameRows', () => {
  it('puts the canonical name first', () => {
    assert.deepEqual(environmentNameRows('production', 'prod,prod-us'), [
      'production',
      'prod',
      'prod-us',
    ]);
  });

  it('does not repeat the canonical name when it is also listed', () => {
    assert.deepEqual(environmentNameRows('production', 'production,prod'), ['production', 'prod']);
  });

  it('accepts an array, which is what a JSON body sends', () => {
    assert.deepEqual(environmentNameRows('qa', ['UAT', ' uat ']), ['qa', 'uat']);
  });

  it('is just the canonical name when there are no extras', () => {
    assert.deepEqual(environmentNameRows('staging', null), ['staging']);
    assert.deepEqual(environmentNameRows('staging', ''), ['staging']);
  });

  it('normalizes everything, so case and padding cannot smuggle a duplicate row past the index', () => {
    assert.deepEqual(environmentNameRows('production', ' PROD , prod '), ['production', 'prod']);
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
