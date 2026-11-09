-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SyncPairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'DEVICE',
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "deviceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncPairing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SyncPairing" ("codeHash", "createdAt", "deviceId", "expiresAt", "id", "usedAt", "userId") SELECT "codeHash", "createdAt", "deviceId", "expiresAt", "id", "usedAt", "userId" FROM "SyncPairing";
DROP TABLE "SyncPairing";
ALTER TABLE "new_SyncPairing" RENAME TO "SyncPairing";
CREATE UNIQUE INDEX "SyncPairing_codeHash_key" ON "SyncPairing"("codeHash");
CREATE INDEX "SyncPairing_userId_idx" ON "SyncPairing"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
