-- Role-based access control.
--
-- Adds Role / RolePermission / UserRole, seeds the built-in company roles, and
-- backfills every existing company-scoped user with the legacy "Company
-- Member" role so their access is unchanged by this migration.
--
-- "User"."isAdmin" is untouched: it remains the system-wide superuser flag and
-- implies every permission. These roles are about access *within* a company.
--
-- Deleting applications, approving metadata versions, reading version history
-- and setting policy overrides stay system-admin actions: they have no
-- permission in the catalog at all, so no role can grant them.

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('SYSTEM', 'COMPANY');

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL DEFAULT 'COMPANY',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyId" TEXT,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_companyId_key" ON "Role"("key", "companyId");

-- CreateIndex
CREATE INDEX "Role_scope_idx" ON "Role"("scope");

-- CreateIndex
CREATE INDEX "Role_companyId_idx" ON "Role"("companyId");

-- Postgres treats NULLs as distinct in a composite unique index, so the
-- constraint above does not stop two global roles sharing a key. This partial
-- index covers that case.
CREATE UNIQUE INDEX "Role_key_global_key" ON "Role"("key") WHERE "companyId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permission_key" ON "RolePermission"("roleId", "permission");

-- CreateIndex
CREATE INDEX "RolePermission_permission_idx" ON "RolePermission"("permission");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_companyId_key" ON "UserRole"("userId", "roleId", "companyId");

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId");

-- CreateIndex
CREATE INDEX "UserRole_companyId_idx" ON "UserRole"("companyId");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- Same NULL caveat as Role_key_global_key: one "applies to every company I
-- belong to" grant per (user, role).
CREATE UNIQUE INDEX "UserRole_user_role_global_key" ON "UserRole"("userId", "roleId") WHERE "companyId" IS NULL;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Seed the built-in roles.
--
-- Ids are stable and readable so this seed and rbac/builtInRoles.js agree.
-- The definitions in that module are re-synced on every boot, which is what
-- keeps these rows current as the permission catalog grows.
-- ---------------------------------------------------------------------------
INSERT INTO "Role" ("id", "key", "name", "description", "scope", "isSystem", "companyId", "createdAt", "updatedAt")
VALUES
  ('role_company_read', 'company_read', 'Company Read',
   'Read-only access to a company and everything under it.',
   'COMPANY', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_company_edit', 'company_edit', 'Company Edit',
   'Read access plus the ability to create and edit applications, products, domains and integrations. Cannot delete or manage users.',
   'COMPANY', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_company_member', 'company_member', 'Company Member (legacy)',
   'The access every company-scoped user had before roles existed: edit access plus inviting and verifying users in their own company. Existing users were granted this role so nothing changed for them; prefer Company Read/Edit/Admin for new grants.',
   'COMPANY', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('role_company_admin', 'company_admin', 'Company Admin',
   'Full control of a company: everything Company Edit can do, plus deletes, user management and granting company roles.',
   'COMPANY', true, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "RolePermission" ("id", "roleId", "permission", "createdAt")
SELECT 'rp_' || md5(v."roleId" || ':' || v."permission"), v."roleId", v."permission", CURRENT_TIMESTAMP
FROM (VALUES
  -- Company Read
  ('role_company_read', 'company.read'),
  ('role_company_read', 'application.read'),
  ('role_company_read', 'product.read'),
  ('role_company_read', 'domain.read'),
  ('role_company_read', 'deployment.read'),
  ('role_company_read', 'note.read'),
  -- Company Edit
  ('role_company_edit', 'company.read'),
  ('role_company_edit', 'application.read'),
  ('role_company_edit', 'product.read'),
  ('role_company_edit', 'domain.read'),
  ('role_company_edit', 'deployment.read'),
  ('role_company_edit', 'note.read'),
  ('role_company_edit', 'company.edit'),
  ('role_company_edit', 'application.create'),
  ('role_company_edit', 'application.edit'),
  ('role_company_edit', 'product.create'),
  ('role_company_edit', 'product.edit'),
  ('role_company_edit', 'domain.edit'),
  ('role_company_edit', 'deployment.manage'),
  ('role_company_edit', 'integration.manage'),
  ('role_company_edit', 'note.write'),
  -- Company Member (legacy) = Company Edit + user management
  ('role_company_member', 'company.read'),
  ('role_company_member', 'application.read'),
  ('role_company_member', 'product.read'),
  ('role_company_member', 'domain.read'),
  ('role_company_member', 'deployment.read'),
  ('role_company_member', 'note.read'),
  ('role_company_member', 'company.edit'),
  ('role_company_member', 'application.create'),
  ('role_company_member', 'application.edit'),
  ('role_company_member', 'product.create'),
  ('role_company_member', 'product.edit'),
  ('role_company_member', 'domain.edit'),
  ('role_company_member', 'deployment.manage'),
  ('role_company_member', 'integration.manage'),
  ('role_company_member', 'note.write'),
  ('role_company_member', 'company.manage_users'),
  -- Company Admin = every company-scoped permission in the catalog
  ('role_company_admin', 'company.read'),
  ('role_company_admin', 'company.edit'),
  ('role_company_admin', 'company.manage_users'),
  ('role_company_admin', 'company.remove_users'),
  ('role_company_admin', 'company.manage_roles'),
  ('role_company_admin', 'application.read'),
  ('role_company_admin', 'application.create'),
  ('role_company_admin', 'application.edit'),
  ('role_company_admin', 'product.read'),
  ('role_company_admin', 'product.create'),
  ('role_company_admin', 'product.edit'),
  ('role_company_admin', 'product.delete'),
  ('role_company_admin', 'domain.read'),
  ('role_company_admin', 'domain.edit'),
  ('role_company_admin', 'domain.delete'),
  ('role_company_admin', 'deployment.read'),
  ('role_company_admin', 'deployment.manage'),
  ('role_company_admin', 'deployment.delete'),
  ('role_company_admin', 'integration.manage'),
  ('role_company_admin', 'note.read'),
  ('role_company_admin', 'note.write')
) AS v("roleId", "permission");

-- ---------------------------------------------------------------------------
-- Backfill: every existing user attached to a company keeps exactly the access
-- they had before roles existed. companyId is NULL on the grant, meaning "in
-- every company this user belongs to", which today is their one company.
--
-- System admins are skipped: isAdmin already implies everything.
-- ---------------------------------------------------------------------------
INSERT INTO "UserRole" ("id", "userId", "roleId", "companyId", "grantedById", "createdAt")
SELECT 'ur_' || md5(u."id" || ':role_company_member'), u."id", 'role_company_member', NULL, NULL, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."companyId" IS NOT NULL
  AND u."isAdmin" = false;
