-- CreateTable
CREATE TABLE "FoodSourceChoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conflictKey" VARCHAR(320) NOT NULL,
    "selectedFoodId" TEXT,
    "selectedSnapshotName" VARCHAR(180) NOT NULL,
    "selectedSnapshotSource" VARCHAR(40) NOT NULL,
    "alternativesSnapshot" JSONB NOT NULL,
    "chosenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FoodSourceChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FoodSourceChoice_userId_conflictKey_key" ON "FoodSourceChoice"("userId", "conflictKey");
CREATE INDEX "FoodSourceChoice_selectedFoodId_idx" ON "FoodSourceChoice"("selectedFoodId");

-- AddForeignKey
ALTER TABLE "FoodSourceChoice" ADD CONSTRAINT "FoodSourceChoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodSourceChoice" ADD CONSTRAINT "FoodSourceChoice_selectedFoodId_fkey" FOREIGN KEY ("selectedFoodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;
