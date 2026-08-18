-- AI foundation: shared infrastructure for AI-backed features.
-- Adds the singleton config, the effective-dated price book, the usage/cost
-- ledger, and per-company access rules. No columns are added to existing
-- tables (the back-relations on Company/Application/User are Prisma-virtual).

-- CreateTable
CREATE TABLE "AiConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "globalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultProvider" TEXT NOT NULL DEFAULT 'anthropic',
    "defaultModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-5',
    "defaultMonthlyCostLimitUsd" DECIMAL(12,2),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiModelPricing" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputPricePerMTok" DECIMAL(12,4) NOT NULL,
    "outputPricePerMTok" DECIMAL(12,4) NOT NULL,
    "cacheReadPricePerMTok" DECIMAL(12,4),
    "cacheWritePricePerMTok" DECIMAL(12,4),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "AiModelPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,
    "applicationId" TEXT,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "purpose" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "pricingId" TEXT,
    "inputPricePerMTok" DECIMAL(12,4),
    "outputPricePerMTok" DECIMAL(12,4),
    "cacheReadPricePerMTok" DECIMAL(12,4),
    "cacheWritePricePerMTok" DECIMAL(12,4),
    "inputCost" DECIMAL(16,8),
    "outputCost" DECIMAL(16,8),
    "totalCost" DECIMAL(16,8),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'success',
    "errorMessage" TEXT,
    "latencyMs" INTEGER,

    CONSTRAINT "AiRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiAccessRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "monthlyCostLimitUsd" DECIMAL(12,2),
    "monthlyTokenLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AiAccessRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiModelPricing_provider_model_active_idx" ON "AiModelPricing"("provider", "model", "active");

-- CreateIndex
CREATE INDEX "AiModelPricing_effectiveTo_idx" ON "AiModelPricing"("effectiveTo");

-- CreateIndex
CREATE INDEX "AiRequest_companyId_createdAt_idx" ON "AiRequest"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AiRequest_applicationId_idx" ON "AiRequest"("applicationId");

-- CreateIndex
CREATE INDEX "AiRequest_feature_idx" ON "AiRequest"("feature");

-- CreateIndex
CREATE INDEX "AiRequest_createdAt_idx" ON "AiRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AiAccessRule_companyId_idx" ON "AiAccessRule"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "AiAccessRule_companyId_userId_feature_key" ON "AiAccessRule"("companyId", "userId", "feature");

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRequest" ADD CONSTRAINT "AiRequest_pricingId_fkey" FOREIGN KEY ("pricingId") REFERENCES "AiModelPricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAccessRule" ADD CONSTRAINT "AiAccessRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiAccessRule" ADD CONSTRAINT "AiAccessRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
