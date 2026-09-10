import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { TRACKED_FIELDS } from '../utils/changeHistory.js';

const router = express.Router();

// Admin-only: list the audit trail for a given entity, matching the precedent
// that other audit-sensitive data (e.g. PolicyControlOverride) is admin-gated.
router.get('/:entityType/:entityId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!TRACKED_FIELDS[entityType]) {
      return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    }

    const entries = await prisma.changeHistory.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching change history:', error);
    res.status(500).json({ error: 'Failed to fetch change history' });
  }
});

export default router;
