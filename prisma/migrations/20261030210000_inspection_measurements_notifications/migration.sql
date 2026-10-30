-- AlterTable
ALTER TABLE "InspectionRecord" ADD COLUMN "functionalTest" BOOLEAN;
ALTER TABLE "InspectionRecord" ADD COLUMN "leakageCurrent" REAL;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "plantId" TEXT,
    "subject" TEXT NOT NULL,
    "recipients" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "delivery" TEXT NOT NULL,
    "error" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "NotificationLog_kind_createdAt_idx" ON "NotificationLog"("kind", "createdAt");

