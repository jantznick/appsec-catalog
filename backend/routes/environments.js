import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { can } from '../middleware/rbac.js';
import { getAuthContext } from '../middleware/authContext.js';
import { applyCompanyScope } from '../utils/scope.js';
import { recordChange } from '../utils/changeHistory.js';
import {
  ENVIRONMENT_KINDS,
  canonicalEnvironmentName,
  environmentNameRows,
  inferEnvironmentKind,
  isSingleSlotKind,
  isValidEnvironmentKind,
  normalizeEnvironmentName,
} from '../services/environmentNaming.js';

/**
 * A company's deployment environment vocabulary.
 *
 * Orbit owns the taxonomy, companies own the words. These rows map a company's own
 * environment names onto Orbit's five kinds, and they are what a CI push's
 * `environment` string and a Wiz `Environment` tag are both matched against - so the
 * names and aliases here are load-bearing rather than cosmetic. A string that matches
 * nothing is recorded unassigned rather than guessed at. See
 * services/environmentResolver.js.
 *
 * A company holds at most one row of each kind except OTHER, which is what makes
 * "the company's production environment" a lookup rather than a tie-break, and is why
 * ApplicationEnvironment has no isPrimary column.
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
    select: {
      id: true,
      companyId: true,
      name: true,
      kind: true,
      status: true,
      names: { select: { id: true, value: true, isCanonical: true } },
    },
  });
}

/** Shape a Prisma unique-constraint failure into a usable 409. */
function isUniqueViolation(error) {
  return error?.code === 'P2002';
}

/**
 * Turn a unique-violation on EnvironmentName into a message that names the culprit.
 *
 * Uniqueness of every string a company's environments answer to is a real database
 * constraint now - @@unique([companyId, value]) over every canonical name AND every
 * alias, in one table. It used to be a hand-written check over a comma-packed
 * column, which meant any writer that forgot to call it punched straight through.
 * This only decorates the failure; it does not decide it.
 *
 * @param {string} companyId
 * @param {string[]} values the strings we were trying to claim
 * @returns {Promise<string>}
 */
async function describeNameCollision(companyId, values) {
  const clashes = await prisma.environmentName.findMany({
    where: { companyId, value: { in: values } },
    select: { value: true, environment: { select: { name: true, kind: true } } },
  });
  if (!clashes.length) {
    return 'One of those names or aliases is already in use by another environment.';
  }
  return clashes
    .map((c) => `"${c.value}" already belongs to ${c.environment?.name || 'another environment'}`)
    .join('; ');
}

/**
 * Reject a second environment of a single-slot kind.
 *
 * The partial unique index enforces this too, but a raw index violation names
 * neither the kind nor the environment already holding it.
 *
 * @param {{ id?: string, companyId: string, kind: string }} candidate
 * @returns {Promise<string | null>}
 */
async function findKindSlotMessage(candidate) {
  if (!isSingleSlotKind(candidate.kind)) {
    return null;
  }

  const holder = await prisma.environment.findFirst({
    where: {
      companyId: candidate.companyId,
      kind: candidate.kind,
      ...(candidate.id ? { id: { not: candidate.id } } : {}),
    },
    select: { name: true },
  });

  if (!holder) {
    return null;
  }

  return `This company's ${candidate.kind} environment is already "${holder.name}". Every kind except OTHER is single-slot - rename that one, or use OTHER.`;
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
        names: { select: { value: true, isCanonical: true }, orderBy: { isCanonical: 'desc' } },
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
    const { name, kind, description, displayOrder, aliases } = req.body || {};

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

    // An explicit kind wins. The inferred one is only a convenience default for a
    // caller that did not send one - it is a SUGGESTION, never a live resolution
    // rule, and nothing downstream infers a kind from a name again.
    // `name` is accepted for backwards compatibility but is no longer a separate
    // concept: for OTHER the label IS the first string the company's pipelines send,
    // so it is folded into the list rather than asked for twice.
    const submitted = [name, aliases].filter((v) => v !== undefined && v !== null);
    const resolvedKind = kind ? kind : inferEnvironmentKind(name);
    if (!isValidEnvironmentKind(resolvedKind)) {
      return res.status(400).json({
        error: 'Invalid kind',
        message: `kind must be one of: ${ENVIRONMENT_KINDS.join(', ')}`,
      });
    }

    // Orbit owns the word for the four named kinds; OTHER takes the first string in
    // its own list, because that is the same thing a separate name field would have
    // held.
    const canonical = canonicalEnvironmentName(resolvedKind, submitted);
    if (!canonical) {
      return res.status(400).json({
        error: 'Name required',
        message: 'An OTHER environment needs at least one name - that first one is what Orbit shows, and it is the only thing telling it apart from your other ones.',
      });
    }

    const slotMessage = await findKindSlotMessage({ companyId, kind: resolvedKind });
    if (slotMessage) {
      return res.status(409).json({ error: 'Kind already in use', message: slotMessage });
    }

    // Canonical first, then the extra spellings. Written as rows so the database
    // enforces that no string resolves to two environments.
    const values = environmentNameRows(canonical, submitted);

    const environment = await prisma.environment.create({
      data: {
        companyId,
        name: canonical,
        kind: resolvedKind,
        description: typeof description === 'string' ? description.trim() || null : null,
        displayOrder: Number.isInteger(displayOrder) ? displayOrder : 0,
        // Names are stored normalized, so keep what the caller actually typed when it
        // differed - the same reason the migration records a sourceLabel.
        sourceLabel: typeof name === 'string' && name.trim() && name.trim() !== canonical
          ? name.trim()
          : null,
        names: {
          create: values.map((value) => ({
            companyId,
            value,
            isCanonical: value === canonical,
          })),
        },
      },
      include: { names: { select: { value: true, isCanonical: true } } },
    });

    // `kind` is what cross-company production reporting counts, and name/aliases are
    // what every CI push and Wiz tag resolve against. A quiet edit to either changes
    // numbers or silently stops pipelines matching, so both are tracked.
    await recordChange({
      entityType: 'Environment',
      entityId: environment.id,
      action: 'create',
      userId: getAuthContext(req)?.userId || null,
      companyId: environment.companyId,
      after: environment,
    });

    res.status(201).json(environment);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const companyId = getAuthContext(req)?.isAdmin
        ? req.body?.companyId || getAuthContext(req)?.companyId
        : getAuthContext(req)?.companyId;
      const attempted = environmentNameRows(
        canonicalEnvironmentName(
          req.body?.kind || inferEnvironmentKind(req.body?.name),
          [req.body?.name, req.body?.aliases].filter(Boolean),
        ) || '',
        [req.body?.name, req.body?.aliases].filter(Boolean),
      );
      return res.status(409).json({
        error: 'Name or alias already in use',
        message: await describeNameCollision(companyId, attempted),
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

    const { name, kind, description, status, displayOrder, aliases } = req.body || {};
    const data = {};

    if (kind !== undefined) {
      if (!isValidEnvironmentKind(kind)) {
        return res.status(400).json({
          error: 'Invalid kind',
          message: `kind must be one of: ${ENVIRONMENT_KINDS.join(', ')}`,
        });
      }
      data.kind = kind;
    }

    // The label follows the kind, so re-kinding relabels the row on its own: a
    // STAGING environment promoted to PRODUCTION becomes "production", not whatever
    // it was called before. An OTHER is labelled by the first string in its own
    // list, which is why there is no separate name to send.
    const nextKind = data.kind ?? existing.kind;
    const existingExtras = existing.names.filter((n) => !n.isCanonical).map((n) => n.value);
    const submitted =
      aliases !== undefined
        ? [name, aliases].filter((v) => v !== undefined && v !== null)
        : [name, ...existingExtras].filter((v) => v !== undefined && v !== null);

    if (name !== undefined || kind !== undefined || aliases !== undefined) {
      const canonical = canonicalEnvironmentName(
        nextKind,
        // For OTHER, fall back to the current label when the caller sent no list at
        // all - a status-only edit must not strip the environment of its name.
        submitted.length ? submitted : [existing.name],
      );
      if (!canonical) {
        return res.status(400).json({
          error: 'Name required',
          message: 'An OTHER environment needs at least one name.',
        });
      }
      data.name = canonical;
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

    // Validate against the row as it WILL be, not as it is: changing the kind and the
    // name in one request has to be checked together, or a legal end state can be
    // rejected because an intermediate one was not.
    const slotMessage = await findKindSlotMessage({
      id: existing.id,
      companyId: existing.companyId,
      kind: nextKind,
    });
    if (slotMessage) {
      return res.status(409).json({ error: 'Kind already in use', message: slotMessage });
    }

    const before = await prisma.environment.findUnique({
      where: { id: existing.id },
      include: { names: { select: { value: true, isCanonical: true } } },
    });

    // The name rows are replaced wholesale rather than diffed. They are a set, the
    // set is small, and the alternative is three code paths (added, removed, became
    // canonical) that all have to agree with the unique index. Deleting first inside
    // the transaction means a rename that reuses another of this environment's own
    // values does not collide with itself.
    const nextCanonical = data.name ?? existing.name;
    const nextValues =
      aliases !== undefined || data.name !== undefined
        ? environmentNameRows(nextCanonical, submitted.length ? submitted : existingExtras)
        : null;

    const environment = await prisma.$transaction(async (tx) => {
      if (nextValues) {
        await tx.environmentName.deleteMany({ where: { environmentId: existing.id } });
        await tx.environmentName.createMany({
          data: nextValues.map((value) => ({
            companyId: existing.companyId,
            environmentId: existing.id,
            value,
            isCanonical: value === nextCanonical,
          })),
        });
      }
      return tx.environment.update({
        where: { id: existing.id },
        data,
        include: { names: { select: { value: true, isCanonical: true } } },
      });
    });

    await recordChange({
      entityType: 'Environment',
      entityId: environment.id,
      action: 'update',
      userId: getAuthContext(req)?.userId || null,
      companyId: environment.companyId,
      before,
      after: environment,
    });

    // Past deployments keep their environmentId, so a rename never orphans history.
    // Future CI pushes are a different matter: a pipeline still sending the old name
    // will stop matching and its deployments will arrive unassigned. Report how many
    // deployments used the old name so the UI can warn before anyone renames a busy
    // environment.
    //
    // Aliases make this recoverable rather than merely visible: keeping the old name
    // as an alias means every existing pipeline keeps resolving while the new name
    // rolls out. `canKeepOldNameAsAlias` tells the UI it can offer that, which is the
    // right default answer to "are you sure?".
    const renamedFrom = data.name && data.name !== existing.name ? existing.name : null;
    const affectedDeployments = renamedFrom
      ? await prisma.deployment.count({
        where: { environmentId: existing.id },
      })
      : 0;
    const canKeepOldNameAsAlias = Boolean(
      renamedFrom && !environment.names.some((n) => n.value === renamedFrom),
    );

    res.json({
      ...environment,
      renamedFrom,
      affectedDeployments,
      canKeepOldNameAsAlias,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findEnvironmentWithCompany(req.params.id);
      const attempted = environmentNameRows(
        canonicalEnvironmentName(req.body?.kind || existing?.kind, [
          req.body?.name,
          req.body?.aliases,
        ].filter(Boolean)) || existing?.name || '',
        [req.body?.name, req.body?.aliases].filter(Boolean),
      );
      return res.status(409).json({
        error: 'Name or alias already in use',
        message: await describeNameCollision(existing?.companyId, attempted),
      });
    }
    console.error('Error updating environment:', error);
    res.status(500).json({ error: 'Failed to update environment' });
  }
});

// Adopt a string that has been arriving unmatched: make it a name of this
// environment, and attach the deployments the caller has selected.
//
// NOTHING HERE IS INFERRED, INCLUDING SCOPE.
//
// The environment is chosen by a human - a suggestion may be shown in the UI but
// never arrives here pre-applied. The string is taken literally. And the
// deployments to attach come as an explicit list of ids: there is deliberately no
// "attach everything with this string" shortcut on the server, because that would
// be Orbit deciding how far an adoption reaches. The UI offers select-all; the
// selection travels with the request.
//
// A deployment is only attached if its own raw string still normalises to the
// value being adopted and it belongs to this company. That is not second-guessing
// the caller - it is refusing to attach a row to an environment it never named,
// whatever id was posted.
router.post('/:id/names', requireAuth, async (req, res) => {
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

    const value = normalizeEnvironmentName(req.body?.value);
    if (!value) {
      return res.status(400).json({ error: 'A name is required' });
    }

    const deploymentIds = Array.isArray(req.body?.deploymentIds)
      ? req.body.deploymentIds.filter((id) => typeof id === 'string' && id)
      : [];

    const attachable = deploymentIds.length
      ? await prisma.deployment.findMany({
        where: {
          id: { in: deploymentIds },
          environmentId: null,
          application: { companyId: existing.companyId },
        },
        select: { id: true, environment: true },
      })
      : [];

    // Only rows that actually carry this string. A posted id for a deployment
    // that said something else is dropped rather than quietly re-homed.
    const matching = attachable.filter(
      (d) => normalizeEnvironmentName(d.environment) === value,
    );
    const rejected = deploymentIds.length - matching.length;

    const result = await prisma.$transaction(async (tx) => {
      const name = await tx.environmentName.create({
        data: { companyId: existing.companyId, environmentId: existing.id, value },
        select: { id: true, value: true },
      });

      const attached = matching.length
        ? await tx.deployment.updateMany({
          where: { id: { in: matching.map((d) => d.id) } },
          data: { environmentId: existing.id },
        })
        : { count: 0 };

      return { name, attached: attached.count };
    });

    await recordChange({
      entityType: 'EnvironmentName',
      entityId: result.name.id,
      action: 'create',
      userId: getAuthContext(req)?.userId || null,
      companyId: existing.companyId,
      after: { value, isCanonical: false, environmentId: existing.id },
    });

    res.status(201).json({
      value: result.name.value,
      environmentId: existing.id,
      attachedDeployments: result.attached,
      // Say so rather than silently attaching fewer than were asked for.
      rejectedDeployments: rejected,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findEnvironmentWithCompany(req.params.id);
      return res.status(409).json({
        error: 'Name already in use',
        message: await describeNameCollision(
          existing?.companyId,
          [normalizeEnvironmentName(req.body?.value)].filter(Boolean),
        ),
      });
    }
    console.error('Error adopting environment name:', error);
    res.status(500).json({ error: 'Failed to adopt that name' });
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

    const before = await prisma.environment.findUnique({ where: { id: existing.id } });
    await prisma.environment.delete({ where: { id: existing.id } });

    await recordChange({
      entityType: 'Environment',
      entityId: existing.id,
      action: 'delete',
      userId: getAuthContext(req)?.userId || null,
      companyId: before?.companyId || null,
      before,
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting environment:', error);
    res.status(500).json({ error: 'Failed to delete environment' });
  }
});

export default router;
