-- CreateTable
CREATE TABLE IF NOT EXISTS "ThreatModel" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scope" TEXT,
    "actors" TEXT,
    "dataTypes" TEXT,
    "threats" TEXT,
    "reviewer" TEXT,
    "lastReviewedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ThreatModelComponent" (
    "id" TEXT NOT NULL,
    "threatModelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archetype" TEXT NOT NULL DEFAULT 'other',
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "scope" TEXT,
    "threats" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreatModelComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ThreatModel_applicationId_key" ON "ThreatModel"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThreatModel_status_idx" ON "ThreatModel"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ThreatModelComponent_threatModelId_idx" ON "ThreatModelComponent"("threatModelId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ThreatModel_applicationId_fkey') THEN
        ALTER TABLE "ThreatModel" ADD CONSTRAINT "ThreatModel_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ThreatModelComponent_threatModelId_fkey') THEN
        ALTER TABLE "ThreatModelComponent" ADD CONSTRAINT "ThreatModelComponent_threatModelId_fkey" FOREIGN KEY ("threatModelId") REFERENCES "ThreatModel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
