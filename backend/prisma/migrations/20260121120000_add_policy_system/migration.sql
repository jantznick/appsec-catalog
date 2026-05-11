-- CreateTable
CREATE TABLE "Policy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scope" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "targetingRules" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DivisionPolicy" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,

    CONSTRAINT "DivisionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPolicy" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,

    CONSTRAINT "CompanyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Policy_scope_idx" ON "Policy"("scope");

-- CreateIndex
CREATE INDEX "Policy_isActive_idx" ON "Policy"("isActive");

-- CreateIndex
CREATE INDEX "Policy_displayOrder_idx" ON "Policy"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DivisionPolicy_divisionId_policyId_key" ON "DivisionPolicy"("divisionId", "policyId");

-- CreateIndex
CREATE INDEX "DivisionPolicy_divisionId_idx" ON "DivisionPolicy"("divisionId");

-- CreateIndex
CREATE INDEX "DivisionPolicy_policyId_idx" ON "DivisionPolicy"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPolicy_companyId_policyId_key" ON "CompanyPolicy"("companyId", "policyId");

-- CreateIndex
CREATE INDEX "CompanyPolicy_companyId_idx" ON "CompanyPolicy"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPolicy_policyId_idx" ON "CompanyPolicy"("policyId");

-- AddForeignKey
ALTER TABLE "DivisionPolicy" ADD CONSTRAINT "DivisionPolicy_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DivisionPolicy" ADD CONSTRAINT "DivisionPolicy_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPolicy" ADD CONSTRAINT "CompanyPolicy_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPolicy" ADD CONSTRAINT "CompanyPolicy_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create default Global Policy (needed before adding policyId to PolicyControl)
-- Using a simple ID that matches Prisma's cuid format
DO $$
DECLARE
    global_policy_id TEXT := 'clx' || substr(md5(random()::text || clock_timestamp()::text), 1, 24);
BEGIN
    INSERT INTO "Policy" ("id", "name", "description", "scope", "isActive", "displayOrder", "targetingRules", "createdAt", "updatedAt")
    VALUES (
        global_policy_id,
        'Global Security Baseline',
        'Default policy for all applications',
        'global',
        true,
        0,
        '{"type": "global"}',
        NOW(),
        NOW()
    );
    
    -- Add policyId column as nullable first
    ALTER TABLE "PolicyControl" ADD COLUMN "policyId" TEXT;
    
    -- Update any existing rows to use the global policy ID
    UPDATE "PolicyControl" SET "policyId" = global_policy_id WHERE "policyId" IS NULL;
    
    -- Now make it NOT NULL (safe since all rows have been updated)
    ALTER TABLE "PolicyControl" ALTER COLUMN "policyId" SET NOT NULL;
END $$;

-- CreateIndex
CREATE INDEX "PolicyControl_policyId_idx" ON "PolicyControl"("policyId");

-- AddForeignKey
ALTER TABLE "PolicyControl" ADD CONSTRAINT "PolicyControl_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
