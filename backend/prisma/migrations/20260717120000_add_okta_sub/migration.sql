-- Add Okta subject identifier for SSO account linking
ALTER TABLE "User" ADD COLUMN "oktaSub" TEXT;

-- Enforce one local account per Okta identity
CREATE UNIQUE INDEX "User_oktaSub_key" ON "User"("oktaSub");
