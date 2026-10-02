import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ENVIRONMENT_SOURCED_FIELDS,
  ENVIRONMENT_VALUE_INCLUDE,
  activeInstances,
  assertEnvironmentsLoaded,
  isActiveInstance,
  primaryInstance,
  resolveEnvironmentValues,
  withEnvironmentValues,
  withEnvironmentValuesAll,
} from './environmentValues.js';
import { ENVIRONMENT_SOURCED_METADATA_FIELDS } from './applicationFields.js';
import { SCORING_INCLUDE } from './scoring.js';
import { calculateCompleteness } from './completeness.js';

/** An ApplicationEnvironment row as Prisma returns it under ENVIRONMENT_VALUE_INCLUDE. */
function instance({
  id = 'inst-1',
  kind = 'PRODUCTION',
  name = 'production',
  status = 'active',
  environmentStatus = 'active',
  displayOrder = 0,
  currentVersion = null,
  gitBranch = null,
} = {}) {
  return {
    id,
    status,
    currentVersion,
    gitBranch,
    environment: { id: `env-${name}`, name, kind, status: environmentStatus, displayOrder },
  };
}

function app(environments, extra = {}) {
  return { id: 'app-1', name: 'Checkout', environments, ...extra };
}

describe('the relation has to be loaded', () => {
  it('throws when environments is undefined, rather than reporting a gap', () => {
    // The whole point. Prisma gives undefined for a relation that was never
    // included and [] for one that is genuinely empty; treating the first as the
    // second is how an application ends up scoring differently per endpoint.
    assert.throws(
      () => resolveEnvironmentValues({ id: 'app-1', name: 'Checkout' }),
      /loaded without its `environments` relation/,
    );
  });

  it('names the application, so the failing row is findable', () => {
    assert.throws(() => assertEnvironmentsLoaded({ id: 'app-42' }), /app-42/);
  });

  it('points at the fix', () => {
    assert.throws(() => assertEnvironmentsLoaded({ id: 'x' }), /ENVIRONMENT_VALUE_INCLUDE/);
  });

  it('accepts an empty array as a real answer', () => {
    assert.deepEqual(resolveEnvironmentValues(app([])), {
      currentVersion: null,
      gitBranch: null,
      primaryEnvironment: null,
    });
  });

  it('rejects a non-array, which means someone included the wrong shape', () => {
    assert.throws(() => assertEnvironmentsLoaded({ id: 'x', environments: {} }), /should be an array/);
  });
});

describe('primary is derived, never stored', () => {
  it('is the PRODUCTION instance', () => {
    const a = app([
      instance({ id: 'stg', kind: 'STAGING', name: 'staging', currentVersion: '9.9.9' }),
      instance({ id: 'prd', kind: 'PRODUCTION', name: 'prod', currentVersion: '1.2.3' }),
    ]);
    assert.equal(primaryInstance(a).id, 'prd');
    assert.equal(resolveEnvironmentValues(a).currentVersion, '1.2.3');
  });

  it('does NOT slide up to staging when there is no production', () => {
    // Decision: retiring or never having a production environment leaves the
    // application with no primary. Promoting the next one down would quietly
    // report a staging version as though it were what customers are running.
    const a = app([instance({ kind: 'STAGING', name: 'staging', currentVersion: '9.9.9' })]);
    assert.equal(primaryInstance(a), null);
    assert.equal(resolveEnvironmentValues(a).currentVersion, null);
  });

  it('reports which environment the values came from', () => {
    const a = app([instance({ kind: 'PRODUCTION', name: 'productionisawesome', currentVersion: '2.0' })]);
    assert.deepEqual(resolveEnvironmentValues(a).primaryEnvironment, {
      applicationEnvironmentId: 'inst-1',
      environmentId: 'env-productionisawesome',
      name: 'productionisawesome',
      kind: 'PRODUCTION',
    });
  });
});

describe('active means both levels agree', () => {
  it('ignores a retired instance', () => {
    const a = app([instance({ status: 'retired', currentVersion: '1.0' })]);
    assert.equal(primaryInstance(a), null);
  });

  it('ignores an instance whose vocabulary row is retired', () => {
    // Nothing cascades Environment.status down to its instances, so checking only
    // the instance would let a company that retired an environment entirely keep
    // reporting versions from it.
    const a = app([instance({ environmentStatus: 'retired', currentVersion: '1.0' })]);
    assert.equal(primaryInstance(a), null);
  });

  it('treats a missing status as active, so a partial select does not blank the row', () => {
    assert.equal(isActiveInstance({ environment: {} }), true);
  });

  it('orders by displayOrder then name', () => {
    const a = app([
      instance({ id: 'c', kind: 'QA', name: 'qa', displayOrder: 2 }),
      instance({ id: 'a', kind: 'PRODUCTION', name: 'prod', displayOrder: 0 }),
      instance({ id: 'b', kind: 'STAGING', name: 'staging', displayOrder: 1 }),
    ]);
    assert.deepEqual(activeInstances(a).map((i) => i.id), ['a', 'b', 'c']);
  });
});

describe('flattening', () => {
  it('puts the values back under their original names', () => {
    const flat = withEnvironmentValues(
      app([instance({ currentVersion: '1.2.3', gitBranch: 'main' })]),
    );
    assert.equal(flat.currentVersion, '1.2.3');
    assert.equal(flat.gitBranch, 'main');
  });

  it('does not mutate the row it was given', () => {
    const original = app([instance({ currentVersion: '1.2.3' })]);
    withEnvironmentValues(original);
    assert.equal(original.currentVersion, undefined, 'the Prisma row stays a faithful picture of the database');
  });

  it('resolves null rather than undefined, so downstream can tell it ran', () => {
    const flat = withEnvironmentValues(app([]));
    assert.equal(flat.currentVersion, null);
    assert.ok('currentVersion' in flat);
  });

  it('maps a list', () => {
    const flat = withEnvironmentValuesAll([
      app([instance({ currentVersion: '1' })]),
      app([instance({ currentVersion: '2' })]),
    ]);
    assert.deepEqual(flat.map((a) => a.currentVersion), ['1', '2']);
  });
});

describe('the pieces agree with each other', () => {
  it('handles exactly the fields the registry marks source: environment', () => {
    assert.deepEqual([...ENVIRONMENT_SOURCED_FIELDS], [...ENVIRONMENT_SOURCED_METADATA_FIELDS]);
    assert.ok(ENVIRONMENT_SOURCED_FIELDS.includes('currentVersion'));
    assert.ok(ENVIRONMENT_SOURCED_FIELDS.includes('gitBranch'));
  });

  it('is loaded by SCORING_INCLUDE', () => {
    // currentVersion is 1 of the 13 completeness fields, which are 40 of the 50
    // knowledge points. A scoring call site without the relation throws rather than
    // quietly docking every application a point.
    assert.ok(SCORING_INCLUDE.environments, 'scoring must load the environments relation');
    assert.deepEqual(SCORING_INCLUDE.environments, ENVIRONMENT_VALUE_INCLUDE.environments);
  });

  it('selects the kind, which is the whole basis of primary', () => {
    const select = ENVIRONMENT_VALUE_INCLUDE.environments.include.environment.select;
    assert.equal(select.kind, true);
    assert.equal(select.status, true, 'needed for the both-levels-active rule');
  });
});

describe('completeness catches a row that skipped the resolver', () => {
  it('throws on a Prisma row with the relation loaded but unflattened', () => {
    // The silent-wrong-number case: currentVersion is undefined because it is not a
    // column any more, and an unanswered field is also undefined. Counting it as
    // missing would cost every application a point on whichever endpoint forgot.
    assert.throws(
      () => calculateCompleteness(app([instance({ currentVersion: '1.2.3' })])),
      /was not passed through withEnvironmentValues/,
    );
  });

  it('is happy once flattened', () => {
    const flat = withEnvironmentValues(app([instance({ currentVersion: '1.2.3' })]));
    assert.doesNotThrow(() => calculateCompleteness(flat));
  });

  it('leaves plain objects alone, so fixtures and import rows still work', () => {
    // No `environments` key at all means this did not come from Prisma.
    assert.doesNotThrow(() => calculateCompleteness({ name: 'x' }));
    assert.doesNotThrow(() => calculateCompleteness({ currentVersion: '1.0' }));
  });

  it('counts a resolved-but-empty version as a real gap', () => {
    const flat = withEnvironmentValues(app([]));
    assert.ok(calculateCompleteness(flat).missing.includes('currentVersion'));
  });
});
