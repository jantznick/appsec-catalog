-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "owner" TEXT,
    "facing" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lifecycleStage" TEXT,
    "businessCriticality" INTEGER,
    "dataSensitivity" TEXT,
    "complianceNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductComponentType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductComponentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductApplication" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "componentTypeId" TEXT,
    "customComponentLabel" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_name_key" ON "Product"("companyId", "name");

-- CreateIndex
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProductComponentType_companyId_name_key" ON "ProductComponentType"("companyId", "name");

-- CreateIndex
CREATE INDEX "ProductComponentType_companyId_idx" ON "ProductComponentType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductApplication_productId_applicationId_key" ON "ProductApplication"("productId", "applicationId");

-- CreateIndex
CREATE INDEX "ProductApplication_productId_idx" ON "ProductApplication"("productId");

-- CreateIndex
CREATE INDEX "ProductApplication_applicationId_idx" ON "ProductApplication"("applicationId");

-- CreateIndex
CREATE INDEX "ProductApplication_componentTypeId_idx" ON "ProductApplication"("componentTypeId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductComponentType" ADD CONSTRAINT "ProductComponentType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApplication" ADD CONSTRAINT "ProductApplication_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApplication" ADD CONSTRAINT "ProductApplication_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductApplication" ADD CONSTRAINT "ProductApplication_componentTypeId_fkey" FOREIGN KEY ("componentTypeId") REFERENCES "ProductComponentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
