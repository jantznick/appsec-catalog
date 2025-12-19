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

/**
 * Calculate Knowledge Sharing Score (0-50 points)
 * - 40 points for metadata completeness (8 fields)
 * - 10 points if metadata reviewed within last 6 months
 */
export function calculateKnowledgeSharingScore(app) {
  let score = 0;
  const totalFields = 8; // Number of metadata fields we are scoring on
  let fieldsFilled = 0;

  // Count filled metadata fields
  if (app.description) fieldsFilled++;
  if (app.owner) fieldsFilled++;
  if (app.repoUrl) fieldsFilled++;
  if (app.language) fieldsFilled++;
  if (app.framework) fieldsFilled++;
  if (app.serverEnvironment) fieldsFilled++;
  if (app.authProfiles) fieldsFilled++;
  if (app.dataTypes) fieldsFilled++;

  // Completeness is 80% of the score (40 points max)
  score = (fieldsFilled / totalFields) * (MAX_SCORE_PER_CATEGORY * 0.8);

  // Freshness is 20% of the score (10 points max)
  if (app.metadataLastReviewed) {
    const reviewDate = new Date(app.metadataLastReviewed);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (reviewDate > sixMonthsAgo) {
      score += MAX_SCORE_PER_CATEGORY * 0.2;
    }
  }

  return Math.round(score);
}

/**
 * Calculate Tool Usage Score (0-50 points)
 * Based on 4 tool categories with risk-adjusted scoring
 */
export function calculateToolUsageScore(app) {
  const toolCategories = ['sast', 'dast', 'appFirewall', 'apiSecurity'];
  const MAX_TOOL_SCORE = 50;
  const BASE_POINTS_PER_CATEGORY = MAX_TOOL_SCORE / toolCategories.length; // 12.5

  let totalAchievedPoints = 0;
  let totalPossiblePoints = 0;

  for (const category of toolCategories) {
    // 1. Determine the risk-adjusted maximum points for this category
    let riskWeight = 1.0;
    
    // Apply facing risk factor
    if (app.facing && riskFactors.facing[app.facing]) {
      riskWeight = Math.max(riskWeight, riskFactors.facing[app.facing]);
    }
    
    // Apply data type risk factors (use max of all applicable)
    if (app.dataTypes) {
      const dataTypesArray = app.dataTypes.split(',').map(dt => dt.trim());
      dataTypesArray.forEach(dt => {
        if (riskFactors.dataTypes[dt]) {
          riskWeight = Math.max(riskWeight, riskFactors.dataTypes[dt]);
        }
      });
    }
    
    const categoryMaxPoints = BASE_POINTS_PER_CATEGORY * riskWeight;

    // 2. Add to total possible points for normalization
    totalPossiblePoints += categoryMaxPoints;

    // 3. Check if tool is marked as N/A (only for API Security)
    const isNA = category === 'apiSecurity' && app.apiSecurityNA;
    if (isNA) {
      // If Not Applicable, the app achieves the full possible points for this category
      totalAchievedPoints += categoryMaxPoints;
      continue;
    }

    // 4. Calculate achieved points based on implementation
    const toolField = `${category}Tool`;
    const levelField = `${category}IntegrationLevel`;
    const tool = app[toolField];
    const level = app[levelField];

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

    // Calculate achieved points for this tool
    const achievedPointsForTool = categoryMaxPoints * integrationWeight * toolWeight;
    totalAchievedPoints += achievedPointsForTool;
  }

  if (totalPossiblePoints === 0) return 0;

  // 5. Normalize the score to be out of 50
  const normalizedScore = (totalAchievedPoints / totalPossiblePoints) * MAX_TOOL_SCORE;

  return Math.round(normalizedScore);
}

/**
 * Calculate total application score
 * @param {Object} app - Application object from database
 * @returns {Object} - { knowledgeScore, toolScore, totalScore }
 */
export function calculateApplicationScore(app) {
  const knowledgeScore = calculateKnowledgeSharingScore(app);
  const toolScore = calculateToolUsageScore(app);
  const totalScore = knowledgeScore + toolScore;

  return {
    knowledgeScore,
    toolScore,
    totalScore,
  };
}

