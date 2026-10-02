import {
  getIntegrationLevelsConfig,
  getRiskFactorsConfig,
  getToolQualityConfig,
  TOOL_CATEGORIES,
} from './scoringConfig.js';
import { FIELD_SETS, calculateCompleteness } from './completeness.js';
import { APPLICATION_METADATA_FIELDS } from './applicationFields.js';
import { ENVIRONMENT_VALUE_INCLUDE } from './environmentValues.js';

/**
 * Prisma `include` covering every relation `calculateApplicationScore` reads.
 *
 * Spread this into any query whose result is passed to the scorer. Scoring an
 * application loaded without `apiSchema` silently drops the whole API-security
 * category, so a call site with its own hand-written include will disagree with
 * every other call site.
 *
 * `ENVIRONMENT_VALUE_INCLUDE` is spread in because `currentVersion` moved to
 * `ApplicationEnvironment` and still counts toward completeness, which is 40 of the
 * 50 knowledge-score points. Loading the relation is only half of it - the row must
 * also go through `withEnvironmentValues()` before it reaches the scorer. Nothing
 * here can enforce that, but `countFieldSet` throws when it sees a row that loaded
 * the relation and skipped the resolver.
 *
 * None of the scoring ARITHMETIC changed. The include widened; the maths did not.
 */
export const SCORING_INCLUDE = {
  deployments: {
    orderBy: { deployedAt: 'desc' },
    take: 1, // Only the most recent deployment affects scan-date freshness.
  },
  apiSchema: { select: { id: true } },
  ...ENVIRONMENT_VALUE_INCLUDE,
};

const MAX_SCORE_PER_CATEGORY = 50;
const SCAN_GRACE_PERIOD_DAYS = 1; // Grace period after deployment before scan is required
const METADATA_REVIEW_MAX_DAYS = 180; // 6 months in days
const METADATA_REVIEW_MAX_POINTS = 10; // Maximum points for metadata review

function getToolQualityWeight(toolQuality, tool, category) {
  const managedTool = toolQuality.managed[tool];
  if (managedTool) {
    return managedTool.categories.includes(category) ? managedTool.weight : 0;
  }

  const approvedTool = toolQuality.approvedUnmanaged[tool];
  if (approvedTool) {
    return approvedTool.categories.includes(category) ? approvedTool.weight : 0;
  }

  return toolQuality.other ?? 0.8;
}

/**
 * The categories the tool score grades.
 *
 * Derived from TOOL_CATEGORIES rather than restated, because a category that the
 * quality config cannot assign is a category every tool scores zero in. The two lists
 * drifting apart is not a visible failure — the score just quietly stops rewarding a
 * field the forms still collect, which is exactly what happened to secrets and
 * IaC/container scanning between Phase 6a and now.
 *
 * `apiSecurity` is appended because it is graded from the uploaded API schema rather
 * than from a named tool, so it has no place in the quality config.
 */
export const SCORED_TOOL_CATEGORIES = Object.freeze([...TOOL_CATEGORIES, 'apiSecurity']);

/** Human label for a metadata field key, falling back to the key itself. */
function getMetadataFieldLabel(key) {
  return APPLICATION_METADATA_FIELDS.find((f) => f.key === key)?.label || key;
}

/**
 * The metadata fields that contribute to knowledge-sharing completeness.
 *
 * Derived from the one completeness set rather than restated. This was a hand-typed
 * list of eight of the App Data tab's thirteen questions, so the 40-point completeness
 * component of the 0-100 score disagreed with the completeness percentage shown beside
 * it: an application could read 100% complete and still be missing five answers the
 * form had asked for. Exported because the API reports the breakdown.
 */
export const KNOWLEDGE_SCORING_FIELDS = FIELD_SETS.metadata.map((key) => ({
  key,
  label: getMetadataFieldLabel(key),
}));

/**
 * If a metadata field is exactly the text "NA" (after trim), it is excluded from scoring for that field.
 * Empty values still count toward the total fields and score as "missing" as before.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMetadataValueNA(value) {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'string') return false;
  return value.trim() === 'NA';
}


/**
 * @param {Object} app
 * @returns {{ totalScorable: number, fieldsFilled: number, missingFields: string[] }}
 */
export function getKnowledgeSharingFieldBreakdown(app) {
  // One implementation. This was its own loop over its own field list with its own
  // blank rule, which is how the score and the completeness percentage drifted apart.
  // `missing` comes back as field keys; the labels are the registry's.
  const { filled, total, missing } = calculateCompleteness(app);
  return {
    totalScorable: total,
    fieldsFilled: filled,
    missingFields: missing.map(getMetadataFieldLabel),
  };
}

/** Canonical facing values; `facing` is a free String column, so compare case-insensitively. */
export function normalizeFacing(value) {
  if (typeof value !== 'string') return null;
  const t = value.trim().toLowerCase();
  if (t === 'external') return 'External';
  if (t === 'internal') return 'Internal';
  return null;
}

/**
 * Which sensitive-data classifications an application declares.
 *
 * The technical form asks PCI/PII/PHI as three independent checkboxes, but the API
 * currently flattens them (with several other answers) into the free-text `dataTypes`
 * column, so there is nothing structured to read. The boolean branch below is written
 * against the columns that APP_DATA_MODEL_EXPLORATION.md proposes adding; until those
 * exist it never matches and the string branch is the only live path.
 *
 * The string branch compares whole tokens, not substrings: "graphics", "Memphis" and
 * "Delphi" all contain "PHI", and treating them as a PHI declaration raises the risk
 * weight on every tool category.
 *
 * @param {Object} app
 * @returns {{ hasPCI: boolean, hasPII: boolean, hasPHI: boolean, declared: boolean }}
 */
export function detectDataClassifications(app) {
  const isTrue = (v) => v === true || v === 'true';

  // Structured columns (not on the model yet - see doc note above).
  let hasPCI = isTrue(app.pciData);
  let hasPII = isTrue(app.piiData);
  let hasPHI = isTrue(app.phiData);

  const hasStructured = hasPCI || hasPII || hasPHI;
  const hasFreeText = Boolean(app.dataTypes) && !isMetadataValueNA(app.dataTypes);

  if (!hasStructured && hasFreeText) {
    const tokens = new Set(
      app.dataTypes
        .toUpperCase()
        .split(/[^A-Z]+/)
        .filter(Boolean),
    );
    hasPCI = tokens.has('PCI');
    hasPII = tokens.has('PII');
    hasPHI = tokens.has('PHI');
  }

  return {
    hasPCI,
    hasPII,
    hasPHI,
    // Whether the application told us anything at all about the data it handles.
    declared: hasStructured || hasFreeText,
  };
}

/**
 * Is this security tool category out of scope for this application?
 *
 * A category that is not applicable leaves the denominator entirely, so its points
 * redistribute across the categories that do apply — an application with no API and no
 * containers is scored on what it actually has, rather than being marked down for
 * tooling it could never need.
 *
 * Three ways to be out of scope: a dedicated N/A declaration, the "NA" sentinel in the
 * tool name, or (for categories a SAST tool can cover) nothing — those stay in scope
 * and are scored from the SAST tool instead. See resolveCategoryToolInputs.
 *
 * @param {Object} app
 * @param {string} category - sast | dast | sca | secretsScan | iacContainerScan | appFirewall | apiSecurity
 * @returns {boolean}
 */
export function isSecurityToolCategoryNotApplicable(app, category) {
  if (category === 'apiSecurity' && app.apiSecurityNA) {
    return true;
  }
  if (category === 'appFirewall' && app.appFirewallNA) {
    return true;
  }
  // "We have no infrastructure-as-code or container images" is a complete answer, not
  // a gap. Note this is only true when explicitly declared: null means unanswered, so
  // the category stays in the denominator and scores zero, as it should.
  if (category === 'iacContainerScan' && app.iacContainerScanNA === true) {
    return true;
  }
  if (category === 'sast' || category === 'dast') {
    return false;
  }
  // Covered by SAST: in scope and scored, from the SAST tool.
  if (category === 'sca' && app.sastIncludesSca) {
    return false;
  }
  if (category === 'secretsScan' && app.sastIncludesSecrets) {
    return false;
  }
  if (category === 'sca') {
    return isMetadataValueNA(app.scaTool);
  }
  const tool = app[`${category}Tool`];
  return isMetadataValueNA(tool);
}

/**
 * Effective tool/level/scan field for scoring and recommendations.
 * When SAST includes SCA, the SCA category reuses SAST's tool, level, and lastSast scan date.
 * @param {Object} app
 * @param {string} category
 * @returns {{ tool: unknown, level: unknown, scanField: string|null, mirrorFromSast: boolean,
 *   qualityCategory: string }} `qualityCategory` is the category the tool-quality
 *   config is consulted under, which differs from `category` only when mirroring.
 */
export function resolveCategoryToolInputs(app, category) {
  // A SAST tool that also covers the category scores it: the team was correctly told
  // to leave the standalone fields blank, so reading them would score zero for work
  // that is being done. Same shape for SCA and secrets.
  const mirrorsSast =
    (category === 'sca' && app.sastIncludesSca) ||
    (category === 'secretsScan' && app.sastIncludesSecrets);
  if (mirrorsSast) {
    return {
      tool: app.sastTool,
      level: app.sastIntegrationLevel,
      scanField: 'lastSastScanDate',
      mirrorFromSast: true,
      // Judge the tool as a SAST tool, because that is what it is. Asking whether it is
      // approved *as a secrets scanner* is the wrong question when the team's answer is
      // "our SAST tool covers this" — and getToolQualityWeight returns 0, not the 0.8
      // fallback, for a managed tool that does not list the category. So ticking the
      // box scored zero: strictly worse than leaving it unticked.
      qualityCategory: 'sast',
    };
  }
  const scanByCategory = {
    sast: 'lastSastScanDate',
    dast: 'lastDastScanDate',
    sca: 'lastScaScanDate',
    secretsScan: 'lastSecretsScanDate',
    iacContainerScan: 'lastIacContainerScanDate',
  };
  return {
    tool: app[`${category}Tool`],
    level: app[`${category}IntegrationLevel`],
    scanField: scanByCategory[category] || null,
    mirrorFromSast: false,
    qualityCategory: category,
  };
}

/**
 * Calculate application importance score (0-1 scale)
 * Based on: businessCriticality, criticalAspects, deploymentType/frequency, interfaces, facing
 * Higher importance means more focus on tool usage vs knowledge sharing
 * 
 * IMPORTANT: Missing data defaults to high importance to encourage teams to provide information.
 * This creates an incentive to fill out forms - if they don't provide data, we assume worst-case.
 * 
 * @returns {Object} - { score: number, factors: Array<{type: string, description: string, contributed: boolean}> }
 */
function calculateImportanceScore(app) {
  let importance = 0;
  const factors = [];
  
  // Business Criticality (1-5 scale) → contributes 0-0.3
  if (app.businessCriticality) {
    const contribution = (app.businessCriticality / 5) * 0.3;
    importance += contribution;
    factors.push({
      type: 'businessCriticality',
      description: `Business criticality: ${app.businessCriticality}/5`,
      contributed: true,
      value: app.businessCriticality
    });
  } else {
    // Missing data: assume high criticality (4 out of 5) to encourage disclosure
    importance += (4 / 5) * 0.3;
    factors.push({
      type: 'businessCriticality',
      description: 'Business criticality: High (assumed - data not provided)',
      contributed: false,
      value: null
    });
  }
  
  // Critical Aspects (count aspects) → contributes 0-0.2
  if (app.criticalAspects && !isMetadataValueNA(app.criticalAspects)) {
    const aspects = app.criticalAspects.split(',').map(a => a.trim()).filter(a => a);
    if (aspects.length > 0) {
      const contribution = Math.min(aspects.length * 0.05, 0.2);
      importance += contribution;
      factors.push({
        type: 'criticalAspects',
        description: `${aspects.length} critical aspect${aspects.length !== 1 ? 's' : ''}: ${aspects.join(', ')}`,
        contributed: true,
        value: aspects
      });
    } else {
      // Missing data: assume 2 critical aspects (moderate importance)
      importance += 2 * 0.05;
      factors.push({
        type: 'criticalAspects',
        description: 'Critical aspects: Moderate (assumed - data not provided)',
        contributed: false,
        value: null
      });
    }
  } else {
    // Missing data: assume 2 critical aspects (moderate importance)
    importance += 2 * 0.05;
    factors.push({
      type: 'criticalAspects',
      description: 'Critical aspects: Moderate (assumed - data not provided)',
      contributed: false,
      value: null
    });
  }
  
  // Deployment Type/Frequency → contributes 0-0.2
  if (app.deploymentType && !isMetadataValueNA(app.deploymentType)) {
    const deploymentLower = app.deploymentType.toLowerCase();
    let contribution = 0;
    let frequencyDesc = '';
    
    // High frequency or automated deployments increase importance
    if (deploymentLower.includes('multiple times per day') || 
        deploymentLower.includes('daily') ||
        deploymentLower.includes('automated')) {
      contribution = 0.2;
      frequencyDesc = 'High frequency deployments';
    } else if (deploymentLower.includes('weekly')) {
      contribution = 0.1;
      frequencyDesc = 'Weekly deployments';
    } else {
      // Deployment type provided but not high frequency: assume moderate
      contribution = 0.1;
      frequencyDesc = 'Moderate deployment frequency';
    }
    importance += contribution;
    factors.push({
      type: 'deploymentFrequency',
      description: `${frequencyDesc}: ${app.deploymentType}`,
      contributed: true,
      value: app.deploymentType
    });
  } else {
    // Missing data: assume high frequency/automated deployment (worst case)
    importance += 0.2;
    factors.push({
      type: 'deploymentFrequency',
      description: 'High frequency deployments (assumed - data not provided)',
      contributed: false,
      value: null
    });
  }
  
  // Interfaces (count) → contributes 0-0.15
  if (app.interfaces && !isMetadataValueNA(app.interfaces)) {
    try {
      const interfaceIds = JSON.parse(app.interfaces);
      if (Array.isArray(interfaceIds) && interfaceIds.length > 0) {
        const contribution = Math.min(interfaceIds.length * 0.03, 0.15);
        importance += contribution;
        factors.push({
          type: 'interfaces',
          description: `${interfaceIds.length} interface${interfaceIds.length !== 1 ? 's' : ''} with other applications`,
          contributed: true,
          value: interfaceIds.length
        });
      } else {
        // Interfaces field exists but is empty: assume no interfaces (lower importance)
        // Don't add anything
        factors.push({
          type: 'interfaces',
          description: 'No interfaces with other applications',
          contributed: true,
          value: 0
        });
      }
    } catch (e) {
      // Parse error: assume no interfaces
      factors.push({
        type: 'interfaces',
        description: 'No interfaces with other applications',
        contributed: true,
        value: 0
      });
    }
  } else {
    // Missing data: assume some interfaces exist (moderate importance)
    // Assume 2 interfaces to encourage disclosure
    importance += Math.min(2 * 0.03, 0.15);
    factors.push({
      type: 'interfaces',
      description: '2 interfaces (assumed - data not provided)',
      contributed: false,
      value: null
    });
  }
  
  // Facing (External = more important) → contributes 0-0.15
  // `facing` is a free String column written by four different paths, so normalize
  // before comparing - an imported "internal" must not read as missing data.
  const facing = isMetadataValueNA(app.facing) ? null : normalizeFacing(app.facing);
  if (isMetadataValueNA(app.facing)) {
    // Treat as missing: assume external (same as else branch below)
    importance += 0.15;
    factors.push({
      type: 'facing',
      description: 'External-facing (assumed - data not provided or marked N/A)',
      contributed: false,
      value: null
    });
  } else if (facing === 'External') {
    importance += 0.15;
    factors.push({
      type: 'facing',
      description: 'External-facing application',
      contributed: true,
      value: 'External'
    });
  } else if (facing === 'Internal') {
    // Internal is explicitly stated, so lower importance
    // Don't add anything (Internal = 0 contribution)
    factors.push({
      type: 'facing',
      description: 'Internal-facing application',
      contributed: true,
      value: 'Internal'
    });
  } else {
    // Missing data: assume External (worst case, higher importance)
    importance += 0.15;
    factors.push({
      type: 'facing',
      description: 'External-facing (assumed - data not provided)',
      contributed: false,
      value: null
    });
  }
  
  // Data Types (PII, PCI, etc.) → check if they contribute to risk
  if (app.dataTypes && !isMetadataValueNA(app.dataTypes)) {
    const { hasPII, hasPCI } = detectDataClassifications(app);
    const hasSensitive = hasPII || hasPCI;

    if (hasSensitive) {
      const sensitiveTypes = [];
      if (hasPII) sensitiveTypes.push('PII');
      if (hasPCI) sensitiveTypes.push('PCI');
      factors.push({
        type: 'dataTypes',
        description: `Handles sensitive data: ${sensitiveTypes.join(', ')}`,
        contributed: true,
        value: app.dataTypes
      });
    } else {
      factors.push({
        type: 'dataTypes',
        description: `Data types: ${app.dataTypes}`,
        contributed: false,
        value: app.dataTypes
      });
    }
  }
  
  // Clamp to 0-1 range
  const score = Math.min(Math.max(importance, 0), 1);
  
  return {
    score,
    factors
  };
}

/**
 * Calculate Knowledge Sharing Score (0-50 points)
 * - 40 points for metadata completeness (up to 8 scorable text fields; values of exactly "NA" are excluded)
 * - 10 points if metadata reviewed within last 6 months
 */
export function calculateKnowledgeSharingScore(app) {
  let score = 0;
  const { totalScorable, fieldsFilled } = getKnowledgeSharingFieldBreakdown(app);

  // Completeness is 80% of the score (40 points max). Fields set to "NA" are excluded from the fraction.
  const completenessPoints =
    totalScorable > 0
      ? (fieldsFilled / totalScorable) * (MAX_SCORE_PER_CATEGORY * 0.8)
      : 0;
  score = completenessPoints;

  // Freshness is 20% of the score (10 points max) - sliding scale based on days since review
  if (app.metadataLastReviewed) {
    const reviewDate = new Date(app.metadataLastReviewed);
    const now = new Date();
    const daysSinceReview = (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceReview <= METADATA_REVIEW_MAX_DAYS) {
      // Calculate points: 10 points per day, decreasing linearly over 6 months
      // Formula: max(0, 10 - (daysSinceReview / METADATA_REVIEW_MAX_DAYS) * 10)
      const reviewPoints = Math.max(0, METADATA_REVIEW_MAX_POINTS - (daysSinceReview / METADATA_REVIEW_MAX_DAYS) * METADATA_REVIEW_MAX_POINTS);
      score += reviewPoints;
    }
    // If reviewed more than 6 months ago, no points awarded
  }

  return Math.round(score);
}

/**
 * Calculate Tool Usage Score (0-50 points)
 * Based on 5 tool categories (SAST, DAST, SCA, app firewall, API security) with risk-adjusted scoring
 */
export function calculateToolUsageScore(app) {
  const integrationLevels = getIntegrationLevelsConfig();
  const riskFactors = getRiskFactorsConfig();
  const toolQuality = getToolQualityConfig();

  const toolCategories = SCORED_TOOL_CATEGORIES;
  const MAX_TOOL_SCORE = 50;
  const BASE_POINTS_PER_CATEGORY = MAX_TOOL_SCORE / toolCategories.length; // 10

  let totalAchievedPoints = 0;
  let totalPossiblePoints = 0;

  // Risk inputs do not vary by category, so resolve them once.
  // Important: missing/NA facing should not be a scoring loophole. Assume External when not provided.
  const facingValue = isMetadataValueNA(app.facing)
    ? 'External'
    : normalizeFacing(app.facing) || 'External';
  const {
    hasPCI,
    hasPII,
    hasPHI,
    declared: declaredDataTypes,
  } = detectDataClassifications(app);

  for (const category of toolCategories) {
    // 1. Determine the risk-adjusted maximum points for this category
    let riskWeight = 1.0;

    // Apply facing risk factor
    if (riskFactors.facing[facingValue]) {
      riskWeight = Math.max(riskWeight, riskFactors.facing[facingValue]);
    }

    // Apply data type risk factors
    if (hasPCI && riskFactors.dataTypes['PCI']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PCI']);
    }
    if (hasPII && riskFactors.dataTypes['PII']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PII']);
    }
    if (hasPHI && riskFactors.dataTypes['PHI']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PHI']);
    }
    // If no data type info was provided at all, assume worst-case (so omission can't inflate score).
    if (!declaredDataTypes) {
      const worstCaseDataTypeRisk = Math.max(
        riskFactors.dataTypes?.PCI || 1.0,
        riskFactors.dataTypes?.PII || 1.0,
        riskFactors.dataTypes?.PHI || 1.0,
      );
      riskWeight = Math.max(riskWeight, worstCaseDataTypeRisk);
    }

    const categoryMaxPoints = BASE_POINTS_PER_CATEGORY * riskWeight;

    // 2. N/A categories are excluded from the denominator so their points redistribute to applicable categories.
    if (isSecurityToolCategoryNotApplicable(app, category)) {
      continue;
    }

    // 3. Add applicable categories to total possible points for normalization
    totalPossiblePoints += categoryMaxPoints;

    if (category === 'apiSecurity') {
      if (app.apiSchema) {
        totalAchievedPoints += categoryMaxPoints;
      }
      continue;
    }

    // 4. Calculate achieved points based on implementation
    const { tool, level, scanField, qualityCategory } = resolveCategoryToolInputs(app, category);

    if (!tool || level === null || level === undefined) {
      continue; // No tool, so 0 achieved points for this category
    }

    // Get integration level weight (convert level to string for lookup)
    const levelKey = level.toString();
    const integrationWeight = integrationLevels[levelKey]?.weight || 0;

    // Get tool quality weight
    const toolWeight = getToolQualityWeight(toolQuality, tool, qualityCategory);

    // Check scan date freshness (SAST, DAST, SCA / SCA-via-SAST) relative to last deployment
    let scanDateWeight = 1.0; // Default: full points
    if (scanField) {
      const scanDate = app[scanField] ? new Date(app[scanField]) : null;
      
      // Get last deployment date
      let lastDeploymentDate = null;
      if (app.deployments && Array.isArray(app.deployments) && app.deployments.length > 0) {
        // Find most recent deployment
        const sortedDeployments = [...app.deployments].sort((a, b) => {
          const dateA = new Date(a.deployedAt);
          const dateB = new Date(b.deployedAt);
          return dateB - dateA; // Descending order
        });
        lastDeploymentDate = new Date(sortedDeployments[0].deployedAt);
      }
      
      if (scanDate) {
        if (lastDeploymentDate) {
          // Check if scan was done within grace period relative to last deployment
          // Scan should be done 1 day before deployment or more recent (within 1 day after)
          const daysAfterDeployment = (scanDate.getTime() - lastDeploymentDate.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysAfterDeployment < -SCAN_GRACE_PERIOD_DAYS) {
            // Scan is more than 1 day BEFORE last deployment - penalty
            // The further before, the larger the penalty
            const daysBefore = Math.abs(daysAfterDeployment) - SCAN_GRACE_PERIOD_DAYS;
            scanDateWeight = Math.max(0.3, 1.0 - (daysBefore * 0.1)); // Decreasing weight based on days before
          } else if (daysAfterDeployment > SCAN_GRACE_PERIOD_DAYS) {
            // Scan is more than 1 day AFTER last deployment - also penalty
            // The further after, the larger the penalty
            const daysAfter = daysAfterDeployment - SCAN_GRACE_PERIOD_DAYS;
            scanDateWeight = Math.max(0.3, 1.0 - (daysAfter * 0.1)); // Decreasing weight based on days after
          }
          // If scan is within grace period (1 day before to 1 day after deployment), full points
        } else {
          // No deployments recorded, use absolute date check as fallback
          const daysSinceScan = (Date.now() - scanDate.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceScan > 90) {
            scanDateWeight = 0.5; // 50% penalty for very old scans when no deployment data
          }
        }
      } else {
        scanDateWeight = 0.3; // 70% penalty for missing scan dates
      }
    }

    // Calculate achieved points for this tool
    const achievedPointsForTool = categoryMaxPoints * integrationWeight * toolWeight * scanDateWeight;
    totalAchievedPoints += achievedPointsForTool;
  }

  if (totalPossiblePoints === 0) return 0;

  // 5. Normalize the score to be out of 50
  const normalizedScore = (totalAchievedPoints / totalPossiblePoints) * MAX_TOOL_SCORE;

  return Math.round(Math.min(normalizedScore, MAX_TOOL_SCORE));
}

/**
 * Calculate total application score with importance-based weighting
 * @param {Object} app - Application object from database
 * @returns {Object} - { knowledgeScore, toolScore, totalScore, importanceScore, knowledgeWeight, toolWeight }
 */
export function calculateApplicationScore(app) {
  // Calculate raw scores (0-50 each)
  const rawKnowledgeScore = calculateKnowledgeSharingScore(app);
  const rawToolScore = calculateToolUsageScore(app);
  
  // Calculate importance score (0-1 scale) and factors
  const importanceResult = calculateImportanceScore(app);
  const importanceScore = importanceResult.score;
  const importanceFactors = importanceResult.factors;
  
  // Determine weighting based on importance
  // Low importance (0-0.33): More weight on Knowledge Sharing (60/40)
  // Medium importance (0.33-0.67): Balanced (50/50)
  // High importance (0.67-1.0): More weight on Tool Usage (40/60)
  let knowledgeWeight, toolWeight;
  if (importanceScore < 0.33) {
    // Low importance: 60/40 split
    knowledgeWeight = 0.6;
    toolWeight = 0.4;
  } else if (importanceScore < 0.67) {
    // Medium importance: 50/50 split
    knowledgeWeight = 0.5;
    toolWeight = 0.5;
  } else {
    // High importance: 40/60 split
    knowledgeWeight = 0.4;
    toolWeight = 0.6;
  }
  
  // Apply weights and scale to maintain 100 point total
  const knowledgeScore = Math.round(rawKnowledgeScore * knowledgeWeight * 2);
  const toolScore = Math.round(rawToolScore * toolWeight * 2);
  const totalScore = Math.min(knowledgeScore + toolScore, 100);

  return {
    knowledgeScore,
    toolScore,
    totalScore,
    importanceScore: Math.round(importanceScore * 100) / 100, // Round to 2 decimal places
    importanceFactors, // Include factors that contributed to importance
    knowledgeWeight,
    toolWeight,
    rawKnowledgeScore, // Include raw scores for transparency
    rawToolScore,
  };
}
