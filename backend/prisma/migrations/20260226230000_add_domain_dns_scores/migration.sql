-- AlterTable
ALTER TABLE "DomainDnsSnapshot"
ADD COLUMN "metadataScore" INTEGER,
ADD COLUMN "dnsSecurityScore" INTEGER,
ADD COLUMN "totalSecurityScore" INTEGER,
ADD COLUMN "scoreBreakdown" TEXT;
