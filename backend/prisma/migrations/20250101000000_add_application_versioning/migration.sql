-- CreateTable: Application metadata version history
CREATE TABLE "ApplicationVersion" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeSource" TEXT,
    
    -- Metadata snapshot fields
    "name" TEXT,
    "description" TEXT,
    "owner" TEXT,
    "repoUrl" TEXT,
    "language" TEXT,
    "framework" TEXT,
    "serverEnvironment" TEXT,
    "facing" TEXT,
    "deploymentType" TEXT,
    "authProfiles" TEXT,
    "dataTypes" TEXT,
    "status" TEXT,
    "businessCriticality" INTEGER,
    "criticalAspects" TEXT,
    "devTeamContact" TEXT,
    "securityTestingDescription" TEXT,
    "additionalNotes" TEXT,
    "sastTool" TEXT,
    "sastIntegrationLevel" INTEGER,
    "dastTool" TEXT,
    "dastIntegrationLevel" INTEGER,
    "appFirewallTool" TEXT,
    "appFirewallIntegrationLevel" INTEGER,
    "apiSecurityTool" TEXT,
    "apiSecurityIntegrationLevel" INTEGER,
    "apiSecurityNA" BOOLEAN,
    "currentVersion" TEXT,
    "deploymentEnvironment" TEXT,
    "gitBranch" TEXT,
    "lastDastScanDate" TIMESTAMP(3),
    "lastSastScanDate" TIMESTAMP(3),
    "interfaces" TEXT,

    CONSTRAINT "ApplicationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Application metadata review history
CREATE TABLE "ApplicationMetadataReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationMetadataReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationVersion_applicationId_idx" ON "ApplicationVersion"("applicationId");
CREATE INDEX "ApplicationVersion_applicationId_versionNumber_idx" ON "ApplicationVersion"("applicationId", "versionNumber");
CREATE INDEX "ApplicationVersion_createdAt_idx" ON "ApplicationVersion"("createdAt");
CREATE INDEX "ApplicationVersion_createdBy_idx" ON "ApplicationVersion"("createdBy");

CREATE INDEX "ApplicationMetadataReview_applicationId_idx" ON "ApplicationMetadataReview"("applicationId");
CREATE INDEX "ApplicationMetadataReview_reviewedAt_idx" ON "ApplicationMetadataReview"("reviewedAt");
CREATE INDEX "ApplicationMetadataReview_reviewedBy_idx" ON "ApplicationMetadataReview"("reviewedBy");

-- AddForeignKey
ALTER TABLE "ApplicationVersion" ADD CONSTRAINT "ApplicationVersion_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationVersion" ADD CONSTRAINT "ApplicationVersion_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationMetadataReview" ADD CONSTRAINT "ApplicationMetadataReview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationMetadataReview" ADD CONSTRAINT "ApplicationMetadataReview_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

