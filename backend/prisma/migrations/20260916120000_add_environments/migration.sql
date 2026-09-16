-- Deployment environments as first-class entities.
--
-- Adds Environment (a company's environment vocabulary) and ApplicationEnvironment
-- (one running instance of an application), attaches deployments, domains and tool
-- links to them, and backfills every existing row so nothing in the UI goes blank.
--
-- This migration only ADDS. The four fields that eventually move off "Application"
-- (currentVersion, gitBranch, deploymentEnvironment, lastDastScanDate) are COPIED
-- onto the instance row here and dropped in a later migration, once the shared
-- metadata field registry no longer references them. Until then both copies exist
-- and "Application" stays the read path.
--
-- lastSastScanDate and lastScaScanDate deliberately stay on "Application": a SAST
-- result describes a commit and an SCA result describes a dependency manifest, so
-- neither is a property of a deployment.
--
-- "Application"."serverEnvironment" is NOT used to seed environment names. Despite
-- the name it holds a hosting model ("cloud", "on-premises", "hybrid") collected by
-- the manager onboarding form, and seeding from it would invent environments called
-- "hybrid".

-- ---------------------------------------------------------------------------
-- Guard: the case-insensitive unique index below cannot be created if company
-- name collisions exist. Fail with something readable instead of a raw index
-- violation, since resolving duplicates is a data decision (merge vs rename).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT 1
    FROM "Application"
    GROUP BY "companyId", lower("name")
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create Application_companyId_lower_name_key: % case-insensitive company/name collision(s) exist in "Application". Resolve them (merge or rename) before applying this migration.',
      dup_count;
  END IF;
END $$;

-- CreateTable
CREATE TABLE "Environment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Environment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationEnvironment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currentVersion" TEXT,
    "gitBranch" TEXT,
    "lastDastScanDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationEnvironment_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN "environmentId" TEXT;

-- AlterTable
ALTER TABLE "ApplicationDomain" ADD COLUMN "applicationEnvironmentId" TEXT;

-- AlterTable
ALTER TABLE "ApplicationToolLink" ADD COLUMN "applicationEnvironmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Environment_companyId_name_key" ON "Environment"("companyId", "name");
CREATE INDEX "Environment_companyId_idx" ON "Environment"("companyId");
CREATE INDEX "Environment_companyId_kind_idx" ON "Environment"("companyId", "kind");
CREATE INDEX "Environment_status_idx" ON "Environment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEnvironment_applicationId_environmentId_key" ON "ApplicationEnvironment"("applicationId", "environmentId");
CREATE INDEX "ApplicationEnvironment_applicationId_idx" ON "ApplicationEnvironment"("applicationId");
CREATE INDEX "ApplicationEnvironment_environmentId_idx" ON "ApplicationEnvironment"("environmentId");
CREATE INDEX "ApplicationEnvironment_status_idx" ON "ApplicationEnvironment"("status");

-- CreateIndex
CREATE INDEX "Deployment_environmentId_idx" ON "Deployment"("environmentId");
CREATE INDEX "ApplicationDomain_applicationEnvironmentId_idx" ON "ApplicationDomain"("applicationEnvironmentId");
CREATE INDEX "ApplicationToolLink_applicationEnvironmentId_idx" ON "ApplicationToolLink"("applicationEnvironmentId");

-- CreateIndex
-- "Application" had no indexes at all before this, not even on companyId.
CREATE INDEX "Application_companyId_idx" ON "Application"("companyId");

-- CreateIndex
-- Application name is unique within a company, case-insensitively. This is a
-- functional index because Prisma cannot express lower(name) in @@unique, and a
-- case-SENSITIVE constraint would disagree with the split endpoint and the
-- interface resolver, which both match names with mode: 'insensitive'.
CREATE UNIQUE INDEX "Application_companyId_lower_name_key" ON "Application"("companyId", lower("name"));

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationEnvironment" ADD CONSTRAINT "ApplicationEnvironment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- RESTRICT: deleting a vocabulary row that instances still reference should fail
-- loudly rather than quietly take deploy history with it.
ALTER TABLE "ApplicationEnvironment" ADD CONSTRAINT "ApplicationEnvironment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDomain" ADD CONSTRAINT "ApplicationDomain_applicationEnvironmentId_fkey" FOREIGN KEY ("applicationEnvironmentId") REFERENCES "ApplicationEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationToolLink" ADD CONSTRAINT "ApplicationToolLink_applicationEnvironmentId_fkey" FOREIGN KEY ("applicationEnvironmentId") REFERENCES "ApplicationEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill
--
-- Ids are deterministic (prefix + md5 of the natural key), following the
-- convention in 20260909120000_add_rbac_roles, so every step below is idempotent
-- and safe to re-run.
-- ---------------------------------------------------------------------------

-- 1) Seed each company's vocabulary from the environment strings that already
--    exist: deployment history and Application.deploymentEnvironment. Names are
--    stored lower-cased so "Prod" and "prod" collapse into one row; the original
--    spelling is kept in sourceLabel.
WITH raw AS (
  SELECT a."companyId" AS company_id, btrim(d."environment") AS label
  FROM "Deployment" d
  JOIN "Application" a ON a."id" = d."applicationId"
  WHERE d."environment" IS NOT NULL AND btrim(d."environment") <> ''
  UNION ALL
  SELECT a."companyId", btrim(a."deploymentEnvironment")
  FROM "Application" a
  WHERE a."deploymentEnvironment" IS NOT NULL AND btrim(a."deploymentEnvironment") <> ''
),
norm AS (
  SELECT company_id, lower(label) AS env_name, min(label) AS source_label
  FROM raw
  GROUP BY company_id, lower(label)
)
INSERT INTO "Environment" ("id", "companyId", "name", "kind", "status", "displayOrder", "sourceLabel", "createdAt", "updatedAt")
SELECT
  'env_' || md5(company_id || ':' || env_name),
  company_id,
  env_name,
  CASE
    WHEN env_name IN ('prod', 'production', 'prd', 'live') THEN 'PRODUCTION'
    WHEN env_name IN ('stage', 'staging', 'stg', 'preprod', 'pre-prod') THEN 'STAGING'
    WHEN env_name IN ('dev', 'development', 'develop') THEN 'DEVELOPMENT'
    WHEN env_name IN ('qa', 'test', 'testing', 'uat') THEN 'QA'
    ELSE 'OTHER'
  END,
  'active',
  0,
  source_label,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM norm
ON CONFLICT ("companyId", "name") DO NOTHING;

-- 2) Any company with applications but no environment string anywhere gets a
--    production environment, so every application can be given an instance below.
INSERT INTO "Environment" ("id", "companyId", "name", "kind", "status", "displayOrder", "sourceLabel", "createdAt", "updatedAt")
SELECT
  'env_' || md5(c."id" || ':production'),
  c."id",
  'production',
  'PRODUCTION',
  'active',
  0,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
WHERE EXISTS (SELECT 1 FROM "Application" a WHERE a."companyId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Environment" e WHERE e."companyId" = c."id")
ON CONFLICT ("companyId", "name") DO NOTHING;

-- 3) An instance for every (application, environment) pair that deployment history
--    already proves existed.
INSERT INTO "ApplicationEnvironment" ("id", "applicationId", "environmentId", "status", "createdAt", "updatedAt")
SELECT DISTINCT
  'appenv_' || md5(d."applicationId" || ':' || e."id"),
  d."applicationId",
  e."id",
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Deployment" d
JOIN "Application" a ON a."id" = d."applicationId"
JOIN "Environment" e ON e."companyId" = a."companyId" AND e."name" = lower(btrim(d."environment"))
ON CONFLICT ("applicationId", "environmentId") DO NOTHING;

-- 4) An instance for whatever Application.deploymentEnvironment claims, which may
--    name an environment the application has never actually deployed to.
INSERT INTO "ApplicationEnvironment" ("id", "applicationId", "environmentId", "status", "createdAt", "updatedAt")
SELECT
  'appenv_' || md5(a."id" || ':' || e."id"),
  a."id",
  e."id",
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Application" a
JOIN "Environment" e ON e."companyId" = a."companyId" AND e."name" = lower(btrim(a."deploymentEnvironment"))
WHERE a."deploymentEnvironment" IS NOT NULL AND btrim(a."deploymentEnvironment") <> ''
ON CONFLICT ("applicationId", "environmentId") DO NOTHING;

-- 5) Every remaining application gets one instance, preferring its company's
--    production environment. Decision: every application has at least one
--    environment; the UI hides the selector until there are two.
INSERT INTO "ApplicationEnvironment" ("id", "applicationId", "environmentId", "status", "createdAt", "updatedAt")
SELECT
  'appenv_' || md5(a."id" || ':' || e.env_id),
  a."id",
  e.env_id,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Application" a
JOIN LATERAL (
  SELECT e2."id" AS env_id
  FROM "Environment" e2
  WHERE e2."companyId" = a."companyId"
  ORDER BY (e2."kind" = 'PRODUCTION') DESC, e2."name"
  LIMIT 1
) e ON TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM "ApplicationEnvironment" ae WHERE ae."applicationId" = a."id"
)
ON CONFLICT ("applicationId", "environmentId") DO NOTHING;

-- 6) Copy the per-instance fields onto each application's primary instance: the one
--    matching deploymentEnvironment, else a production one, else the first by name.
WITH primary_env AS (
  SELECT DISTINCT ON (ae."applicationId")
    ae."id" AS app_env_id,
    ae."applicationId" AS application_id
  FROM "ApplicationEnvironment" ae
  JOIN "Environment" e ON e."id" = ae."environmentId"
  JOIN "Application" a ON a."id" = ae."applicationId"
  ORDER BY
    ae."applicationId",
    (e."name" = lower(btrim(COALESCE(a."deploymentEnvironment", '')))) DESC,
    (e."kind" = 'PRODUCTION') DESC,
    e."name"
)
UPDATE "ApplicationEnvironment" ae
SET
  "currentVersion" = a."currentVersion",
  "gitBranch" = a."gitBranch",
  "lastDastScanDate" = a."lastDastScanDate",
  "updatedAt" = CURRENT_TIMESTAMP
FROM primary_env p
JOIN "Application" a ON a."id" = p.application_id
WHERE ae."id" = p.app_env_id;

-- 7) Attach existing deployments to their environment. Rows whose string matches
--    nothing stay null and surface as "Unassigned".
UPDATE "Deployment" d
SET "environmentId" = e."id"
FROM "Application" a, "Environment" e
WHERE a."id" = d."applicationId"
  AND e."companyId" = a."companyId"
  AND e."name" = lower(btrim(d."environment"))
  AND d."environmentId" IS NULL;

-- 8) Re-home existing application/domain associations onto the primary instance, so
--    no domain loses its application link during the transition.
WITH primary_env AS (
  SELECT DISTINCT ON (ae."applicationId")
    ae."id" AS app_env_id,
    ae."applicationId" AS application_id
  FROM "ApplicationEnvironment" ae
  JOIN "Environment" e ON e."id" = ae."environmentId"
  JOIN "Application" a ON a."id" = ae."applicationId"
  ORDER BY
    ae."applicationId",
    (e."name" = lower(btrim(COALESCE(a."deploymentEnvironment", '')))) DESC,
    (e."kind" = 'PRODUCTION') DESC,
    e."name"
)
UPDATE "ApplicationDomain" ad
SET "applicationEnvironmentId" = p.app_env_id
FROM primary_env p
WHERE ad."applicationId" = p.application_id
  AND ad."applicationEnvironmentId" IS NULL;
