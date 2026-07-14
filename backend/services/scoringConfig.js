import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scoringConfigDir = path.join(__dirname, '..', 'config', 'scoring');
const integrationLevelsPath = path.join(scoringConfigDir, 'integrationLevels.json');
const riskFactorsPath = path.join(scoringConfigDir, 'riskFactors.json');
const toolQualityPath = path.join(scoringConfigDir, 'toolQuality.json');

const TOOL_QUALITY_COMMENT =
  'Defines category-specific quality multipliers for tools. Weights are 0.0 to 1.0 and cap how much credit a tool can receive.';

export const TOOL_CATEGORIES = ['sast', 'dast', 'sca', 'appFirewall', 'apiSecurity'];

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function getIntegrationLevelsConfig() {
  return readJsonFile(integrationLevelsPath);
}

export function getRiskFactorsConfig() {
  return readJsonFile(riskFactorsPath);
}

export function getToolQualityConfig() {
  return normalizeToolQualityConfig(readJsonFile(toolQualityPath), { coerceLegacyWeights: true });
}

function normalizeToolCategories(categories, tool) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(`${tool} must belong to at least one category`);
  }

  const uniqueCategories = [...new Set(categories)];
  for (const category of uniqueCategories) {
    if (!TOOL_CATEGORIES.includes(category)) {
      throw new Error(`${tool} has an unknown category: ${category}`);
    }
  }

  return uniqueCategories;
}

function normalizeToolEntry(rawValue, tool, options = {}) {
  if (typeof rawValue === 'number') {
    return {
      weight: normalizeToolWeight(rawValue, tool, options),
      categories: [...TOOL_CATEGORIES],
    };
  }

  if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    throw new Error(`${tool} must be an object with weight and categories`);
  }

  return {
    weight: normalizeToolWeight(rawValue.weight, tool, options),
    categories: normalizeToolCategories(rawValue.categories, tool),
  };
}

function normalizeToolWeight(rawWeight, label, options = {}) {
  const weight = Number(rawWeight);
  if (options.coerceLegacyWeights && Number.isFinite(weight) && weight > 1 && weight <= 10) {
    return 1;
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new Error(`${label} must have a weight between 0 and 1`);
  }
  return weight;
}

function normalizeToolWeights(value, sectionName, options = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${sectionName} must be an object`);
  }

  const normalized = {};
  for (const [rawTool, rawWeight] of Object.entries(value)) {
    const tool = rawTool.trim();
    if (!tool) {
      throw new Error(`${sectionName} contains an empty tool name`);
    }

    normalized[tool] = normalizeToolEntry(rawWeight, tool, options);
  }

  return normalized;
}

export function normalizeToolQualityConfig(config, options = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Tool quality config must be an object');
  }

  return {
    '//': typeof config['//'] === 'string' ? config['//'] : TOOL_QUALITY_COMMENT,
    managed: normalizeToolWeights(config.managed ?? {}, 'Managed tools', options),
    approvedUnmanaged: normalizeToolWeights(config.approvedUnmanaged ?? {}, 'Approved unmanaged tools', options),
    other: normalizeToolWeight(config.other, 'Default tool weight', options),
  };
}

export async function saveToolQualityConfig(config) {
  const normalized = normalizeToolQualityConfig(config);
  const tmpPath = `${toolQualityPath}.tmp`;
  const data = `${JSON.stringify(normalized, null, 2)}\n`;

  await fs.promises.writeFile(tmpPath, data, 'utf8');
  await fs.promises.rename(tmpPath, toolQualityPath);

  return normalized;
}
