-- CreateTable
CREATE TABLE "OperationalMetric" (
    "id" TEXT NOT NULL,
    "metric" VARCHAR(80) NOT NULL,
    "outcome" VARCHAR(32) NOT NULL,
    "dimension" VARCHAR(80) NOT NULL DEFAULT 'all',
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "latencyUpperMs" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" INTEGER NOT NULL DEFAULT 0,
    "maxDurationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OperationalMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalMetric_metric_outcome_dimension_bucketStart_latencyUpperMs_key" ON "OperationalMetric"("metric", "outcome", "dimension", "bucketStart", "latencyUpperMs");
CREATE INDEX "OperationalMetric_bucketStart_metric_idx" ON "OperationalMetric"("bucketStart", "metric");
