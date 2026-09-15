/**
 * Resolves a user's effective permissions and answers `can(...)` questions.
 *
 * The shape we resolve to:
 *
 *   {
 *     userId,
 *     isSystemAdmin,        // User.isAdmin — holds every permission
 *     global: Set,          // SYSTEM-scoped permissions
 *     allCompanies: Set,    // COMPANY-scoped permissions granted with no
 *                           //   companyId, i.e. "in every company I belong to"
 *     byCompany: Map,       // companyId -> Set of COMPANY-scoped permissions
 *     homeCompanyIds: [],   // companies the user is a member of
 *     companyIds: [],       // homeCompanyIds + companies granted explicitly
 *     roles: []             // assignments, for display
 *   }
 */
import { prisma } from '../prisma/client.js';
import { getAuthContext } from '../middleware/authContext.js';
import { PermissionScope, isValidPermission, permissionScope } from './permissions.js';

/**
 * Short-lived cache so we don't re-query roles on every request in a burst.
 * Bounded staleness is fine for authorization here because grants and revokes
 * call `invalidatePermissionCache(userId)` directly; the TTL only covers
 * changes made out of band (another process, a manual SQL edit).
 */
const CACHE_TTL_MS = 30_000;
const cache = new Map();

export function invalidatePermissionCache(userId) {
  if (userId) cache.delete(userId);
  else cache.clear();
}

async function loadAssignments(userId) {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.assignments;

  const assignments = await prisma.userRole.findMany({
    where: { userId },
    select: {
      id: true,
      companyId: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          key: true,
          name: true,
          scope: true,
          companyId: true,
          isSystem: true,
          permissions: { select: { permission: true } },
        },
      },
    },
  });

  cache.set(userId, { assignments, expiresAt: Date.now() + CACHE_TTL_MS });
  return assignments;
}

/**
 * Build the permission context for an auth context (session or api key).
 * Returns null when the request is unauthenticated.
 */
export async function loadPermissionContext(auth) {
  if (!auth?.userId) return null;

  // An api key can be pinned to a single company; when it is, nothing outside
  // that company is reachable no matter what roles the user holds.
  const restrictedCompanyId = auth.restrictedCompanyId ?? null;

  const homeCompanyIds = auth.companyId ? [auth.companyId] : [];
  const global = new Set();
  const allCompanies = new Set();
  const byCompany = new Map();

  const assignments = await loadAssignments(auth.userId);

  for (const assignment of assignments) {
    const role = assignment.role;
    if (!role) continue;
    const permissions = role.permissions.map((p) => p.permission).filter(isValidPermission);

    if (role.scope === PermissionScope.SYSTEM) {
      for (const p of permissions) global.add(p);
      continue;
    }

    // A company-owned role can only ever apply within its owning company.
    const targetCompanyId = role.companyId ?? assignment.companyId;

    if (!targetCompanyId) {
      for (const p of permissions) allCompanies.add(p);
      continue;
    }

    if (!byCompany.has(targetCompanyId)) byCompany.set(targetCompanyId, new Set());
    const set = byCompany.get(targetCompanyId);
    for (const p of permissions) set.add(p);
  }

  let effectiveHomeCompanyIds = homeCompanyIds;
  let effectiveByCompany = byCompany;

  if (restrictedCompanyId) {
    effectiveHomeCompanyIds = homeCompanyIds.filter((id) => id === restrictedCompanyId);
    effectiveByCompany = new Map(
      [...byCompany.entries()].filter(([companyId]) => companyId === restrictedCompanyId)
    );
  }

  const companyIds = [
    ...new Set([...effectiveHomeCompanyIds, ...effectiveByCompany.keys()]),
  ];

  return {
    userId: auth.userId,
    // An api key with adminAccessDisabled (or one pinned to a company) already
    // has isAdmin stripped in apiKeyAuth, so this reads the effective value.
    isSystemAdmin: Boolean(auth.isAdmin),
    global,
    allCompanies,
    byCompany: effectiveByCompany,
    homeCompanyIds: effectiveHomeCompanyIds,
    companyIds,
    restrictedCompanyId,
    roles: assignments.map((a) => ({
      id: a.id,
      companyId: a.companyId,
      createdAt: a.createdAt,
      roleId: a.role.id,
      key: a.role.key,
      name: a.role.name,
      scope: a.role.scope,
      isSystem: a.role.isSystem,
    })),
  };
}

/**
 * Attach a lazily-resolved permission context to the request.
 *
 * The in-flight promise is what gets cached, so several checks in the same
 * request — including concurrent ones inside a Promise.all — share one
 * resolution instead of racing to load it.
 */
export function getPermissionContext(req) {
  if (req._rbacContext !== undefined) return Promise.resolve(req._rbacContext);
  if (!req._rbacContextPromise) {
    req._rbacContextPromise = loadPermissionContext(getAuthContext(req))
      .then((ctx) => {
        req._rbacContext = ctx;
        return ctx;
      })
      .finally(() => {
        req._rbacContextPromise = null;
      });
  }
  return req._rbacContextPromise;
}

/** Drop the per-request cache, e.g. after the session's company was re-synced. */
export function resetPermissionContext(req) {
  req._rbacContext = undefined;
  req._rbacContextPromise = null;
}

/**
 * Does this context hold `permission`?
 *
 * COMPANY-scoped permissions require a companyId; passing one for a
 * SYSTEM-scoped permission is ignored. Unknown permission strings are always
 * denied rather than silently passing — a typo should close the door, not
 * open it.
 */
export function contextCan(ctx, permission, companyId = null) {
  if (!ctx) return false;
  if (!isValidPermission(permission)) {
    console.warn(`[rbac] unknown permission checked: ${permission}`);
    return false;
  }
  if (ctx.isSystemAdmin) return true;

  if (permissionScope(permission) === PermissionScope.SYSTEM) {
    return ctx.global.has(permission);
  }

  if (!companyId) return false;
  if (ctx.restrictedCompanyId && companyId !== ctx.restrictedCompanyId) return false;

  if (ctx.byCompany.get(companyId)?.has(permission)) return true;
  return ctx.homeCompanyIds.includes(companyId) && ctx.allCompanies.has(permission);
}

/** Promise-returning `can` for use inside route handlers. */
export async function can(req, permission, companyId = null) {
  const ctx = await getPermissionContext(req);
  return contextCan(ctx, permission, companyId);
}

/** Every company this context can exercise `permission` in. */
export function companiesWithPermission(ctx, permission) {
  if (!ctx) return [];
  const out = new Set();
  if (ctx.allCompanies.has(permission)) {
    for (const id of ctx.homeCompanyIds) out.add(id);
  }
  for (const [companyId, permissions] of ctx.byCompany) {
    if (permissions.has(permission)) out.add(companyId);
  }
  return [...out];
}

/**
 * A Prisma `where` fragment restricting a query to the companies where the
 * context holds `permission`. System admins get `{}` (no restriction).
 *
 * Returns `null` when the context can't see anything — callers should short
 * circuit and return an empty list rather than querying.
 */
export async function companyScopeFilter(req, permission, field = 'companyId') {
  const ctx = await getPermissionContext(req);
  if (!ctx) return null;
  if (ctx.isSystemAdmin) {
    // Still honour an api key pinned to one company.
    return ctx.restrictedCompanyId ? { [field]: ctx.restrictedCompanyId } : {};
  }
  const companyIds = companiesWithPermission(ctx, permission);
  if (companyIds.length === 0) return null;
  return { [field]: { in: companyIds } };
}

/**
 * The permission payload handed to the frontend by /api/auth/me.
 */
export function serializePermissionContext(ctx) {
  if (!ctx) return null;
  return {
    isSystemAdmin: ctx.isSystemAdmin,
    global: [...ctx.global],
    allCompanies: [...ctx.allCompanies],
    byCompany: Object.fromEntries([...ctx.byCompany].map(([k, v]) => [k, [...v]])),
    homeCompanyIds: ctx.homeCompanyIds,
    companyIds: ctx.companyIds,
    roles: ctx.roles,
  };
}
