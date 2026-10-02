import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { WIZ_RESOURCE_TYPES, WIZ_TAG_KEYS, readWizTag, wizTagsToObject } from './wiz.js';

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
  it('ships two resource types for the POC', () => {
    assert.deepEqual([...WIZ_RESOURCE_TYPES], ['VIRTUAL_MACHINE', 'CONTAINER']);
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
