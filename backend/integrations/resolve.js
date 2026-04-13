import { prisma } from '../prisma/client.js';
import { decryptIntegrationPayload } from '../utils/integrationCrypto.js';

/**
 * @param {string} companyId
 * @param {string} provider
 * @returns {Promise<{ scope: 'ENTERPRISE' | 'COMPANY', companyId: string | null, decrypted: Record<string, string>, baseUrl: string | null } | null>}
 */
export async function resolveIntegrationForCompany(companyId, provider) {
  const companyCred = await prisma.integrationCredential.findFirst({
    where: {
      provider,
      scope: 'COMPANY',
      companyId,
    },
  });

  if (companyCred) {
    const decrypted = JSON.parse(decryptIntegrationPayload(companyCred.encryptedPayload));
    return {
      scope: 'COMPANY',
      companyId,
      decrypted,
      baseUrl: companyCred.baseUrl || null,
      credentialId: companyCred.id,
    };
  }

  const ent = await prisma.integrationCredential.findFirst({
    where: {
      provider,
      scope: 'ENTERPRISE',
      companyId: null,
    },
  });

  if (!ent) {
    return null;
  }

  const decrypted = JSON.parse(decryptIntegrationPayload(ent.encryptedPayload));
  return {
    scope: 'ENTERPRISE',
    companyId: null,
    decrypted,
    baseUrl: ent.baseUrl || null,
    credentialId: ent.id,
  };
}

/**
 * Validate filter JSON for Tenable.io link.
 * @param {unknown} filter
 */
export function validateTenableIoFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return { ok: false, message: 'filter must be an object' };
  }
  const tagUuid = /** @type {{ tagUuid?: string }} */ (filter).tagUuid;
  if (!tagUuid || typeof tagUuid !== 'string') {
    return { ok: false, message: 'filter.tagUuid is required' };
  }
  return { ok: true };
}

/**
 * Normalize stored filter for TENABLE_IO (persist display fields).
 * @param {object} body
 */
export function normalizeTenableIoFilter(body) {
  const tagUuid = body.tagUuid;
  const tagName = typeof body.tagName === 'string' ? body.tagName : null;
  const categoryUuid = typeof body.categoryUuid === 'string' ? body.categoryUuid : null;
  return {
    tagUuid,
    tagName,
    categoryUuid,
  };
}

/**
 * Validate Wiz company link (folder binding).
 * @param {unknown} filter
 */
export function validateWizFilter(filter) {
  if (!filter || typeof filter !== 'object') {
    return { ok: false, message: 'filter must be an object' };
  }
  const folderId = /** @type {{ folderId?: string }} */ (filter).folderId;
  if (!folderId || typeof folderId !== 'string') {
    return { ok: false, message: 'filter.folderId is required' };
  }
  return { ok: true };
}

/**
 * @param {object} body
 */
export function normalizeWizFilter(body) {
  const rawId = body.folderId;
  const folderId = typeof rawId === 'string' ? rawId.trim() : rawId;
  const folderName = typeof body.folderName === 'string' ? body.folderName.trim() : null;
  return {
    folderId,
    folderName: folderName || null,
  };
}
