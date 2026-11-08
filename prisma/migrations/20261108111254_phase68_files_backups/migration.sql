-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ownerKind" TEXT NOT NULL,
    "companyId" TEXT,
    "uploadedById" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "mimeType" TEXT NOT NULL,
    "originalName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MaintenanceRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "summaryJson" TEXT,
    "error" TEXT
);

-- CreateTable
CREATE TABLE "BackupObject" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storedBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "sourceMtimeMs" REAL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "missingSince" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_url_key" ON "StoredFile"("url");

-- CreateIndex
CREATE INDEX "StoredFile_companyId_idx" ON "StoredFile"("companyId");

-- CreateIndex
CREATE INDEX "StoredFile_ownerKind_idx" ON "StoredFile"("ownerKind");

-- CreateIndex
CREATE INDEX "MaintenanceRun_kind_startedAt_idx" ON "MaintenanceRun"("kind", "startedAt");

-- CreateIndex
CREATE INDEX "BackupObject_kind_uploadedAt_idx" ON "BackupObject"("kind", "uploadedAt");

-- CreateIndex
CREATE INDEX "BackupObject_source_idx" ON "BackupObject"("source");
