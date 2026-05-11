-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Division_name_key" ON "Division"("name");

-- CreateIndex
CREATE INDEX "Division_name_idx" ON "Division"("name");

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "divisionId" TEXT;

-- CreateIndex
CREATE INDEX "Company_divisionId_idx" ON "Company"("divisionId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

