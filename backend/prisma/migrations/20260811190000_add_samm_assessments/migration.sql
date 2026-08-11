CREATE TABLE "SammFramework" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SammFramework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SammDomain" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SammDomain_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SammPractice" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "scoringGuidance" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "SammPractice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SammAssessment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "ownerName" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SammAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SammAssessmentResponse" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "practiceId" TEXT NOT NULL,
    "score" INTEGER,
    "rationale" TEXT,
    "evidenceReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SammAssessmentResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SammFramework_name_version_key" ON "SammFramework"("name", "version");
CREATE INDEX "SammFramework_isActive_idx" ON "SammFramework"("isActive");
CREATE UNIQUE INDEX "SammDomain_frameworkId_key_key" ON "SammDomain"("frameworkId", "key");
CREATE INDEX "SammDomain_frameworkId_displayOrder_idx" ON "SammDomain"("frameworkId", "displayOrder");
CREATE UNIQUE INDEX "SammPractice_domainId_key_key" ON "SammPractice"("domainId", "key");
CREATE INDEX "SammPractice_domainId_displayOrder_idx" ON "SammPractice"("domainId", "displayOrder");
CREATE INDEX "SammAssessment_companyId_createdAt_idx" ON "SammAssessment"("companyId", "createdAt" DESC);
CREATE INDEX "SammAssessment_status_idx" ON "SammAssessment"("status");
CREATE INDEX "SammAssessment_frameworkId_idx" ON "SammAssessment"("frameworkId");
CREATE UNIQUE INDEX "SammAssessmentResponse_assessmentId_practiceId_key" ON "SammAssessmentResponse"("assessmentId", "practiceId");
CREATE INDEX "SammAssessmentResponse_practiceId_idx" ON "SammAssessmentResponse"("practiceId");

ALTER TABLE "SammDomain" ADD CONSTRAINT "SammDomain_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "SammFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SammPractice" ADD CONSTRAINT "SammPractice_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "SammDomain"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SammAssessment" ADD CONSTRAINT "SammAssessment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SammAssessment" ADD CONSTRAINT "SammAssessment_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "SammFramework"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SammAssessment" ADD CONSTRAINT "SammAssessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SammAssessment" ADD CONSTRAINT "SammAssessment_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SammAssessmentResponse" ADD CONSTRAINT "SammAssessmentResponse_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "SammAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SammAssessmentResponse" ADD CONSTRAINT "SammAssessmentResponse_practiceId_fkey" FOREIGN KEY ("practiceId") REFERENCES "SammPractice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
