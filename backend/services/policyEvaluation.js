/**
 * Policy field evaluation primitives.
 *
 * WHY THIS IS A SEPARATE MODULE
 *
 * services/policy.js imports Prisma, so it could not be imported into a dependency-free
 * test suite. That forced POLICY_OPERATORS in services/policyFields.js to hand-mirror
 * the operator switch below, with a comment on each side pointing at the other — a seam
 * that had already drifted once (within_days / older_than_days existed in the engine
 * and not in the validator).
 *
 * These functions are pure: they read a plain application object and a field check, and
 * touch no database. Moving them here lets the validator derive its operator vocabulary
 * from IMPLEMENTED_OPERATORS below instead of restating it, so an operator can no longer
 * exist in one and not the other.
 *
 * Dependency-free. Keep it that way.
 */

/**
 * Get field value from application object
 * Supports direct field access (e.g., "sastTool")
 * Future: Could support nested paths (e.g., "company.divisionId")
 * @param {Object} application - Application object
 * @param {string} fieldPath - Field path (e.g., "sastTool", "sastIntegrationLevel")
 * @returns {any} - Field value or null
 */
export function getFieldValue(application, fieldPath) {
  // For now, support only direct field access
  // Future: Could parse dot notation for nested fields
  if (fieldPath.includes('.')) {
    // Nested path support (future enhancement)
    const parts = fieldPath.split('.');
    let value = application;
    for (const part of parts) {
      if (value === null || value === undefined) {
        return null;
      }
      value = value[part];
    }
    return value;
  }
  
  return application[fieldPath] ?? null;
}

/**
 * Parse value from JSON string
 * Supports string, number, boolean, array, null
 * @param {string|null} valueStr - JSON string or null
 * @returns {any} - Parsed value
 */
export function parseValue(valueStr) {
  if (valueStr === null || valueStr === undefined || valueStr === '') {
    return null;
  }
  
  try {
    return JSON.parse(valueStr);
  } catch (e) {
    // If not valid JSON, treat as string
    return valueStr;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * True for a Date, or a string that starts with an ISO-8601 date. Used to decide
 * whether a comparison should be made on timestamps rather than numbers: a date
 * string coerces to NaN through Number(), which silently made every gte/gt/lte/lt
 * check on a date field return false.
 * @param {any} v
 * @returns {boolean}
 */
function isDateLike(v) {
  return v instanceof Date || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v));
}

/**
 * Parse a date-ish value to epoch milliseconds.
 *
 * Deliberately refuses bare numbers. `new Date(3)` is a valid instant three
 * milliseconds after the epoch, so accepting numbers made a nonsensical check
 * like `lastSastScanDate gte 3` compare a real timestamp against ~1970 and
 * pass for every application.
 *
 * @param {any} v
 * @returns {number|null} null when it is not a usable date
 */
export function toTime(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'string' && v.trim()) {
    const t = new Date(v).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Render a date for an evidence line. Falls back to the raw value so evidence
 * never reads "Invalid Date".
 * @param {any} v
 * @returns {string}
 */
export function formatDate(v) {
  const t = toTime(v);
  return t === null ? String(v) : new Date(t).toISOString().slice(0, 10);
}

/**
 * Coerce both sides of an ordering comparison to the same comparable scale.
 * Dates win when the application's value looks like a date, so an integration
 * level (a number) and a scan date (a timestamp) are never compared to one
 * another by accident.
 * @returns {[number, number]|null} null when the pair cannot be compared
 */
function comparablePair(fieldValue, expectedValue) {
  if (isDateLike(fieldValue)) {
    const a = toTime(fieldValue);
    const b = toTime(expectedValue);
    return a === null || b === null ? null : [a, b];
  }
  const a = Number(fieldValue);
  const b = Number(expectedValue);
  return Number.isNaN(a) || Number.isNaN(b) ? null : [a, b];
}

/**
 * Evaluate a single field check against an application
 * @param {Object} fieldCheck - PolicyControlField object
 * @param {any} fieldValue - Value from application field
 * @returns {boolean} - True if check passes
 */
export function evaluateFieldCheck(fieldCheck, fieldValue) {
  const { operator, value: valueStr } = fieldCheck;
  const expectedValue = parseValue(valueStr);
  
  // Handle null/undefined field values
  const isNullish = fieldValue === null || fieldValue === undefined;
  const isEmpty = fieldValue === '' || (Array.isArray(fieldValue) && fieldValue.length === 0);
  
  switch (operator) {
    case 'exists':
      return !isNullish && !isEmpty;
    
    case 'not_exists':
      return isNullish || isEmpty;
    
    case 'equals':
      if (isNullish) return false;
      // Handle string comparison (case-insensitive for strings)
      if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
        return fieldValue.toLowerCase() === expectedValue.toLowerCase();
      }
      return fieldValue === expectedValue;
    
    case 'not_equals':
      if (isNullish) return false;
      if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
        return fieldValue.toLowerCase() !== expectedValue.toLowerCase();
      }
      return fieldValue !== expectedValue;
    
    // Ordering comparisons work on numbers (integration levels, criticality) and
    // on dates (scan and review dates) — see comparablePair.
    case 'gte': {
      if (isNullish) return false;
      const pair = comparablePair(fieldValue, expectedValue);
      return pair ? pair[0] >= pair[1] : false;
    }

    case 'gt': {
      if (isNullish) return false;
      const pair = comparablePair(fieldValue, expectedValue);
      return pair ? pair[0] > pair[1] : false;
    }

    case 'lte': {
      if (isNullish) return false;
      const pair = comparablePair(fieldValue, expectedValue);
      return pair ? pair[0] <= pair[1] : false;
    }

    case 'lt': {
      if (isNullish) return false;
      const pair = comparablePair(fieldValue, expectedValue);
      return pair ? pair[0] < pair[1] : false;
    }

    // Rolling windows, relative to evaluation time. A fixed date in `value` is
    // correct on the day it is authored and wrong every day after, so recency
    // requirements ("scanned in the last 30 days", "reviewed every 6 months")
    // need these rather than gte/lte against a literal date.
    case 'within_days': {
      if (isNullish) return false;
      const days = Number(expectedValue);
      const t = toTime(fieldValue);
      if (t === null || Number.isNaN(days)) return false;
      return t >= Date.now() - days * DAY_MS;
    }

    case 'older_than_days': {
      if (isNullish) return false;
      const days = Number(expectedValue);
      const t = toTime(fieldValue);
      if (t === null || Number.isNaN(days)) return false;
      return t < Date.now() - days * DAY_MS;
    }

    case 'contains':
      if (isNullish) return false;
      const fieldStr = String(fieldValue).toLowerCase();
      const searchStr = String(expectedValue).toLowerCase();
      return fieldStr.includes(searchStr);
    
    case 'in':
      if (isNullish) return false;
      // Normalize to array: if it's a string, treat as single-item array
      const inArray = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
      return inArray.includes(fieldValue);
    
    case 'not_in':
      if (isNullish) return false;
      // Normalize to array: if it's a string, treat as single-item array
      const notInArray = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
      return !notInArray.includes(fieldValue);
    
    default:
      console.warn(`Unknown operator: ${operator}`);
      return false;
  }
}

/**
 * Every operator `evaluateFieldCheck` implements, which is the switch's own `case`
 * labels. services/policyFields.js derives POLICY_OPERATORS from this, so adding an
 * operator to the switch without listing it here makes it unsaveable rather than
 * silently dead — and listing one that is not implemented fails the engine's own test.
 */
export const IMPLEMENTED_OPERATORS = Object.freeze([
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
  'within_days',
  'older_than_days',
]);

/** Operators whose `value` is a count of days, so it must be a positive number. */
export const DAY_COUNT_OPERATORS = Object.freeze(['within_days', 'older_than_days']);
