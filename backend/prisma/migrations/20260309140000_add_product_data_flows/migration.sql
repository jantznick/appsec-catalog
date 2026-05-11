-- CreateTable
CREATE TABLE "ProductDataFlow" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceApplicationId" TEXT NOT NULL,
    "targetApplicationId" TEXT NOT NULL,
    "flowName" TEXT,
    "dataClassification" TEXT,
    "protocol" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'unidirectional',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDataFlow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductDataFlow_productId_idx" ON "ProductDataFlow"("productId");

-- CreateIndex
CREATE INDEX "ProductDataFlow_sourceApplicationId_idx" ON "ProductDataFlow"("sourceApplicationId");

-- CreateIndex
CREATE INDEX "ProductDataFlow_targetApplicationId_idx" ON "ProductDataFlow"("targetApplicationId");

-- CreateIndex
CREATE INDEX "ProductDataFlow_createdAt_idx" ON "ProductDataFlow"("createdAt");

-- AddForeignKey
ALTER TABLE "ProductDataFlow" ADD CONSTRAINT "ProductDataFlow_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDataFlow" ADD CONSTRAINT "ProductDataFlow_sourceApplicationId_fkey" FOREIGN KEY ("sourceApplicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductDataFlow" ADD CONSTRAINT "ProductDataFlow_targetApplicationId_fkey" FOREIGN KEY ("targetApplicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
