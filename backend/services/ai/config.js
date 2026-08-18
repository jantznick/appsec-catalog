/**
 * Global AI configuration (singleton row). Holds the master kill-switch, the
 * default provider/model, and an org-wide default monthly budget per company.
 */
import { prisma } from '../../prisma/client.js';
import { decToNum } from './money.js';

const SINGLETON_ID = 'singleton';

const DEFAULTS = {
  id: SINGLETON_ID,
  globalEnabled: false,
  defaultProvider: 'anthropic',
  defaultModel: process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-5',
  defaultMaxOutputTokens: null,
  defaultMonthlyCostLimitUsd: null,
};

/** Read the singleton config, falling back to defaults if the row is absent. */
export async function getAiConfig() {
  const row = await prisma.aiConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return { ...DEFAULTS };
  return {
    id: row.id,
    globalEnabled: row.globalEnabled,
    defaultProvider: row.defaultProvider,
    defaultModel: row.defaultModel,
    defaultMaxOutputTokens: row.defaultMaxOutputTokens ?? null,
    defaultMonthlyCostLimitUsd: decToNum(row.defaultMonthlyCostLimitUsd),
    updatedAt: row.updatedAt,
    updatedById: row.updatedById,
  };
}

/** Upsert the singleton config. Only provided fields are changed. */
export async function updateAiConfig(patch = {}, updatedById = null) {
  const data = {};
  if (patch.globalEnabled !== undefined) data.globalEnabled = Boolean(patch.globalEnabled);
  if (patch.defaultProvider !== undefined) data.defaultProvider = String(patch.defaultProvider);
  if (patch.defaultModel !== undefined) data.defaultModel = String(patch.defaultModel);
  if (patch.defaultMaxOutputTokens !== undefined) {
    if (patch.defaultMaxOutputTokens === null || patch.defaultMaxOutputTokens === '') {
      data.defaultMaxOutputTokens = null;
    } else {
      const n = parseInt(patch.defaultMaxOutputTokens, 10);
      data.defaultMaxOutputTokens = Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  if (patch.defaultMonthlyCostLimitUsd !== undefined) {
    data.defaultMonthlyCostLimitUsd =
      patch.defaultMonthlyCostLimitUsd === null || patch.defaultMonthlyCostLimitUsd === ''
        ? null
        : Number(patch.defaultMonthlyCostLimitUsd);
  }
  data.updatedById = updatedById;

  await prisma.aiConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...DEFAULTS, ...data },
    update: data,
  });
  return getAiConfig();
}
