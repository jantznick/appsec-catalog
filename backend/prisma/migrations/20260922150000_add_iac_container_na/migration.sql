-- Adds a "not applicable" declaration for IaC / container scanning.
--
-- Not every application has infrastructure-as-code or container images. Without this,
-- such an application permanently fails 4.6.14 and can never reach 100% completeness —
-- the tool and integration-level fields sit empty with no way to say why.
--
-- Mirrors apiSecurityNA / appFirewallNA, with one deliberate difference: NO DEFAULT.
-- Those two carry @default(false), so on a real row they are never null and therefore
-- always count as filled — two guaranteed points of completeness on every application,
-- recorded as wart C2 in APP_DATA_FIXES_PLAN.md. Adding a third would extend a known
-- defect. Here null means "not answered" and counts as unfilled, which is honest; once
-- answered, either value counts.
--
-- In the completeness field sets the declaration always counts, and the tool and level
-- leave the denominator when it is set to true — the same shape as the existing
-- @standaloneSca and @standaloneSecrets markers.
--
-- Added to ApplicationVersion too, since the field is versioned:true in the registry.

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "iacContainerScanNA" BOOLEAN;

-- AlterTable
ALTER TABLE "ApplicationVersion" ADD COLUMN     "iacContainerScanNA" BOOLEAN;

