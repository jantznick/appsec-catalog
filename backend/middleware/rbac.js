/**
 * Permission-checking middleware.
 *
 *   router.put('/:id',
 *     requireAuth,
 *     requirePermission('application.edit', companyFrom.application('id')),
 *     handler)
 *
 * A COMPANY-scoped permission always needs a company resolver so the check has
 * something to check *against*; a SYSTEM-scoped one must not have any. Getting
 * that wrong throws when the route is defined rather than at request time.
 */
import { prisma } from '../prisma/client.js';
import { getAuthContext } from './authContext.js';
import { getPermissionContext, contextCan } from '../rbac/context.js';
import { PERMISSIONS, isValidPermission, permissionScope, PermissionScope } from '../rbac/permissions.js';

/** Returned by a resolver when the entity the company would come from is gone. */
export const NOT_FOUND = Symbol('rbac:not-found');

function unauthenticated(res) {
  return res.status(401).json({
    error: 'Authentication required',
    message: 'You must be logged in to access this resource',
  });
}

function forbidden(res, permission) {
  const label = PERMISSIONS[permission]?.label ?? permission;
  return res.status(403).json({
    error: 'Permission denied',
    message: `You do not have permission to ${label.toLowerCase()}`,
    requiredPermission: permission,
  });
}

/**
 * Resolve the owning company of a record by id, memoised per request so two
 * checks against the same entity cost one query.
 */
function entityCompanyResolver(model, paramName, label) {
  return async (req) => {
    const id = req.params?.[paramName];
    if (!id) return NOT_FOUND;

    req._rbacEntityCache ??= new Map();
    const cacheKey = `${model}:${id}`;
    if (req._rbacEntityCache.has(cacheKey)) return req._rbacEntityCache.get(cacheKey);

    const row = await prisma[model].findUnique({
      where: { id },
      select: { companyId: true },
    });
    const resolved = row ? row.companyId : NOT_FOUND;
    req._rbacEntityCache.set(cacheKey, resolved);
    if (resolved === NOT_FOUND) req._rbacNotFoundLabel = label;
    return resolved;
  };
}

/**
 * Ways to work out which company a request is about.
 * Each returns `string | null | NOT_FOUND`.
 */
export const companyFrom = {
  /** The company id is the route param itself, e.g. /companies/:id. */
  param:
    (name = 'companyId') =>
    (req) =>
      req.params?.[name] ?? null,
  body:
    (name = 'companyId') =>
    (req) =>
      req.body?.[name] ?? null,
  query:
    (name = 'companyId') =>
    (req) =>
      req.query?.[name] ?? null,
  /** The caller's own company — for "manage my company" style routes. */
  self: () => (req) => getAuthContext(req)?.companyId ?? null,
  /** Body company id if present, otherwise the caller's own company. */
  bodyOrSelf:
    (name = 'companyId') =>
    (req) =>
      req.body?.[name] || getAuthContext(req)?.companyId || null,

  application: (paramName = 'id') => entityCompanyResolver('application', paramName, 'Application'),
  product: (paramName = 'id') => entityCompanyResolver('product', paramName, 'Product'),
  domain: (paramName = 'id') => entityCompanyResolver('domain', paramName, 'Domain'),
  note: (paramName = 'id') => entityCompanyResolver('note', paramName, 'Note'),
  user: (paramName = 'id') => entityCompanyResolver('user', paramName, 'User'),
};

async function resolveCompanyId(req, resolver) {
  if (!resolver) return null;
  return resolver(req);
}

/**
 * Require a single permission.
 *
 * @param {string} permission key from the permission catalog
 * @param {Function} [companyResolver] required for COMPANY-scoped permissions
 */
export function requirePermission(permission, companyResolver) {
  if (!isValidPermission(permission)) {
    throw new Error(`requirePermission: unknown permission "${permission}"`);
  }
  const scope = permissionScope(permission);
  if (scope === PermissionScope.COMPANY && typeof companyResolver !== 'function') {
    throw new Error(
      `requirePermission("${permission}"): company-scoped permissions need a company resolver`
    );
  }
  if (scope === PermissionScope.SYSTEM && companyResolver) {
    throw new Error(
      `requirePermission("${permission}"): system-scoped permissions do not take a company resolver`
    );
  }

  return async function permissionMiddleware(req, res, next) {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId) return unauthenticated(res);

      const companyId = await resolveCompanyId(req, companyResolver);
      if (companyId === NOT_FOUND) {
        const label = req._rbacNotFoundLabel ?? 'Resource';
        return res.status(404).json({
          error: `${label} not found`,
          message: `The requested ${label.toLowerCase()} does not exist`,
        });
      }

      const ctx = await getPermissionContext(req);
      if (!contextCan(ctx, permission, companyId)) return forbidden(res, permission);

      req.rbacCompanyId = companyId;
      return next();
    } catch (error) {
      console.error('requirePermission error', error);
      return res.status(500).json({
        error: 'Authorization check failed',
        message: 'An error occurred while checking your permissions',
      });
    }
  };
}

/**
 * Pass if the caller holds *any* of the given checks.
 * Each check is `[permission]` or `[permission, companyResolver]`.
 */
export function requireAnyPermission(checks) {
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error('requireAnyPermission: at least one check is required');
  }
  for (const [permission] of checks) {
    if (!isValidPermission(permission)) {
      throw new Error(`requireAnyPermission: unknown permission "${permission}"`);
    }
  }

  return async function anyPermissionMiddleware(req, res, next) {
    try {
      const auth = getAuthContext(req);
      if (!auth?.userId) return unauthenticated(res);

      const ctx = await getPermissionContext(req);
      for (const [permission, companyResolver] of checks) {
        const companyId = await resolveCompanyId(req, companyResolver);
        if (companyId === NOT_FOUND) continue;
        if (contextCan(ctx, permission, companyId)) {
          req.rbacCompanyId = companyId;
          return next();
        }
      }
      return forbidden(res, checks[0][0]);
    } catch (error) {
      console.error('requireAnyPermission error', error);
      return res.status(500).json({
        error: 'Authorization check failed',
        message: 'An error occurred while checking your permissions',
      });
    }
  };
}

/**
 * In-handler assertion. Writes the 403 and returns false when denied, so a
 * handler can do:
 *
 *   if (!(await assertPermission(req, res, 'company.edit', companyId))) return;
 */
export async function assertPermission(req, res, permission, companyId = null) {
  const auth = getAuthContext(req);
  if (!auth?.userId) {
    unauthenticated(res);
    return false;
  }
  const ctx = await getPermissionContext(req);
  if (!contextCan(ctx, permission, companyId)) {
    forbidden(res, permission);
    return false;
  }
  return true;
}

export { getPermissionContext, contextCan } from '../rbac/context.js';
export { can, companyScopeFilter, companiesWithPermission } from '../rbac/context.js';
