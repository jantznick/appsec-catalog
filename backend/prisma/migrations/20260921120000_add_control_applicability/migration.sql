-- Adds per-control applicability, so a control can be scoped to the applications it
-- actually applies to instead of being evaluated against every one.
--
-- PolicyControlField.role splits a control's checks in two:
--   'compliance'   (default) - decides meeting / not_meeting, as before
--   'applies_when'           - decides whether the control applies at all. If these
--                              do not match, the control evaluates to "not_applicable"
--                              and its compliance checks are never run.
--
-- PolicyControl.appliesWhenLogic is how the applies_when checks combine (AND / OR).
--
-- Additive and backward compatible: every existing field defaults to 'compliance' and
-- every existing control to 'AND' with no applies_when checks, so all current controls
-- keep applying to every application exactly as they do today.

-- AlterTable
ALTER TABLE "PolicyControl" ADD COLUMN     "appliesWhenLogic" TEXT NOT NULL DEFAULT 'AND';

-- AlterTable
ALTER TABLE "PolicyControlField" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'compliance';

-- CreateIndex
CREATE INDEX "PolicyControlField_controlId_role_idx" ON "PolicyControlField"("controlId", "role");
