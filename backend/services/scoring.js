import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configs once at module level
const integrationLevels = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'config', 'scoring', 'integrationLevels.json'),
    'utf-8'
  )
);
const toolQuality = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'config', 'scoring', 'toolQuality.json'),
    'utf-8'
  )
);
const riskFactors = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'config', 'scoring', 'riskFactors.json'),
    'utf-8'
  )
);

const MAX_SCORE_PER_CATEGORY = 50;
const SCAN_GRACE_PERIOD_DAYS = 1; // Grace period after deployment before scan is required
const METADATA_REVIEW_MAX_DAYS = 180; // 6 months in days
const METADATA_REVIEW_MAX_POINTS = 10; // Maximum points for metadata review

/** The eight text metadata fields that contribute to knowledge-sharing completeness. */
export const KNOWLEDGE_SCORING_FIELDS = [
  { key: 'description', label: 'Description' },
  { key: 'devTeamContact', label: 'Development Team Contact' },
  { key: 'repoUrl', label: 'Repository URL' },
  { key: 'language', label: 'Language' },
  { key: 'framework', label: 'Framework' },
  { key: 'serverEnvironment', label: 'Server Environment' },
  { key: 'authProfiles', label: 'Authentication Profiles' },
  { key: 'dataTypes', label: 'Data Types' },
];

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
 * A knowledge field is counted as "filled" for the 40pt completeness if it has real content; empty and "NA" are not filled.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isKnowledgeFieldFilledForScore(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '' || t === 'NA') return false;
    return true;
  }
  return Boolean(value);
}

/**
 * @param {Object} app
 * @returns {{ totalScorable: number, fieldsFilled: number, missingFields: string[] }}
 */
export function getKnowledgeSharingFieldBreakdown(app) {
  let totalScorable = 0;
  let fieldsFilled = 0;
  const missingFields = [];
  for (const { key, label } of KNOWLEDGE_SCORING_FIELDS) {
    const v = app[key];
    if (isMetadataValueNA(v)) {
      continue;
    }
    totalScorable += 1;
    if (isKnowledgeFieldFilledForScore(v)) {
      fieldsFilled += 1;
    } else {
      missingFields.push(label);
    }
  }
  return { totalScorable, fieldsFilled, missingFields };
}

/**
 * Security tool category is excluded from integration/scan scoring (receives full category credit):
 * API Security "N/A" boolean, or the tool name is exactly "NA" (see isMetadataValueNA).
 * @param {Object} app
 * @param {string} category - sast | dast | sca | appFirewall | apiSecurity
 * @returns {boolean}
 */
export function isSecurityToolCategoryNotApplicable(app, category) {
  if (category === 'apiSecurity' && app.apiSecurityNA) {
    return true;
  }
  if (category === 'appFirewall' && app.appFirewallNA) {
    return true;
  }
  if (category === 'sast' || category === 'dast') {
    return false;
  }
  if (category === 'sca' && app.sastIncludesSca) {
    return false;
  }
  if (category === 'sca' && !app.sastIncludesSca) {
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
 * @returns {{ tool: unknown, level: unknown, scanField: string|null, mirrorFromSast: boolean }}
 */
export function resolveCategoryToolInputs(app, category) {
  if (category === 'sca' && app.sastIncludesSca) {
    return {
      tool: app.sastTool,
      level: app.sastIntegrationLevel,
      scanField: 'lastSastScanDate',
      mirrorFromSast: true,
    };
  }
  const scanByCategory = {
    sast: 'lastSastScanDate',
    dast: 'lastDastScanDate',
    sca: 'lastScaScanDate',
  };
  return {
    tool: app[`${category}Tool`],
    level: app[`${category}IntegrationLevel`],
    scanField: scanByCategory[category] || null,
    mirrorFromSast: false,
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
  if (isMetadataValueNA(app.facing)) {
    // Treat as missing: assume external (same as else branch below)
    importance += 0.15;
    factors.push({
      type: 'facing',
      description: 'External-facing (assumed - data not provided or marked N/A)',
      contributed: false,
      value: null
    });
  } else if (app.facing === 'External') {
    importance += 0.15;
    factors.push({
      type: 'facing',
      description: 'External-facing application',
      contributed: true,
      value: 'External'
    });
  } else if (app.facing === 'Internal') {
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
    const dataTypesLower = app.dataTypes.toLowerCase();
    const hasPII = dataTypesLower.includes('pii') || dataTypesLower.includes('personal');
    const hasPCI = dataTypesLower.includes('pci') || dataTypesLower.includes('payment');
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
  const toolCategories = ['sast', 'dast', 'sca', 'appFirewall', 'apiSecurity'];
  const MAX_TOOL_SCORE = 50;
  const BASE_POINTS_PER_CATEGORY = MAX_TOOL_SCORE / toolCategories.length; // 10

  let totalAchievedPoints = 0;
  let totalPossiblePoints = 0;

  for (const category of toolCategories) {
    // 1. Determine the risk-adjusted maximum points for this category
    let riskWeight = 1.0;
    
    // Apply facing risk factor
    if (app.facing && riskFactors.facing[app.facing]) {
      riskWeight = Math.max(riskWeight, riskFactors.facing[app.facing]);
    }
    
    // Apply data type risk factors using boolean fields (more accurate)
    // Check for PCI, PII, PHI data types
    // Note: These are stored as boolean fields but may also be in dataTypes string
    // We prioritize the boolean fields if available, otherwise fall back to string parsing
    let hasPCI = false;
    let hasPII = false;
    let hasPHI = false;
    
    // Check boolean fields first (if they exist on the app object)
    if (app.pciData === true || app.pciData === 'true') {
      hasPCI = true;
    }
    if (app.piiData === true || app.piiData === 'true') {
      hasPII = true;
    }
    if (app.phiData === true || app.phiData === 'true') {
      hasPHI = true;
    }
    
    // Fall back to parsing dataTypes string if boolean fields not available
    if (!hasPCI && !hasPII && !hasPHI && app.dataTypes && !isMetadataValueNA(app.dataTypes)) {
      const dataTypesArray = app.dataTypes.split(',').map(dt => dt.trim());
      dataTypesArray.forEach(dt => {
        if (dt.toUpperCase().includes('PCI')) hasPCI = true;
        if (dt.toUpperCase().includes('PII')) hasPII = true;
        if (dt.toUpperCase().includes('PHI')) hasPHI = true;
      });
    }
    
    // Apply risk factors
    if (hasPCI && riskFactors.dataTypes['PCI']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PCI']);
    }
    if (hasPII && riskFactors.dataTypes['PII']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PII']);
    }
    if (hasPHI && riskFactors.dataTypes['PHI']) {
      riskWeight = Math.max(riskWeight, riskFactors.dataTypes['PHI']);
    }
    
    const categoryMaxPoints = BASE_POINTS_PER_CATEGORY * riskWeight;

    // 2. Add to total possible points for normalization
    totalPossiblePoints += categoryMaxPoints;

    // 3. N/A: API Security flag, or any category with tool set to the plain text "NA" — full credit, no level/scan
    if (isSecurityToolCategoryNotApplicable(app, category)) {
      totalAchievedPoints += categoryMaxPoints;
      continue;
    }

    // 4. Calculate achieved points based on implementation
    const { tool, level, scanField } = resolveCategoryToolInputs(app, category);

    if (!tool || level === null || level === undefined) {
      continue; // No tool, so 0 achieved points for this category
    }

    // Get integration level weight (convert level to string for lookup)
    const levelKey = level.toString();
    const integrationWeight = integrationLevels[levelKey]?.weight || 0;

    // Get tool quality weight
    let toolWeight = toolQuality.other || 0.8;
    if (toolQuality.managed[tool]) {
      toolWeight = toolQuality.managed[tool];
    } else if (toolQuality.approvedUnmanaged[tool]) {
      toolWeight = toolQuality.approvedUnmanaged[tool];
    }

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
        // If tool is configured but no scan date, apply a penalty
        if (lastDeploymentDate) {
          // If there are deployments but no scan, significant penalty
          scanDateWeight = 0.3; // 70% penalty for missing scan dates when deployments exist
        } else {
          // No deployments and no scan date - smaller penalty
          scanDateWeight = 0.8; // 20% penalty for missing scan dates
        }
      }
    }

    // Calculate achieved points for this tool
    const achievedPointsForTool = categoryMaxPoints * integrationWeight * toolWeight * scanDateWeight;
    totalAchievedPoints += achievedPointsForTool;
  }

  if (totalPossiblePoints === 0) return 0;

  // 5. Normalize the score to be out of 50
  const normalizedScore = (totalAchievedPoints / totalPossiblePoints) * MAX_TOOL_SCORE;

  return Math.round(normalizedScore);
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
  const totalScore = knowledgeScore + toolScore;

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




