-- CreateTable: ProductScore
CREATE TABLE "ProductScore" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgKnowledgeScore" INTEGER NOT NULL,
    "avgToolScore" INTEGER NOT NULL,
    "avgTotalScore" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductScore_productId_idx" ON "ProductScore"("productId");
CREATE INDEX "ProductScore_calculatedAt_idx" ON "ProductScore"("calculatedAt");
CREATE INDEX "ProductScore_avgTotalScore_idx" ON "ProductScore"("avgTotalScore");

-- AddForeignKey
ALTER TABLE "ProductScore" ADD CONSTRAINT "ProductScore_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

