import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { assertPermission } from '../middleware/rbac.js';
import { TRACKED_FIELDS } from '../utils/changeHistory.js';

const router = express.Router();

/**
 * Which company owns the entity an audit trail is being requested for.
 * ChangeHistory.companyId is denormalized onto the row, but a caller could ask
 * for an entity that has no history yet, so the owning company is resolved from
 * the entity itself rather than from the trail.
 */
const COMPANY_LOOKUP = {
  Application: (id) => prisma.application.findUnique({ where: { id }, select: { companyId: true } }),
  Product: (id) => prisma.product.findUnique({ where: { id }, select: { companyId: true } }),
  Domain: (id) => prisma.domain.findUnique({ where: { id }, select: { companyId: true } }),
  Note: (id) => prisma.note.findUnique({ where: { id }, select: { companyId: true } }),
  SammAssessment: (id) => prisma.sammAssessment.findUnique({ where: { id }, select: { companyId: true } }),
  Company: async (id) => ({ companyId: id }),
  // Policies and policy controls are authored across companies, so they have no
  // owning company; their trail stays system-admin only (see below).
  Policy: async () => null,
  PolicyControl: async () => null,
};

/**
 * Read the audit trail for one entity.
 * GET /api/change-history/:entityType/:entityId
 *
 * Company-scoped entities need `company.read_audit` on the owning company,
 * which only Company Admin holds - the trail exposes every past value of every
 * tracked field, so it is deliberately narrower than `company.read`. Entities
 * with no owning company (Policy, PolicyControl) remain system-admin only.
 */
router.get('/:entityType/:entityId', requireAuth, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!TRACKED_FIELDS[entityType]) {
      return res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    }

    const owner = await COMPANY_LOOKUP[entityType]?.(entityId);
    // A null owner means "not company-scoped": assertPermission is called with
    // no companyId, which only a system admin satisfies.
    if (!(await assertPermission(req, res, 'company.read_audit', owner?.companyId ?? null))) return;

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
