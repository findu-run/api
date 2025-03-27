-- CreateTable
CREATE TABLE "monitoring_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "url" TEXT,
    "message" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "monitoring_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "monitoring_events_name_status_detectedAt_idx" ON "monitoring_events"("name", "status", "detectedAt");
