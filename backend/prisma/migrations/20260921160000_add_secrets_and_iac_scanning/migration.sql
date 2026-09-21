-- Secrets scanning and IaC/container scanning tool fields, following the existing
-- sast/dast/sca pattern — see POLICY_CONTROL_COVERAGE_PLAN.md Phase 6a.
--
-- Unblocks 4.6.9 (secrets scan on pull requests), 6.3.3 (no hard-coded passwords —
-- the requirement that secrets scanning detects violations of) and 4.6.14
-- (IaC / container scanned prior to deploying as a workload).
--
-- sastIncludesSecrets mirrors the existing sastIncludesSca, for SAST tools that
-- also cover secrets, so a team is not asked to name a second tool they do not have.
--
-- IaC and container share one field rather than two: most tools in this space
-- (Snyk, Trivy, Wiz) cover both, so separate columns would always be set together.
--
-- Additive; all nullable or defaulted, so existing rows are untouched.

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "iacContainerScanIntegrationLevel" INTEGER,
ADD COLUMN     "iacContainerScanTool" TEXT,
ADD COLUMN     "lastIacContainerScanDate" TIMESTAMP(3),
ADD COLUMN     "lastSecretsScanDate" TIMESTAMP(3),
ADD COLUMN     "sastIncludesSecrets" BOOLEAN DEFAULT false,
ADD COLUMN     "secretsScanIntegrationLevel" INTEGER,
ADD COLUMN     "secretsScanTool" TEXT;

