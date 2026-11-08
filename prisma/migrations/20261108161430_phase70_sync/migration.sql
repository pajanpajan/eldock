-- CreateTable
CREATE TABLE "SyncDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "appVersion" TEXT,
    "tokenHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPullAt" DATETIME,
    "lastPushAt" DATETIME,
    "lastCursor" INTEGER,
    "revokedAt" DATETIME,
    "revokedById" TEXT,
    "revokedReason" TEXT,
    CONSTRAINT "SyncDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncPairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "deviceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncMutation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "code" TEXT,
    "message" TEXT,
    "entity" TEXT,
    "entityId" TEXT,
    "resultJson" TEXT,
    "performedAt" DATETIME,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncMutation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SyncMutation_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "SyncDevice" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncChange" (
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "plantId" TEXT,
    "companyId" TEXT,
    "equipmentId" TEXT,
    "seq" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "changedAt" DATETIME NOT NULL,

    PRIMARY KEY ("entity", "entityId")
);

-- CreateTable
CREATE TABLE "SyncCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" INTEGER NOT NULL DEFAULT 0,
    "prunedSeq" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncDevice_tokenHash_key" ON "SyncDevice"("tokenHash");

-- CreateIndex
CREATE INDEX "SyncDevice_userId_revokedAt_idx" ON "SyncDevice"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "SyncDevice_companyId_revokedAt_idx" ON "SyncDevice"("companyId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncPairing_codeHash_key" ON "SyncPairing"("codeHash");

-- CreateIndex
CREATE INDEX "SyncPairing_userId_idx" ON "SyncPairing"("userId");

-- CreateIndex
CREATE INDEX "SyncMutation_deviceId_receivedAt_idx" ON "SyncMutation"("deviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "SyncMutation_receivedAt_idx" ON "SyncMutation"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncMutation_userId_clientId_key" ON "SyncMutation"("userId", "clientId");

-- CreateIndex
CREATE INDEX "SyncChange_plantId_seq_idx" ON "SyncChange"("plantId", "seq");

-- CreateIndex
CREATE INDEX "SyncChange_companyId_seq_idx" ON "SyncChange"("companyId", "seq");

-- CreateIndex
CREATE INDEX "SyncChange_equipmentId_idx" ON "SyncChange"("equipmentId");

-- CreateIndex
CREATE INDEX "SyncChange_deleted_changedAt_idx" ON "SyncChange"("deleted", "changedAt");

-- Čítač žurnálu změn (jediný řádek, triggery ho při chybějícím řádku založí znovu)
INSERT INTO "SyncCounter" ("id", "value", "prunedSeq") VALUES (1, 0, 0);
