-- Make the per-call max output token ceiling admin-configurable.
-- Null = fall back to the AI_MAX_OUTPUT_TOKENS environment variable.
ALTER TABLE "AiConfig" ADD COLUMN "defaultMaxOutputTokens" INTEGER;
