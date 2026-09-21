/**
 * Role and role-assignment management.
 *
 * Who can grant what:
 *
 * - System admins (User.isAdmin) and holders of the system `role.manage`
 *   permission can grant or revoke any role, in any company, including the
 *   "applies to every company the user belongs to" form.
 * - A company admin (anyone holding `company.manage_roles` in a company) can
 *   grant and revoke COMPANY-scoped roles inside that company only, and only
 *   to users who belong to it. They can never create an all-companies grant.
 *
 * A grant is additionally refused if it would hand out a permission the
 * granter does not themselves hold in that company, so nobody can use this
 * endpoint to climb above their own access.
 */
import express from 'express';
import { prisma } from '../prisma/client.js';
import { requireAuth } from '../middleware/auth.js';
import { getAuthContext } from '../middleware/authContext.js';
import { getPermissionContext, contextCan, invalidatePermissionCache } from '../rbac/context.js';
import { permissionCatalog, PERMISSIONS, PermissionScope } from '../rbac/permissions.js';
import {
  canAuthorRolesSomewhere,
  checkPermissionCap,
  checkRoleOwnership,
  companiesWhereAuthor,
  isGlobalRoleAuthor,
  isReservedRoleKey,
  roleKeyFromName,
  validatePermissionList,
} from '../rbac/authoring.js';

const router = express.Router();

const ROLE_SELECT = {
  id: true,
  key: true,
  name: true,
  description: true,
  scope: true,
  isSystem: true,
  companyId: true,
  permissions: { select: { permission: true }, orderBy: { permission: 'asc' } },
  _count: { select: { assignments: true } },
};

function serializeRole(role) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    scope: role.scope,
    isSystem: role.isSystem,
    companyId: role.companyId,
    permissions: role.permissions.map((p) => p.permission),
    // Absent when the role came from a query that didn't ask for the count.
    assignmentCount: role._count?.assignments,
  };
}

/** Can this context administer roles anywhere at all? */
function canManageRolesSomewhere(ctx) {
  if (!ctx) return false;
  if (ctx.isSystemAdmin || ctx.global.has('role.manage')) return true;
  if (ctx.allCompanies.has('company.manage_roles') && ctx.homeCompanyIds.length > 0) return true;
  for (const permissions of ctx.byCompany.values()) {
    if (permissions.has('company.manage_roles')) return true;
  }
  return false;
}

/** Every company where this context can grant existing roles. */
function companiesWithManageRoles(ctx) {
  if (!ctx) return [];
  const out = new Set();
  if (ctx.allCompanies.has('company.manage_roles')) {
    for (const id of ctx.homeCompanyIds) out.add(id);
  }
  for (const [companyId, permissions] of ctx.byCompany) {
    if (permissions.has('company.manage_roles')) out.add(companyId);
  }
  return [...out];
}

/**
 * Pick a key that is free for this owner. Keys are unique per owning company,
 * so two companies may each have a "release_manager"; a numeric suffix settles
 * a clash inside one owner.
 */
async function allocateRoleKey(name, companyId) {
  const base = roleKeyFromName(name);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}_${attempt + 1}`;
    // Built-in keys are reserved everywhere so a company role cannot present
    // itself as "company_admin" in the UI.
    if (isReservedRoleKey(candidate)) continue;
    const clash = await prisma.role.findFirst({
      where: { key: candidate, companyId },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  // Practically unreachable; keeps the create path from looping forever.
  return `${base}_${Date.now()}`;
}

/**
 * Editing a role changes what everyone holding it can do, so their cached
 * permission sets have to go. The per-user TTL would get there eventually;
 * this makes the change immediate.
 */
async function invalidateHoldersOfRole(roleId) {
  const holders = await prisma.userRole.findMany({
    where: { roleId },
    select: { userId: true },
  });
  for (const { userId } of new Map(holders.map((h) => [h.userId, h])).values()) {
    invalidatePermissionCache(userId);
  }
}

function isGlobalRoleManager(ctx) {
  return Boolean(ctx?.isSystemAdmin || ctx?.global.has('role.manage'));
}

/**
 * The permission catalog, for rendering what a role grants.
 * GET /api/roles/permissions
 */
router.get('/permissions', requireAuth, async (req, res) => {
  try {
    res.json({ groups: permissionCatalog() });
  } catch (error) {
    console.error('Error fetching permission catalog:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

/**
 * List roles the caller could assign.
 * GET /api/roles
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const ctx = await getPermissionContext(req);

    // A global manager sees every role. Anyone else sees the global roles they
    // can assign, plus the custom roles owned by companies they administer -
    // without this they could neither assign nor edit their own company's roles.
    const scopedCompanyIds = [
      ...new Set([...companiesWhereAuthor(ctx), ...companiesWithManageRoles(ctx)]),
    ];
    const where = isGlobalRoleManager(ctx)
      ? {}
      : {
          scope: PermissionScope.COMPANY,
          OR: [
            { companyId: null },
            ...(scopedCompanyIds.length > 0 ? [{ companyId: { in: scopedCompanyIds } }] : []),
          ],
        };

    const roles = await prisma.role.findMany({
      where,
      select: ROLE_SELECT,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });

    res.json({
      roles: roles.map(serializeRole),
      canManageRoles: canManageRolesSomewhere(ctx),
      canManageAllRoles: isGlobalRoleManager(ctx),
      canAuthorRoles: canAuthorRolesSomewhere(ctx),
      canAuthorGlobalRoles: isGlobalRoleAuthor(ctx),
      authorableCompanyIds: isGlobalRoleAuthor(ctx) ? null : companiesWhereAuthor(ctx),
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/**
 * Create a custom role.
 * POST /api/roles
 * Body: { name, description?, permissions: string[], companyId?: string|null }
 *
 * `companyId` null means the role can be assigned in every company and is
 * reserved for global authors. Custom roles are always COMPANY-scoped; see
 * rbac/authoring.js for why system-wide permissions are not authorable.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const ctx = await getPermissionContext(req);
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : null;
    const companyId = req.body?.companyId || null;

    if (!name) {
      return res.status(400).json({ error: 'Missing fields', message: 'A role name is required' });
    }
    if (name.length > 80) {
      return res.status(400).json({
        error: 'Invalid name',
        message: 'Role names are limited to 80 characters',
      });
    }

    const validated = validatePermissionList(req.body?.permissions);
    if (!validated.ok) {
      return res.status(400).json({ error: validated.error, message: validated.message });
    }

    const ownership = checkRoleOwnership(ctx, companyId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error, message: ownership.message });
    }

    const cap = checkPermissionCap(ctx, companyId, validated.permissions);
    if (!cap.ok) {
      return res.status(cap.status).json({ error: cap.error, message: cap.message });
    }

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) {
        return res.status(404).json({ error: 'Company not found', message: 'The specified company does not exist' });
      }
    }

    const key = await allocateRoleKey(name, companyId);

    const role = await prisma.role.create({
      data: {
        key,
        name,
        description: description || null,
        scope: PermissionScope.COMPANY,
        isSystem: false,
        companyId,
        permissions: { create: validated.permissions.map((permission) => ({ permission })) },
      },
      select: ROLE_SELECT,
    });

    res.status(201).json({ message: `Created role "${role.name}"`, role: serializeRole(role) });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

/**
 * Update a custom role's name, description or permissions.
 * PUT /api/roles/:id
 *
 * Registered before the /assignments routes below, which is safe: `/:id`
 * matches a single path segment, so `/assignments/<id>` never falls into it.
 *
 * Ownership (`companyId`) is deliberately immutable: moving a role between
 * companies would silently change who its existing assignments apply to.
 * Permission changes take effect immediately for everyone already holding it.
 */
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await getPermissionContext(req);
    const role = await prisma.role.findUnique({ where: { id: req.params.id }, select: ROLE_SELECT });

    if (!role) {
      return res.status(404).json({ error: 'Role not found', message: 'That role does not exist' });
    }
    if (role.isSystem) {
      return res.status(403).json({
        error: 'Built-in role',
        message: 'Built-in roles are defined in code and cannot be edited',
      });
    }

    const ownership = checkRoleOwnership(ctx, role.companyId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error, message: ownership.message });
    }

    const data = {};

    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ error: 'Invalid name', message: 'A role name is required' });
      }
      if (name.length > 80) {
        return res.status(400).json({
          error: 'Invalid name',
          message: 'Role names are limited to 80 characters',
        });
      }
      data.name = name;
    }

    if (req.body?.description !== undefined) {
      const description = String(req.body.description ?? '').trim();
      data.description = description || null;
    }

    let permissions = null;
    if (req.body?.permissions !== undefined) {
      const validated = validatePermissionList(req.body.permissions);
      if (!validated.ok) {
        return res.status(400).json({ error: validated.error, message: validated.message });
      }
      const cap = checkPermissionCap(ctx, role.companyId, validated.permissions);
      if (!cap.ok) {
        return res.status(cap.status).json({ error: cap.error, message: cap.message });
      }
      permissions = validated.permissions;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (permissions) {
        const existing = role.permissions.map((p) => p.permission);
        const toRemove = existing.filter((p) => !permissions.includes(p));
        const toAdd = permissions.filter((p) => !existing.includes(p));

        if (toRemove.length > 0) {
          await tx.rolePermission.deleteMany({
            where: { roleId: role.id, permission: { in: toRemove } },
          });
        }
        if (toAdd.length > 0) {
          await tx.rolePermission.createMany({
            data: toAdd.map((permission) => ({ roleId: role.id, permission })),
            skipDuplicates: true,
          });
        }
      }

      return tx.role.update({
        where: { id: role.id },
        data: Object.keys(data).length > 0 ? data : {},
        select: ROLE_SELECT,
      });
    });

    // Everyone holding this role now resolves to a different permission set.
    await invalidateHoldersOfRole(role.id);

    res.json({ message: `Updated role "${updated.name}"`, role: serializeRole(updated) });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * Delete a custom role.
 * DELETE /api/roles/:id
 *
 * Refused while anyone still holds it. The FK would cascade the assignments
 * away silently, which is a quiet way to strip access from people who are not
 * on screen - so the count comes back instead and the caller revokes first.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await getPermissionContext(req);
    const role = await prisma.role.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, isSystem: true, companyId: true, _count: { select: { assignments: true } } },
    });

    if (!role) {
      return res.status(404).json({ error: 'Role not found', message: 'That role does not exist' });
    }
    if (role.isSystem) {
      return res.status(403).json({
        error: 'Built-in role',
        message: 'Built-in roles are defined in code and cannot be deleted',
      });
    }

    const ownership = checkRoleOwnership(ctx, role.companyId);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error, message: ownership.message });
    }

    const held = role._count.assignments;
    if (held > 0) {
      return res.status(409).json({
        error: 'Role in use',
        message: `${held} user${held === 1 ? '' : 's'} still ${held === 1 ? 'has' : 'have'} this role. Revoke it from them before deleting it.`,
        assignmentCount: held,
      });
    }

    await prisma.role.delete({ where: { id: role.id } });

    res.json({ message: `Deleted role "${role.name}"` });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Failed to delete role' });
  }
});

/**
 * List a user's role assignments.
 * GET /api/roles/assignments?userId=...
 *
 * Callers can always read their own. Reading someone else's needs role
 * management rights covering that user.
 */
router.get('/assignments', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const ctx = await getPermissionContext(req);
    const userId = req.query.userId || auth.userId;

    if (userId !== auth.userId && !isGlobalRoleManager(ctx)) {
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { companyId: true },
      });
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found', message: 'The requested user does not exist' });
      }
      if (!contextCan(ctx, 'company.manage_roles', targetUser.companyId)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You do not have permission to view this user\'s roles',
        });
      }
    }

    const assignments = await prisma.userRole.findMany({
      where: { userId },
      select: {
        id: true,
        companyId: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        grantedBy: { select: { id: true, email: true } },
        role: { select: ROLE_SELECT },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      assignments: assignments.map((a) => ({
        id: a.id,
        companyId: a.companyId,
        company: a.company,
        createdAt: a.createdAt,
        grantedBy: a.grantedBy,
        role: serializeRole(a.role),
      })),
    });
  } catch (error) {
    console.error('Error fetching role assignments:', error);
    res.status(500).json({ error: 'Failed to fetch role assignments' });
  }
});

/**
 * Grant a role.
 * POST /api/roles/assignments
 * Body: { userId, roleId, companyId? }
 *
 * `companyId` null means "every company this user belongs to" and is reserved
 * for global role managers.
 */
router.post('/assignments', requireAuth, async (req, res) => {
  try {
    const auth = getAuthContext(req);
    const ctx = await getPermissionContext(req);
    const { userId, roleId } = req.body ?? {};
    const companyId = req.body?.companyId || null;

    if (!userId || !roleId) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'userId and roleId are required',
      });
    }

    const [targetUser, role] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, companyId: true } }),
      prisma.role.findUnique({ where: { id: roleId }, select: ROLE_SELECT }),
    ]);

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found', message: 'The requested user does not exist' });
    }
    if (!role) {
      return res.status(404).json({ error: 'Role not found', message: 'The requested role does not exist' });
    }

    const rolePermissions = role.permissions.map((p) => p.permission);

    if (role.scope === PermissionScope.SYSTEM && companyId) {
      return res.status(400).json({
        error: 'Invalid assignment',
        message: 'System-scoped roles are not assigned to a company',
      });
    }
    if (role.companyId && companyId && role.companyId !== companyId) {
      return res.status(400).json({
        error: 'Invalid assignment',
        message: 'This role belongs to a different company',
      });
    }

    if (isGlobalRoleManager(ctx)) {
      if (companyId) {
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
        if (!company) {
          return res.status(404).json({ error: 'Company not found', message: 'The specified company does not exist' });
        }
      }
    } else {
      // Company-level role manager.
      if (!companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Only system administrators can grant a role across every company a user belongs to',
        });
      }
      if (role.scope !== PermissionScope.COMPANY) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only grant company-scoped roles',
        });
      }
      if (!contextCan(ctx, 'company.manage_roles', companyId)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You do not have permission to manage roles in this company',
        });
      }
      if (targetUser.companyId !== companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You can only grant roles to users in your company',
        });
      }
      // No escalation: you cannot hand out access you do not have yourself.
      const missing = rolePermissions.filter((p) => !contextCan(ctx, p, companyId));
      if (missing.length > 0) {
        return res.status(403).json({
          error: 'Permission denied',
          message: `This role grants permissions you do not hold: ${missing
            .map((p) => PERMISSIONS[p]?.label ?? p)
            .join(', ')}`,
        });
      }
    }

    const existing = await prisma.userRole.findFirst({
      where: { userId, roleId, companyId },
      select: { id: true },
    });
    if (existing) {
      return res.status(409).json({
        error: 'Already granted',
        message: 'This user already has that role',
      });
    }

    const assignment = await prisma.userRole.create({
      data: { userId, roleId, companyId, grantedById: auth.userId },
      select: {
        id: true,
        companyId: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        grantedBy: { select: { id: true, email: true } },
        role: { select: ROLE_SELECT },
      },
    });

    invalidatePermissionCache(userId);

    res.status(201).json({
      message: `Granted ${role.name} to ${targetUser.email}`,
      assignment: {
        id: assignment.id,
        companyId: assignment.companyId,
        company: assignment.company,
        createdAt: assignment.createdAt,
        grantedBy: assignment.grantedBy,
        role: serializeRole(assignment.role),
      },
    });
  } catch (error) {
    console.error('Error granting role:', error);
    res.status(500).json({ error: 'Failed to grant role' });
  }
});

/**
 * Revoke a role.
 * DELETE /api/roles/assignments/:id
 */
router.delete('/assignments/:id', requireAuth, async (req, res) => {
  try {
    const ctx = await getPermissionContext(req);
    const assignment = await prisma.userRole.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        userId: true,
        companyId: true,
        role: { select: { name: true, scope: true } },
        user: { select: { email: true } },
      },
    });

    if (!assignment) {
      return res.status(404).json({
        error: 'Assignment not found',
        message: 'That role assignment does not exist',
      });
    }

    if (!isGlobalRoleManager(ctx)) {
      if (!assignment.companyId) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'Only system administrators can revoke an all-companies role',
        });
      }
      if (!contextCan(ctx, 'company.manage_roles', assignment.companyId)) {
        return res.status(403).json({
          error: 'Permission denied',
          message: 'You do not have permission to manage roles in this company',
        });
      }
    }

    await prisma.userRole.delete({ where: { id: assignment.id } });
    invalidatePermissionCache(assignment.userId);

    res.json({ message: `Revoked ${assignment.role.name} from ${assignment.user.email}` });
  } catch (error) {
    console.error('Error revoking role:', error);
    res.status(500).json({ error: 'Failed to revoke role' });
  }
});

export default router;
