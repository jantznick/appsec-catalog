-- Per-company provider/model selection. Null = inherit the global AiConfig
-- default. provider and model are set together (a model is provider-specific).
ALTER TABLE "AiAccessRule" ADD COLUMN "provider" TEXT;
ALTER TABLE "AiAccessRule" ADD COLUMN "model" TEXT;
