-- Allow a user to hold MANY source-control connections (GitHub, GitLab, self-hosted, multiple
-- accounts). Identity of a connection is (userId, provider, host, externalUserId) instead of a
-- single connection per user.

DROP INDEX "GitHubConnection_userId_key";
CREATE UNIQUE INDEX "GitHubConnection_userId_provider_host_githubUserId_key"
  ON "GitHubConnection"("userId", "provider", "host", "githubUserId");
CREATE INDEX "GitHubConnection_userId_idx" ON "GitHubConnection"("userId");
