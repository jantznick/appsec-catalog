-- Add approvalNotes field to ApplicationVersion
ALTER TABLE "ApplicationVersion" 
  ADD COLUMN "approvalNotes" TEXT;

