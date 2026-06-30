-- Add optional per-token company and admin restrictions for personal API tokens.
ALTER TABLE "ApiToken"
ADD COLUMN "companyId" TEXT,
ADD COLUMN "adminAccessDisabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "ApiToken_companyId_idx" ON "ApiToken"("companyId");

ALTER TABLE "ApiToken"
ADD CONSTRAINT "ApiToken_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
