-- Adds the Phase 6a secrets and IaC/container columns to ApplicationVersion.
--
-- FIXES A SILENT FAILURE INTRODUCED BY 20260921160000.
--
-- Those seven fields were added to the metadata registry as versioned:true, but not to
-- ApplicationVersion. createApplicationVersion spreads pickVersionedMetadata() straight
-- into prisma.applicationVersion.create, so every snapshot create began throwing on
-- unknown columns — and that call is wrapped in a try/catch that logs and returns null
-- on purpose, because "versioning is supplementary, don't fail the main operation".
--
-- The result was invisible: no error surfaced to any caller, no snapshot was written,
-- and the pending-approval queue simply had nothing in it. Version history stopped
-- recording and nothing said so.
--
-- services/applicationVersionColumns.test.js now asserts the registry's versioned list
-- and ApplicationVersion agree in both directions.
--
-- Additive and nullable, matching the existing snapshot columns, which carry no
-- defaults because a snapshot records what a field held rather than a fallback.

-- AlterTable
ALTER TABLE "ApplicationVersion" ADD COLUMN     "iacContainerScanIntegrationLevel" INTEGER,
ADD COLUMN     "iacContainerScanTool" TEXT,
ADD COLUMN     "lastIacContainerScanDate" TIMESTAMP(3),
ADD COLUMN     "lastSecretsScanDate" TIMESTAMP(3),
ADD COLUMN     "sastIncludesSecrets" BOOLEAN,
ADD COLUMN     "secretsScanIntegrationLevel" INTEGER,
ADD COLUMN     "secretsScanTool" TEXT;

