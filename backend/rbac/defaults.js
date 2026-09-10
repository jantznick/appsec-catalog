/**
 * Default role for a user who has just been put into a company.
 *
 * The migration backfilled every pre-existing company user with
 * `company_member` so their access was unchanged. Users created *after* that
 * need the same treatment, otherwise they land in a company able to do nothing.
 * This is called from every place that sets `User.companyId`.
 *
 * It only grants when the user has no company-scoped role at all, so it never
 * widens access for someone an admin has already given a narrower role like
 * Company Read. The grant is the "every company I belong to" form, matching the
 * backfill.
 */
import { prisma } from '../prisma/client.js';
import { LEGACY_MEMBER_ROLE_KEY } from './builtInRoles.js';
import { invalidatePermissionCache } from './context.js';
import { PermissionScope } from './permissions.js';

export async function ensureDefaultCompanyRole(userId) {
  if (!userId) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true, isAdmin: true },
    });
    // System admins already hold everything; users with no company have nothing
    // for a company role to apply to.
    if (!user?.companyId || user.isAdmin) return;

    const existing = await prisma.userRole.findFirst({
      where: { userId, role: { scope: PermissionScope.COMPANY } },
      select: { id: true },
    });
    if (existing) return;

    const role = await prisma.role.findFirst({
      where: { key: LEGACY_MEMBER_ROLE_KEY, companyId: null },
      select: { id: true },
    });
    if (!role) {
      console.warn(`[rbac] default role "${LEGACY_MEMBER_ROLE_KEY}" is missing; not granting`);
      return;
    }

    await prisma.userRole.create({
      data: { userId, roleId: role.id, companyId: null },
    });
    invalidatePermissionCache(userId);
  } catch (error) {
    // Never fail the surrounding operation (provisioning, invite acceptance)
    // over this; it is recoverable by granting the role in the UI.
    console.error('[rbac] failed to grant default company role', error);
  }
}
