/**
 * Read-side reporting over the AiRequest ledger: rollups for the admin usage
 * view and the (future) company-facing "your AI usage" view.
 */
import { prisma } from '../../prisma/client.js';
import { decToNum, round } from './money.js';

function parseRange({ from, to } = {}) {
  const where = {};
  if (from) where.gte = new Date(from);
  if (to) where.lte = new Date(to);
  return Object.keys(where).length ? where : undefined;
}

/**
 * Summary totals + grouped breakdowns. Scope with `companyId` for a single
 * company (the company-facing view) or leave null for the whole instance.
 */
export async function getUsageSummary({ companyId = null, from, to, status = 'success' } = {}) {
  const createdAt = parseRange({ from, to });
  const where = {
    ...(companyId ? { companyId } : {}),
    ...(status ? { status } : {}),
    ...(createdAt ? { createdAt } : {}),
  };

  const totalsAgg = await prisma.aiRequest.aggregate({
    where,
    _sum: {
      inputTokens: true, outputTokens: true,
      cacheReadTokens: true, cacheWriteTokens: true, totalCost: true,
    },
    _count: true,
  });

  const totals = {
    requests: totalsAgg._count || 0,
    inputTokens: totalsAgg._sum.inputTokens || 0,
    outputTokens: totalsAgg._sum.outputTokens || 0,
    cacheReadTokens: totalsAgg._sum.cacheReadTokens || 0,
    cacheWriteTokens: totalsAgg._sum.cacheWriteTokens || 0,
    totalCost: round(decToNum(totalsAgg._sum.totalCost) || 0, 6),
  };

  const groupSum = async (by) => {
    const rows = await prisma.aiRequest.groupBy({
      by: [by],
      where,
      _sum: { inputTokens: true, outputTokens: true, totalCost: true },
      _count: true,
    });
    return rows.map((r) => ({
      key: r[by],
      requests: r._count || 0,
      inputTokens: r._sum.inputTokens || 0,
      outputTokens: r._sum.outputTokens || 0,
      totalCost: round(decToNum(r._sum.totalCost) || 0, 6),
    }));
  };

  const [byFeature, byModel, byCompanyRaw] = await Promise.all([
    groupSum('feature'),
    groupSum('model'),
    companyId ? Promise.resolve(null) : groupSum('companyId'),
  ]);

  // Resolve company names for the instance-wide view.
  let byCompany = null;
  if (byCompanyRaw) {
    const ids = byCompanyRaw.map((r) => r.key).filter(Boolean);
    const companies = ids.length
      ? await prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
      : [];
    const nameById = Object.fromEntries(companies.map((c) => [c.id, c.name]));
    byCompany = byCompanyRaw.map((r) => ({
      ...r,
      companyName: r.key ? nameById[r.key] || '(unknown)' : '(no company)',
    }));
  }

  return { totals, byFeature, byModel, byCompany };
}

/** Recent individual ledger rows (for a drill-down table). */
export async function listRecentRequests({ companyId = null, limit = 50 } = {}) {
  const rows = await prisma.aiRequest.findMany({
    where: companyId ? { companyId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200),
    include: {
      company: { select: { name: true } },
      application: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    companyName: r.company?.name || null,
    applicationName: r.application?.name || null,
    feature: r.feature,
    model: r.model,
    status: r.status,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    totalCost: decToNum(r.totalCost),
    currency: r.currency,
    latencyMs: r.latencyMs,
    errorMessage: r.errorMessage,
  }));
}
