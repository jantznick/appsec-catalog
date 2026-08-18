/**
 * Public surface of the AI foundation. Import from here rather than reaching
 * into individual modules.
 */
export { runAi } from './runAi.js';
export { isAiConfigured } from './client.js';
export {
  resolveAccess,
  assertAiAllowed,
  getMonthToDateUsage,
  listAccessRules,
  setCompanyAccess,
} from './access.js';
export { getAiConfig, updateAiConfig } from './config.js';
export {
  getActivePricing,
  listPricing,
  setPricing,
  computeCost,
} from './pricing.js';
export { getUsageSummary, listRecentRequests } from './usage.js';
export { AI_FEATURES, AI_FEATURE_KEYS, listFeatures, isKnownFeature } from './features.js';
export { AiError, AiConfigError, AiAccessError } from './errors.js';
