-- AlterTable
ALTER TABLE "SecurityFindingsJob" ADD COLUMN "runStartedAt" TIMESTAMP(3);
ALTER TABLE "SecurityFindingsJob" ADD COLUMN "durationMs" INTEGER;
