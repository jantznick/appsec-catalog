/**
 * Tests for policy control field validation.
 *
 * See the note at the top of scoring.test.js on why this uses `node --test` with no
 * dependencies.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { METADATA_FIELD_KEYS } from './applicationFields.js';
import {
  POLICY_OPERATORS,
  VALUE_REQUIRED_OPERATORS,
  isPolicyOperator,
  validatePolicyControlFields,
} from './policyFields.js';

describe('POLICY_OPERATORS', () => {
  it('covers the operators the engine implements', () => {
    // Mirrors the switch in services/policy.js evaluateFieldCheck. That module imports
    // Prisma so it cannot be imported here; this is the hand-maintained seam.
    assert.deepEqual([...POLICY_OPERATORS].sort(), [
      'contains',
      'equals',
      'exists',
      'gt',
      'gte',
      'in',
      'lt',
      'lte',
      'not_equals',
      'not_exists',
      'not_in',
    ]);
  });

  it('marks only the existence operators as not needing a value', () => {
    const noValue = POLICY_OPERATORS.filter((op) => !VALUE_REQUIRED_OPERATORS.includes(op));
    assert.deepEqual(noValue.sort(), ['exists', 'not_exists']);
  });

  it('recognizes its own operators and rejects others', () => {
    for (const op of POLICY_OPERATORS) {
      assert.equal(isPolicyOperator(op), true, op);
    }
    assert.equal(isPolicyOperator('EXISTS'), false, 'operators are case-sensitive');
    assert.equal(isPolicyOperator('equal'), false);
    assert.equal(isPolicyOperator(''), false);
  });
});

describe('validatePolicyControlFields', () => {
  it('accepts an omitted or empty field list', () => {
    // A control with no field mappings is valid: it falls back to a manual override.
    assert.deepEqual(validatePolicyControlFields(undefined), []);
    assert.deepEqual(validatePolicyControlFields(null), []);
    assert.deepEqual(validatePolicyControlFields([]), []);
  });

  it('accepts a valid mapping', () => {
    assert.deepEqual(
      validatePolicyControlFields([
        { fieldPath: 'sastTool', operator: 'exists' },
        { fieldPath: 'sastIntegrationLevel', operator: 'gte', value: 3 },
      ]),
      [],
    );
  });

  it('accepts every registry field paired with every operator', () => {
    for (const fieldPath of METADATA_FIELD_KEYS) {
      for (const operator of POLICY_OPERATORS) {
        assert.deepEqual(
          validatePolicyControlFields([{ fieldPath, operator }]),
          [],
          `${fieldPath} / ${operator}`,
        );
      }
    }
  });

  it('rejects a non-array', () => {
    assert.deepEqual(validatePolicyControlFields('sastTool'), ['fields must be an array']);
  });

  it('rejects a typo in the field path — the silent-compliance bug', () => {
    // "sastTools" resolves to null for every application, fails `exists`, and marks the
    // entire portfolio non-compliant for this control with no error anywhere.
    const problems = validatePolicyControlFields([{ fieldPath: 'sastTools', operator: 'exists' }]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /not an application field/);
  });

  it('suggests the right field for a case mistake', () => {
    const [problem] = validatePolicyControlFields([{ fieldPath: 'sasttool', operator: 'exists' }]);
    assert.match(problem, /Did you mean "sastTool"\?/);
  });

  it('suggests near matches for a plural or truncation', () => {
    const [problem] = validatePolicyControlFields([{ fieldPath: 'sastTools', operator: 'exists' }]);
    assert.match(problem, /Did you mean/);
    assert.match(problem, /sastTool/);
  });

  it('points at the available-fields endpoint when it cannot guess', () => {
    const [problem] = validatePolicyControlFields([{ fieldPath: 'zzzzz', operator: 'exists' }]);
    assert.match(problem, /available-fields/);
  });

  it('rejects a non-metadata column that does exist on the model', () => {
    // companyId is a real column but not application metadata, and the policy engine
    // has no business branching on it.
    const problems = validatePolicyControlFields([{ fieldPath: 'companyId', operator: 'exists' }]);
    assert.equal(problems.length, 1);
  });

  it('is not fooled by inherited object properties', () => {
    for (const fieldPath of ['constructor', 'toString', '__proto__']) {
      const problems = validatePolicyControlFields([{ fieldPath, operator: 'exists' }]);
      assert.equal(problems.length, 1, `${fieldPath} must be rejected`);
    }
  });

  it('rejects an unknown operator', () => {
    const problems = validatePolicyControlFields([{ fieldPath: 'sastTool', operator: 'is' }]);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /not a supported operator/);
    assert.match(problems[0], /exists/, 'lists what is supported');
  });

  it('requires both fieldPath and operator', () => {
    assert.deepEqual(validatePolicyControlFields([{ operator: 'exists' }]), [
      'field 1: fieldPath is required',
    ]);
    assert.deepEqual(validatePolicyControlFields([{ fieldPath: 'sastTool' }]), [
      'field 1: operator is required',
    ]);
  });

  it('treats whitespace-only values as missing', () => {
    const problems = validatePolicyControlFields([{ fieldPath: '   ', operator: '  ' }]);
    assert.equal(problems.length, 2);
  });

  it('tolerates surrounding whitespace on valid values', () => {
    assert.deepEqual(
      validatePolicyControlFields([{ fieldPath: '  sastTool  ', operator: ' exists ' }]),
      [],
    );
  });

  it('rejects a non-object entry', () => {
    assert.deepEqual(validatePolicyControlFields(['sastTool']), ['field 1: must be an object']);
    assert.deepEqual(validatePolicyControlFields([null]), ['field 1: must be an object']);
  });

  it('reports every problem at once, numbered by position', () => {
    // So the user fixes one form rather than one problem per round trip.
    const problems = validatePolicyControlFields([
      { fieldPath: 'sastTool', operator: 'exists' },
      { fieldPath: 'nope', operator: 'exists' },
      { fieldPath: 'dastTool', operator: 'bogus' },
    ]);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /^field 2:/);
    assert.match(problems[1], /^field 3:/);
  });
});

describe('the policy field picker agrees with the registry', () => {
  /**
   * `availableFields` in routes/config.js is what the admin UI offers in the field
   * dropdown. It carries policy-specific metadata the registry does not (allowed
   * operators, value types, dropdown options), so it is not generated from the
   * registry — but every path it offers must still be a real field, or an admin picks
   * an option and gets a 400 from the validation above.
   *
   * Read as source text because routes/config.js imports Prisma and so cannot be
   * imported here. If the regex stops matching, this test fails loudly rather than
   * silently passing.
   */
  const configSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'routes', 'config.js'),
    'utf8',
  );
  const pickerPaths = [...new Set([...configSource.matchAll(/path: '([A-Za-z]+)'/g)].map((m) => m[1]))];

  it('finds the picker entries at all', () => {
    assert.ok(pickerPaths.length > 20, `only found ${pickerPaths.length} picker paths`);
  });

  it('offers only fields the save validation accepts', () => {
    const rejected = pickerPaths.filter(
      (fieldPath) => validatePolicyControlFields([{ fieldPath, operator: 'exists' }]).length > 0,
    );
    assert.deepEqual(rejected, [], 'the picker offers fields that would be rejected on save');
  });

  it('omits only the fields it deliberately hides', () => {
    // apiSecurityTool / apiSecurityIntegrationLevel are the legacy API-security pair,
    // superseded by the schema upload and hidden in the version UI too. `interfaces` is
    // a JSON array in a String column, not usefully comparable by a policy operator.
    const missing = METADATA_FIELD_KEYS.filter((key) => !pickerPaths.includes(key));
    assert.deepEqual(missing.sort(), [
      'apiSecurityIntegrationLevel',
      'apiSecurityTool',
      'interfaces',
    ]);
  });
});
