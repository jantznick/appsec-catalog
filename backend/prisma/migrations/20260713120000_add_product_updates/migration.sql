CREATE TABLE "ProductUpdate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Improvement',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "releaseLabel" TEXT,
    "relatedCommits" JSONB,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductUpdate_status_publishedAt_idx" ON "ProductUpdate"("status", "publishedAt");
CREATE INDEX "ProductUpdate_createdBy_idx" ON "ProductUpdate"("createdBy");
CREATE INDEX "ProductUpdate_createdAt_idx" ON "ProductUpdate"("createdAt");

ALTER TABLE "ProductUpdate" ADD CONSTRAINT "ProductUpdate_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
