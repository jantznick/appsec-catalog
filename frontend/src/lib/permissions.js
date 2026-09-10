/**
 * Client-side mirror of the backend permission check in backend/rbac/context.js.
 *
 * This is for *rendering* only — hiding a button the user can't use. Every
 * action it gates is independently enforced on the server, so a stale or
 * spoofed payload here can't grant anything.
 */

/** Permissions that are global rather than per-company. Mirrors the catalog. */
const SYSTEM_PERMISSIONS = new Set([
  'company.create',
  'user.manage',
  'role.manage',
  'policy.manage',
  'division.manage',
]);

export function isSystemPermission(permission) {
  return SYSTEM_PERMISSIONS.has(permission);
}

/**
 * @param {object|null} permissions payload from /api/auth/me
 * @param {string} permission e.g. 'application.edit'
 * @param {string|null} companyId required for company-scoped permissions
 */
export function checkPermission(permissions, permission, companyId = null) {
  if (!permissions) return false;
  if (permissions.isSystemAdmin) return true;

  if (isSystemPermission(permission)) {
    return (permissions.global ?? []).includes(permission);
  }

  if (!companyId) return false;
  if ((permissions.byCompany?.[companyId] ?? []).includes(permission)) return true;
  return (
    (permissions.homeCompanyIds ?? []).includes(companyId) &&
    (permissions.allCompanies ?? []).includes(permission)
  );
}

/** Every company id where the user holds `permission`. */
export function companiesWithPermission(permissions, permission) {
  if (!permissions) return [];
  const out = new Set();
  if ((permissions.allCompanies ?? []).includes(permission)) {
    for (const id of permissions.homeCompanyIds ?? []) out.add(id);
  }
  for (const [companyId, perms] of Object.entries(permissions.byCompany ?? {})) {
    if (perms.includes(permission)) out.add(companyId);
  }
  return [...out];
}

/**
 * True if the user holds `permission` in at least one company — for gating nav
 * items and other places where no single company is in scope yet.
 */
export function hasPermissionAnywhere(permissions, permission) {
  if (!permissions) return false;
  if (permissions.isSystemAdmin) return true;
  if (isSystemPermission(permission)) return (permissions.global ?? []).includes(permission);
  return companiesWithPermission(permissions, permission).length > 0;
}
