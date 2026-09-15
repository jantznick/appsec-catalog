# Role-Based Access Control

Authorization is permission-based. A route asks "does this caller hold
`application.edit` in company X?" rather than "is this caller an admin?".

## The pieces

| Piece | Where | What it is |
| --- | --- | --- |
| Permission catalog | `backend/rbac/permissions.js` | Every valid permission string, its scope and a human label. Source of truth. |
| Built-in roles | `backend/rbac/builtInRoles.js` | Named bundles of permissions, re-synced into the DB on boot. |
| Resolver | `backend/rbac/context.js` | Turns a session or API key into an effective permission set; answers `can()`. |
| Middleware | `backend/middleware/rbac.js` | `requirePermission`, `companyFrom`, `assertPermission`. |
| Role management API | `backend/routes/roles.js` | List roles, grant and revoke assignments. |
| Frontend mirror | `frontend/src/lib/permissions.js` | Same check, for hiding controls the user can't use. |

## Scopes

Permissions come in two scopes:

- **COMPANY** — answers a question about one company (`application.edit`).
  Checking one always needs a company id.
- **SYSTEM** — global (`company.create`, `role.manage`). Never takes a company id.

## `isAdmin` is unchanged

`User.isAdmin` is still the system-wide superuser flag, and the resolver treats
it as holding every permission in every company. It is *not* the same thing as
the `company_admin` role, which is full control of one company. Nothing about
the existing admin flag, its routes, or the frontend `isAdmin()` checks changed.

SYSTEM-scoped permissions exist so that narrow global capabilities can be handed
out later ("manage policies everywhere") without making someone a full admin.
No system-scoped roles are seeded today.

**The catalog contains only what is delegatable.** An action that must stay
system-admin-only has no permission in `permissions.js` at all — its route uses
`requireAdmin`. A permission that exists but is withheld from every built-in
role could be handed out again by a custom role later; no permission means no
way to delegate it, ever. Currently kept out on purpose:

- Deleting an application, its API schema, or its threat-model components
- Approving metadata versions and reading version history
- Setting policy control overrides
- Deleting a whole company
- Company name, email domains and division; moving an application between
  companies; creating a company; assigning a user to one; `users PUT|DELETE /:id`

## Built-in roles

| Role | What it can do |
| --- | --- |
| `company_read` | Read the company, its applications, products, domains, deployments and notes. |
| `company_edit` | Company Read, plus creating and editing applications, products, domains, deployments and integrations. No deletes, no user management. |
| `company_member` | The pre-RBAC default: Company Edit plus inviting and verifying users in the company. Every existing company user was backfilled with this so nothing changed for them. Prefer Read/Edit/Admin for new grants. |
| `company_admin` | Every permission in the catalog: deleting domains and deployments, removing users from the company, and granting company roles. Application deletes, approvals, version history and policy overrides are *not* included — those stay system-admin. |

Deletes are deliberately split from their `manage`/`edit` counterparts —
`deployment.delete` is separate from `deployment.manage`, and
`company.remove_users` from `company.manage_users` — so that a role which can
record a deployment or invite a colleague cannot also erase one. Only
`company_admin` holds the delete halves, which keeps "only admins delete
things" true for everyone carrying the legacy role.

Net effect on the day this ships: nothing changes for anyone. Every existing
company user holds `company_member`, which grants exactly their pre-RBAC access,
and no one holds `company_admin` until it is granted.

Built-in roles are `isSystem = true` and cannot be edited or deleted through the
API. `syncBuiltInRoles()` runs on boot and reconciles their permission rows with
`builtInRoles.js`, so adding a permission to a role is a code change plus a
deploy — no data migration.

## Assignments

A `UserRole` row is (user, role, companyId?).

- `companyId` set → the role applies in that company only.
- `companyId` null → the role applies in **every company the user belongs to**.

Users have a single company today (`User.companyId`), so the two forms behave
the same. The distinction is what makes "company admin of Acme only" work once
users can belong to several companies; the resolver already handles both.

## Who can grant roles

- System admins and holders of `role.manage` — any role, any company,
  including the all-companies form.
- Holders of `company.manage_roles` in a company — company-scoped roles, in
  that company, to users who belong to it. Never the all-companies form.

A grant is refused if the role carries a permission the granter does not hold in
that company, so the endpoint can't be used to climb.

## Using it in a route

```js
import { requirePermission, companyFrom, can, companyScopeFilter } from '../middleware/rbac.js';

// Company comes from a route param
router.get('/:id', requireAuth, requirePermission('company.read', companyFrom.param('id')), handler);

// Company comes from the record being touched (one memoised lookup per request)
router.put('/:id', requireAuth, requirePermission('application.edit', companyFrom.application('id')), handler);

// Inside a handler, when the company isn't known until you've loaded something
if (!(await can(req, 'application.read', application.companyId))) { /* 403 */ }

// List endpoints: a Prisma `where` fragment for everything the caller can see.
// null means "nothing" — return an empty list rather than querying.
const scope = await companyScopeFilter(req, 'application.read');
if (!scope) return res.json([]);
```

`requirePermission` throws at route-definition time if a COMPANY-scoped
permission is missing its company resolver, or a SYSTEM-scoped one is given one.

## Frontend

`/api/auth/me` returns a `permissions` payload alongside `user`. The auth store
exposes:

```js
const { can, canAnywhere, companiesWith, isAdmin } = useAuthStore();

can('application.delete', app.companyId)   // one company
canAnywhere('company.manage_roles')        // any company — for nav/menu gating
companiesWith('company.manage_roles')      // the list
isAdmin()                                  // system superuser, unchanged
```

These are for rendering only. Every gated action is independently enforced
server-side.

## API keys

An API key pinned to a company (`ApiToken.companyId`) narrows the resolved
context to that company, and `adminAccessDisabled` already strips `isAdmin` in
`apiKeyAuth`. Roles are resolved from the owning user either way.

## Caching

Assignments are cached per user for 30s in-process. Grants and revokes call
`invalidatePermissionCache(userId)`, so the TTL only bounds changes made out of
band (another instance, direct SQL).

## Migrating a route

0. Decide whether the action is delegatable at all. If it must stay
   system-admin-only, leave it on `requireAdmin` and add no permission.
1. Pick or add a permission in `permissions.js`.
2. Add it to the built-in roles that should have it in `builtInRoles.js`.
3. Replace `requireAdmin` with `requirePermission(...)`, or an inline
   `auth.isAdmin && auth.companyId === x` check with `await can(req, ...)`.
4. Replace list filtering with `companyScopeFilter`.
5. Gate the matching UI control with `can(...)` from the auth store.

Routes not yet migrated still work: `requireAuth`, `requireVerified` and
`requireAdmin` are unchanged.

## Not done yet

- Custom, company-authored roles. `Role.companyId` and `RoleScope.SYSTEM` are in
  the schema for this; there is no API to create them.
- Multi-company membership. The assignment model supports it; `User.companyId`
  is still one company.
- Most routes outside companies / applications / users still gate on
  `requireAdmin`. The `note.*` and `policy.manage` permissions are in the
  catalog but their routes are still admin-only — more restrictive than the
  catalog implies, never less.
