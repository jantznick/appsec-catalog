CREATE TABLE "ApplicationApiSchema" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "content" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationApiSchema_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApplicationApiSchema_applicationId_key" ON "ApplicationApiSchema"("applicationId");

ALTER TABLE "ApplicationApiSchema"
ADD CONSTRAINT "ApplicationApiSchema_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
