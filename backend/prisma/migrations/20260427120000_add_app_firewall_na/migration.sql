-- AlterTable
ALTER TABLE "Application" ADD COLUMN "appFirewallNA" BOOLEAN DEFAULT false;

-- AlterTable
ALTER TABLE "ApplicationVersion" ADD COLUMN "appFirewallNA" BOOLEAN;
