import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scoringConfigDir = path.join(__dirname, '..', 'config', 'scoring');
const integrationLevelsPath = path.join(scoringConfigDir, 'integrationLevels.json');
const riskFactorsPath = path.join(scoringConfigDir, 'riskFactors.json');
const toolQualityPath = path.join(scoringConfigDir, 'toolQuality.json');
const sensitiveFieldsPath = path.join(scoringConfigDir, 'sensitiveFields.json');

const TOOL_QUALITY_COMMENT =
  'Defines category-specific quality multipliers for tools. Weights are 0.0 to 1.0 and cap how much credit a tool can receive.';

export const TOOL_CATEGORIES = ['sast', 'dast', 'sca', 'appFirewall'];

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

export function getSensitiveFieldsConfig() {
  return normalizeSensitiveFieldsConfig(readJsonFile(sensitiveFieldsPath));
}

function normalizeToolCategories(categories, tool, options = {}) {
  if (!Array.isArray(categories) || categories.length === 0) {
    throw new Error(`${tool} must belong to at least one category`);
  }

  const uniqueCategories = [...new Set(categories)]
    .filter((category) => !(options.coerceLegacyWeights && category === 'apiSecurity'));
  if (uniqueCategories.length === 0 && options.coerceLegacyWeights) {
    return [];
  }

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
    categories: normalizeToolCategories(rawValue.categories, tool, options),
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

    const entry = normalizeToolEntry(rawWeight, tool, options);
    if (options.coerceLegacyWeights && entry.categories.length === 0) {
      continue;
    }
    normalized[tool] = entry;
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

export function normalizeSensitiveFieldsConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Sensitive fields config must be an object');
  }

  const rules = Array.isArray(config.rules)
    ? config.rules
    : [{
        id: 'sensitive_term',
        label: 'Sensitive Term',
        classification: 'Sensitive Data',
        severity: 'Medium',
        keyTerms: Array.isArray(config.terms) ? config.terms : [],
        valuePatterns: [],
        why: 'This field path matched a configured sensitive-data term.',
        reviewGuidance: 'Confirm whether the field contains sensitive data and whether access, logging, and retention controls are appropriate.',
      }];

  const normalizedRules = rules.map((rule, index) => {
    if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
      throw new Error(`Sensitive rule ${index + 1} must be an object`);
    }

    const id = String(rule.id || '').trim();
    const label = String(rule.label || '').trim();
    const classification = String(rule.classification || '').trim();
    const severity = String(rule.severity || 'Medium').trim();
    const keyTerms = [...new Set((Array.isArray(rule.keyTerms) ? rule.keyTerms : [])
      .map((term) => String(term).trim())
      .filter(Boolean))];
    const valuePatterns = [...new Set((Array.isArray(rule.valuePatterns) ? rule.valuePatterns : [])
      .map((pattern) => String(pattern).trim())
      .filter(Boolean))];

    if (!id) throw new Error(`Sensitive rule ${index + 1} must have an id`);
    if (!label) throw new Error(`${id} must have a label`);
    if (!classification) throw new Error(`${id} must have a classification`);
    if (keyTerms.length === 0 && valuePatterns.length === 0) {
      throw new Error(`${id} must have at least one key term or value pattern`);
    }

    for (const pattern of valuePatterns) {
      try {
        new RegExp(pattern.replace(/^\(\?i\)/, ''), pattern.startsWith('(?i)') ? 'i' : undefined);
      } catch (error) {
        throw new Error(`${id} has an invalid value pattern: ${error.message}`);
      }
    }

    return {
      id,
      label,
      classification,
      severity,
      keyTerms,
      valuePatterns,
      why: String(rule.why || '').trim(),
      reviewGuidance: String(rule.reviewGuidance || '').trim(),
    };
  });

  const ids = new Set();
  for (const rule of normalizedRules) {
    if (ids.has(rule.id)) {
      throw new Error(`${rule.id} appears more than once`);
    }
    ids.add(rule.id);
  }

  if (normalizedRules.length === 0) {
    throw new Error('At least one sensitive field rule is required');
  }

  return {
    '//': typeof config['//'] === 'string'
      ? config['//']
      : 'Rules used to identify and explain sensitive fields in uploaded OpenAPI/Swagger schemas. keyTerms match field paths; valuePatterns match example/default/enum values.',
    rules: normalizedRules,
  };
}

export async function saveSensitiveFieldsConfig(config) {
  const normalized = normalizeSensitiveFieldsConfig(config);
  const tmpPath = `${sensitiveFieldsPath}.tmp`;
  const data = `${JSON.stringify(normalized, null, 2)}\n`;

  await fs.promises.writeFile(tmpPath, data, 'utf8');
  await fs.promises.rename(tmpPath, sensitiveFieldsPath);

  return normalized;
}
