/**
 * The single choke-point for every AI call in the app.
 *
 * Guarantees, for each call:
 *   1. Access is checked (global switch, company rule, budget) BEFORE the call.
 *   2. Every attempt writes exactly one AiRequest ledger row — success, error,
 *      or blocked — attributed to company/application/user/feature.
 *   3. The price used is snapshotted onto the row, so later price-book edits
 *      never change historical cost.
 *
 * No feature should ever call the model client directly; go through runAi.
 */
import { prisma } from '../../prisma/client.js';
import { callModel } from './client.js';
import { assertAiAllowed, resolveAccess } from './access.js';
import { getAiConfig } from './config.js';
import { getActivePricing, computeCost } from './pricing.js';
import { AiAccessError } from './errors.js';

/**
 * @param {object} p
 * @param {string} p.feature                 - key from features.js
 * @param {string|null} [p.companyId]
 * @param {string|null} [p.applicationId]
 * @param {string|null} [p.userId]
 * @param {string|null} [p.purpose]          - free-text sub-context
 * @param {string} [p.model]                 - overrides config default
 * @param {string} [p.system]
 * @param {Array}  p.messages
 * @param {number} [p.maxTokens]
 * @param {Array}  [p.tools]
 * @param {object} [p.toolChoice]
 * @returns {Promise<{text, toolUse, usage, cost, model, aiRequestId}>}
 */
export async function runAi({
  feature,
  companyId = null,
  applicationId = null,
  userId = null,
  purpose = null,
  provider,
  model,
  system,
  messages,
  maxTokens,
  tools,
  toolChoice,
}) {
  const config = await getAiConfig();

  // Resolve access first: the decision carries the company's rule, which may
  // override the provider/model. Precedence: feature override -> company
  // setting -> global config default.
  const decision = await resolveAccess({ companyId, userId, feature });
  const rule = decision.rule || null;
  const resolvedProvider = provider || rule?.provider || config.defaultProvider || 'anthropic';
  const resolvedModel = model || rule?.model || config.defaultModel;

  // Admin-configured ceiling on generated tokens, falling back to the env floor.
  // A feature may request fewer tokens, never more than the ceiling.
  const ceiling =
    config.defaultMaxOutputTokens ||
    parseInt(process.env.AI_MAX_OUTPUT_TOKENS || '4096', 10);
  const resolvedMaxTokens = maxTokens ? Math.min(maxTokens, ceiling) : ceiling;

  // 1. Gate. If blocked, record a blocked row (no cost) and throw the typed error.
  if (!decision.allowed) {
    await safeRecord({
      companyId, applicationId, userId, feature, purpose,
      provider: resolvedProvider, model: resolvedModel,
      usage: emptyUsage(), cost: computeCost(emptyUsage(), null),
      status: 'blocked', errorMessage: `${decision.reason || 'denied'}`,
    });
    // assertAiAllowed re-resolves and throws AiAccessError with a friendly message.
    await assertAiAllowed({ companyId, userId, feature });
  }

  // 2. Call the model.
  let result;
  try {
    result = await callModel({
      provider: resolvedProvider, model: resolvedModel, system, messages, maxTokens: resolvedMaxTokens, tools, toolChoice,
    });
  } catch (err) {
    await safeRecord({
      companyId, applicationId, userId, feature, purpose,
      provider: resolvedProvider, model: resolvedModel,
      usage: emptyUsage(), cost: computeCost(emptyUsage(), null),
      status: 'error', errorMessage: err?.message || 'model error',
    });
    throw err;
  }

  // 3. Snapshot pricing + compute cost, then record the success row.
  const pricing = await getActivePricing(resolvedProvider, result.model || resolvedModel);
  const cost = computeCost(result.usage, pricing);
  const row = await safeRecord({
    companyId, applicationId, userId, feature, purpose,
    provider: resolvedProvider, model: result.model || resolvedModel,
    usage: result.usage, cost,
    status: 'success', latencyMs: result.latencyMs,
  });

  return {
    text: result.text,
    toolUse: result.toolUse,
    usage: result.usage,
    cost,
    model: result.model || resolvedModel,
    aiRequestId: row?.id || null,
  };
}

function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}

/**
 * Persist one AiRequest. Ledger writes must never mask the real outcome of a
 * call, so a failure here is logged and swallowed rather than thrown.
 */
async function safeRecord({
  companyId, applicationId, userId, feature, purpose,
  provider, model, usage, cost, status, errorMessage = null, latencyMs = null,
}) {
  try {
    return await prisma.aiRequest.create({
      data: {
        companyId, applicationId, userId, feature, purpose,
        provider, model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        pricingId: cost.pricingId,
        inputPricePerMTok: cost.inputPricePerMTok,
        outputPricePerMTok: cost.outputPricePerMTok,
        cacheReadPricePerMTok: cost.cacheReadPricePerMTok,
        cacheWritePricePerMTok: cost.cacheWritePricePerMTok,
        inputCost: cost.inputCost,
        outputCost: cost.outputCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        status,
        errorMessage,
        latencyMs,
      },
    });
  } catch (err) {
    console.error('Failed to record AiRequest ledger row:', err.message);
    return null;
  }
}
