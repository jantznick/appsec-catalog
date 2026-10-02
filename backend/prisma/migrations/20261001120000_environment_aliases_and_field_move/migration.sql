-- Environments, phase 3: aliases, one-slot-per-kind, and the field move.
--
-- Four things, in dependency order:
--
--   1. Environment.aliases, so a company whose pipelines disagree with each other
--      ("prod" here, "production" there) does not have to change its tagging schema
--      before the catalog can resolve anything.
--   2. A PARTIAL unique index on (companyId, kind), excluding OTHER. Orbit owns the
--      taxonomy and companies own the words: at most one PRODUCTION / STAGING / QA /
--      DEVELOPMENT per company, unlimited OTHERs. This cardinality is what lets
--      "the company's production environment" be a lookup rather than a tie-break,
--      and is why ApplicationEnvironment has no isPrimary column.
--   3. ApplicationDomain and ApplicationToolLink FKs to the instance become SET NULL.
--      They were CASCADE, which meant deleting an instance deleted the whole join row
--      - unlinking a domain from its APPLICATION, not merely from its environment.
--   4. currentVersion / gitBranch / deploymentEnvironment drop off Application and
--      ApplicationVersion. The first two now live on ApplicationEnvironment; the third
--      is deleted outright, because its only job was recording which environment a row
--      described and that is now the relation.
--
-- lastDastScanDate deliberately does NOT move. See "Deferred: where DAST lives" in
-- ENVIRONMENT_IMPLEMENTATION_PLAN.md.

-- ---------------------------------------------------------------------------
-- 1. Aliases
-- ---------------------------------------------------------------------------
ALTER TABLE "Environment" ADD COLUMN "aliases" TEXT;

-- ---------------------------------------------------------------------------
-- 2. One row per kind per company, except OTHER
--
-- Guard first: the index cannot be created over existing duplicates, and the raw
-- index violation names neither the company nor the kind.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count int;
  dup_detail text;
BEGIN
  SELECT count(*), string_agg(detail, E'\n')
  INTO dup_count, dup_detail
  FROM (
    SELECT "companyId" || ' / ' || kind || ': ' || string_agg(name, ', ') AS detail
    FROM "Environment"
    WHERE kind <> 'OTHER'
    GROUP BY "companyId", kind
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create Environment_companyId_kind_key: % company/kind pair(s) hold more than one environment. Every kind except OTHER is single-slot. Merge or re-kind these before applying:%s',
      dup_count, E'\n' || dup_detail;
  END IF;
END $$;

CREATE UNIQUE INDEX "Environment_companyId_kind_key"
  ON "Environment"("companyId", kind)
  WHERE kind <> 'OTHER';

-- ---------------------------------------------------------------------------
-- 3. Instance FKs: CASCADE -> SET NULL
-- ---------------------------------------------------------------------------
ALTER TABLE "ApplicationDomain" DROP CONSTRAINT "ApplicationDomain_applicationEnvironmentId_fkey";
ALTER TABLE "ApplicationDomain" ADD CONSTRAINT "ApplicationDomain_applicationEnvironmentId_fkey"
  FOREIGN KEY ("applicationEnvironmentId") REFERENCES "ApplicationEnvironment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationToolLink" DROP CONSTRAINT "ApplicationToolLink_applicationEnvironmentId_fkey";
ALTER TABLE "ApplicationToolLink" ADD CONSTRAINT "ApplicationToolLink_applicationEnvironmentId_fkey"
  FOREIGN KEY ("applicationEnvironmentId") REFERENCES "ApplicationEnvironment"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. The field move
--
-- 20260922120000 already copied these onto each application's default instance, but
-- that was some time ago and both deploy write paths have been writing to Application
-- as well as to the instance since. Re-run the copy idempotently so nothing written in
-- the interval is lost, THEN check that every remaining value has somewhere to live,
-- THEN drop.
-- ---------------------------------------------------------------------------

-- 4a. Top up the production instance from the application, without overwriting a value
--     the instance already holds (the instance is the more recent writer of the two).
UPDATE "ApplicationEnvironment" ae
SET
  "currentVersion" = COALESCE(ae."currentVersion", a."currentVersion"),
  "gitBranch"      = COALESCE(ae."gitBranch", a."gitBranch")
FROM "Application" a
JOIN "Environment" e
  ON e."companyId" = a."companyId"
 AND e.kind = 'PRODUCTION'
WHERE ae."applicationId" = a.id
  AND ae."environmentId" = e.id
  AND (a."currentVersion" IS NOT NULL OR a."gitBranch" IS NOT NULL);

-- 4b. Guard: anything still carrying a value with no production instance to hold it
--     would be silently destroyed by the DROP below.
DO $$
DECLARE
  orphan_count int;
  orphan_detail text;
BEGIN
  SELECT count(*), string_agg(detail, E'\n')
  INTO orphan_count, orphan_detail
  FROM (
    SELECT a.id || ' (' || a.name || ')' AS detail
    FROM "Application" a
    WHERE (a."currentVersion" IS NOT NULL OR a."gitBranch" IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM "ApplicationEnvironment" ae
        JOIN "Environment" e ON e.id = ae."environmentId"
        WHERE ae."applicationId" = a.id
          AND e.kind = 'PRODUCTION'
      )
    LIMIT 50
  ) d;

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot drop Application.currentVersion / gitBranch: % application(s) hold a value but have no PRODUCTION environment instance to move it to, so dropping would destroy it. Give them a production instance first (POST /api/applications/:id/environments). Showing up to 50:%s',
      orphan_count, E'\n' || orphan_detail;
  END IF;
END $$;

-- 4c. Drop. deploymentEnvironment needs no rescue: the relation replaced it, and the
--     raw submitted string is still on every Deployment row.
ALTER TABLE "Application"
  DROP COLUMN "currentVersion",
  DROP COLUMN "gitBranch",
  DROP COLUMN "deploymentEnvironment";

ALTER TABLE "ApplicationVersion"
  DROP COLUMN "currentVersion",
  DROP COLUMN "gitBranch",
  DROP COLUMN "deploymentEnvironment";
