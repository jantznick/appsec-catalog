/**
 * AI access gating.
 *
 * Order of checks: global kill-switch -> a company access rule must exist and
 * be enabled -> optional monthly budget (cost/token) caps. Rules are matched
 * most-specific-first so per-user / per-feature overrides win over the broad
 * company rule. `userId` is unused today (always company-wide) but the schema
 * and matching are ready for per-user RBAC later.
 */
import { prisma } from '../../prisma/client.js';
import { getAiConfig } from './config.js';
import { decToNum } from './money.js';
import { AiAccessError } from './errors.js';

/** Start of the current UTC month — the budget accounting window. */
function startOfMonthUtc(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Month-to-date successful-usage totals for a company. */
export async function getMonthToDateUsage(companyId, since = startOfMonthUtc()) {
  if (!companyId) return { costUsd: 0, tokens: 0 };
  const agg = await prisma.aiRequest.aggregate({
    where: { companyId, status: 'success', createdAt: { gte: since } },
    _sum: { totalCost: true, inputTokens: true, outputTokens: true },
  });
  const cost = decToNum(agg._sum.totalCost) || 0;
  const tokens = (agg._sum.inputTokens || 0) + (agg._sum.outputTokens || 0);
  return { costUsd: cost, tokens };
}

/**
 * Find the access rule that applies to (companyId, userId, feature), matching
 * most specific first. Returns the rule row or null.
 */
export async function findApplicableRule({ companyId, userId = null, feature = null }) {
  if (!companyId) return null;
  const rules = await prisma.aiAccessRule.findMany({ where: { companyId } });
  if (rules.length === 0) return null;

  const score = (r) =>
    (r.userId ? 2 : 0) + (r.feature ? 1 : 0); // more specific = higher score

  const candidates = rules
    .filter(
      (r) =>
        (r.userId === null || r.userId === userId) &&
        (r.feature === null || r.feature === feature)
    )
    .sort((a, b) => score(b) - score(a));

  return candidates[0] || null;
}

/**
 * Resolve whether a call is allowed. Never throws; returns a structured
 * decision so callers (and the admin UI) can explain *why*.
 */
export async function resolveAccess({ companyId, userId = null, feature = null }) {
  const config = await getAiConfig();

  if (!config.globalEnabled) {
    return { allowed: false, reason: 'global_disabled', config };
  }

  // Global/admin context with no company attribution: allowed once globally on.
  if (!companyId) {
    return { allowed: true, reason: 'global_context', config };
  }

  const rule = await findApplicableRule({ companyId, userId, feature });
  if (!rule) {
    return { allowed: false, reason: 'no_company_rule', config };
  }
  if (!rule.enabled) {
    return { allowed: false, reason: 'company_disabled', rule, config };
  }

  const limitUsd =
    decToNum(rule.monthlyCostLimitUsd) ?? config.defaultMonthlyCostLimitUsd ?? null;
  const tokenLimit = rule.monthlyTokenLimit ?? null;

  if (limitUsd !== null || tokenLimit !== null) {
    const mtd = await getMonthToDateUsage(companyId);
    if (limitUsd !== null && mtd.costUsd >= limitUsd) {
      return { allowed: false, reason: 'budget_exceeded', rule, config, mtd, limitUsd };
    }
    if (tokenLimit !== null && mtd.tokens >= tokenLimit) {
      return { allowed: false, reason: 'token_limit_exceeded', rule, config, mtd, tokenLimit };
    }
    return { allowed: true, reason: 'ok', rule, config, mtd, limitUsd, tokenLimit };
  }

  return { allowed: true, reason: 'ok', rule, config };
}

const REASON_MESSAGES = {
  global_disabled: 'AI features are currently disabled for this instance.',
  no_company_rule: 'AI is not enabled for this company.',
  company_disabled: 'AI has been disabled for this company.',
  budget_exceeded: 'This company has reached its monthly AI spend limit.',
  token_limit_exceeded: 'This company has reached its monthly AI token limit.',
};

/** Throw AiAccessError if not allowed; otherwise return the decision. */
export async function assertAiAllowed(ctx) {
  const decision = await resolveAccess(ctx);
  if (!decision.allowed) {
    throw new AiAccessError(REASON_MESSAGES[decision.reason] || 'AI access denied', {
      reason: decision.reason,
    });
  }
  return decision;
}

// ---- Admin CRUD for access rules ------------------------------------------

export function serializeAccessRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    feature: row.feature,
    provider: row.provider,
    model: row.model,
    enabled: row.enabled,
    monthlyCostLimitUsd: decToNum(row.monthlyCostLimitUsd),
    monthlyTokenLimit: row.monthlyTokenLimit,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

export async function listAccessRules() {
  const rows = await prisma.aiAccessRule.findMany({
    include: { company: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((r) => ({ ...serializeAccessRule(r), companyName: r.company?.name || null }));
}

/**
 * Create or update the company-wide rule for a company (userId/feature null).
 * Kept as find-then-write rather than upsert because the compound unique key
 * contains nullable columns, which Postgres treats as distinct.
 */
export async function setCompanyAccess(companyId, patch = {}, updatedById = null) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  const data = {};
  if (patch.enabled !== undefined) data.enabled = Boolean(patch.enabled);

  // Provider and model are a pair — set/cleared together to avoid a company
  // pointing at a provider with a model that belongs to a different one.
  if (patch.provider !== undefined || patch.model !== undefined) {
    const provider = patch.provider ? String(patch.provider).trim() : null;
    const model = patch.model ? String(patch.model).trim() : null;
    if ((provider && !model) || (!provider && model)) {
      const err = new Error('Provider and model must be set together (or both cleared)');
      err.status = 400;
      throw err;
    }
    data.provider = provider;
    data.model = model;
  }
  if (patch.monthlyCostLimitUsd !== undefined) {
    data.monthlyCostLimitUsd =
      patch.monthlyCostLimitUsd === null || patch.monthlyCostLimitUsd === ''
        ? null
        : Number(patch.monthlyCostLimitUsd);
  }
  if (patch.monthlyTokenLimit !== undefined) {
    data.monthlyTokenLimit =
      patch.monthlyTokenLimit === null || patch.monthlyTokenLimit === ''
        ? null
        : parseInt(patch.monthlyTokenLimit, 10);
  }
  data.updatedById = updatedById;

  const existing = await prisma.aiAccessRule.findFirst({
    where: { companyId, userId: null, feature: null },
  });
  const row = existing
    ? await prisma.aiAccessRule.update({ where: { id: existing.id }, data })
    : await prisma.aiAccessRule.create({
        data: { companyId, userId: null, feature: null, enabled: true, ...data },
      });
  return serializeAccessRule(row);
}
