-- CreateTable
CREATE TABLE "SecurityFindingsJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "companyId" TEXT,
    "requestPayload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "message" TEXT,
    "error" TEXT,
    "resultCsv" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityFindingsJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SecurityFindingsJob_userId_createdAt_idx" ON "SecurityFindingsJob"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "SecurityFindingsJob" ADD CONSTRAINT "SecurityFindingsJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
