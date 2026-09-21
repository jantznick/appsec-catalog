-- Stores pull-request template detection for the linked repo, read during repo sync.
-- Evidence for 4.6.7 ("All pull requests shall include a security-impact review
-- checklist and document the findings/responses") — see
-- POLICY_CONTROL_COVERAGE_PLAN.md Phase 5b.
--
-- What this evidences, precisely: the repo has a PR template and that template asks
-- about security. It does NOT evidence that any pull request was completed against
-- it. Reading merged PR bodies is a separate control.
--
-- Table is "GitHubRepo" on disk; the Prisma model is ScmRepo (@@map).
--
-- Nullable for the same reason as the branch-protection columns: NULL means "not read
-- yet", which is not the same as prTemplateFound = false ("looked, and there is no
-- template"). A control must distinguish absent evidence from absent controls.

-- AlterTable
ALTER TABLE "GitHubRepo" ADD COLUMN     "prTemplateError" TEXT,
ADD COLUMN     "prTemplateFound" BOOLEAN,
ADD COLUMN     "prTemplateHasSecuritySection" BOOLEAN,
ADD COLUMN     "prTemplatePath" TEXT,
ADD COLUMN     "prTemplateSecurityHeading" TEXT,
ADD COLUMN     "prTemplateSyncedAt" TIMESTAMP(3);
