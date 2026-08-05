-- Enriched OSV advisory details for friendly display (severity, summary, CVE) alongside the raw IDs.

-- AlterTable
ALTER TABLE "RepoDependency" ADD COLUMN "osvVulns" JSONB;
