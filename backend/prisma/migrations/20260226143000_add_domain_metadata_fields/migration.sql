-- AlterTable
ALTER TABLE "Domain"
ADD COLUMN "description" TEXT,
ADD COLUMN "owner" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN "apexDomain" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill updatedAt for existing rows
UPDATE "Domain"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

-- Enforce not-null after backfill
ALTER TABLE "Domain"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Domain_companyId_apexDomain_idx" ON "Domain"("companyId", "apexDomain");
