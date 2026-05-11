-- CreateTable
CREATE TABLE "ProductIngressPoint" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductIngressPoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductIngressPoint_productId_idx" ON "ProductIngressPoint"("productId");

-- CreateIndex
CREATE INDEX "ProductIngressPoint_applicationId_idx" ON "ProductIngressPoint"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductIngressPoint_productId_applicationId_channel_key" ON "ProductIngressPoint"("productId", "applicationId", "channel");

-- AddForeignKey
ALTER TABLE "ProductIngressPoint" ADD CONSTRAINT "ProductIngressPoint_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductIngressPoint" ADD CONSTRAINT "ProductIngressPoint_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
