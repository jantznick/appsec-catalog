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
