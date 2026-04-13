-- CreateEnum
CREATE TYPE "IntegrationScope" AS ENUM ('ENTERPRISE', 'COMPANY');

-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scope" "IntegrationScope" NOT NULL,
    "companyId" TEXT,
    "encryptedPayload" TEXT NOT NULL,
    "accessKeyHint" TEXT,
    "baseUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyToolLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyToolLink_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCredential" ADD CONSTRAINT "IntegrationCredential_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyToolLink" ADD CONSTRAINT "CompanyToolLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "CompanyToolLink_companyId_provider_key" ON "CompanyToolLink"("companyId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationCredential_provider_idx" ON "IntegrationCredential"("provider");

-- CreateIndex
CREATE INDEX "IntegrationCredential_companyId_idx" ON "IntegrationCredential"("companyId");

-- CreateIndex
CREATE INDEX "CompanyToolLink_provider_idx" ON "CompanyToolLink"("provider");

-- One enterprise credential per provider
CREATE UNIQUE INDEX "IntegrationCredential_enterprise_provider_key" ON "IntegrationCredential"("provider") WHERE "scope" = 'ENTERPRISE';

-- One company credential per (companyId, provider)
CREATE UNIQUE INDEX "IntegrationCredential_company_provider_key" ON "IntegrationCredential"("companyId", "provider") WHERE "scope" = 'COMPANY' AND "companyId" IS NOT NULL;
