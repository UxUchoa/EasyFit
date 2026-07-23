-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'REVIEW', 'FAILED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportItemDecision" AS ENUM ('PENDING', 'KEEP', 'REPLACE', 'IGNORE', 'MANUAL');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" VARCHAR(180) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "contentSha256" VARCHAR(64) NOT NULL,
    "sourcePayload" JSONB NOT NULL,
    "parserVersion" VARCHAR(64) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" VARCHAR(500),
    "startedAt" TIMESTAMP(3),
    "reviewReadyAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportItem" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dayLabel" VARCHAR(80) NOT NULL,
    "mealLabel" VARCHAR(80) NOT NULL,
    "extractedName" VARCHAR(180) NOT NULL,
    "extractedQuantity" DECIMAL(10,3),
    "extractedUnit" VARCHAR(24),
    "sourcePointer" VARCHAR(240) NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "matchedFoodId" TEXT,
    "matchedFoodName" VARCHAR(180),
    "matchedFoodSource" VARCHAR(40),
    "matchConfidence" DECIMAL(4,3),
    "decision" "ImportItemDecision" NOT NULL DEFAULT 'PENDING',
    "reviewedName" VARCHAR(180),
    "reviewedQuantity" DECIMAL(10,3),
    "reviewedUnit" VARCHAR(24),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "sourceImportJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DietPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DietPlanVersion" (
    "id" TEXT NOT NULL,
    "dietPlanId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DietPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportJob_userId_createdAt_idx" ON "ImportJob"("userId", "createdAt");
CREATE INDEX "ImportJob_status_updatedAt_idx" ON "ImportJob"("status", "updatedAt");
CREATE UNIQUE INDEX "ImportItem_importJobId_position_key" ON "ImportItem"("importJobId", "position");
CREATE INDEX "ImportItem_importJobId_decision_idx" ON "ImportItem"("importJobId", "decision");
CREATE UNIQUE INDEX "DietPlan_sourceImportJobId_key" ON "DietPlan"("sourceImportJobId");
CREATE INDEX "DietPlan_userId_active_idx" ON "DietPlan"("userId", "active");
CREATE UNIQUE INDEX "DietPlanVersion_dietPlanId_version_key" ON "DietPlanVersion"("dietPlanId", "version");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportItem" ADD CONSTRAINT "ImportItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DietPlan" ADD CONSTRAINT "DietPlan_sourceImportJobId_fkey" FOREIGN KEY ("sourceImportJobId") REFERENCES "ImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DietPlanVersion" ADD CONSTRAINT "DietPlanVersion_dietPlanId_fkey" FOREIGN KEY ("dietPlanId") REFERENCES "DietPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
