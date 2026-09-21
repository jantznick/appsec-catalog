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
import { IMPLEMENTED_OPERATORS, DAY_COUNT_OPERATORS } from './policyEvaluation.js';

/**
 * Operators `evaluateFieldCheck` in services/policy.js implements.
 *
 * Kept in step with that switch statement by hand; policyFields.test.js asserts the
 * list is non-empty and self-consistent, but the engine is not importable here because
 * it imports Prisma. If you add an operator there, add it here.
 */
/**
 * The operators a control may use.
 *
 * Derived from the engine rather than restated. This was a hand-maintained seam —
 * services/policy.js imported Prisma, so its operator switch could not be imported
 * into a dependency-free test — and it had already drifted: within_days and
 * older_than_days existed in the engine and not here, which would have rejected a
 * control the engine could evaluate perfectly well.
 *
 * The primitives now live in services/policyEvaluation.js, which imports nothing, so
 * the vocabulary comes from the implementation and the two cannot disagree.
 */
export const POLICY_OPERATORS = IMPLEMENTED_OPERATORS;

export { DAY_COUNT_OPERATORS };

/**
 * Field roles. `compliance` (the default) decides whether a control is met;
 * `applies_when` decides whether it applies to the application at all.
 * A typo here would silently turn a scope check into a compliance check, which
 * inverts the control's meaning rather than merely mis-scoping it.
 */
export const POLICY_FIELD_ROLES = Object.freeze(['compliance', 'applies_when']);

/**
 * Relation roots a control may target directly, which are not columns on `Application`
 * and so are not in the field registry.
 *
 * `getFieldValue` in the policy engine reads these off the application object, and
 * `withEvaluableRelations` loads them on demand. `exists` on a collection is meaningful
 * because the engine treats an empty array as absent, so "this application has at least
 * one recorded data flow" is a real check.
 *
 * Kept as an explicit allowlist rather than accepting any bare word: the whole point of
 * this validation is that an unrecognised path silently never matches.
 */
export const POLICY_RELATION_ROOTS = Object.freeze([
  'apiSchema',
  'ingressProducts',
  'outgoingProductFlows',
  'incomingProductFlows',
  'scmRepoLink',
  'threatModel',
]);

/** @param {string} role @returns {boolean} */
export function isPolicyFieldRole(role) {
  return POLICY_FIELD_ROLES.includes(role);
}

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
    } else if (fieldPath.includes('.')) {
      // Dot notation traverses a relation, which `getFieldValue` in services/policy.js
      // has always supported ("company.divisionId", "threatModel.status"). Those targets
      // are not columns on Application, so the flat registry cannot confirm them — and
      // rejecting them here would block a legitimate control the engine can evaluate.
      // Check the shape only; an unresolvable path still yields null at evaluation time.
      if (!/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z][A-Za-z0-9]*)+$/.test(fieldPath)) {
        problems.push(
          `${position}: "${fieldPath}" is not a valid field path. ` +
            'Use a column name, or dot notation through a relation (e.g. "company.divisionId").',
        );
      }
    } else if (!isMetadataField(fieldPath) && !POLICY_RELATION_ROOTS.includes(fieldPath)) {
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
    } else if (DAY_COUNT_OPERATORS.includes(operator)) {
      // The value is a number of days. Anything else can never match, so it would
      // be another control that silently never passes.
      const days = Number(field.value);
      if (
        field.value === null ||
        field.value === undefined ||
        field.value === '' ||
        Number.isNaN(days) ||
        days <= 0
      ) {
        problems.push(`${position}: ${operator} needs a positive number of days`);
      }
    }

    // Roles are optional and default to `compliance`; only a supplied-but-wrong value
    // is rejected, so existing callers that omit it are unaffected.
    if (field.role !== undefined && field.role !== null) {
      const role = typeof field.role === 'string' ? field.role.trim() : '';
      if (!isPolicyFieldRole(role)) {
        problems.push(
          `${position}: "${field.role}" is not a valid field role. Supported: ${POLICY_FIELD_ROLES.join(', ')}`,
        );
      }
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
