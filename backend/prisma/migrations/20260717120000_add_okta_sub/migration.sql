-- Add Okta subject identifier for SSO account linking
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "oktaSub" TEXT;

-- Enforce one local account per Okta identity
CREATE UNIQUE INDEX IF NOT EXISTS "User_oktaSub_key" ON "User"("oktaSub");
