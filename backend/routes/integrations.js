import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  encryptIntegrationPayload,
  maskAccessKeyHint,
  getIntegrationsKey,
} from '../utils/integrationCrypto.js';
import {
  assertSupportedProvider,
  PROVIDER_TENABLE_IO,
  PROVIDER_WIZ,
  SUPPORTED_PROVIDERS,
} from '../integrations/constants.js';
import {
  resolveIntegrationForCompany,
  validateTenableIoFilter,
  normalizeTenableIoFilter,
  validateWizFilter,
  normalizeWizFilter,
} from '../integrations/resolve.js';
import { listTenableIoTagValues } from '../integrations/tenableIo.js';
import { listWizFolders, normalizeWizGraphqlUrl } from '../integrations/wiz.js';
import { integrationLog } from '../integrations/log.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

function canAccessCompany(req, companyId) {
  const auth = getAuthContext(req);
  return auth?.isAdmin || auth?.companyId === companyId;
}

/**
 * List tags / save link: same people who can open the company (admin or member of that company),
 * for both catalog-wide and company-scoped credentials.
 */
function canListOrSaveTags(req, companyId, resolved) {
  if (!resolved) {
    return false;
  }
  return canAccessCompany(req, companyId);
}

function canManageCredential(req, scope, companyId) {
  const auth = getAuthContext(req);
  if (scope === 'ENTERPRISE') {
    return !!auth?.isAdmin;
  }
  if (!companyId) {
    return false;
  }
  return auth?.isAdmin || auth?.companyId === companyId;
}

/**
 * PUT /api/integrations/credentials/:provider
 * body: { scope, companyId?, accessKey, secretKey, baseUrl? }
 * Wiz: accessKey/secretKey → client ID/secret; baseUrl = required tenant GraphQL endpoint.
 */
router.put('/integrations/credentials/:provider', requireAuth, async (req, res) => {
  try {
    getIntegrationsKey();
  } catch (e) {
    return res.status(503).json({
      error: 'Integration encryption not configured',
      message: e.message,
    });
  }

  try {
    const { provider } = req.params;
    assertSupportedProvider(provider);

    const { scope, companyId, accessKey, secretKey, baseUrl } = req.body;

    if (scope !== 'ENTERPRISE' && scope !== 'COMPANY') {
      return res.status(400).json({ error: 'scope must be ENTERPRISE or COMPANY' });
    }
    if (scope === 'COMPANY' && !companyId) {
      return res.status(400).json({ error: 'companyId is required for COMPANY scope' });
    }
    if (scope === 'ENTERPRISE' && companyId) {
      return res.status(400).json({ error: 'companyId must not be set for ENTERPRISE scope' });
    }

    if (!canManageCredential(req, scope, companyId)) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot manage this integration credential',
      });
    }

    if (!accessKey || !secretKey || typeof accessKey !== 'string' || typeof secretKey !== 'string') {
      return res.status(400).json({ error: 'accessKey and secretKey are required' });
    }

    let payloadObj;
    let hint;
    let baseUrlStored = null;

    if (provider === PROVIDER_WIZ) {
      const graphqlUrl =
        baseUrl && typeof baseUrl === 'string' && baseUrl.trim() ? baseUrl.trim() : '';
      if (!graphqlUrl) {
        return res.status(400).json({
          error:
            'GraphQL endpoint is required for Wiz (store your tenant API URL, e.g. https://api.<tenant>.app.wiz.io/graphql)',
        });
      }
      try {
        baseUrlStored = normalizeWizGraphqlUrl(graphqlUrl);
      } catch (e) {
        return res.status(400).json({ error: e.message || 'Invalid GraphQL URL' });
      }
      payloadObj = {
        clientId: accessKey.trim(),
        clientSecret: secretKey.trim(),
      };
      hint = maskAccessKeyHint(accessKey.trim());
    } else {
      payloadObj = { accessKey: accessKey.trim(), secretKey: secretKey.trim() };
      hint = maskAccessKeyHint(accessKey.trim());
      baseUrlStored = baseUrl && typeof baseUrl === 'string' ? baseUrl.trim() : null;
    }

    const encryptedPayload = encryptIntegrationPayload(JSON.stringify(payloadObj));

    const data = {
      provider,
      scope,
      companyId: scope === 'COMPANY' ? companyId : null,
      encryptedPayload,
      accessKeyHint: hint,
      baseUrl: baseUrlStored,
      updatedByUserId: getAuthContext(req)?.userId ?? null,
    };

    if (scope === 'ENTERPRISE') {
      const existing = await prisma.integrationCredential.findFirst({
        where: { provider, scope: 'ENTERPRISE', companyId: null },
      });
      if (existing) {
        const updated = await prisma.integrationCredential.update({
          where: { id: existing.id },
          data,
        });
        return res.json({
          ok: true,
          id: updated.id,
          scope: updated.scope,
          provider: updated.provider,
          accessKeyHint: updated.accessKeyHint,
          baseUrl: updated.baseUrl,
        });
      }
      const created = await prisma.integrationCredential.create({ data });
      return res.status(201).json({
        ok: true,
        id: created.id,
        scope: created.scope,
        provider: created.provider,
        accessKeyHint: created.accessKeyHint,
        baseUrl: created.baseUrl,
      });
    }

    const existing = await prisma.integrationCredential.findFirst({
      where: { provider, scope: 'COMPANY', companyId },
    });
    if (existing) {
      const updated = await prisma.integrationCredential.update({
        where: { id: existing.id },
        data,
      });
      return res.json({
        ok: true,
        id: updated.id,
        scope: updated.scope,
        provider: updated.provider,
        companyId: updated.companyId,
        accessKeyHint: updated.accessKeyHint,
        baseUrl: updated.baseUrl,
      });
    }
    const created = await prisma.integrationCredential.create({ data });
    return res.status(201).json({
      ok: true,
      id: created.id,
      scope: created.scope,
      provider: created.provider,
      companyId: created.companyId,
      accessKeyHint: created.accessKeyHint,
      baseUrl: created.baseUrl,
    });
  } catch (error) {
    console.error('Integration credential save error:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save integration credential' });
  }
});

/**
 * GET /api/integrations/credentials/:provider?scope=&companyId=
 */
router.get('/integrations/credentials/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    assertSupportedProvider(provider);
    const { scope, companyId } = req.query;

    if (scope !== 'ENTERPRISE' && scope !== 'COMPANY') {
      return res.status(400).json({ error: 'Query scope must be ENTERPRISE or COMPANY' });
    }
    if (scope === 'COMPANY' && !companyId) {
      return res.status(400).json({ error: 'companyId query is required for COMPANY scope' });
    }

    if (!canManageCredential(req, scope, companyId || null)) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot view this integration credential',
      });
    }

    const row =
      scope === 'ENTERPRISE'
        ? await prisma.integrationCredential.findFirst({
            where: { provider, scope: 'ENTERPRISE', companyId: null },
          })
        : await prisma.integrationCredential.findFirst({
            where: { provider, scope: 'COMPANY', companyId },
          });

    if (!row) {
      return res.json({
        configured: false,
        provider,
        scope,
        companyId: scope === 'COMPANY' ? companyId : null,
      });
    }

    return res.json({
      configured: true,
      provider: row.provider,
      scope: row.scope,
      companyId: row.companyId,
      accessKeyHint: row.accessKeyHint,
      baseUrl: row.baseUrl,
      updatedAt: row.updatedAt,
    });
  } catch (error) {
    console.error('Integration credential get error:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to load integration credential' });
  }
});

/**
 * DELETE /api/integrations/credentials/:provider?scope=&companyId=
 */
router.delete('/integrations/credentials/:provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.params;
    assertSupportedProvider(provider);
    const { scope, companyId } = req.query;

    if (scope !== 'ENTERPRISE' && scope !== 'COMPANY') {
      return res.status(400).json({ error: 'Query scope must be ENTERPRISE or COMPANY' });
    }
    if (scope === 'COMPANY' && !companyId) {
      return res.status(400).json({ error: 'companyId query is required for COMPANY scope' });
    }

    if (!canManageCredential(req, scope, companyId || null)) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot delete this integration credential',
      });
    }

    const row =
      scope === 'ENTERPRISE'
        ? await prisma.integrationCredential.findFirst({
            where: { provider, scope: 'ENTERPRISE', companyId: null },
          })
        : await prisma.integrationCredential.findFirst({
            where: { provider, scope: 'COMPANY', companyId },
          });

    if (!row) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    await prisma.integrationCredential.delete({ where: { id: row.id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Integration credential delete error:', error);
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to delete integration credential' });
  }
});

/**
 * GET /api/companies/:companyId/integrations/:provider/tags
 */
router.get(
  '/companies/:companyId/integrations/:provider/tags',
  requireAuth,
  async (req, res) => {
    try {
      getIntegrationsKey();
    } catch (e) {
      return res.status(503).json({
        error: 'Integration encryption not configured',
        message: e.message,
      });
    }

    try {
      const { companyId, provider } = req.params;
      assertSupportedProvider(provider);

      if (!canAccessCompany(req, companyId)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You cannot access this company',
        });
      }

      const resolved = await resolveIntegrationForCompany(companyId, provider);
      if (!resolved) {
        return res.status(400).json({
          error: 'No integration configured',
          message: 'Save API credentials for this provider first (enterprise or company scope).',
        });
      }

      if (!canListOrSaveTags(req, companyId, resolved)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You cannot list tags for this company',
        });
      }

      if (provider === PROVIDER_TENABLE_IO) {
        const tags = await listTenableIoTagValues(resolved.decrypted, resolved.baseUrl);
        integrationLog('info', {
          layer: 'api',
          op: 'GET_integration_tags',
          provider,
          companyId,
          credentialScope: resolved.scope,
          itemCount: tags.length,
        });
        return res.json({ tags });
      }

      if (provider === PROVIDER_WIZ) {
        const folders = await listWizFolders(resolved.decrypted, resolved.baseUrl);
        const tags = folders.map((f) => ({
          uuid: f.id,
          value: f.name,
          display_label: f.name,
          category_uuid: null,
        }));
        integrationLog('info', {
          layer: 'api',
          op: 'GET_integration_tags',
          provider,
          companyId,
          credentialScope: resolved.scope,
          itemCount: tags.length,
        });
        return res.json({ tags });
      }

      return res.status(400).json({ error: 'Provider not implemented' });
    } catch (error) {
      integrationLog('error', {
        layer: 'api',
        op: 'GET_integration_tags',
        provider: req.params.provider,
        companyId: req.params.companyId,
        error: error.message || String(error),
        httpStatus: error.statusCode,
      });
      console.error('List integration tags error:', error);
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }
      if (error.statusCode === 403) {
        return res.status(403).json({
          error: 'Vendor API denied',
          message: error.message,
        });
      }
      if (error.statusCode === 502) {
        return res.status(502).json({
          error: 'Vendor API error',
          message: error.message,
        });
      }
      res.status(500).json({ error: 'Failed to list tags' });
    }
  },
);

/**
 * PUT /api/companies/:companyId/integrations/:provider/link
 * body: TENABLE_IO → { tagUuid, tagName?, categoryUuid? } · WIZ → { folderId, folderName? }
 */
router.put(
  '/companies/:companyId/integrations/:provider/link',
  requireAuth,
  async (req, res) => {
    try {
      const { companyId, provider } = req.params;
      assertSupportedProvider(provider);

      if (!canAccessCompany(req, companyId)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You cannot access this company',
        });
      }

      const resolved = await resolveIntegrationForCompany(companyId, provider);
      if (!resolved) {
        return res.status(400).json({
          error: 'No integration configured',
          message: 'Configure API credentials before setting a link.',
        });
      }

      if (!canListOrSaveTags(req, companyId, resolved)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You cannot set an integration link for this company',
        });
      }

      let filter;
      if (provider === PROVIDER_TENABLE_IO) {
        const normalized = normalizeTenableIoFilter(req.body);
        const v = validateTenableIoFilter(normalized);
        if (!v.ok) {
          return res.status(400).json({ error: v.message });
        }
        filter = normalized;
      } else if (provider === PROVIDER_WIZ) {
        const normalized = normalizeWizFilter(req.body);
        const v = validateWizFilter(normalized);
        if (!v.ok) {
          return res.status(400).json({ error: v.message });
        }
        filter = normalized;
      } else {
        return res.status(400).json({ error: 'Provider not implemented' });
      }

      const link = await prisma.companyToolLink.upsert({
        where: {
          companyId_provider: { companyId, provider },
        },
        create: {
          companyId,
          provider,
          filter,
        },
        update: { filter },
      });

      res.json({
        ok: true,
        link: {
          id: link.id,
          provider: link.provider,
          filter: link.filter,
          updatedAt: link.updatedAt,
        },
      });
    } catch (error) {
      console.error('Save integration link error:', error);
      if (error.statusCode === 400) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to save integration link' });
    }
  },
);

/**
 * GET /api/integrations/providers - supported provider ids for UI
 */
router.get('/integrations/providers', requireAuth, async (req, res) => {
  res.json({ providers: SUPPORTED_PROVIDERS });
});

/**
 * GET /api/integrations/admin/company-overview - admin: all companies with company-scoped API credentials
 */
router.get(
  '/integrations/admin/company-overview',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const rows = await prisma.integrationCredential.findMany({
        where: { scope: 'COMPANY', companyId: { not: null } },
        select: {
          provider: true,
          accessKeyHint: true,
          companyId: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ company: { name: 'asc' } }, { provider: 'asc' }],
      });

      const byCompany = new Map();
      for (const r of rows) {
        if (!r.company) continue;
        const id = r.companyId;
        if (!byCompany.has(id)) {
          byCompany.set(id, {
            companyId: id,
            companyName: r.company.name,
            integrations: [],
          });
        }
        byCompany.get(id).integrations.push({
          provider: r.provider,
          accessKeyHint: r.accessKeyHint,
        });
      }

      res.json({ companies: [...byCompany.values()] });
    } catch (error) {
      console.error('Company integration overview error:', error);
      res.status(500).json({ error: 'Failed to load company integrations overview' });
    }
  },
);

export default router;
