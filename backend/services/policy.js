import { prisma } from '../prisma/client.js';

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
function parseValue(valueStr) {
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
    
    case 'gte':
      if (isNullish) return false;
      const numValue = Number(fieldValue);
      const numExpected = Number(expectedValue);
      if (isNaN(numValue) || isNaN(numExpected)) return false;
      return numValue >= numExpected;
    
    case 'gt':
      if (isNullish) return false;
      const numValueGt = Number(fieldValue);
      const numExpectedGt = Number(expectedValue);
      if (isNaN(numValueGt) || isNaN(numExpectedGt)) return false;
      return numValueGt > numExpectedGt;
    
    case 'lte':
      if (isNullish) return false;
      const numValueLte = Number(fieldValue);
      const numExpectedLte = Number(expectedValue);
      if (isNaN(numValueLte) || isNaN(numExpectedLte)) return false;
      return numValueLte <= numExpectedLte;
    
    case 'lt':
      if (isNullish) return false;
      const numValueLt = Number(fieldValue);
      const numExpectedLt = Number(expectedValue);
      if (isNaN(numValueLt) || isNaN(numExpectedLt)) return false;
      return numValueLt < numExpectedLt;
    
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
 * Evaluate a single policy control against an application
 * @param {Object} control - PolicyControl with fields
 * @param {Object} application - Application object
 * @returns {Object} - Evaluation result
 */
export async function evaluateControl(control, application) {
  if (!control.fields || control.fields.length === 0) {
    return {
      status: 'not_meeting',
      evidence: ['No field mappings defined for this control'],
      details: {
        fieldResults: [],
        evaluationLogic: control.evaluationLogic,
        finalResult: false,
      },
    };
  }
  
  // Sort fields by displayOrder
  const sortedFields = [...control.fields].sort((a, b) => a.displayOrder - b.displayOrder);
  
  // Evaluate each field check
  const fieldResults = sortedFields.map(fieldCheck => {
    const fieldValue = getFieldValue(application, fieldCheck.fieldPath);
    const result = evaluateFieldCheck(fieldCheck, fieldValue);
    
    return {
      fieldPath: fieldCheck.fieldPath,
      operator: fieldCheck.operator,
      value: fieldCheck.value,
      result,
      fieldValue: fieldValue,
    };
  });
  
  // Combine results based on evaluation logic
  let finalResult;
  if (control.evaluationLogic === 'OR') {
    // At least one field check must pass
    finalResult = fieldResults.some(fr => fr.result);
  } else {
    // AND: All field checks must pass
    finalResult = fieldResults.every(fr => fr.result);
  }
  
  // Build evidence array
  const evidence = [];
  const passedFields = fieldResults.filter(fr => fr.result);
  const failedFields = fieldResults.filter(fr => !fr.result);
  
  if (passedFields.length > 0) {
    passedFields.forEach(fr => {
      if (fr.operator === 'exists') {
        evidence.push(`${fr.fieldPath} is configured`);
      } else if (fr.operator === 'equals') {
        evidence.push(`${fr.fieldPath} equals "${fr.fieldValue}"`);
      } else if (fr.operator === 'gte') {
        evidence.push(`${fr.fieldPath} is ${fr.fieldValue} (>= ${parseValue(fr.value)})`);
      } else {
        evidence.push(`${fr.fieldPath} meets requirement`);
      }
    });
  }
  
  if (failedFields.length > 0 && !finalResult) {
    failedFields.forEach(fr => {
      if (fr.operator === 'exists') {
        evidence.push(`${fr.fieldPath} is not configured`);
      } else if (fr.operator === 'equals') {
        evidence.push(`${fr.fieldPath} is "${fr.fieldValue || 'not set'}" (expected "${parseValue(fr.value)}")`);
      } else if (fr.operator === 'gte') {
        evidence.push(`${fr.fieldPath} is ${fr.fieldValue || 'not set'} (requires >= ${parseValue(fr.value)})`);
      } else {
        evidence.push(`${fr.fieldPath} does not meet requirement`);
      }
    });
  }
  
  return {
    status: finalResult ? 'meeting' : 'not_meeting',
    evidence,
    details: {
      fieldResults,
      evaluationLogic: control.evaluationLogic,
      finalResult,
    },
  };
}

/**
 * Evaluate all active policy controls for an application
 * @param {Object} application - Application object
 * @returns {Object} - Evaluation results for all controls
 */
export async function evaluateAllControls(application) {
  // Get all active controls with their fields
  const controls = await prisma.policyControl.findMany({
    where: {
      isActive: true,
    },
    include: {
      fields: {
        orderBy: {
          displayOrder: 'asc',
        },
      },
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });
  
  // Evaluate each control
  const controlResults = await Promise.all(
    controls.map(async (control) => {
      const evaluation = await evaluateControl(control, application);
      return {
        control: {
          id: control.id,
          controlId: control.controlId,
          name: control.name,
          description: control.description,
          category: control.category,
          evaluationLogic: control.evaluationLogic,
        },
        status: evaluation.status,
        evidence: evaluation.evidence,
        details: evaluation.details,
      };
    })
  );
  
  // Calculate summary
  const total = controlResults.length;
  const meeting = controlResults.filter(cr => cr.status === 'meeting').length;
  const notMeeting = controlResults.filter(cr => cr.status === 'not_meeting').length;
  const compliancePercentage = total > 0 ? Math.round((meeting / total) * 100) : 100;
  
  return {
    controls: controlResults,
    summary: {
      total,
      meeting,
      not_meeting: notMeeting,
      compliance_percentage: compliancePercentage,
    },
  };
}
