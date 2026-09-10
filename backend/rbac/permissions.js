/**
 * Permission catalog.
 *
 * Permissions are plain strings (`resource.action`) so they can be stored on
 * RolePermission rows without a migration every time we add one. This file is
 * the source of truth for which strings are valid and what they mean.
 *
 * Two scopes exist:
 *
 * - COMPANY: the permission only answers a question about a specific company,
 *   e.g. "can this user edit applications belonging to company X?". Checking one
 *   always requires a companyId.
 * - SYSTEM: the permission is global, e.g. "can this user create companies?".
 *   Checking one never takes a companyId.
 *
 * `User.isAdmin` remains the system-wide superuser flag. A system admin
 * implicitly holds every permission in this catalog for every company, so
 * nothing here needs to be granted to them. SYSTEM-scoped permissions exist so
 * that we can later hand out narrow global capabilities (e.g. "manage policies
 * everywhere") without making someone a full admin.
 *
 * THE INVARIANT: this catalog contains only what is *delegatable*. An action
 * that must stay system-admin-only has no permission here at all — its route
 * uses `requireAdmin` instead. That is deliberate: a permission that exists but
 * is withheld from every built-in role could be handed out again later by a
 * custom role, silently widening access. No permission, no way to delegate it.
 *
 * Currently kept out of the catalog on purpose, and gated by `requireAdmin`:
 * deleting an application (and its API schema and threat-model components),
 * approving metadata versions, reading version history, and setting policy
 * control overrides. Deleting a whole company is also admin-only.
 */

export const PermissionScope = {
  SYSTEM: 'SYSTEM',
  COMPANY: 'COMPANY',
};

/**
 * @type {Record<string, { scope: string, label: string, description: string }>}
 */
export const PERMISSIONS = {
  // ---------------------------------------------------------------- company
  'company.read': {
    scope: PermissionScope.COMPANY,
    label: 'View company',
    description: 'View the company profile, scores, portfolio and coverage reports.',
  },
  'company.edit': {
    scope: PermissionScope.COMPANY,
    label: 'Edit company',
    description: 'Edit company profile fields such as tech stack, contacts and environment.',
  },
  'company.manage_users': {
    scope: PermissionScope.COMPANY,
    label: 'Manage company users',
    description: 'Invite users into the company and verify pending members.',
  },
  'company.remove_users': {
    scope: PermissionScope.COMPANY,
    label: 'Remove company users',
    description: 'Remove a user from the company. Separate from inviting and verifying so that ordinary members cannot eject colleagues.',
  },
  'company.manage_roles': {
    scope: PermissionScope.COMPANY,
    label: 'Manage company roles',
    description: 'Grant and revoke company-scoped roles for users in the company.',
  },

  // ------------------------------------------------------------ application
  'application.read': {
    scope: PermissionScope.COMPANY,
    label: 'View applications',
    description: 'View applications, their metadata, threat models and scores.',
  },
  'application.create': {
    scope: PermissionScope.COMPANY,
    label: 'Create applications',
    description: 'Create new applications, including bulk import.',
  },
  'application.edit': {
    scope: PermissionScope.COMPANY,
    label: 'Edit applications',
    description: 'Edit application metadata, threat models, API schemas and domains.',
  },

  // ---------------------------------------------------------------- product
  'product.read': {
    scope: PermissionScope.COMPANY,
    label: 'View products',
    description: 'View products, their applications, ingress points and data flows.',
  },
  'product.create': {
    scope: PermissionScope.COMPANY,
    label: 'Create products',
    description: 'Create new products and component types.',
  },
  'product.edit': {
    scope: PermissionScope.COMPANY,
    label: 'Edit products',
    description: 'Edit products and manage their applications, ingress points and data flows.',
  },
  'product.delete': {
    scope: PermissionScope.COMPANY,
    label: 'Delete products',
    description: 'Delete products and remove their ingress points and data flows.',
  },

  // ----------------------------------------------------------------- domain
  'domain.read': {
    scope: PermissionScope.COMPANY,
    label: 'View domains',
    description: 'View hosting domains, DNS snapshots and change history.',
  },
  'domain.edit': {
    scope: PermissionScope.COMPANY,
    label: 'Edit domains',
    description: 'Add hosting domains and link them to applications.',
  },
  'domain.delete': {
    scope: PermissionScope.COMPANY,
    label: 'Delete domains',
    description: 'Delete hosting domains and unlink them from applications.',
  },

  // ------------------------------------------------------------- deployment
  'deployment.read': {
    scope: PermissionScope.COMPANY,
    label: 'View deployments',
    description: 'View deployments and CI/CD deployment tokens.',
  },
  'deployment.manage': {
    scope: PermissionScope.COMPANY,
    label: 'Manage deployments',
    description: 'Record deployments and issue or revoke deployment tokens.',
  },
  'deployment.delete': {
    scope: PermissionScope.COMPANY,
    label: 'Delete deployments',
    description: 'Delete recorded deployments. Separate from `deployment.manage` so that recording a deployment does not imply erasing one.',
  },

  // ------------------------------------------------------------ integration
  'integration.manage': {
    scope: PermissionScope.COMPANY,
    label: 'Manage integrations',
    description: 'Link the company and its applications to external tools and repos.',
  },

  // ------------------------------------------------------------------- note
  'note.read': {
    scope: PermissionScope.COMPANY,
    label: 'View notes',
    description: 'Read internal notes on the company and its applications.',
  },
  'note.write': {
    scope: PermissionScope.COMPANY,
    label: 'Write notes',
    description: 'Create, edit and delete internal notes.',
  },

  // ----------------------------------------------------------- system scope
  'company.create': {
    scope: PermissionScope.SYSTEM,
    label: 'Create companies',
    description: 'Create new companies anywhere in the system.',
  },
  'user.manage': {
    scope: PermissionScope.SYSTEM,
    label: 'Manage all users',
    description: 'Edit, assign and delete any user regardless of company.',
  },
  'role.manage': {
    scope: PermissionScope.SYSTEM,
    label: 'Manage all roles',
    description: 'Grant and revoke any role, for any user, in any company.',
  },
  'policy.manage': {
    scope: PermissionScope.SYSTEM,
    label: 'Manage policies',
    description: 'Author policies and policy controls that apply across companies.',
  },
  'division.manage': {
    scope: PermissionScope.SYSTEM,
    label: 'Manage divisions',
    description: 'Create, edit and delete divisions and their company assignments.',
  },
};

export const ALL_PERMISSIONS = Object.freeze(Object.keys(PERMISSIONS));

export const COMPANY_PERMISSIONS = Object.freeze(
  ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].scope === PermissionScope.COMPANY)
);

export const SYSTEM_PERMISSIONS = Object.freeze(
  ALL_PERMISSIONS.filter((p) => PERMISSIONS[p].scope === PermissionScope.SYSTEM)
);

export function isValidPermission(permission) {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, permission);
}

export function permissionScope(permission) {
  return PERMISSIONS[permission]?.scope ?? null;
}

export function isCompanyPermission(permission) {
  return permissionScope(permission) === PermissionScope.COMPANY;
}

/**
 * The catalog shaped for the UI: one entry per permission, grouped by the
 * resource prefix so the role editor can render sections.
 */
export function permissionCatalog() {
  const groups = new Map();
  for (const key of ALL_PERMISSIONS) {
    const meta = PERMISSIONS[key];
    const resource = key.split('.')[0];
    if (!groups.has(resource)) groups.set(resource, []);
    groups.get(resource).push({ key, ...meta });
  }
  return [...groups.entries()].map(([resource, permissions]) => ({ resource, permissions }));
}
