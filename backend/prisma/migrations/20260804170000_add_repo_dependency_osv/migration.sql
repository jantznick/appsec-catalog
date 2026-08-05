-- OSV.dev advisory flagging for repo dependencies.
-- Informational only — Wiz remains the source of truth for vulnerability data.

-- AlterTable
ALTER TABLE "RepoDependency"
    ADD COLUMN "osvScanned" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "osvVulnIds" JSONB,
    ADD COLUMN "osvScannedAt" TIMESTAMP(3);
