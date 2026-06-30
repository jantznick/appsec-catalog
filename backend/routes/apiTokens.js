import crypto from 'crypto';
import express from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireVerified } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';

const router = express.Router();

function generateSecret() {
  return crypto.randomBytes(32).toString('hex');
}

function buildHint(secret) {
  const s = String(secret);
  return s.length <= 8 ? s : s.slice(-8);
}

// List current user's API tokens (metadata only)
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const tokens = await prisma.apiToken.findMany({
      where: { userId: auth.userId },
      select: {
        id: true,
        userId: true,
        name: true,
        secretHint: true,
        companyId: true,
        adminAccessDisabled: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ tokens });
  } catch (error) {
    console.error('Error listing api tokens:', error);
    return res.status(500).json({ error: 'Failed to list API tokens' });
  }
});

// Create an API token (returns token value once)
router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const companyId = typeof req.body?.companyId === 'string' && req.body.companyId.trim()
      ? req.body.companyId.trim()
      : null;
    const adminAccessDisabled = companyId ? true : (auth.isAdmin ? Boolean(req.body?.adminAccessDisabled) : true);

    if (companyId) {
      if (!auth.isAdmin && auth.companyId !== companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only restrict a token to your own company',
        });
      }

      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!company) {
        return res.status(400).json({ error: 'Selected company does not exist' });
      }
    }

    const secret = generateSecret();
    const secretHash = await bcrypt.hash(secret, 10);
    const secretHint = buildHint(secret);

    const tokenRow = await prisma.apiToken.create({
      data: {
        userId: auth.userId,
        name: name || null,
        secretHash,
        secretHint,
        companyId,
        adminAccessDisabled,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        secretHint: true,
        companyId: true,
        adminAccessDisabled: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });

    const token = `asc_${tokenRow.id}.${secret}`;

    return res.status(201).json({
      token,
      apiToken: tokenRow,
      message: 'Token created. Copy it now; it will not be shown again.',
    });
  } catch (error) {
    console.error('Error creating api token:', error);
    return res.status(500).json({ error: 'Failed to create API token' });
  }
});

// Revoke an API token (owner only; admins use /api/admin/api-tokens)
router.delete('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { id } = req.params;

    const existing = await prisma.apiToken.findFirst({
      where: { id, userId: auth.userId },
      select: { id: true, revokedAt: true },
    });
    if (!existing) {
      return res.status(404).json({ error: 'API token not found' });
    }
    if (existing.revokedAt) {
      return res.json({ message: 'API token already revoked' });
    }

    await prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });

    return res.json({ message: 'API token revoked' });
  } catch (error) {
    console.error('Error revoking api token:', error);
    return res.status(500).json({ error: 'Failed to revoke API token' });
  }
});

export default router;
