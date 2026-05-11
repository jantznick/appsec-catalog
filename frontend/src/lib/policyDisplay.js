/** Shared labels for policy control operators (matches PolicyControls). */
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
];

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
