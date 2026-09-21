/**
 * Rules for authoring custom roles.
 *
 * Two kinds of author:
 *
 * - Global (User.isAdmin, or the system `role.manage` permission): may author a
 *   role owned by one company, or a global role with `companyId: null` that can
 *   be assigned in every company.
 * - Company (`company.author_roles` in some company): may author roles owned by
 *   that company only. Never a global one — a global role reaches companies
 *   they have no authority over.
 *
 * Both are capped the same way: a role may not carry a permission its author
 * does not already hold in the company the role belongs to. Without that cap,
 * authoring would be a trivial escalation — invent a role with every
 * permission, grant it to yourself.
 *
 * Custom roles are always COMPANY-scoped. SYSTEM-scoped permissions
 * (role.manage, user.manage, policy.manage, …) are deliberately not authorable:
 * bundling them into a role is a way to hand out global power, and the built-in
 * set plus `isAdmin` already covers the cases we have.
 */
import { contextCan } from './context.js';
import {
  PERMISSIONS,
  PermissionScope,
  isValidPermission,
  permissionScope,
} from './permissions.js';
import { BUILT_IN_ROLE_KEYS } from './builtInRoles.js';

/** Author may act on roles anywhere (global roles included). */
export function isGlobalRoleAuthor(ctx) {
  return Boolean(ctx?.isSystemAdmin || ctx?.global.has('role.manage'));
}

/** Every company where this context may author roles. */
export function companiesWhereAuthor(ctx) {
  if (!ctx) return [];
  const out = new Set();
  if (ctx.allCompanies.has('company.author_roles')) {
    for (const id of ctx.homeCompanyIds) out.add(id);
  }
  for (const [companyId, permissions] of ctx.byCompany) {
    if (permissions.has('company.author_roles')) out.add(companyId);
  }
  return [...out];
}

/** Can this context author roles at all, anywhere? */
export function canAuthorRolesSomewhere(ctx) {
  return isGlobalRoleAuthor(ctx) || companiesWhereAuthor(ctx).length > 0;
}

/**
 * Normalize and validate a submitted permission list.
 * @returns {{ ok: true, permissions: string[] } | { ok: false, error: string, message: string }}
 */
export function validatePermissionList(raw) {
  if (!Array.isArray(raw) || raw.length === 0) {
    return {
      ok: false,
      error: 'Invalid permissions',
      message: 'Pick at least one permission for the role',
    };
  }

  const permissions = [...new Set(raw.map((p) => String(p).trim()).filter(Boolean))];

  const unknown = permissions.filter((p) => !isValidPermission(p));
  if (unknown.length > 0) {
    return {
      ok: false,
      error: 'Invalid permissions',
      message: `Unknown permission${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}`,
    };
  }

  const systemScoped = permissions.filter((p) => permissionScope(p) === PermissionScope.SYSTEM);
  if (systemScoped.length > 0) {
    return {
      ok: false,
      error: 'Invalid permissions',
      message: `Custom roles are company-scoped and cannot carry system-wide permissions: ${systemScoped.join(', ')}`,
    };
  }

  return { ok: true, permissions };
}

/**
 * May this context author a role owned by `companyId` (null = global)?
 * @returns {{ ok: true } | { ok: false, status: number, error: string, message: string }}
 */
export function checkRoleOwnership(ctx, companyId) {
  if (isGlobalRoleAuthor(ctx)) return { ok: true };

  if (!companyId) {
    return {
      ok: false,
      status: 403,
      error: 'Permission denied',
      message: 'Only system administrators can create a role that applies to every company',
    };
  }
  if (!contextCan(ctx, 'company.author_roles', companyId)) {
    return {
      ok: false,
      status: 403,
      error: 'Permission denied',
      message: 'You do not have permission to manage roles in this company',
    };
  }
  return { ok: true };
}

/**
 * No-escalation cap: every permission must be one the author already holds in
 * the company the role belongs to. A global role (companyId null) reaches every
 * company, so only a global author can make one and the cap does not apply —
 * checkRoleOwnership has already refused everyone else.
 */
export function checkPermissionCap(ctx, companyId, permissions) {
  if (isGlobalRoleAuthor(ctx)) return { ok: true };

  const missing = permissions.filter((p) => !contextCan(ctx, p, companyId));
  if (missing.length > 0) {
    return {
      ok: false,
      status: 403,
      error: 'Permission denied',
      message: `You cannot put permissions in a role that you do not hold yourself: ${missing
        .map((p) => PERMISSIONS[p]?.label ?? p)
        .join(', ')}`,
    };
  }
  return { ok: true };
}

/**
 * Turn a display name into a stable key. Keys are only unique per owning
 * company (see the Role model), so the caller de-duplicates against siblings.
 */
export function roleKeyFromName(name) {
  const base = String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || 'custom_role';
}

/** Built-in keys are reserved so a custom role can't impersonate one. */
export function isReservedRoleKey(key) {
  return BUILT_IN_ROLE_KEYS.includes(key);
}
