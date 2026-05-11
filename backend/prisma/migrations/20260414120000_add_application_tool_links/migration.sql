-- CreateTable
CREATE TABLE "ApplicationToolLink" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationToolLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApplicationToolLink_provider_idx" ON "ApplicationToolLink"("provider");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ApplicationToolLink_applicationId_provider_key" ON "ApplicationToolLink"("applicationId", "provider");

-- AddForeignKey
ALTER TABLE "ApplicationToolLink" ADD CONSTRAINT "ApplicationToolLink_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
