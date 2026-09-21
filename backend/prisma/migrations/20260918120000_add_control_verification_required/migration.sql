-- Adds the "verification_required" evaluation state to policy controls.
--
-- When verificationRequired is true, a control whose field checks all pass resolves to
-- "verification_required" rather than "meeting": the automated checks cover only part of
-- the requirement and a human must confirm the rest. An admin PolicyControlOverride is
-- what promotes it to "meeting".
--
-- Additive only: both columns are nullable or defaulted, so existing rows are unaffected
-- and existing controls keep their current behaviour (verificationRequired = false).

-- AlterTable
ALTER TABLE "PolicyControl" ADD COLUMN     "verificationNote" TEXT,
ADD COLUMN     "verificationRequired" BOOLEAN NOT NULL DEFAULT false;
