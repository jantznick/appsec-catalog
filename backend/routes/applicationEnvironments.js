import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission, companyFrom } from '../middleware/rbac.js';
import { getAuthContext } from '../middleware/authContext.js';
import { recordChange } from '../utils/changeHistory.js';
import { PRIMARY_ENVIRONMENT_KIND } from '../services/environmentNaming.js';

/**
 * An application's environment INSTANCES: "Orbit Backend runs in production".
 *
 * Distinct from routes/environments.js, which manages the company's vocabulary
 * ("what we call our production environment"). This router manages which
 * applications are in which of those, and the facts true of each running copy.
 *
 * WHY THIS EXISTS
 *
 * Until now the only thing in the entire codebase that could create an
 * ApplicationEnvironment was an actual CI deploy, via
 * services/environmentResolver.js. That made the whole feature untestable and
 * unusable by hand: creating a second vocabulary row produced no visible change
 * anywhere, because no application was in it.
 *
 * NO PRIMARY ENDPOINT, DELIBERATELY
 *
 * There is nothing here to mark an instance primary. An application's primary
 * environment is the one whose kind is PRODUCTION, derived at read time - a company
 * holds at most one PRODUCTION row, so it is a lookup rather than a choice. To
 * change which environment is primary you change a KIND, in the vocabulary, which
 * is a company-wide decision and belongs in settings.
 */

const router = express.Router();

const STATUSES = new Set(['active', 'retired']);

const INSTANCE_SELECT = {
  id: true,
  applicationId: true,
  environmentId: true,
  status: true,
  currentVersion: true,
  gitBranch: true,
  createdAt: true,
  updatedAt: true,
  environment: {
    select: { id: true, name: true, kind: true, status: true, displayOrder: true, aliases: true },
  },
  _count: { select: { domains: true, toolLinks: true } },
};

/** Shape an instance for a response, adding the derived primary flag. */
function presentInstance(instance) {
  return {
    ...instance,
    // Derived, never stored. See the header.
    isPrimary: instance.environment?.kind === PRIMARY_ENVIRONMENT_KIND,
  };
}

// List an application's environment instances.
router.get(
  '/:id/environments',
  requireAuth,
  requirePermission('application.read', companyFrom.application('id')),
  async (req, res) => {
    try {
      const instances = await prisma.applicationEnvironment.findMany({
        where: { applicationId: req.params.id },
        select: INSTANCE_SELECT,
        orderBy: [{ environment: { displayOrder: 'asc' } }, { environment: { name: 'asc' } }],
      });
      res.json(instances.map(presentInstance));
    } catch (error) {
      console.error('Error listing application environments:', error);
      res.status(500).json({ error: 'Failed to list environments for this application' });
    }
  },
);

// Put an application into one of its company's environments.
router.post(
  '/:id/environments',
  requireAuth,
  requirePermission('environment.manage', companyFrom.application('id')),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { environmentId, currentVersion, gitBranch } = req.body || {};

      if (!environmentId) {
        return res.status(400).json({ error: 'environmentId is required' });
      }

      const application = await prisma.application.findUnique({
        where: { id },
        select: { id: true, companyId: true },
      });
      if (!application) {
        return res.status(404).json({ error: 'Application not found' });
      }

      // The environment must belong to the application's own company. Without this
      // check an id from another company would link two tenants' data together
      // through a join table that has no company column of its own to catch it.
      const environment = await prisma.environment.findUnique({
        where: { id: environmentId },
        select: { id: true, companyId: true, name: true },
      });
      if (!environment || environment.companyId !== application.companyId) {
        return res.status(400).json({
          error: 'Unknown environment',
          message: 'That environment does not belong to this application\'s company.',
        });
      }

      const existing = await prisma.applicationEnvironment.findUnique({
        where: { applicationId_environmentId: { applicationId: id, environmentId } },
        select: { id: true },
      });
      if (existing) {
        return res.status(409).json({
          error: 'Already in this environment',
          message: `This application is already recorded in "${environment.name}".`,
        });
      }

      const instance = await prisma.applicationEnvironment.create({
        data: {
          applicationId: id,
          environmentId,
          currentVersion: typeof currentVersion === 'string' ? currentVersion.trim() || null : null,
          gitBranch: typeof gitBranch === 'string' ? gitBranch.trim() || null : null,
        },
        select: INSTANCE_SELECT,
      });

      await recordChange({
        entityType: 'ApplicationEnvironment',
        entityId: instance.id,
        action: 'create',
        after: instance,
        userId: getAuthContext(req)?.userId || null,
      });

      res.status(201).json(presentInstance(instance));
    } catch (error) {
      console.error('Error adding application environment:', error);
      res.status(500).json({ error: 'Failed to add this application to the environment' });
    }
  },
);

// Edit one instance: its version, its branch, or whether it is still running.
router.put(
  '/:id/environments/:instanceId',
  requireAuth,
  requirePermission('environment.manage', companyFrom.application('id')),
  async (req, res) => {
    try {
      const { id, instanceId } = req.params;
      const { currentVersion, gitBranch, status } = req.body || {};

      const existing = await prisma.applicationEnvironment.findUnique({
        where: { id: instanceId },
        select: INSTANCE_SELECT,
      });
      if (!existing || existing.applicationId !== id) {
        return res.status(404).json({ error: 'Environment instance not found for this application' });
      }

      const data = {};
      if (currentVersion !== undefined) {
        data.currentVersion = typeof currentVersion === 'string' ? currentVersion.trim() || null : null;
      }
      if (gitBranch !== undefined) {
        data.gitBranch = typeof gitBranch === 'string' ? gitBranch.trim() || null : null;
      }
      if (status !== undefined) {
        if (!STATUSES.has(status)) {
          return res.status(400).json({ error: 'status must be active or retired' });
        }
        data.status = status;
      }

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: 'No changes supplied' });
      }

      const instance = await prisma.applicationEnvironment.update({
        where: { id: instanceId },
        data,
        select: INSTANCE_SELECT,
      });

      await recordChange({
        entityType: 'ApplicationEnvironment',
        entityId: instance.id,
        action: 'update',
        before: existing,
        after: instance,
        userId: getAuthContext(req)?.userId || null,
      });

      res.json(presentInstance(instance));
    } catch (error) {
      console.error('Error updating application environment:', error);
      res.status(500).json({ error: 'Failed to update this environment' });
    }
  },
);

// Remove an application from an environment entirely.
//
// Retiring (PUT status) is the usual answer and keeps the row. Deleting is for a
// mistake - an application attached to the wrong environment - and it drops the
// per-instance version and branch with it.
//
// The domains and tool links that pointed here are NOT deleted. Their FKs are
// SET NULL (see migration 20261001120000); they were CASCADE, which meant this
// endpoint would have silently unlinked a domain from its APPLICATION rather than
// merely from this environment.
router.delete(
  '/:id/environments/:instanceId',
  requireAuth,
  requirePermission('environment.manage', companyFrom.application('id')),
  async (req, res) => {
    try {
      const { id, instanceId } = req.params;

      const existing = await prisma.applicationEnvironment.findUnique({
        where: { id: instanceId },
        select: INSTANCE_SELECT,
      });
      if (!existing || existing.applicationId !== id) {
        return res.status(404).json({ error: 'Environment instance not found for this application' });
      }

      await prisma.applicationEnvironment.delete({ where: { id: instanceId } });

      await recordChange({
        entityType: 'ApplicationEnvironment',
        entityId: instanceId,
        action: 'delete',
        before: existing,
        userId: getAuthContext(req)?.userId || null,
      });

      res.json({
        ok: true,
        // Say what was let go of, so the UI can tell the user rather than leaving
        // them to notice later that a domain lost its environment.
        detachedDomains: existing._count?.domains || 0,
        detachedToolLinks: existing._count?.toolLinks || 0,
      });
    } catch (error) {
      console.error('Error deleting application environment:', error);
      res.status(500).json({ error: 'Failed to remove this environment' });
    }
  },
);

export default router;
