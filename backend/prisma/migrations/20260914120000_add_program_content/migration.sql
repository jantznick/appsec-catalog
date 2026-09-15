-- Program content distribution: ASCOE sessions and Security Champions packages,
-- plus the materials attached to them. See PROGRAM_CONTENT_PLAN.md.
--
-- Separate release tables per program (they differ: ASCOE is hosted by the
-- AppSec team and has no facilitator to brief; a Champions package exists to be
-- handed to a member company to run), sharing one ContentAsset table so the
-- file-handling machinery exists once.
--
-- `audienceScope` defaults to 'companies' so a release whose company list is
-- lost fails closed rather than becoming visible to everyone.
--
-- The ContentAsset upload columns and ContentAssetDownload are created here
-- although Phase 1 ships links-only, so adding uploads needs no migration.

-- CreateTable
CREATE TABLE "AscoeSession" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3),
    "location" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "publicSummary" TEXT,
    "isPubliclyListed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "audienceScope" TEXT NOT NULL DEFAULT 'companies',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AscoeSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChampionsPackage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "theme" TEXT,
    "summary" TEXT,
    "body" TEXT,
    "facilitatorNotes" TEXT,
    "publicSummary" TEXT,
    "isPubliclyListed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "audienceScope" TEXT NOT NULL DEFAULT 'companies',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChampionsPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AscoeSessionCompany" (
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "AscoeSessionCompany_pkey" PRIMARY KEY ("sessionId","companyId")
);

-- CreateTable
CREATE TABLE "ChampionsPackageCompany" (
    "packageId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "ChampionsPackageCompany_pkey" PRIMARY KEY ("packageId","companyId")
);

-- CreateTable
CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "ascoeSessionId" TEXT,
    "packageId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'document',
    "section" TEXT NOT NULL DEFAULT 'materials',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "externalUrl" TEXT,
    "embedUrl" TEXT,
    "storagePath" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "checksumSha256" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentAssetDownload" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAssetDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AscoeSession_slug_key" ON "AscoeSession"("slug");

-- CreateIndex
CREATE INDEX "AscoeSession_status_sessionDate_idx" ON "AscoeSession"("status", "sessionDate");

-- CreateIndex
CREATE INDEX "AscoeSession_status_isPubliclyListed_idx" ON "AscoeSession"("status", "isPubliclyListed");

-- CreateIndex
CREATE INDEX "AscoeSession_createdBy_idx" ON "AscoeSession"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionsPackage_slug_key" ON "ChampionsPackage"("slug");

-- CreateIndex
CREATE INDEX "ChampionsPackage_status_periodStart_idx" ON "ChampionsPackage"("status", "periodStart");

-- CreateIndex
CREATE INDEX "ChampionsPackage_status_isPubliclyListed_idx" ON "ChampionsPackage"("status", "isPubliclyListed");

-- CreateIndex
CREATE INDEX "ChampionsPackage_createdBy_idx" ON "ChampionsPackage"("createdBy");

-- CreateIndex
CREATE INDEX "AscoeSessionCompany_companyId_idx" ON "AscoeSessionCompany"("companyId");

-- CreateIndex
CREATE INDEX "ChampionsPackageCompany_companyId_idx" ON "ChampionsPackageCompany"("companyId");

-- CreateIndex
CREATE INDEX "ContentAsset_ascoeSessionId_section_displayOrder_idx" ON "ContentAsset"("ascoeSessionId", "section", "displayOrder");

-- CreateIndex
CREATE INDEX "ContentAsset_packageId_section_displayOrder_idx" ON "ContentAsset"("packageId", "section", "displayOrder");

-- CreateIndex
CREATE INDEX "ContentAssetDownload_assetId_createdAt_idx" ON "ContentAssetDownload"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentAssetDownload_companyId_createdAt_idx" ON "ContentAssetDownload"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "ContentAssetDownload_userId_idx" ON "ContentAssetDownload"("userId");

-- AddForeignKey
ALTER TABLE "AscoeSession" ADD CONSTRAINT "AscoeSession_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionsPackage" ADD CONSTRAINT "ChampionsPackage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AscoeSessionCompany" ADD CONSTRAINT "AscoeSessionCompany_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AscoeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AscoeSessionCompany" ADD CONSTRAINT "AscoeSessionCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionsPackageCompany" ADD CONSTRAINT "ChampionsPackageCompany_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ChampionsPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChampionsPackageCompany" ADD CONSTRAINT "ChampionsPackageCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_ascoeSessionId_fkey" FOREIGN KEY ("ascoeSessionId") REFERENCES "AscoeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ChampionsPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAsset" ADD CONSTRAINT "ContentAsset_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAssetDownload" ADD CONSTRAINT "ContentAssetDownload_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ContentAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAssetDownload" ADD CONSTRAINT "ContentAssetDownload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAssetDownload" ADD CONSTRAINT "ContentAssetDownload_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
