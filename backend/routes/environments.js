import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { can } from '../middleware/rbac.js';
import { getAuthContext } from '../middleware/authContext.js';
import { applyCompanyScope } from '../utils/scope.js';
import {
  ENVIRONMENT_KINDS,
  inferEnvironmentKind,
  isValidEnvironmentKind,
  normalizeEnvironmentName,
} from '../services/environmentNaming.js';

/**
 * A company's deployment environment vocabulary.
 *
 * These rows are what a CI push's `environment` string is matched against, so the
 * names here are load-bearing rather than cosmetic: a name no pipeline sends will
 * never receive a deployment, and deployments naming something absent from this list
 * are recorded unassigned. See services/environmentResolver.js.
 */

const router = express.Router();

const STATUSES = new Set(['active', 'retired']);

/**
 * Resolve the company an environment belongs to, for permission checks.
 * @param {string} id
 */
async function findEnvironmentWithCompany(id) {
  return prisma.environment.findUnique({
    where: { id },
    select: { id: true, companyId: true, name: true, status: true },
  });
}

/** Shape a Prisma unique-constraint failure into a usable 409. */
function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

// The kinds a client may choose from, so the UI does not hard-code its own copy.
router.get('/kinds', requireAuth, (req, res) => {
  res.json({ kinds: ENVIRONMENT_KINDS });
});

// List environments. Non-admins see their own company's; admins can scope by
// company or division through the usual scope selector params.
router.get('/', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const whereClause = {};

    if (!auth.isAdmin) {
      if (!auth.companyId) {
        return res.json([]);
      }
      whereClause.companyId = auth.companyId;
    } else {
      applyCompanyScope(whereClause, auth, req.query);
    }

    if (req.query.status && STATUSES.has(req.query.status)) {
      whereClause.status = req.query.status;
    }

    const environments = await prisma.environment.findMany({
      where: whereClause,
      orderBy: [{ companyId: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { applications: true, deployments: true } },
      },
    });

    res.json(environments);
  } catch (error) {
    console.error('Error listing environments:', error);
    res.status(500).json({ error: 'Failed to list environments' });
  }
});

// Create an environment for a company.
router.post('/', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const { name, kind, description, displayOrder } = req.body || {};

    const companyId = auth.isAdmin ? req.body?.companyId || auth.companyId : auth.companyId;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }

    if (!(await can(req, 'environment.manage', companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot manage environments for this company',
      });
    }

    const normalizedName = normalizeEnvironmentName(name);
    if (!normalizedName) {
      return res.status(400).json({ error: 'Environment name is required' });
    }

    // An explicit kind wins; otherwise infer from the name, which gets the common
    // cases right and falls back to OTHER rather than guessing PRODUCTION.
    const resolvedKind = kind ? kind : inferEnvironmentKind(normalizedName);
    if (!isValidEnvironmentKind(resolvedKind)) {
      return res.status(400).json({
        error: 'Invalid kind',
        message: `kind must be one of: ${ENVIRONMENT_KINDS.join(', ')}`,
      });
    }

    const environment = await prisma.environment.create({
      data: {
        companyId,
        name: normalizedName,
        kind: resolvedKind,
        description: typeof description === 'string' ? description.trim() || null : null,
        displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
        // Names are stored normalized, so keep what the caller actually typed when it
        // differed - the same reason the migration records a sourceLabel.
        sourceLabel: typeof name === 'string' && name.trim() !== normalizedName ? name.trim() : null,
      },
    });

    res.status(201).json(environment);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({
        error: 'Environment already exists',
        message: 'This company already has an environment with that name.',
      });
    }
    console.error('Error creating environment:', error);
    res.status(500).json({ error: 'Failed to create environment' });
  }
});

// Update an environment: rename, re-kind, describe, reorder, or retire.
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await findEnvironmentWithCompany(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    if (!(await can(req, 'environment.manage', existing.companyId))) {
      return res.status(403).json({
        error: 'Permission denied',
        message: 'You cannot manage environments for this company',
      });
    }

    const { name, kind, description, status, displayOrder } = req.body || {};
    const data = {};

    if (name !== undefined) {
      const normalizedName = normalizeEnvironmentName(name);
      if (!normalizedName) {
        return res.status(400).json({ error: 'Environment name cannot be empty' });
      }
      data.name = normalizedName;
    }

    if (kind !== undefined) {
      if (!isValidEnvironmentKind(kind)) {
        return res.status(400).json({
          error: 'Invalid kind',
          message: `kind must be one of: ${ENVIRONMENT_KINDS.join(', ')}`,
        });
      }
      data.kind = kind;
    }

    if (status !== undefined) {
      if (!STATUSES.has(status)) {
        return res.status(400).json({ error: 'status must be active or retired' });
      }
      data.status = status;
    }

    if (description !== undefined) {
      data.description = typeof description === 'string' ? description.trim() || null : null;
    }

    if (displayOrder !== undefined) {
      if (!Number.isInteger(displayOrder)) {
        return res.status(400).json({ error: 'displayOrder must be an integer' });
      }
      data.displayOrder = displayOrder;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No changes supplied' });
    }

    const environment = await prisma.environment.update({
      where: { id: existing.id },
      data,
    });

    // Past deployments keep their environmentId, so a rename never orphans history.
    // Future CI pushes are a different matter: a pipeline still sending the old name
    // will stop matching and its deployments will arrive unassigned. Report how many
    // deployments used the old name so the UI can warn before anyone renames a busy
    // environment.
    const renamedFrom = data.name && data.name !== existing.name ? existing.name : null;
    const affectedDeployments = renamedFrom
      ? await prisma.deployment.count({
        where: { environmentId: existing.id },
      })
      : 0;

    res.json({
      ...environment,
      renamedFrom,
      affectedDeployments,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({
        error: 'Environment already exists',
        message: 'This company already has an environment with that name.',
      });
    }
    console.error('Error updating environment:', error);
    res.status(500).json({ error: 'Failed to update environment' });
  }
});

// Hard delete. Admin-only on purpose: an environment with instances or deployments
// carries history, and `environment.manage` holders retire instead (PUT status).
// The schema's onDelete: Restrict on ApplicationEnvironment.environmentId means the
// database refuses this while instances exist; the explicit check below turns that
// into a usable message rather than a 500.
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await prisma.environment.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        _count: { select: { applications: true, deployments: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Environment not found' });
    }

    if (existing._count.applications > 0 || existing._count.deployments > 0) {
      return res.status(409).json({
        error: 'Environment is in use',
        message:
          `"${existing.name}" is used by ${existing._count.applications} application instance(s) and ${existing._count.deployments} deployment(s). Retire it instead of deleting it, so its history is kept.`,
      });
    }

    await prisma.environment.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting environment:', error);
    res.status(500).json({ error: 'Failed to delete environment' });
  }
});

export default router;
