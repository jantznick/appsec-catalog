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

    // Company role managers only ever deal in global, company-scoped roles;
    // system managers see everything, including company-owned custom roles.
    const where = isGlobalRoleManager(ctx) ? {} : { companyId: null, scope: PermissionScope.COMPANY };

    const roles = await prisma.role.findMany({
      where,
      select: ROLE_SELECT,
      orderBy: [{ scope: 'asc' }, { name: 'asc' }],
    });

    res.json({
      roles: roles.map(serializeRole),
      canManageRoles: canManageRolesSomewhere(ctx),
      canManageAllRoles: isGlobalRoleManager(ctx),
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
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
