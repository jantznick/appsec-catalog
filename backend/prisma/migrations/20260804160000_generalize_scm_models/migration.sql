-- Generalize the GitHub-specific models into provider-agnostic SCM models. Table/column names are
-- preserved via @@map/@map in the Prisma schema, so this migration is purely additive (no renames,
-- no data movement).

-- ScmConnection (table GitHubConnection)
ALTER TABLE "GitHubConnection" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'GITHUB';
ALTER TABLE "GitHubConnection" ADD COLUMN "host" TEXT NOT NULL DEFAULT 'github.com';
ALTER TABLE "GitHubConnection" ADD COLUMN "encryptedRefreshToken" TEXT;
ALTER TABLE "GitHubConnection" ALTER COLUMN "installationId" DROP NOT NULL;

-- ScmRepo (table GitHubRepo)
ALTER TABLE "GitHubRepo" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'GITHUB';
ALTER TABLE "GitHubRepo" ADD COLUMN "host" TEXT NOT NULL DEFAULT 'github.com';

-- Repo identity is now unique per (provider, host, externalId) instead of a global github id.
DROP INDEX "GitHubRepo_githubRepoId_key";
CREATE UNIQUE INDEX "GitHubRepo_provider_host_githubRepoId_key" ON "GitHubRepo"("provider", "host", "githubRepoId");
