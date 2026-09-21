-- Stores normalised branch protection for the linked repo's default branch, read
-- during repo sync. Evidence for 4.6.3 (segregation of duties) and 6.3.12
-- (pre-release code review) — see POLICY_CONTROL_COVERAGE_PLAN.md Phase 5a.
--
-- Table is "GitHubRepo" on disk; the Prisma model is ScmRepo (@@map), kept from
-- an earlier rename so the migration stayed a no-op.
--
-- Every column is nullable on purpose. NULL means "not read yet", which is NOT the
-- same as false ("read, and the protection is absent"). A control has to be able to
-- tell those apart, or an application fails for evidence we never fetched — the
-- provider layer preserves the same distinction via branchProtectionError.
--
-- Additive: existing rows get NULL and stay unevaluated until their next sync.

-- AlterTable
ALTER TABLE "GitHubRepo" ADD COLUMN     "allowsForcePushes" BOOLEAN,
ADD COLUMN     "branchProtectionEnabled" BOOLEAN,
ADD COLUMN     "branchProtectionError" TEXT,
ADD COLUMN     "branchProtectionSyncedAt" TIMESTAMP(3),
ADD COLUMN     "dismissStaleReviews" BOOLEAN,
ADD COLUMN     "enforcedForAdmins" BOOLEAN,
ADD COLUMN     "protectedBranch" TEXT,
ADD COLUMN     "requireCodeOwnerReviews" BOOLEAN,
ADD COLUMN     "requiredApprovingReviewCount" INTEGER,
ADD COLUMN     "requiresStatusChecks" BOOLEAN;
