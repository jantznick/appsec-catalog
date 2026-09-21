-- Owner attestation for controls no field could evidence (process and product
-- properties: "no back doors", "secure coding guidelines are followed") —
-- see POLICY_CONTROL_COVERAGE_PLAN.md Phase 4.
--
-- Deliberately NOT an extension of PolicyControlOverride:
--   override    = an admin saying "trust me, this is fine"        (admin-only, never expires)
--   attestation = an owner asserting what they must defend at audit (company-scoped, expires)
-- Merging them would make "how much of our compliance is self-reported?"
-- unanswerable, which is the first question an auditor asks.
--
-- One live attestation per application/control; re-attesting updates the row and
-- change history keeps the previous statement. Withdrawal sets revokedAt rather
-- than deleting, so the trail still shows someone attested and then took it back.
--
-- PolicyControl gains allowsAttestation (off by default — a control is only
-- attestable when someone decides it is) and attestationValidDays (default 365).

-- AlterTable
ALTER TABLE "PolicyControl" ADD COLUMN     "allowsAttestation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "attestationValidDays" INTEGER NOT NULL DEFAULT 365;

-- CreateTable
CREATE TABLE "ControlAttestation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "controlId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "attestedBy" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ControlAttestation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ControlAttestation_applicationId_idx" ON "ControlAttestation"("applicationId");

-- CreateIndex
CREATE INDEX "ControlAttestation_controlId_idx" ON "ControlAttestation"("controlId");

-- CreateIndex
CREATE INDEX "ControlAttestation_expiresAt_idx" ON "ControlAttestation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ControlAttestation_applicationId_controlId_key" ON "ControlAttestation"("applicationId", "controlId");

-- AddForeignKey
ALTER TABLE "ControlAttestation" ADD CONSTRAINT "ControlAttestation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlAttestation" ADD CONSTRAINT "ControlAttestation_controlId_fkey" FOREIGN KEY ("controlId") REFERENCES "PolicyControl"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ControlAttestation" ADD CONSTRAINT "ControlAttestation_attestedBy_fkey" FOREIGN KEY ("attestedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

