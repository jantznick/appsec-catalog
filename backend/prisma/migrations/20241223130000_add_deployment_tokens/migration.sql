-- CreateTable: Deployment tokens for CI/CD pipeline integration
CREATE TABLE "DeploymentToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "createdBy" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Join table for deployment tokens and applications
CREATE TABLE "ApplicationDeploymentToken" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDeploymentToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeploymentToken_token_key" ON "DeploymentToken"("token");
CREATE UNIQUE INDEX "DeploymentToken_tokenHash_key" ON "DeploymentToken"("tokenHash");
CREATE INDEX "DeploymentToken_companyId_idx" ON "DeploymentToken"("companyId");
CREATE INDEX "DeploymentToken_tokenHash_idx" ON "DeploymentToken"("tokenHash");
CREATE INDEX "DeploymentToken_revokedAt_idx" ON "DeploymentToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDeploymentToken_tokenId_applicationId_key" ON "ApplicationDeploymentToken"("tokenId", "applicationId");
CREATE INDEX "ApplicationDeploymentToken_tokenId_idx" ON "ApplicationDeploymentToken"("tokenId");
CREATE INDEX "ApplicationDeploymentToken_applicationId_idx" ON "ApplicationDeploymentToken"("applicationId");

-- AddForeignKey
ALTER TABLE "DeploymentToken" ADD CONSTRAINT "DeploymentToken_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeploymentToken" ADD CONSTRAINT "ApplicationDeploymentToken_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "DeploymentToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeploymentToken" ADD CONSTRAINT "ApplicationDeploymentToken_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

