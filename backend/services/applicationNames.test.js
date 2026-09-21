/**
 * Tests for application name uniqueness and suffixing.
 *
 * See the note at the top of scoring.test.js on why this uses `node --test` with no
 * dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BULK_IMPORT_MAX_ROWS,
  applicationNameKey,
  disambiguateApplicationName,
  resolveApplicationNames,
} from './applicationNames.js';

describe('applicationNameKey', () => {
  it('folds case and trims, because that is how users read "same name"', () => {
    assert.equal(applicationNameKey('Checkout'), 'checkout');
    assert.equal(applicationNameKey('  CHECKOUT  '), 'checkout');
    assert.equal(applicationNameKey('ChEcKoUt'), 'checkout');
  });

  it('handles null, undefined and non-strings', () => {
    assert.equal(applicationNameKey(null), '');
    assert.equal(applicationNameKey(undefined), '');
    assert.equal(applicationNameKey(42), '42');
  });
});

describe('disambiguateApplicationName', () => {
  it('returns the name unchanged when nothing collides', () => {
    assert.equal(disambiguateApplicationName('Checkout', new Set()), 'Checkout');
  });

  it('appends (1) on the first collision', () => {
    assert.equal(disambiguateApplicationName('Checkout', new Set(['checkout'])), 'Checkout (1)');
  });

  it('counts up past taken suffixes', () => {
    const taken = new Set(['checkout', 'checkout (1)', 'checkout (2)']);
    assert.equal(disambiguateApplicationName('Checkout', taken), 'Checkout (3)');
  });

  it('collides case-insensitively', () => {
    assert.equal(disambiguateApplicationName('CHECKOUT', new Set(['checkout'])), 'CHECKOUT (1)');
  });

  it('preserves the requested casing rather than normalizing it', () => {
    // We disambiguate the name; we do not get to restyle it.
    assert.equal(disambiguateApplicationName('CHECKOUT', new Set(['checkout'])), 'CHECKOUT (1)');
    assert.equal(disambiguateApplicationName('ChEcKoUt', new Set()), 'ChEcKoUt');
  });

  it('trims the requested name', () => {
    assert.equal(disambiguateApplicationName('  Checkout  ', new Set()), 'Checkout');
  });

  it('fills a gap left in the middle of a suffix run', () => {
    // (1) is free even though (2) is taken.
    const taken = new Set(['checkout', 'checkout (2)']);
    assert.equal(disambiguateApplicationName('Checkout', taken), 'Checkout (1)');
  });

  it('terminates rather than spinning when every suffix is taken', () => {
    const taken = new Set(['x']);
    for (let i = 1; i <= 6; i += 1) taken.add(`x (${i})`);
    // limit 5 is exhausted, so it must fall back rather than loop forever.
    const result = disambiguateApplicationName('x', taken, 5);
    assert.ok(result.startsWith('x ('), result);
    assert.ok(!taken.has(applicationNameKey(result)), 'fallback must still be unique');
  });

  it('keeps a name containing parentheses intact', () => {
    assert.equal(
      disambiguateApplicationName('Checkout (EU)', new Set(['checkout (eu)'])),
      'Checkout (EU) (1)',
    );
  });
});

describe('resolveApplicationNames', () => {
  it('leaves a clean batch untouched and reports no renames', () => {
    const { names, renamed } = resolveApplicationNames(['A', 'B'], []);
    assert.deepEqual(names, ['A', 'B']);
    assert.deepEqual(renamed, []);
  });

  it('suffixes against names that already exist', () => {
    const { names, renamed } = resolveApplicationNames(['Checkout'], ['Checkout']);
    assert.deepEqual(names, ['Checkout (1)']);
    assert.deepEqual(renamed, [{ row: 1, requestedName: 'Checkout', finalName: 'Checkout (1)' }]);
  });

  it('suffixes duplicates within the batch itself', () => {
    // Two identical rows in one file: the second must not collide with the first.
    const { names, renamed } = resolveApplicationNames(['New App', 'New App', 'New App'], []);
    assert.deepEqual(names, ['New App', 'New App (1)', 'New App (2)']);
    assert.equal(renamed.length, 2);
    assert.deepEqual(
      renamed.map((r) => r.row),
      [2, 3],
    );
  });

  it('accounts for both existing names and in-batch duplicates together', () => {
    const { names } = resolveApplicationNames(['Checkout', 'Checkout'], ['Checkout', 'Checkout (1)']);
    assert.deepEqual(names, ['Checkout (2)', 'Checkout (3)']);
  });

  it('never returns a duplicate key, whatever the input', () => {
    const requested = ['A', 'a', 'A ', 'A (1)', 'B', 'A'];
    const { names } = resolveApplicationNames(requested, ['a']);
    const keys = names.map(applicationNameKey);
    assert.equal(new Set(keys).size, keys.length, `collision in ${JSON.stringify(names)}`);
  });

  it('reports row numbers that are 1-based, matching the CSV', () => {
    const { renamed } = resolveApplicationNames(['Fine', 'Taken'], ['Taken']);
    assert.deepEqual(renamed, [{ row: 2, requestedName: 'Taken', finalName: 'Taken (1)' }]);
  });

  it('handles an empty batch', () => {
    const { names, renamed } = resolveApplicationNames([], ['Checkout']);
    assert.deepEqual(names, []);
    assert.deepEqual(renamed, []);
  });

  it('scales to a full-size import without collisions', () => {
    const requested = Array.from({ length: BULK_IMPORT_MAX_ROWS }, () => 'Same');
    const { names } = resolveApplicationNames(requested, []);
    const keys = names.map(applicationNameKey);
    assert.equal(new Set(keys).size, BULK_IMPORT_MAX_ROWS);
  });
});
