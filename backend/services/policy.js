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
 * @param {Object} override - Optional PolicyControlOverride object
 * @returns {Object} - Evaluation result
 */
export async function evaluateControl(control, application, override = null) {
  // If control has no field mappings, check for manual override
  if (!control.fields || control.fields.length === 0) {
    if (override) {
      return {
        status: override.isCompliant ? 'meeting' : 'not_meeting',
        evidence: override.isCompliant 
          ? ['Manually marked as compliant by admin']
          : ['Manually marked as not compliant by admin'],
        details: {
          fieldResults: [],
          evaluationLogic: control.evaluationLogic,
          finalResult: override.isCompliant,
          override: {
            isCompliant: override.isCompliant,
            noteId: override.noteId,
            note: override.note ? {
              id: override.note.id,
              content: override.note.content,
              createdAt: override.note.createdAt,
            } : null,
            overriddenBy: override.overriddenBy,
            user: override.user ? {
              id: override.user.id,
              email: override.user.email,
            } : null,
            overriddenAt: override.overriddenAt,
          },
        },
      };
    }
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
 * Evaluate conditional targeting rules for a policy
 * @param {Object} targetingRules - Parsed targeting rules JSON
 * @param {Object} application - Application object with company relation
 * @returns {boolean} - True if policy applies to this application
 */
function evaluateConditionalTargeting(targetingRules, application) {
  if (!targetingRules || !targetingRules.conditions || !Array.isArray(targetingRules.conditions)) {
    return false;
  }

  const { conditions, logic = 'AND' } = targetingRules;

  // Evaluate each condition
  const conditionResults = conditions.map(condition => {
    const fieldValue = getFieldValue(application, condition.fieldPath);
    // Reuse the evaluateFieldCheck logic by creating a temporary field check object
    // Condition value might be a string that needs to be stored as JSON string
    const tempFieldCheck = {
      operator: condition.operator,
      value: typeof condition.value === 'string' ? condition.value : JSON.stringify(condition.value),
    };
    return evaluateFieldCheck(tempFieldCheck, fieldValue);
  });

  // Combine results based on logic
  if (logic === 'OR') {
    return conditionResults.some(result => result === true);
  } else {
    // AND (default)
    return conditionResults.every(result => result === true);
  }
}

/**
 * Active policies that apply to a given company (global, company-targeted, or division match).
 * Used for company policy UI; same applicability rules as compliance evaluation.
 * @returns {Array<{id,name,description,scope,isActive,reason}>} or null if company does not exist
 */
export async function getApplicablePolicySummariesForCompany(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, divisionId: true },
  });
  if (!company) {
    return null;
  }

  const allPolicies = await prisma.policy.findMany({
    where: { isActive: true },
    include: {
      divisionPolicies: {
        include: {
          division: {
            select: { id: true, name: true },
          },
        },
      },
      companyPolicies: {
        include: {
          company: {
            select: { id: true },
          },
        },
      },
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const policies = [];

  for (const policy of allPolicies) {
    let reason = '';

    if (policy.scope === 'global') {
      reason = 'Applies to all';
    } else if (policy.scope === 'company') {
      const companyMatch = policy.companyPolicies?.some((cp) => cp.company.id === companyId);
      if (companyMatch) {
        reason = 'Assigned to this company';
      }
    } else if (policy.scope === 'division' && company.divisionId) {
      const divisionMatch = policy.divisionPolicies?.find(
        (dp) => dp.division.id === company.divisionId,
      );
      if (divisionMatch) {
        reason = `Assigned to ${divisionMatch.division.name} division`;
      }
    }

    if (reason) {
      policies.push({
        id: policy.id,
        name: policy.name,
        description: policy.description,
        scope: policy.scope,
        isActive: policy.isActive,
        reason,
      });
    }
  }

  return policies;
}

/**
 * Whether a company member is allowed to read policy details (must be an applicable policy).
 */
export async function canCompanyViewPolicy(policyId, companyId) {
  const summaries = await getApplicablePolicySummariesForCompany(companyId);
  if (summaries === null) {
    return false;
  }
  return summaries.some((p) => p.id === policyId);
}

/**
 * Determine which policies apply to an application
 * @param {Object} application - Application object with company relation
 * @returns {Array} - Array of applicable Policy objects
 */
async function getApplicablePolicies(application) {
  const applicablePolicies = [];

  // Get all active policies with their relationships
  const allPolicies = await prisma.policy.findMany({
    where: {
      isActive: true,
    },
    include: {
      divisionPolicies: {
        include: {
          division: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      companyPolicies: {
        include: {
          company: {
            select: {
              id: true,
            },
          },
        },
      },
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  // Check each policy
  for (const policy of allPolicies) {
    let applies = false;
    let reason = '';

    if (policy.scope === 'global') {
      applies = true;
      reason = 'Applies to all applications';
    } else if (policy.scope === 'division') {
      // Check if application's company is in one of the policy's divisions
      if (application.company?.divisionId) {
        const divisionMatch = policy.divisionPolicies.find(
          dp => dp.division.id === application.company.divisionId
        );
        if (divisionMatch) {
          applies = true;
          reason = `Your company is in the ${divisionMatch.division.name} division`;
        }
      }
    } else if (policy.scope === 'company') {
      // Check if application's company is in the policy's companies
      if (application.companyId) {
        const companyMatch = policy.companyPolicies.some(
          cp => cp.company.id === application.companyId
        );
        if (companyMatch) {
          applies = true;
          reason = 'Applies to your company';
        }
      }
    } else if (policy.scope === 'conditional') {
      // Evaluate conditional targeting rules
      if (policy.targetingRules) {
        try {
          const targetingRules = JSON.parse(policy.targetingRules);
          if (evaluateConditionalTargeting(targetingRules, application)) {
            applies = true;
            // Build reason from conditions
            if (targetingRules.conditions && targetingRules.conditions.length > 0) {
              const conditionDescriptions = targetingRules.conditions.map(c => {
                const fieldValue = getFieldValue(application, c.fieldPath);
                return `${c.fieldPath} ${c.operator} ${c.value} (actual: ${fieldValue})`;
              });
              reason = `Conditional policy: ${conditionDescriptions.join(', ')}`;
            } else {
              reason = 'Conditional policy requirements met';
            }
          }
        } catch (e) {
          console.error('Error parsing targeting rules for policy:', policy.id, e);
        }
      }
    }

    if (applies) {
      applicablePolicies.push({
        ...policy,
        reason,
      });
    }
  }

  return applicablePolicies;
}

/**
 * Evaluate all applicable policies and their controls for an application
 * @param {Object} application - Application object with company relation
 * @returns {Object} - Evaluation results grouped by policy
 */
export async function evaluateAllControls(application) {
  // Get applicable policies
  const applicablePolicies = await getApplicablePolicies(application);

  // Get all controls from applicable policies
  const policyIds = applicablePolicies.map(p => p.id);
  
  const controls = await prisma.policyControl.findMany({
    where: {
      isActive: true,
      policyId: {
        in: policyIds,
      },
    },
    include: {
      fields: {
        orderBy: {
          displayOrder: 'asc',
        },
      },
      policy: {
        select: {
          id: true,
          name: true,
          scope: true,
        },
      },
    },
    orderBy: {
      displayOrder: 'asc',
    },
  });

  // Fetch all overrides for this application and these controls
  const controlIds = controls.map(c => c.id);
  const overrides = await prisma.policyControlOverride.findMany({
    where: {
      applicationId: application.id,
      controlId: {
        in: controlIds,
      },
    },
    include: {
      note: {
        select: {
          id: true,
          content: true,
          createdAt: true,
        },
      },
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  // Create a map of controlId -> override for quick lookup
  const overrideMap = new Map();
  overrides.forEach(override => {
    overrideMap.set(override.controlId, override);
  });

  // Evaluate each control
  const controlResults = await Promise.all(
    controls.map(async (control) => {
      const override = overrideMap.get(control.id) || null;
      const evaluation = await evaluateControl(control, application, override);
      return {
        control: {
          id: control.id,
          controlId: control.controlId,
          name: control.name,
          description: control.description,
          category: control.category,
          evaluationLogic: control.evaluationLogic,
        },
        policy: control.policy,
        status: evaluation.status,
        evidence: evaluation.evidence,
        details: evaluation.details,
      };
    })
  );

  // Group controls by policy
  const policiesMap = new Map();
  
  // Initialize policy entries
  applicablePolicies.forEach(policy => {
    policiesMap.set(policy.id, {
      policy: {
        id: policy.id,
        name: policy.name,
        description: policy.description,
        scope: policy.scope,
        category: policy.category,
      },
      reason: policy.reason,
      controls: [],
      summary: {
        total: 0,
        meeting: 0,
        not_meeting: 0,
        compliance_percentage: 0,
      },
    });
  });

  // Group control results by policy
  controlResults.forEach(controlResult => {
    const policyEntry = policiesMap.get(controlResult.policy.id);
    if (policyEntry) {
      policyEntry.controls.push(controlResult);
      policyEntry.summary.total++;
      if (controlResult.status === 'meeting') {
        policyEntry.summary.meeting++;
      } else {
        policyEntry.summary.not_meeting++;
      }
    }
  });

  // Calculate compliance percentages for each policy
  policiesMap.forEach(policyEntry => {
    const { total, meeting } = policyEntry.summary;
    policyEntry.summary.compliance_percentage = total > 0 ? Math.round((meeting / total) * 100) : 100;
  });

  // Convert to array
  const policies = Array.from(policiesMap.values());

  // Calculate overall summary
  const allControls = controlResults;
  const total = allControls.length;
  const meeting = allControls.filter(cr => cr.status === 'meeting').length;
  const notMeeting = allControls.filter(cr => cr.status === 'not_meeting').length;
  const compliancePercentage = total > 0 ? Math.round((meeting / total) * 100) : 100;

  // Overall compliance: all policies must be 100% compliant
  const allPoliciesCompliant = policies.every(p => p.summary.compliance_percentage === 100);

  return {
    policies,
    summary: {
      total,
      meeting,
      not_meeting: notMeeting,
      compliance_percentage: compliancePercentage,
      all_policies_compliant: allPoliciesCompliant,
      total_policies: policies.length,
      compliant_policies: policies.filter(p => p.summary.compliance_percentage === 100).length,
    },
  };
}
