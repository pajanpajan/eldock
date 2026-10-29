-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CZ',
    "campusMapUrl" TEXT,
    "campusViewBoxW" INTEGER NOT NULL DEFAULT 1000,
    "campusViewBoxH" INTEGER NOT NULL DEFAULT 700,
    "campusWidthM" INTEGER NOT NULL DEFAULT 400,
    "campusDepthM" INTEGER NOT NULL DEFAULT 280,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Plant" ("address", "campusMapUrl", "campusViewBoxH", "campusViewBoxW", "city", "code", "country", "createdAt", "customerName", "id", "name", "updatedAt") SELECT "address", "campusMapUrl", "campusViewBoxH", "campusViewBoxW", "city", "code", "country", "createdAt", "customerName", "id", "name", "updatedAt" FROM "Plant";
DROP TABLE "Plant";
ALTER TABLE "new_Plant" RENAME TO "Plant";
CREATE UNIQUE INDEX "Plant_code_key" ON "Plant"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
