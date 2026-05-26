import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client.js';

function parseApiKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.trim();
  // Expected: asc_<tokenId>.<hexsecret>
  const m = /^asc_([a-z0-9]+)\.([0-9a-f]{32,256})$/i.exec(v);
  if (!m) return null;
  return { tokenId: m[1], secret: m[2] };
}

/**
 * If an `api-key` header is present and valid, populates `req.auth`.
 * Does not create or mutate cookie sessions.
 */
export async function apiKeyAuth(req, _res, next) {
  try {
    const raw = req.headers?.['api-key'];
    if (!raw) return next();

    const parsed = parseApiKey(raw);
    if (!parsed) return next();

    const tokenRow = await prisma.apiToken.findFirst({
      where: { id: parsed.tokenId, revokedAt: null },
      select: { id: true, userId: true, secretHash: true },
    });
    if (!tokenRow) return next();

    const ok = await bcrypt.compare(parsed.secret, tokenRow.secretHash);
    if (!ok) return next();

    const user = await prisma.user.findUnique({
      where: { id: tokenRow.userId },
      select: {
        id: true,
        email: true,
        companyId: true,
        isAdmin: true,
        verifiedAccount: true,
      },
    });
    if (!user || !user.verifiedAccount) return next();

    req.auth = {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      isAdmin: user.isAdmin,
      verified: user.verifiedAccount,
      authType: 'apiKey',
    };

    await prisma.apiToken.update({
      where: { id: tokenRow.id },
      data: { lastUsedAt: new Date() },
    });

    return next();
  } catch (e) {
    // Fail-closed to session auth if api-key auth errors
    console.error('apiKeyAuth error', e);
    return next();
  }
}

