-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GoalMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "MealKind" AS ENUM ('BREAKFAST', 'MORNING_SNACK', 'LUNCH', 'AFTERNOON_SNACK', 'DINNER', 'SUPPER', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('PLANNED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubjectRequestKind" AS ENUM ('EXPORT', 'DELETION');

-- CreateEnum
CREATE TYPE "SubjectRequestStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" VARCHAR(40) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" VARCHAR(500),
    "ipPrefix" VARCHAR(64),
    "countryCode" VARCHAR(8),
    "region" VARCHAR(80),
    "city" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reauthenticatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "keyHash" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

-- CreateTable
CREATE TABLE "ExternalProviderState" (
    "provider" VARCHAR(64) NOT NULL,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "circuitOpenUntil" TIMESTAMP(3),
    "quotaWindowStartedAt" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalProviderState_pkey" PRIMARY KEY ("provider")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" VARCHAR(80) NOT NULL,
    "birthDate" DATE NOT NULL,
    "biologicalSex" VARCHAR(24) NOT NULL,
    "heightCm" DECIMAL(5,2) NOT NULL,
    "currentWeightKg" DECIMAL(6,2) NOT NULL,
    "desiredWeightKg" DECIMAL(6,2) NOT NULL,
    "activityLevel" VARCHAR(32) NOT NULL,
    "objective" VARCHAR(32) NOT NULL,
    "trainingExperience" VARCHAR(32) NOT NULL,
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "physicalRestrictions" VARCHAR(1000),
    "availableEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priorityMuscleGroups" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "dayClosesAtMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "measuredAt" DATE NOT NULL,
    "weightKg" DECIMAL(6,2) NOT NULL,
    "waistCm" DECIMAL(6,2),
    "hipCm" DECIMAL(6,2),
    "chestCm" DECIMAL(6,2),
    "armCm" DECIMAL(6,2),
    "thighCm" DECIMAL(6,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" VARCHAR(24) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "timeMinutes" INTEGER NOT NULL,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "channel" VARCHAR(16) NOT NULL DEFAULT 'IN_APP',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationSettings" (
    "userId" TEXT NOT NULL,
    "quietStartMinutes" INTEGER,
    "quietEndMinutes" INTEGER,
    "pushPermission" VARCHAR(16) NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "GoalPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" "GoalMode" NOT NULL,
    "calorieTarget" INTEGER NOT NULL,
    "proteinGrams" DECIMAL(6,2) NOT NULL,
    "carbohydrateGrams" DECIMAL(6,2) NOT NULL,
    "fatGrams" DECIMAL(6,2) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "logicalDate" DATE NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "goalPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "dayLogId" TEXT NOT NULL,
    "kind" "MealKind" NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "customName" VARCHAR(80),
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" VARCHAR(180) NOT NULL,
    "brand" VARCHAR(120),
    "barcode" VARCHAR(32),
    "source" VARCHAR(40) NOT NULL,
    "sourceReference" VARCHAR(180),
    "sourceFetchedAt" TIMESTAMP(3),
    "sourceExpiresAt" TIMESTAMP(3),
    "baseQuantity" DECIMAL(10,3) NOT NULL,
    "baseUnit" VARCHAR(16) NOT NULL,
    "calories" DECIMAL(10,3) NOT NULL,
    "proteinGrams" DECIMAL(10,3),
    "carbohydrateGrams" DECIMAL(10,3),
    "fatGrams" DECIMAL(10,3),
    "fiberGrams" DECIMAL(10,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodFavorite" (
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodFavorite_pkey" PRIMARY KEY ("userId","foodId")
);

-- CreateTable
CREATE TABLE "FoodPortion" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "unit" VARCHAR(24) NOT NULL,
    "quantityInBaseUnit" DECIMAL(10,3) NOT NULL,

    CONSTRAINT "FoodPortion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntry" (
    "id" TEXT NOT NULL,
    "clientMutationId" VARCHAR(80),
    "mealId" TEXT NOT NULL,
    "foodId" TEXT,
    "kind" "EntryKind" NOT NULL,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "snapshotName" VARCHAR(180) NOT NULL,
    "snapshotBrand" VARCHAR(120),
    "snapshotSource" VARCHAR(40) NOT NULL,
    "snapshotCalories" DECIMAL(10,3) NOT NULL,
    "snapshotProtein" DECIMAL(10,3),
    "snapshotCarbohydrate" DECIMAL(10,3),
    "snapshotFat" DECIMAL(10,3),
    "macrosComplete" BOOLEAN NOT NULL DEFAULT true,
    "originEntryId" TEXT,
    "copiedFromEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealEntryRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealEntryId" TEXT,
    "logicalDate" DATE NOT NULL,
    "reason" VARCHAR(160),
    "previousQuantity" DECIMAL(10,3) NOT NULL,
    "previousCalories" DECIMAL(10,3) NOT NULL,
    "previousProtein" DECIMAL(10,3),
    "previousCarbohydrate" DECIMAL(10,3),
    "previousFat" DECIMAL(10,3),
    "nextQuantity" DECIMAL(10,3) NOT NULL,
    "nextCalories" DECIMAL(10,3) NOT NULL,
    "nextProtein" DECIMAL(10,3),
    "nextCarbohydrate" DECIMAL(10,3),
    "nextFat" DECIMAL(10,3),
    "correctedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealEntryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMeal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedMealItem" (
    "id" TEXT NOT NULL,
    "savedMealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "sourceMealEntryId" TEXT,
    "quantity" DECIMAL(10,3) NOT NULL,
    "unit" VARCHAR(16) NOT NULL,
    "snapshotName" VARCHAR(180) NOT NULL,
    "snapshotBrand" VARCHAR(120),
    "snapshotSource" VARCHAR(40) NOT NULL,
    "snapshotCalories" DECIMAL(10,3) NOT NULL,
    "snapshotProtein" DECIMAL(10,3),
    "snapshotCarbohydrate" DECIMAL(10,3),
    "snapshotFat" DECIMAL(10,3),
    "macrosComplete" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SavedMealItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "division" VARCHAR(16) NOT NULL DEFAULT 'CUSTOM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedByRuleVersion" VARCHAR(64),
    "generationInputs" JSONB,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "WorkoutPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "muscleGroup" VARCHAR(80) NOT NULL,
    "equipment" VARCHAR(80),
    "instructions" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutPlanExercise" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "targetSets" INTEGER NOT NULL,
    "targetReps" VARCHAR(40) NOT NULL,
    "restSeconds" INTEGER NOT NULL,

    CONSTRAINT "WorkoutPlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayLogId" TEXT,
    "planId" TEXT,
    "planVersionId" TEXT,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "name" VARCHAR(120) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutSessionExercise" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "position" INTEGER NOT NULL,
    "nameSnapshot" VARCHAR(160) NOT NULL,
    "muscleSnapshot" VARCHAR(80) NOT NULL,
    "equipmentSnapshot" VARCHAR(80),
    "replacedFromExerciseId" TEXT,
    "replacedFromNameSnapshot" VARCHAR(160),
    "replacedFromMuscleSnapshot" VARCHAR(80),
    "replacedFromEquipmentSnapshot" VARCHAR(80),
    "substitutionReason" VARCHAR(32),
    "substitutedAt" TIMESTAMP(3),
    "targetSets" INTEGER NOT NULL,
    "targetReps" VARCHAR(40) NOT NULL,
    "restSeconds" INTEGER NOT NULL,

    CONSTRAINT "WorkoutSessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseSet" (
    "id" TEXT NOT NULL,
    "sessionExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "repetitions" INTEGER,
    "weightKg" DECIMAL(7,2),
    "effortRpe" DECIMAL(3,1),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" VARCHAR(80) NOT NULL,
    "textVersion" VARCHAR(32) NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "SubjectRequestKind" NOT NULL,
    "status" "SubjectRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "receiptCode" VARCHAR(40) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "artifactKey" TEXT,
    "expiresAt" TIMESTAMP(3),
    "failureReason" VARCHAR(500),
    "resultSummary" VARCHAR(500),

    CONSTRAINT "SubjectRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" VARCHAR(100) NOT NULL,
    "objectType" VARCHAR(80),
    "objectId" VARCHAR(120),
    "result" VARCHAR(32) NOT NULL,
    "correlationId" VARCHAR(64) NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "RateLimitBucket_resetAt_idx" ON "RateLimitBucket"("resetAt");

-- CreateIndex
CREATE INDEX "ExternalProviderState_circuitOpenUntil_idx" ON "ExternalProviderState"("circuitOpenUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_measuredAt_idx" ON "BodyMeasurement"("userId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMeasurement_userId_measuredAt_key" ON "BodyMeasurement"("userId", "measuredAt");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_enabled_idx" ON "NotificationPreference"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_type_key" ON "NotificationPreference"("userId", "type");

-- CreateIndex
CREATE INDEX "GoalPlan_userId_validFrom_validUntil_idx" ON "GoalPlan"("userId", "validFrom", "validUntil");

-- CreateIndex
CREATE UNIQUE INDEX "DayLog_userId_logicalDate_key" ON "DayLog"("userId", "logicalDate");

-- CreateIndex
CREATE INDEX "Meal_dayLogId_position_idx" ON "Meal"("dayLogId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_dayLogId_slug_key" ON "Meal"("dayLogId", "slug");

-- CreateIndex
CREATE INDEX "Food_name_idx" ON "Food"("name");

-- CreateIndex
CREATE INDEX "Food_barcode_idx" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_ownerId_idx" ON "Food"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Food_barcode_source_key" ON "Food"("barcode", "source");

-- CreateIndex
CREATE INDEX "FoodFavorite_userId_createdAt_idx" ON "FoodFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_name_key" ON "FoodPortion"("foodId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MealEntry_clientMutationId_key" ON "MealEntry"("clientMutationId");

-- CreateIndex
CREATE INDEX "MealEntry_mealId_kind_idx" ON "MealEntry"("mealId", "kind");

-- CreateIndex
CREATE INDEX "MealEntry_copiedFromEntryId_idx" ON "MealEntry"("copiedFromEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "MealEntry_originEntryId_kind_key" ON "MealEntry"("originEntryId", "kind");

-- CreateIndex
CREATE INDEX "MealEntryRevision_userId_logicalDate_correctedAt_idx" ON "MealEntryRevision"("userId", "logicalDate", "correctedAt");

-- CreateIndex
CREATE INDEX "MealEntryRevision_mealEntryId_correctedAt_idx" ON "MealEntryRevision"("mealEntryId", "correctedAt");

-- CreateIndex
CREATE INDEX "SavedMeal_userId_updatedAt_idx" ON "SavedMeal"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedMealItem_savedMealId_position_key" ON "SavedMealItem"("savedMealId", "position");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_active_idx" ON "WorkoutPlan"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlanVersion_planId_version_key" ON "WorkoutPlanVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlanExercise_versionId_dayIndex_position_key" ON "WorkoutPlanExercise"("versionId", "dayIndex", "position");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_idx" ON "WorkoutSession"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSessionExercise_sessionId_position_key" ON "WorkoutSessionExercise"("sessionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSet_sessionExerciseId_setNumber_key" ON "ExerciseSet"("sessionExerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_purpose_idx" ON "ConsentRecord"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "SubjectRequest_receiptCode_key" ON "SubjectRequest"("receiptCode");

-- CreateIndex
CREATE INDEX "SubjectRequest_userId_requestedAt_idx" ON "SubjectRequest"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "AuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationSettings" ADD CONSTRAINT "NotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalPlan" ADD CONSTRAINT "GoalPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_goalPlanId_fkey" FOREIGN KEY ("goalPlanId") REFERENCES "GoalPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_dayLogId_fkey" FOREIGN KEY ("dayLogId") REFERENCES "DayLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPortion" ADD CONSTRAINT "FoodPortion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntry" ADD CONSTRAINT "MealEntry_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntryRevision" ADD CONSTRAINT "MealEntryRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealEntryRevision" ADD CONSTRAINT "MealEntryRevision_mealEntryId_fkey" FOREIGN KEY ("mealEntryId") REFERENCES "MealEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMeal" ADD CONSTRAINT "SavedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedMealItem" ADD CONSTRAINT "SavedMealItem_savedMealId_fkey" FOREIGN KEY ("savedMealId") REFERENCES "SavedMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanVersion" ADD CONSTRAINT "WorkoutPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "WorkoutPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_dayLogId_fkey" FOREIGN KEY ("dayLogId") REFERENCES "DayLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSession" ADD CONSTRAINT "WorkoutSession_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "WorkoutPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExercise" ADD CONSTRAINT "WorkoutSessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExercise" ADD CONSTRAINT "WorkoutSessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseSet" ADD CONSTRAINT "ExerciseSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "WorkoutSessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectRequest" ADD CONSTRAINT "SubjectRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
