import { SUPPORTED_PROVIDERS } from './constants.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} companyId
 * @param {boolean} isAdminSession
 */
export async function buildIntegrationSummaryForCompanyId(prisma, companyId, isAdminSession) {
  const credRows = await prisma.integrationCredential.findMany({
    where: {
      provider: { in: [...SUPPORTED_PROVIDERS] },
      OR: [
        { scope: 'ENTERPRISE', companyId: null },
        { scope: 'COMPANY', companyId },
      ],
    },
    select: {
      provider: true,
      scope: true,
      accessKeyHint: true,
      baseUrl: true,
    },
  });

  const integrationSummary = {};
  for (const provider of SUPPORTED_PROVIDERS) {
    const entRow = credRows.find((c) => c.provider === provider && c.scope === 'ENTERPRISE');
    const coRow = credRows.find((c) => c.provider === provider && c.scope === 'COMPANY');
    integrationSummary[provider] = {
      enterprise: {
        configured: !!entRow,
        ...(isAdminSession && entRow
          ? { accessKeyHint: entRow.accessKeyHint, baseUrl: entRow.baseUrl }
          : {}),
      },
      company: {
        configured: !!coRow,
        ...(coRow
          ? { accessKeyHint: coRow.accessKeyHint, baseUrl: coRow.baseUrl }
          : {}),
      },
    };
  }
  return integrationSummary;
}
