-- CreateTable
CREATE TABLE "DomainDnsSnapshot" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "cnameRecords" TEXT,
    "aRecords" TEXT,
    "aaaaRecords" TEXT,
    "txtRecords" TEXT,
    "mxRecords" TEXT,
    "nsRecords" TEXT,
    "spfRecord" TEXT,
    "dmarcRecord" TEXT,
    "dkimRecords" TEXT,
    "createdBy" TEXT,

    CONSTRAINT "DomainDnsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainDnsChange" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainDnsChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DomainDnsSnapshot_domainId_idx" ON "DomainDnsSnapshot"("domainId");

-- CreateIndex
CREATE INDEX "DomainDnsSnapshot_checkedAt_idx" ON "DomainDnsSnapshot"("checkedAt");

-- CreateIndex
CREATE INDEX "DomainDnsSnapshot_domainId_checkedAt_idx" ON "DomainDnsSnapshot"("domainId", "checkedAt");

-- CreateIndex
CREATE INDEX "DomainDnsChange_domainId_idx" ON "DomainDnsChange"("domainId");

-- CreateIndex
CREATE INDEX "DomainDnsChange_snapshotId_idx" ON "DomainDnsChange"("snapshotId");

-- CreateIndex
CREATE INDEX "DomainDnsChange_createdAt_idx" ON "DomainDnsChange"("createdAt");

-- AddForeignKey
ALTER TABLE "DomainDnsSnapshot" ADD CONSTRAINT "DomainDnsSnapshot_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainDnsChange" ADD CONSTRAINT "DomainDnsChange_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainDnsChange" ADD CONSTRAINT "DomainDnsChange_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DomainDnsSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
