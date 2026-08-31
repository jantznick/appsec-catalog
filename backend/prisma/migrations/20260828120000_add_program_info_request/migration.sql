-- "Request more information" submissions from the public documentation site.
-- Submitted by anonymous visitors (no account), so the table holds only an
-- email to reply to, the programs they selected, and an optional message.
-- Admins triage in-app via status NEW -> HANDLED.

-- CreateTable
CREATE TABLE "ProgramInfoRequest" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "programs" TEXT NOT NULL,
    "sourcePage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handledAt" TIMESTAMP(3),
    "handledById" TEXT,

    CONSTRAINT "ProgramInfoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgramInfoRequest_status_idx" ON "ProgramInfoRequest"("status");

-- CreateIndex
CREATE INDEX "ProgramInfoRequest_createdAt_idx" ON "ProgramInfoRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "ProgramInfoRequest" ADD CONSTRAINT "ProgramInfoRequest_handledById_fkey" FOREIGN KEY ("handledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
