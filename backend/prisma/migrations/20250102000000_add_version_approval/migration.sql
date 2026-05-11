-- Add approval workflow fields to ApplicationVersion
ALTER TABLE "ApplicationVersion" 
  ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'approved',
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedFields" TEXT,
  ADD COLUMN "approvalNotes" TEXT,
  ADD COLUMN "rejectionReason" TEXT;

-- CreateIndex
CREATE INDEX "ApplicationVersion_approvalStatus_idx" ON "ApplicationVersion"("approvalStatus");
CREATE INDEX "ApplicationVersion_applicationId_approvalStatus_idx" ON "ApplicationVersion"("applicationId", "approvalStatus");

-- AddForeignKey
ALTER TABLE "ApplicationVersion" ADD CONSTRAINT "ApplicationVersion_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

