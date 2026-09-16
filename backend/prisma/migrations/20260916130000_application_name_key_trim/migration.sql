-- Make the application name constraint agree with the application's own definition of
-- a duplicate name.
--
-- 20260916120000_add_environments created Application_companyId_lower_name_key as
-- ("companyId", lower("name")). That is case-insensitive but not whitespace-insensitive,
-- while services/applicationNames.js applicationNameKey() folds with
-- `trim().toLowerCase()`. So "Checkout " and "checkout" are the same name to the bulk
-- importer - which suffixes the second one - but two distinct rows to the database.
--
-- The application's definition is the one users experience, so the index follows it.
--
-- This is a separate migration rather than an edit to the previous one because Prisma
-- refuses to deploy a migration whose checksum changed after it was applied, and whether
-- the previous migration has already been applied is not certain. Applying both in order
-- is correct either way.

-- ---------------------------------------------------------------------------
-- Guard: the tighter rule can collide where the looser one did not, so re-check
-- before swapping the index.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT 1
    FROM "Application"
    GROUP BY "companyId", lower(btrim("name"))
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot tighten Application_companyId_lower_name_key: % collision(s) exist in "Application" once surrounding whitespace is ignored. These are names that differ only by case and/or leading/trailing spaces. Resolve them (merge or rename) before applying this migration.',
      dup_count;
  END IF;
END $$;

-- DropIndex
DROP INDEX IF EXISTS "Application_companyId_lower_name_key";

-- CreateIndex
-- Same name, tighter expression: matches applicationNameKey() in
-- services/applicationNames.js. Keep the two in step.
CREATE UNIQUE INDEX "Application_companyId_lower_name_key" ON "Application"("companyId", lower(btrim("name")));
