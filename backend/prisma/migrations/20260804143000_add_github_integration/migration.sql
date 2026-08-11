-- GitHub integration: per-user connections, shared repo snapshots,
-- normalized top-level dependency inventory, and per-application repo links.

-- CreateTable
CREATE TABLE IF NOT EXISTS "GitHubConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "installationId" TEXT NOT NULL,
    "encryptedToken" TEXT,
    "scopes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GitHubRepo" (
    "id" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "htmlUrl" TEXT NOT NULL,
    "defaultBranch" TEXT,
    "description" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "topics" JSONB,
    "license" TEXT,
    "languages" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubRepo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RepoDependency" (
    "id" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "versionRange" TEXT,
    "isFramework" BOOLEAN NOT NULL DEFAULT false,
    "framework" TEXT,
    "source" TEXT NOT NULL,
    "resolvedFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepoDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ApplicationGitHubRepo" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "githubRepoId" TEXT NOT NULL,
    "linkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationGitHubRepo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GitHubConnection_userId_key" ON "GitHubConnection"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GitHubConnection_githubUserId_idx" ON "GitHubConnection"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GitHubRepo_githubRepoId_key" ON "GitHubRepo"("githubRepoId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GitHubRepo_fullName_idx" ON "GitHubRepo"("fullName");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RepoDependency_ecosystem_name_idx" ON "RepoDependency"("ecosystem", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RepoDependency_name_idx" ON "RepoDependency"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RepoDependency_isFramework_idx" ON "RepoDependency"("isFramework");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RepoDependency_githubRepoId_ecosystem_name_key" ON "RepoDependency"("githubRepoId", "ecosystem", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationGitHubRepo_applicationId_key" ON "ApplicationGitHubRepo"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationGitHubRepo_githubRepoId_idx" ON "ApplicationGitHubRepo"("githubRepoId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GitHubConnection_userId_fkey') THEN
        ALTER TABLE "GitHubConnection" ADD CONSTRAINT "GitHubConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RepoDependency_githubRepoId_fkey') THEN
        ALTER TABLE "RepoDependency" ADD CONSTRAINT "RepoDependency_githubRepoId_fkey" FOREIGN KEY ("githubRepoId") REFERENCES "GitHubRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationGitHubRepo_applicationId_fkey') THEN
        ALTER TABLE "ApplicationGitHubRepo" ADD CONSTRAINT "ApplicationGitHubRepo_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationGitHubRepo_githubRepoId_fkey') THEN
        ALTER TABLE "ApplicationGitHubRepo" ADD CONSTRAINT "ApplicationGitHubRepo_githubRepoId_fkey" FOREIGN KEY ("githubRepoId") REFERENCES "GitHubRepo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
