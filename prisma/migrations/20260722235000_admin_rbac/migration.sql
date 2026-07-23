-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPPORT', 'ADMIN');

-- CreateEnum
CREATE TYPE "SupportAccessScope" AS ENUM ('ACCOUNT_METADATA', 'IMPORT_STATUS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "SupportAccess" (
    "id" TEXT NOT NULL,
    "operatorUserId" TEXT,
    "targetUserId" TEXT,
    "reason" VARCHAR(500) NOT NULL,
    "scopes" "SupportAccessScope"[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportAccessObject" (
    "id" TEXT NOT NULL,
    "supportAccessId" TEXT NOT NULL,
    "objectType" VARCHAR(80) NOT NULL,
    "objectId" VARCHAR(120) NOT NULL,
    "consultedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportAccessObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportAccess_operatorUserId_expiresAt_idx" ON "SupportAccess"("operatorUserId", "expiresAt");
CREATE INDEX "SupportAccess_targetUserId_createdAt_idx" ON "SupportAccess"("targetUserId", "createdAt");
CREATE INDEX "SupportAccessObject_supportAccessId_consultedAt_idx" ON "SupportAccessObject"("supportAccessId", "consultedAt");

-- AddForeignKey
ALTER TABLE "SupportAccess" ADD CONSTRAINT "SupportAccess_operatorUserId_fkey" FOREIGN KEY ("operatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAccess" ADD CONSTRAINT "SupportAccess_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportAccessObject" ADD CONSTRAINT "SupportAccessObject_supportAccessId_fkey" FOREIGN KEY ("supportAccessId") REFERENCES "SupportAccess"("id") ON DELETE CASCADE ON UPDATE CASCADE;
