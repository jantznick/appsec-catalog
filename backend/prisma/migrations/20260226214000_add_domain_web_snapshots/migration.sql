-- CreateTable
CREATE TABLE "DomainWebSnapshot" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "urlAttempted" TEXT NOT NULL,
    "usedHttpFallback" BOOLEAN NOT NULL DEFAULT false,
    "finalUrl" TEXT,
    "statusCode" INTEGER,
    "title" TEXT,
    "loadTimeMs" INTEGER,
    "screenshotPath" TEXT,
    "error" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "DomainWebSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainWebSnapshot_domainId_idx" ON "DomainWebSnapshot"("domainId");

-- CreateIndex
CREATE INDEX "DomainWebSnapshot_checkedAt_idx" ON "DomainWebSnapshot"("checkedAt");

-- CreateIndex
CREATE INDEX "DomainWebSnapshot_domainId_checkedAt_idx" ON "DomainWebSnapshot"("domainId", "checkedAt");

-- AddForeignKey
ALTER TABLE "DomainWebSnapshot" ADD CONSTRAINT "DomainWebSnapshot_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
