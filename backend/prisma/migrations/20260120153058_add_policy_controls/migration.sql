-- CreateTable
CREATE TABLE "PolicyControl" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "evaluationLogic" TEXT NOT NULL DEFAULT 'AND',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyControl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyControlField" (
    "id" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicyControlField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyControl_controlId_key" ON "PolicyControl"("controlId");

-- CreateIndex
CREATE INDEX "PolicyControl_controlId_idx" ON "PolicyControl"("controlId");

-- CreateIndex
CREATE INDEX "PolicyControl_isActive_idx" ON "PolicyControl"("isActive");

-- CreateIndex
CREATE INDEX "PolicyControl_displayOrder_idx" ON "PolicyControl"("displayOrder");

-- CreateIndex
CREATE INDEX "PolicyControlField_controlId_idx" ON "PolicyControlField"("controlId");

-- CreateIndex
CREATE INDEX "PolicyControlField_fieldPath_idx" ON "PolicyControlField"("fieldPath");

-- AddForeignKey
ALTER TABLE "PolicyControlField" ADD CONSTRAINT "PolicyControlField_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "PolicyControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;
