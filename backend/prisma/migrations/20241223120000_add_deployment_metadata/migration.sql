-- AlterTable: Remove lastDeployDate, add deployment metadata fields
ALTER TABLE "Application" 
  DROP COLUMN IF EXISTS "lastDeployDate",
  ADD COLUMN "currentVersion" TEXT,
  ADD COLUMN "deploymentEnvironment" TEXT,
  ADD COLUMN "gitBranch" TEXT,
  ADD COLUMN "lastDastScanDate" TIMESTAMP(3),
  ADD COLUMN "lastSastScanDate" TIMESTAMP(3);

-- CreateTable: Deployment history
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "environment" TEXT NOT NULL,
    "version" TEXT,
    "gitBranch" TEXT,
    "deployedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deployment_applicationId_idx" ON "Deployment"("applicationId");
CREATE INDEX "Deployment_deployedAt_idx" ON "Deployment"("deployedAt");
CREATE INDEX "Deployment_environment_idx" ON "Deployment"("environment");

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
