/**
 * Reconciles the built-in roles in rbac/builtInRoles.js with the database on
 * boot, the same way utils/adminInit.js reconciles admin users.
 *
 * The migration seeds these rows once; this keeps them correct afterwards, so
 * adding a permission to the catalog and listing it on a role is all that's
 * needed for the change to reach every environment on next deploy.
 *
 * Only roles marked `isSystem` are touched. Custom roles are never modified.
 */
import { prisma } from '../prisma/client.js';
import { BUILT_IN_ROLES, BUILT_IN_ROLE_KEYS } from './builtInRoles.js';
import { isValidPermission } from './permissions.js';
import { invalidatePermissionCache } from './context.js';

export async function syncBuiltInRoles() {
  let created = 0;
  let permissionsAdded = 0;
  let permissionsRemoved = 0;

  for (const definition of BUILT_IN_ROLES) {
    const wanted = [...new Set(definition.permissions)].filter((p) => {
      if (isValidPermission(p)) return true;
      console.warn(`[rbac] built-in role "${definition.key}" lists unknown permission "${p}"`);
      return false;
    });

    let role = await prisma.role.findFirst({
      where: { key: definition.key, companyId: null },
      select: { id: true },
    });

    if (!role) {
      role = await prisma.role.create({
        data: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          scope: definition.scope,
          isSystem: true,
          companyId: null,
        },
        select: { id: true },
      });
      created += 1;
    } else {
      await prisma.role.update({
        where: { id: role.id },
        data: {
          name: definition.name,
          description: definition.description,
          scope: definition.scope,
          isSystem: true,
        },
      });
    }

    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id },
      select: { permission: true },
    });
    const existingSet = new Set(existing.map((r) => r.permission));

    const toAdd = wanted.filter((p) => !existingSet.has(p));
    const toRemove = [...existingSet].filter((p) => !wanted.includes(p));

    if (toAdd.length > 0) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((permission) => ({ roleId: role.id, permission })),
        skipDuplicates: true,
      });
      permissionsAdded += toAdd.length;
    }

    if (toRemove.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: role.id, permission: { in: toRemove } },
      });
      permissionsRemoved += toRemove.length;
    }
  }

  // Drop stale permission rows on built-in roles that were removed from the
  // catalog entirely (e.g. a permission we renamed).
  const orphaned = await prisma.rolePermission.findMany({
    where: { role: { isSystem: true, key: { in: BUILT_IN_ROLE_KEYS }, companyId: null } },
    select: { id: true, permission: true },
  });
  const stale = orphaned.filter((r) => !isValidPermission(r.permission));
  if (stale.length > 0) {
    await prisma.rolePermission.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    permissionsRemoved += stale.length;
  }

  invalidatePermissionCache();

  if (created || permissionsAdded || permissionsRemoved) {
    console.log(
      `[rbac] built-in roles synced (roles created: ${created}, permissions added: ${permissionsAdded}, removed: ${permissionsRemoved})`
    );
  }
}
