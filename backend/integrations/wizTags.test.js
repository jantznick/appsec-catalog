import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WIZ_RESOURCE_TYPES,
  WIZ_TAG_KEYS,
  readWizTag,
  wizResourceMatchReason,
  wizTagWhereCandidates,
  wizTagsToObject,
} from './wiz.js';

/**
 * The tag plumbing under the Wiz filter, tested without a tenant.
 *
 * listWizResourcesForFolder itself needs credentials and a network, so what is
 * pinned here is the part that decides whether a resource matches: turning a tag
 * blob into an object keyed by tag name, and reading a key out of it.
 */

describe('wizTagsToObject', () => {
  it('keeps tags attached to one resource rather than flattening a folder', () => {
    // normalizeWizTagValues flattens every tag in a folder into one list of
    // "key:value" strings, which cannot answer "does THIS resource carry both
    // Product=X and Application=Y" - the question the whole filter rests on.
    assert.deepEqual(
      wizTagsToObject({ Product: 'Orbit', Application: 'backend', Environment: 'production' }),
      { Product: 'Orbit', Application: 'backend', Environment: 'production' },
    );
  });

  it('trims keys', () => {
    // A tag key with a trailing space is a real thing in a cloud estate, and
    // "SupportTeam " silently not matching "SupportTeam" is a fault nobody finds.
    assert.deepEqual(wizTagsToObject({ 'Application ': 'backend' }), { Application: 'backend' });
  });

  it('accepts an array of {key,value}', () => {
    assert.deepEqual(
      wizTagsToObject([{ key: 'Product', value: 'Orbit' }, { name: 'Role', value: 'database' }]),
      { Product: 'Orbit', Role: 'database' },
    );
  });

  it('accepts an array of "key:value" strings', () => {
    assert.deepEqual(wizTagsToObject(['Product:Orbit', 'Environment:production']), {
      Product: 'Orbit',
      Environment: 'production',
    });
  });

  it('keeps a value containing a colon whole', () => {
    assert.deepEqual(wizTagsToObject(['Route53:identity-s.example.com']), {
      Route53: 'identity-s.example.com',
    });
  });

  it('is an empty object for anything unusable', () => {
    for (const input of [null, undefined, '', 0]) {
      assert.deepEqual(wizTagsToObject(input), {}, String(input));
    }
  });
});

describe('readWizTag', () => {
  it('reads the configured key', () => {
    assert.equal(readWizTag({ Product: 'Orbit' }, WIZ_TAG_KEYS.product), 'Orbit');
  });

  it('falls back to a case-insensitive match', () => {
    // The key name is the company's, not ours, and cloud consoles are inconsistent
    // about case. Matching exactly first keeps the common path cheap.
    assert.equal(readWizTag({ application: 'backend' }, 'Application'), 'backend');
    assert.equal(readWizTag({ APPLICATION: 'backend' }, 'Application'), 'backend');
  });

  it('returns null rather than undefined when absent', () => {
    assert.equal(readWizTag({ Product: 'Orbit' }, 'Application'), null);
    assert.equal(readWizTag(null, 'Application'), null);
  });
});

describe('the defaults are a starting point, not a decision', () => {
  it('lists resource types once, with no duplicates', () => {
    // Wiz takes the whole array in one query, so a duplicate is a wasted page of
    // results rather than an error - invisible, and the kind of thing that creeps
    // in when a list this long is edited by hand.
    assert.equal(new Set(WIZ_RESOURCE_TYPES).size, WIZ_RESOURCE_TYPES.length);
    assert.ok(WIZ_RESOURCE_TYPES.length > 10, 'the list is the configured estate, not a sample');
    assert.ok(WIZ_RESOURCE_TYPES.includes('VIRTUAL_MACHINE'));
    assert.ok(WIZ_RESOURCE_TYPES.includes('CONTAINER'));
  });

  it('uses only names Wiz could accept', () => {
    // One unknown type makes Wiz reject the whole query, which is survivable
    // (there is a per-type fallback) but slow and loud. A typo caught here is
    // cheaper than a typo caught by a page load.
    for (const type of WIZ_RESOURCE_TYPES) {
      assert.match(type, /^[A-Z][A-Z0-9_]*$/, `${type} is not a Wiz type name`);
    }
  });

  it('names every tag key in one place', () => {
    assert.deepEqual(WIZ_TAG_KEYS, {
      product: 'Product',
      application: 'Application',
      environment: 'Environment',
      role: 'Role',
    });
  });
});

describe('wizResourceMatchReason', () => {
  const viewing = { applicationValue: 'backend', productValue: 'Orbit' };

  it('matches the application exactly', () => {
    assert.equal(
      wizResourceMatchReason({ ...viewing, resourceApplication: 'backend' }),
      'application',
    );
  });

  it('ignores case and padding, because a tag value is typed by a human', () => {
    assert.equal(
      wizResourceMatchReason({ ...viewing, resourceApplication: '  BackEnd ' }),
      'application',
    );
  });

  it('treats _shared as shared', () => {
    // The convention: a resource holds one value per tag key, so a host serving
    // several applications cannot name one without being wrong for the rest.
    assert.equal(
      wizResourceMatchReason({ ...viewing, resourceApplication: '_shared' }),
      'shared',
    );
  });

  it('treats a missing application tag as shared too', () => {
    // Untagged says the same thing by accident that _shared says on purpose.
    for (const value of [null, undefined, '', '   ']) {
      assert.equal(
        wizResourceMatchReason({ ...viewing, resourceApplication: value }),
        'shared',
        JSON.stringify(value),
      );
    }
  });

  it('excludes another application in the same product', () => {
    assert.equal(
      wizResourceMatchReason({ ...viewing, resourceApplication: 'frontend' }),
      null,
    );
  });

  it('does not call anything shared when no product was asked for', () => {
    // Shared means "serves THIS product". Without a product there is no scope for
    // it to be shared within, and returning every untagged resource in the folder
    // would be the whole estate.
    assert.equal(
      wizResourceMatchReason({
        applicationValue: 'backend',
        productValue: null,
        resourceApplication: null,
      }),
      null,
    );
  });

  it('honours includeUnassigned: false', () => {
    assert.equal(
      wizResourceMatchReason({ ...viewing, resourceApplication: '_shared', includeUnassigned: false }),
      null,
    );
  });

  it('matches everything when no filter is asked for', () => {
    assert.equal(
      wizResourceMatchReason({
        applicationValue: null,
        productValue: null,
        resourceApplication: 'anything',
      }),
      'all',
    );
  });

  it('returns EVERY resource in the product when only a product is given', () => {
    // REGRESSION. The no-filter clause used to be last and guarded on
    // !productValue, so asking for a product alone returned only its shared
    // resources - every named application in it fell through to null, and a
    // product with six resources reported none.
    for (const value of ['backend', 'frontend', '_shared', null, '']) {
      assert.equal(
        wizResourceMatchReason({
          applicationValue: null,
          productValue: 'Orbit',
          resourceApplication: value,
        }),
        'product',
        `Application=${JSON.stringify(value)} should be in the product`,
      );
    }
  });

  it('does not let includeUnassigned hide a product listing', () => {
    // includeUnassigned is about an APPLICATION's shared resources. Asking for a
    // whole product is not that question, and the flag must not silently drop the
    // untagged half of it.
    assert.equal(
      wizResourceMatchReason({
        applicationValue: null,
        productValue: 'Orbit',
        resourceApplication: null,
        includeUnassigned: false,
      }),
      'product',
    );
  });
});

describe('wizTagWhereCandidates', () => {
  it('sends the common casings, because Wiz EQUALS is case-sensitive', () => {
    // REGRESSION. A product tagged "OptimiseRx" was invisible when the assigned
    // value read "OptimiseRX": the server predicate matched exactly and returned
    // an empty page, while Orbit's own comparison would have matched. Same input,
    // different answer depending on which path ran.
    const [first] = wizTagWhereCandidates({ Product: 'OptimiseRX' });
    const values = first.tags.EQUALS.map((e) => e.value);
    assert.ok(values.includes('OptimiseRX'), 'as assigned');
    assert.ok(values.includes('optimiserx'), 'lower');
    assert.ok(values.includes('OPTIMISERX'), 'upper');
    assert.ok(values.includes('Optimiserx'), 'title');
  });

  it('does not repeat a casing when the value is already lower case', () => {
    const [first] = wizTagWhereCandidates({ Product: 'orbit' });
    const values = first.tags.EQUALS.map((e) => e.value);
    assert.equal(new Set(values).size, values.length);
  });

  it('keeps every candidate on the same tag key', () => {
    const [first] = wizTagWhereCandidates({ Product: 'Orbit' });
    assert.ok(first.tags.EQUALS.every((e) => e.key === 'Product'));
  });

  it('is empty when there is nothing to filter on', () => {
    assert.deepEqual(wizTagWhereCandidates({}), []);
    assert.deepEqual(wizTagWhereCandidates({ Product: '' }), []);
  });
});
