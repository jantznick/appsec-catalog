/**
 * Validation for policy control field mappings.
 *
 * WHY THIS EXISTS
 *
 * `PolicyControlField.fieldPath` and `.operator` were stored and read as free strings
 * with no check that either was real (APP_DATA_FIXES_PLAN.md finding E10 / 1.3). Both
 * failure modes are silent and permanent:
 *
 *   - A misspelled fieldPath ("sastTools") resolves to null in `getFieldValue`, fails
 *     the `exists` operator, and marks EVERY application non-compliant for that
 *     control. Forever, with no error anywhere.
 *   - An unknown operator hits the default case in `evaluateFieldCheck`, which warns to
 *     the server log and returns false — same outcome, same silence.
 *
 * A compliance control that is quietly wrong is worse than one that is missing, because
 * it produces confident numbers. Validating on save is the cheapest place to catch it.
 *
 * Dependency-free, like services/applicationFields.js, so it is unit testable.
 */

import { METADATA_FIELD_KEYS, isMetadataField } from './applicationFields.js';

/**
 * Operators `evaluateFieldCheck` in services/policy.js implements.
 *
 * Kept in step with that switch statement by hand; policyFields.test.js asserts the
 * list is non-empty and self-consistent, but the engine is not importable here because
 * it imports Prisma. If you add an operator there, add it here.
 */
export const POLICY_OPERATORS = Object.freeze([
  'exists',
  'not_exists',
  'equals',
  'not_equals',
  'gte',
  'gt',
  'lte',
  'lt',
  'contains',
  'in',
  'not_in',
]);

/** Operators that compare against a value, so a value is required. */
export const VALUE_REQUIRED_OPERATORS = Object.freeze(
  POLICY_OPERATORS.filter((op) => op !== 'exists' && op !== 'not_exists'),
);

/** @param {string} operator @returns {boolean} */
export function isPolicyOperator(operator) {
  return POLICY_OPERATORS.includes(operator);
}

/**
 * Validate the field mappings submitted for a policy control.
 *
 * Returns human-readable problems rather than throwing, so a caller can report all of
 * them at once instead of making the user fix one per round trip.
 *
 * @param {unknown} fields The `fields` array from the request body.
 * @returns {string[]} One message per problem; empty when valid.
 */
export function validatePolicyControlFields(fields) {
  if (fields === undefined || fields === null) return [];

  if (!Array.isArray(fields)) {
    return ['fields must be an array'];
  }

  const problems = [];

  fields.forEach((field, index) => {
    const position = `field ${index + 1}`;

    if (!field || typeof field !== 'object') {
      problems.push(`${position}: must be an object`);
      return;
    }

    const fieldPath = typeof field.fieldPath === 'string' ? field.fieldPath.trim() : '';
    const operator = typeof field.operator === 'string' ? field.operator.trim() : '';

    if (!fieldPath) {
      problems.push(`${position}: fieldPath is required`);
    } else if (!isMetadataField(fieldPath)) {
      problems.push(
        `${position}: "${fieldPath}" is not an application field. ` +
          `${suggestField(fieldPath)}`,
      );
    }

    if (!operator) {
      problems.push(`${position}: operator is required`);
    } else if (!isPolicyOperator(operator)) {
      problems.push(
        `${position}: "${operator}" is not a supported operator. Supported: ${POLICY_OPERATORS.join(', ')}`,
      );
    }
  });

  return problems;
}

/**
 * Best-effort "did you mean" for a bad field path, to make the 400 actionable.
 * @param {string} fieldPath
 * @returns {string}
 */
function suggestField(fieldPath) {
  const needle = fieldPath.toLowerCase();

  // Exact case-insensitive match first — the most likely mistake.
  const exact = METADATA_FIELD_KEYS.find((key) => key.toLowerCase() === needle);
  if (exact) return `Did you mean "${exact}"?`;

  // Then a containment match either way, which catches plurals and truncations
  // ("sastTools", "sast").
  const near = METADATA_FIELD_KEYS.filter(
    (key) => key.toLowerCase().includes(needle) || needle.includes(key.toLowerCase()),
  );
  if (near.length > 0 && near.length <= 3) {
    return `Did you mean ${near.map((k) => `"${k}"`).join(' or ')}?`;
  }

  return 'See GET /api/config/available-fields for the list.';
}
