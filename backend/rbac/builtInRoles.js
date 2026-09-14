/**
 * Built-in roles.
 *
 * These are seeded (and re-synced) on boot by `syncBuiltInRoles()`. They live
 * in code rather than only in the database so that a permission added to the
 * catalog lands on the right roles everywhere without a data migration.
 *
 * Custom, company-authored roles are the next step: the Role table already
 * carries a nullable `companyId`, so a company can own roles alongside these
 * global ones. Built-in roles have `isSystem: true` and cannot be edited or
 * deleted through the API.
 */
import { COMPANY_PERMISSIONS, PermissionScope } from './permissions.js';

const READ_PERMISSIONS = [
  'company.read',
  'application.read',
  'product.read',
  'domain.read',
  'deployment.read',
  'note.read',
];

const EDIT_PERMISSIONS = [
  ...READ_PERMISSIONS,
  'company.edit',
  'application.create',
  'application.edit',
  'product.create',
  'product.edit',
  'domain.edit',
  'deployment.manage',
  'integration.manage',
  'note.write',
];

export const BUILT_IN_ROLES = [
  {
    key: 'company_read',
    name: 'Company Read',
    description: 'Read-only access to a company and everything under it.',
    scope: PermissionScope.COMPANY,
    permissions: READ_PERMISSIONS,
  },
  {
    key: 'company_edit',
    name: 'Company Edit',
    description:
      'Read access plus the ability to create and edit applications, products, domains and integrations. Cannot delete or manage users.',
    scope: PermissionScope.COMPANY,
    permissions: EDIT_PERMISSIONS,
  },
  {
    key: 'company_member',
    name: 'Company Member (legacy)',
    description:
      'The access every company-scoped user had before roles existed: edit access plus inviting and verifying users in their own company. Existing users were granted this role so nothing changed for them; prefer Company Read/Edit/Admin for new grants.',
    scope: PermissionScope.COMPANY,
    permissions: [...EDIT_PERMISSIONS, 'company.manage_users'],
  },
  {
    key: 'company_admin',
    name: 'Company Admin',
    description:
      'Full control of a company: everything Company Edit can do, plus deleting domains and deployments, removing users, and granting company roles. Deleting applications, approving metadata versions and setting policy overrides remain system-admin actions.',
    scope: PermissionScope.COMPANY,
    // Every company-scoped permission. The catalog only contains delegatable
    // actions (see permissions.js), so this is safe as a blanket grant and
    // picks up permissions added later on the next sync.
    permissions: [...COMPANY_PERMISSIONS],
  },
];

export const BUILT_IN_ROLE_KEYS = Object.freeze(BUILT_IN_ROLES.map((r) => r.key));

/** The role backfilled onto pre-RBAC company users. */
export const LEGACY_MEMBER_ROLE_KEY = 'company_member';

export function builtInRole(key) {
  return BUILT_IN_ROLES.find((r) => r.key === key) ?? null;
}
