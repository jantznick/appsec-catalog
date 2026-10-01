-- Roadmap + feature requests, the two halves of the expanded What's New page.
--
-- RoadmapItem is admin-authored and draft-by-default, so a quarter's worth of
-- work can be lined up before anyone sees it. It optionally points at the
-- ProductUpdate that shipped it, which is how a SHIPPED card links through to
-- its release note. Items in IN_PROGRESS carry a finer-grained delivery state
-- (beta, HTS testing, or a scheduled production date).
--
-- FeatureRequest mirrors ProgramInfoRequest: a submission queue only admins
-- read. The submitter's email is denormalized so a request outlives the
-- account, and `adminNote` is the one field written back for them to see.

-- CreateEnum
CREATE TYPE "RoadmapStage" AS ENUM ('EXPLORING', 'PLANNED', 'IN_PROGRESS', 'SHIPPED');

-- CreateEnum
CREATE TYPE "RoadmapProgressState" AS ENUM ('BETA_TESTING', 'HTS_TESTING', 'SCHEDULED_RELEASE');

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Improvement',
    "stage" "RoadmapStage" NOT NULL DEFAULT 'EXPLORING',
    "targetLabel" TEXT,
    "progressState" "RoadmapProgressState",
    "scheduledReleaseAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "shippedAt" TIMESTAMP(3),
    "linkedUpdateId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Improvement',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "submittedById" TEXT,
    "submitterEmail" TEXT NOT NULL,
    "adminNote" TEXT,
    "roadmapItemId" TEXT,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoadmapItem_status_stage_sortOrder_idx" ON "RoadmapItem"("status", "stage", "sortOrder");

-- CreateIndex
CREATE INDEX "RoadmapItem_linkedUpdateId_idx" ON "RoadmapItem"("linkedUpdateId");

-- CreateIndex
CREATE INDEX "RoadmapItem_createdBy_idx" ON "RoadmapItem"("createdBy");

-- CreateIndex
CREATE INDEX "FeatureRequest_status_createdAt_idx" ON "FeatureRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeatureRequest_submittedById_idx" ON "FeatureRequest"("submittedById");

-- CreateIndex
CREATE INDEX "FeatureRequest_roadmapItemId_idx" ON "FeatureRequest"("roadmapItemId");

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_linkedUpdateId_fkey" FOREIGN KEY ("linkedUpdateId") REFERENCES "ProductUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_roadmapItemId_fkey" FOREIGN KEY ("roadmapItemId") REFERENCES "RoadmapItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
