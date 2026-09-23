/**
 * Scope checks: what an unanswered field does to a control's applicability.
 *
 * WHY THIS IS ITS OWN SUITE
 *
 * A scope check is the one place in the engine where `false` is the permissive answer.
 * Failing one excuses the control: `not_applicable`, out of the compliance denominator,
 * contributing nothing. So the nullish rule that is correct for a compliance check —
 * a value nobody supplied cannot satisfy an assertion — is backwards here, and excuses
 * controls on exactly the applications we know least about.
 *
 * It bit us for real. `iacContainerScanNA not_equals true` reads as "applies unless the
 * team said it does not". Every application had that field null, every check returned
 * false, and 4.6.14 excused itself across the whole portfolio, reported as a deliberate
 * Not Applicable.
 *
 * These tests are written against the ENGINE, not against today's controls. The policy
 * engine is general: anyone must be able to express any policy with the operators that
 * exist, and a rule that happens to make the current three controls work is not the
 * same thing. So the expressiveness cases below matter as much as the bug case.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { evaluateScopeCheck, getFieldValue } from './policyEvaluation.js';

const app = (overrides = {}) => ({ name: 'Checkout', ...overrides });

/**
 * Whether a set of scope checks leaves the application in scope, combining them the
 * way evaluateControl does. Tests the pure evaluator rather than evaluateControl,
 * which reaches for Prisma — this suite, like the rest, runs without a database.
 */
function inScope(scopeChecks, application, { appliesWhenLogic = 'AND' } = {}) {
  const results = scopeChecks.map((f) =>
    evaluateScopeCheck(f, getFieldValue(application, f.fieldPath)),
  );
  if (results.length === 0) return true;
  return appliesWhenLogic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

/** 'meeting' when in scope, 'not_applicable' when excluded — the outcomes that matter. */
function status(scopeChecks, application, opts) {
  return inScope(scopeChecks, application, opts) ? 'meeting' : 'not_applicable';
}

describe('an unanswered field cannot take a control out of scope', () => {
  it('keeps the control in scope when the scoped field is null', () => {
    // The 4.6.14 bug, reduced. Before the fix this returned not_applicable.
    assert.equal(
      status([{ fieldPath: 'iacContainerScanNA', operator: 'not_equals', value: 'true' }],
        app({ iacContainerScanNA: null })),
      'meeting',
    );
  });

  it('keeps the control in scope when the scoped field is absent entirely', () => {
    assert.equal(
      status([{ fieldPath: 'facing', operator: 'equals', value: '"external"' }], app()),
      'meeting',
    );
  });

  it('still excludes when the field is answered and does not match', () => {
    // The whole point of scoping still works: a real answer can take it out of scope.
    assert.equal(
      status([{ fieldPath: 'facing', operator: 'equals', value: '"external"' }],
        app({ facing: 'Internal' })),
      'not_applicable',
    );
  });

  it('still includes when the field is answered and matches', () => {
    assert.equal(
      status([{ fieldPath: 'facing', operator: 'equals', value: '"external"' }],
        app({ facing: 'external' })),
      'meeting',
    );
  });

  it('applies to comparison operators too, not just equality', () => {
    // businessCriticality gte 4 is a real scope check on 4.6.11.
    assert.equal(
      status([{ fieldPath: 'businessCriticality', operator: 'gte', value: '4' }],
        app({ businessCriticality: null })),
      'meeting',
    );
    assert.equal(
      status([{ fieldPath: 'businessCriticality', operator: 'gte', value: '4' }],
        app({ businessCriticality: 2 })),
      'not_applicable',
    );
  });
});

describe('presence operators keep their own answer', () => {
  // These two exist to ask about nullness. Overriding them would make "applies only
  // when this is set" inexpressible, which is exactly the kind of hole the fix is
  // meant to close rather than open.

  it('exists excludes a null field, because that is the question it asks', () => {
    assert.equal(
      status([{ fieldPath: 'repoUrl', operator: 'exists', value: null }], app()),
      'not_applicable',
    );
    assert.equal(
      status([{ fieldPath: 'repoUrl', operator: 'exists', value: null }],
        app({ repoUrl: 'https://x/y' })),
      'meeting',
    );
  });

  it('not_exists includes a null field and excludes a populated one', () => {
    assert.equal(
      status([{ fieldPath: 'repoUrl', operator: 'not_exists', value: null }], app()),
      'meeting',
    );
    assert.equal(
      status([{ fieldPath: 'repoUrl', operator: 'not_exists', value: null }],
        app({ repoUrl: 'https://x/y' })),
      'not_applicable',
    );
  });
});

describe('every scoping intent stays expressible', () => {
  // The engine is general. A fix that makes the current controls work while removing
  // an author's ability to say something is not a fix.

  it('"applies unless explicitly X" — now one check', () => {
    const check = [{ fieldPath: 'iacContainerScanNA', operator: 'not_equals', value: 'true' }];
    assert.equal(status(check, app({ iacContainerScanNA: true })), 'not_applicable');
    assert.equal(status(check, app({ iacContainerScanNA: false })), 'meeting');
    assert.equal(status(check, app({ iacContainerScanNA: null })), 'meeting');
  });

  it('"applies only when definitely X" — exists AND equals', () => {
    const checks = [
      { fieldPath: 'facing', operator: 'exists', value: null },
      { fieldPath: 'facing', operator: 'equals', value: '"external"' },
    ];
    assert.equal(status(checks, app({ facing: 'external' })), 'meeting');
    assert.equal(status(checks, app({ facing: 'Internal' })), 'not_applicable');
    // The case the old semantics could not distinguish from "Internal".
    assert.equal(status(checks, app({ facing: null })), 'not_applicable');
  });

  it('"applies when unanswered or X" — the pre-fix workaround still works', () => {
    // 4.6.10 and 4.6.11 are written this way. They must keep their current answers;
    // the not_exists clause is now redundant rather than load-bearing.
    const checks = [
      { fieldPath: 'facing', operator: 'equals', value: '"external"' },
      { fieldPath: 'facing', operator: 'not_exists', value: null },
    ];
    const opts = { appliesWhenLogic: 'OR' };
    assert.equal(status(checks, app({ facing: 'external' }), opts), 'meeting');
    assert.equal(status(checks, app({ facing: null }), opts), 'meeting');
    assert.equal(status(checks, app({ facing: 'Internal' }), opts), 'not_applicable');
  });

  it('a control with no scope checks applies to everything', () => {
    assert.equal(status([], app()), 'meeting');
  });
});
