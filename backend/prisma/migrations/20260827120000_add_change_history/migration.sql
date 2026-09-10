-- AlterTable: last-editor pointer for resources without dedicated versioning
ALTER TABLE "Product"
ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Domain"
ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Policy"
ADD COLUMN "updatedById" TEXT;

ALTER TABLE "PolicyControl"
ADD COLUMN "updatedById" TEXT;

ALTER TABLE "SammAssessment"
ADD COLUMN "updatedById" TEXT;

ALTER TABLE "Note"
ADD COLUMN "updatedBy" TEXT;

-- AlterTable: Company had no createdAt/updatedAt/updatedById at all
ALTER TABLE "Company"
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3),
ADD COLUMN "updatedById" TEXT;

-- Backfill updatedAt for existing rows (no historical value available, so use createdAt)
UPDATE "Company"
SET "updatedAt" = COALESCE("createdAt", CURRENT_TIMESTAMP)
WHERE "updatedAt" IS NULL;

-- Enforce not-null after backfill
ALTER TABLE "Company"
ALTER COLUMN "updatedAt" SET NOT NULL;

-- CreateTable: generic audit trail for Product, Domain, Company, Policy, PolicyControl,
-- SammAssessment, Note (resources without a dedicated ApplicationVersion-style table)
CREATE TABLE "ChangeHistory" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changedBy" TEXT,
    "changeSource" TEXT NOT NULL,
    "companyId" TEXT,
    "changedFields" JSONB,
    "diff" JSONB,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChangeHistory_entityType_entityId_createdAt_idx" ON "ChangeHistory"("entityType", "entityId", "createdAt");
CREATE INDEX "ChangeHistory_changedBy_idx" ON "ChangeHistory"("changedBy");
CREATE INDEX "ChangeHistory_companyId_idx" ON "ChangeHistory"("companyId");
CREATE INDEX "ChangeHistory_createdAt_idx" ON "ChangeHistory"("createdAt");

ALTER TABLE "ChangeHistory" ADD CONSTRAINT "ChangeHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChangeHistory" ADD CONSTRAINT "ChangeHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
