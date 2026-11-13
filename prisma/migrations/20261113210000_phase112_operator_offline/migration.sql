-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "valueJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OfflineSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
    "kind" TEXT NOT NULL,
    "resultJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OfflineSubmission_createdAt_idx" ON "OfflineSubmission"("createdAt");
