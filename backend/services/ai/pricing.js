/**
 * Effective-dated price book + cost computation.
 *
 * Prices are stored per 1,000,000 tokens. A price change never mutates a row:
 * the current row is closed (effectiveTo = now, active = false) and a new row
 * is inserted. Each AiRequest additionally snapshots the numbers it used, so
 * historical cost is stable regardless of later edits.
 */
import { prisma } from '../../prisma/client.js';
import { decToNum, round } from './money.js';

/** The currently-active price row for a provider/model, or null. */
export async function getActivePricing(provider, model) {
  return prisma.aiModelPricing.findFirst({
    where: { provider, model, active: true, effectiveTo: null },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/** All price rows (history included), newest first. */
export async function listPricing({ activeOnly = false } = {}) {
  const rows = await prisma.aiModelPricing.findMany({
    where: activeOnly ? { active: true, effectiveTo: null } : undefined,
    orderBy: [{ provider: 'asc' }, { model: 'asc' }, { effectiveFrom: 'desc' }],
  });
  return rows.map(serializePricing);
}

export function serializePricing(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    inputPricePerMTok: decToNum(row.inputPricePerMTok),
    outputPricePerMTok: decToNum(row.outputPricePerMTok),
    cacheReadPricePerMTok: decToNum(row.cacheReadPricePerMTok),
    cacheWritePricePerMTok: decToNum(row.cacheWritePricePerMTok),
    currency: row.currency,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdById: row.createdById,
  };
}

/**
 * Set the current price for a provider/model. Closes any existing active row
 * and inserts a fresh one, so the change is auditable and past requests keep
 * their snapshotted prices. Returns the new active row (serialized).
 */
export async function setPricing(input, createdById = null) {
  const provider = String(input.provider || '').trim();
  const model = String(input.model || '').trim();
  if (!provider || !model) {
    const err = new Error('provider and model are required');
    err.status = 400;
    throw err;
  }
  const num = (v, req = false) => {
    if (v === null || v === undefined || v === '') {
      if (req) {
        const err = new Error('Missing required price field');
        err.status = 400;
        throw err;
      }
      return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      const err = new Error('Price values must be non-negative numbers');
      err.status = 400;
      throw err;
    }
    return n;
  };

  const data = {
    provider,
    model,
    inputPricePerMTok: num(input.inputPricePerMTok, true),
    outputPricePerMTok: num(input.outputPricePerMTok, true),
    cacheReadPricePerMTok: num(input.cacheReadPricePerMTok),
    cacheWritePricePerMTok: num(input.cacheWritePricePerMTok),
    currency: String(input.currency || 'USD'),
    createdById,
  };

  return prisma.$transaction(async (tx) => {
    await tx.aiModelPricing.updateMany({
      where: { provider, model, active: true, effectiveTo: null },
      data: { active: false, effectiveTo: new Date() },
    });
    const row = await tx.aiModelPricing.create({ data });
    return serializePricing(row);
  });
}

/**
 * Compute cost from token usage and a price row. Anthropic's `input_tokens`
 * excludes cache read/creation tokens, so the three input buckets are priced
 * separately. Returns both the per-bucket costs and the price snapshot to
 * persist onto the AiRequest.
 */
export function computeCost(usage, pricing) {
  const u = {
    inputTokens: usage?.inputTokens || 0,
    outputTokens: usage?.outputTokens || 0,
    cacheReadTokens: usage?.cacheReadTokens || 0,
    cacheWriteTokens: usage?.cacheWriteTokens || 0,
  };

  if (!pricing) {
    // No price on file: record usage but leave cost null (unknown, not zero).
    return {
      pricingId: null,
      inputPricePerMTok: null,
      outputPricePerMTok: null,
      cacheReadPricePerMTok: null,
      cacheWritePricePerMTok: null,
      inputCost: null,
      outputCost: null,
      totalCost: null,
      currency: 'USD',
    };
  }

  const inPrice = decToNum(pricing.inputPricePerMTok) || 0;
  const outPrice = decToNum(pricing.outputPricePerMTok) || 0;
  // Fall back to the plain input price if a cache-specific price is not set.
  const cacheReadPrice =
    decToNum(pricing.cacheReadPricePerMTok) ?? inPrice;
  const cacheWritePrice =
    decToNum(pricing.cacheWritePricePerMTok) ?? inPrice;

  const perMillion = (tokens, price) => (tokens / 1_000_000) * price;

  const inputCost =
    perMillion(u.inputTokens, inPrice) +
    perMillion(u.cacheReadTokens, cacheReadPrice) +
    perMillion(u.cacheWriteTokens, cacheWritePrice);
  const outputCost = perMillion(u.outputTokens, outPrice);

  return {
    pricingId: pricing.id,
    inputPricePerMTok: inPrice,
    outputPricePerMTok: outPrice,
    cacheReadPricePerMTok: decToNum(pricing.cacheReadPricePerMTok),
    cacheWritePricePerMTok: decToNum(pricing.cacheWritePricePerMTok),
    inputCost: round(inputCost, 8),
    outputCost: round(outputCost, 8),
    totalCost: round(inputCost + outputCost, 8),
    currency: pricing.currency || 'USD',
  };
}
