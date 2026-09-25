/** Shared labels for policy control operators (matches PolicyControls). */
/**
 * Operators the control editor offers.
 *
 * MUST stay in step with IMPLEMENTED_OPERATORS in backend/services/policyEvaluation.js.
 *
 * This list was missing within_days and older_than_days, which the engine has
 * implemented since the rolling-window work. Because getOperatorsForField intersects
 * this list with the backend's allowedOperators, the dropdown could not offer them — and
 * a <Select> whose stored value is absent from its options renders the first option, so
 * opening one of those controls showed "Exists" and saving overwrote the mapping.
 *
 * getOperatorOptionsFor below makes an unrecognised stored operator visible rather than
 * silently replaced, so the next operator added to the engine degrades to an ugly label
 * instead of destroying data.
 */
export const POLICY_OPERATORS = [
  { value: 'exists', label: 'Exists' },
  { value: 'not_exists', label: 'Not Exists' },
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'gte', label: 'Greater Than or Equal (≥)' },
  { value: 'gt', label: 'Greater Than (>)' },
  { value: 'lte', label: 'Less Than or Equal (≤)' },
  { value: 'lt', label: 'Less Than (<)' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In (array)' },
  { value: 'not_in', label: 'Not In (array)' },
  { value: 'within_days', label: 'Within the last N days' },
  { value: 'older_than_days', label: 'Older than N days' },
];

/**
 * Operators whose value is a count of days rather than a value to compare against.
 * The input must be a number — a date picker cannot express "30 days".
 */
export const DAY_COUNT_OPERATORS = ['within_days', 'older_than_days'];

/** @param {string} operator */
export function isDayCountOperator(operator) {
  return DAY_COUNT_OPERATORS.includes(operator);
}

/**
 * Options for an operator select, guaranteed to contain `current`.
 *
 * A select silently coerces a value it has no option for, which turns "this UI is a
 * version behind the engine" into "this UI destroys the mapping on save". Including the
 * stored value — labelled as unrecognised — keeps the data intact and makes the gap
 * obvious instead of invisible.
 *
 * @param {Array<{value: string, label: string}>} allowed
 * @param {string|undefined} current
 */
export function getOperatorOptionsFor(allowed, current) {
  const options = Array.isArray(allowed) ? allowed : [];
  if (!current || options.some((o) => o.value === current)) return options;
  return [...options, { value: current, label: `${current} (not supported by this UI)` }];
}

export function getOperatorLabel(operator) {
  return POLICY_OPERATORS.find((o) => o.value === operator)?.label || operator;
}

export function getPolicyFieldLabel(availableFields, fieldPath) {
  if (!Array.isArray(availableFields) || !fieldPath) {
    return fieldPath || '-';
  }
  const field = availableFields.find((f) => f.path === fieldPath);
  return field ? field.label : fieldPath;
}

/** Format stored field value for display in pills (JSON strings decoded when possible). */
export function formatPolicyFieldValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'string') return parsed;
      return JSON.stringify(parsed);
    } catch {
      return value;
    }
  }
  return String(value);
}

/**
 * Plain-English statement of what a field check requires.
 *
 * WHY THIS IS SHARED
 *
 * This was a thirty-line ternary chain inline in PolicyComplianceView's JSX, and it had
 * two faults the Policies list did not:
 *
 * - `within_days` and `older_than_days` were missing, so they fell through to a
 *   catch-all that printed the raw identifier: "Requirement: within_days 30".
 * - It interpolated the stored value directly. Values are stored as JSON, so a string
 *   arrives already quoted and rendered as `Must equal ""approved""`.
 *
 * Both are fixed by going through formatPolicyFieldValue, the same decoder the Policies
 * list uses — which is why that screen was right and this one was not.
 *
 * @param {string} operator
 * @param {unknown} value stored (JSON-encoded) value from the field check
 * @returns {string}
 */
export function describeRequirement(operator, value) {
  const v = formatPolicyFieldValue(value);
  const list = Array.isArray(value) ? value.join(', ') : v;

  switch (operator) {
    case 'exists':
      return 'Field must exist';
    case 'not_exists':
      return 'Field must not exist';
    case 'equals':
      return `Must equal "${v}"`;
    case 'not_equals':
      return `Must not equal "${v}"`;
    case 'gte':
      return `Must be \u2265 ${v}`;
    case 'gt':
      return `Must be > ${v}`;
    case 'lte':
      return `Must be \u2264 ${v}`;
    case 'lt':
      return `Must be < ${v}`;
    case 'contains':
      return `Must contain "${v}"`;
    case 'in':
      return `Must be one of: ${list}`;
    case 'not_in':
      return `Must not be one of: ${list}`;
    case 'within_days':
      return `Must be within the last ${v} days`;
    case 'older_than_days':
      return `Must be older than ${v} days`;
    default:
      // An operator the UI does not know. Say so rather than printing the identifier
      // as though it were prose.
      return `Unrecognised check (${operator})${v ? ` \u2014 ${v}` : ''}`;
  }
}

/**
 * How a control's checks combine, as a sentence.
 *
 * Was built inline as "All fields must " + (AND ? "pass" : "at least one must pass"),
 * which rendered every OR control as "All fields must at least one must pass".
 */
export function describeEvaluationLogic(logic) {
  return logic === 'OR'
    ? 'At least one field must pass for this control to be met'
    : 'All fields must pass for this control to be met';
}
