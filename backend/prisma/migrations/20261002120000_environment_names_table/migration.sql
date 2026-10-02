-- Environment names become rows, and the canonical name comes from the kind.
--
-- WHY
--
-- `Environment.aliases` was a comma-packed string. A database cannot index into
-- that, so @@unique on it would only have stopped two rows holding the identical
-- whole string - "prod" could belong to two environments and nothing would
-- complain. Uniqueness was therefore a hand-written check in routes, and any writer
-- that forgot to call it punched straight through to a value that resolved two
-- different ways on two different days.
--
-- One row per value makes @@unique([companyId, value]) a real constraint. The
-- CANONICAL name goes in the same table, which closes the last gap: with names in
-- one column and aliases in another, nothing stopped one environment's name
-- equalling another's alias, because those were two constraints over two columns.
-- Now one index covers the whole match space.
--
-- Resolution also gets cheaper: one indexed lookup on (companyId, value) instead of
-- fetching all of a company's environments and comparing in JS.
--
-- AND the canonical name now comes from the kind for the four named kinds, so every
-- company's production environment is called "production" however its pipelines
-- spell it. Whatever a row was called before is preserved as an alias, so nothing
-- stops resolving. OTHER keeps its typed name - it is the only thing telling a
-- sandbox from a demo.

-- ---------------------------------------------------------------------------
-- 0. Pre-flight: would moving the canonical names collide?
--
-- Step 2d renames every non-OTHER environment to its kind's word, and
-- Environment_companyId_name_key is still in force at that point. A company with a
-- PRODUCTION row called "prod" AND an OTHER called "production" would hit that
-- index mid-migration, which reports a duplicate key and nothing else useful.
-- Check it up front, where the message can say which company and which rows.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  clash_count int;
  clash_detail text;
BEGIN
  SELECT count(*), string_agg(detail, E'\n')
  INTO clash_count, clash_detail
  FROM (
    SELECT
      e."companyId" || ': "' || o."name" || '" (' || o."kind" || ') blocks "'
        || e."name" || '" (' || e."kind" || ') from becoming "' || lower(e."kind") || '"' AS detail
    FROM "Environment" e
    JOIN "Environment" o
      ON o."companyId" = e."companyId"
     AND o."id" <> e."id"
     AND o."name" = lower(e."kind")
    WHERE e."kind" <> 'OTHER'
      AND e."name" <> lower(e."kind")
  ) d;

  IF clash_count > 0 THEN
    RAISE EXCEPTION
      'Cannot move canonical environment names onto their kinds: % collision(s). The canonical name for each of PRODUCTION / STAGING / QA / DEVELOPMENT is now the lower-cased kind, and another environment in the same company already holds that name. Rename the blocking row first:%s',
      clash_count, E'\n' || clash_detail;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1. The table
-- ---------------------------------------------------------------------------
CREATE TABLE "EnvironmentName" (
  "id"            TEXT NOT NULL,
  "companyId"     TEXT NOT NULL,
  "environmentId" TEXT NOT NULL,
  "value"         TEXT NOT NULL,
  "isCanonical"   BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EnvironmentName_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EnvironmentName" ADD CONSTRAINT "EnvironmentName_environmentId_fkey"
  FOREIGN KEY ("environmentId") REFERENCES "Environment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "EnvironmentName_environmentId_idx" ON "EnvironmentName"("environmentId");
CREATE INDEX "EnvironmentName_companyId_idx" ON "EnvironmentName"("companyId");

-- ---------------------------------------------------------------------------
-- 2. Move the canonical name to the kind's word, keeping the old one as an alias
--
-- Done before the unique index exists, because this is the step most likely to
-- create a collision: two of a company's OTHER environments could already be named
-- "production", or a company could have both "prod" (PRODUCTION) and an OTHER
-- called "production".
-- ---------------------------------------------------------------------------

-- 2a. Canonical rows. For the four named kinds that is the lower-cased kind; OTHER
--     keeps whatever it was called.
INSERT INTO "EnvironmentName" ("id", "companyId", "environmentId", "value", "isCanonical")
SELECT
  gen_random_uuid()::text,
  e."companyId",
  e."id",
  CASE WHEN e."kind" = 'OTHER' THEN e."name" ELSE lower(e."kind") END,
  true
FROM "Environment" e;

-- 2b. The previous name, where the canonical one just changed under it. Without this
--     every pipeline sending the old string would start arriving as Unassigned.
INSERT INTO "EnvironmentName" ("id", "companyId", "environmentId", "value", "isCanonical")
SELECT
  gen_random_uuid()::text,
  e."companyId",
  e."id",
  e."name",
  false
FROM "Environment" e
WHERE e."kind" <> 'OTHER'
  AND e."name" <> lower(e."kind");

-- 2c. The comma-packed aliases, split out. Trimmed, lower-cased and de-duplicated
--     against what is already there.
INSERT INTO "EnvironmentName" ("id", "companyId", "environmentId", "value", "isCanonical")
SELECT DISTINCT ON (e."companyId", v.value)
  gen_random_uuid()::text,
  e."companyId",
  e."id",
  v.value,
  false
FROM "Environment" e
CROSS JOIN LATERAL (
  SELECT lower(btrim(part)) AS value
  FROM unnest(string_to_array(COALESCE(e."aliases", ''), ',')) AS part
) v
WHERE v.value <> ''
  AND NOT EXISTS (
    SELECT 1 FROM "EnvironmentName" n
    WHERE n."companyId" = e."companyId" AND n."value" = v.value
  );

-- 2d. Point Environment.name at the canonical row.
UPDATE "Environment" e
SET "name" = CASE WHEN e."kind" = 'OTHER' THEN e."name" ELSE lower(e."kind") END;

-- ---------------------------------------------------------------------------
-- 3. The constraint this whole change exists for
--
-- Guard first: a raw index violation names neither the string nor the two
-- environments fighting over it.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count int;
  dup_detail text;
BEGIN
  SELECT count(*), string_agg(detail, E'\n')
  INTO dup_count, dup_detail
  FROM (
    SELECT n."companyId" || ' / "' || n."value" || '" claimed by ' || count(*) || ' environments' AS detail
    FROM "EnvironmentName" n
    GROUP BY n."companyId", n."value"
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot create EnvironmentName_companyId_value_key: % string(s) resolve to more than one environment. Every name and alias must be unique within a company. Resolve these before applying:%s',
      dup_count, E'\n' || dup_detail;
  END IF;
END $$;

CREATE UNIQUE INDEX "EnvironmentName_companyId_value_key" ON "EnvironmentName"("companyId", "value");

-- ---------------------------------------------------------------------------
-- 4. The column the table replaces
-- ---------------------------------------------------------------------------
ALTER TABLE "Environment" DROP COLUMN "aliases";
