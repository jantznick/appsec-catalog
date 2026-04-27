-- AlterTable
ALTER TABLE "Application" ADD COLUMN "sastIncludesSca" BOOLEAN DEFAULT false;
ALTER TABLE "Application" ADD COLUMN "scaTool" TEXT;
ALTER TABLE "Application" ADD COLUMN "scaIntegrationLevel" INTEGER;
ALTER TABLE "Application" ADD COLUMN "lastScaScanDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ApplicationVersion" ADD COLUMN "sastIncludesSca" BOOLEAN;
ALTER TABLE "ApplicationVersion" ADD COLUMN "scaTool" TEXT;
ALTER TABLE "ApplicationVersion" ADD COLUMN "scaIntegrationLevel" INTEGER;
ALTER TABLE "ApplicationVersion" ADD COLUMN "lastScaScanDate" TIMESTAMP(3);
