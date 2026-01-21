-- CreateTable
CREATE TABLE "PolicyControlOverride" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "isCompliant" BOOLEAN NOT NULL,
    "noteId" TEXT,
    "overriddenBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyControlOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControlOverride_applicationId_controlId_key" ON "PolicyControlOverride"("applicationId", "controlId");

-- CreateIndex
CREATE INDEX "PolicyControlOverride_applicationId_idx" ON "PolicyControlOverride"("applicationId");

-- CreateIndex
CREATE INDEX "PolicyControlOverride_controlId_idx" ON "PolicyControlOverride"("controlId");

-- CreateIndex
CREATE INDEX "PolicyControlOverride_overriddenAt_idx" ON "PolicyControlOverride"("overriddenAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControlOverride_noteId_key" ON "PolicyControlOverride"("noteId");

-- AddForeignKey
ALTER TABLE "PolicyControlOverride" ADD CONSTRAINT "PolicyControlOverride_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyControlOverride" ADD CONSTRAINT "PolicyControlOverride_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "PolicyControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyControlOverride" ADD CONSTRAINT "PolicyControlOverride_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyControlOverride" ADD CONSTRAINT "PolicyControlOverride_overriddenBy_fkey" FOREIGN KEY ("overriddenBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
