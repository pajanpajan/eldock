-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PanelBoardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT,
    "customerName" TEXT,
    "installationSite" TEXT,
    "manufacturerInfoJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enclosureType" TEXT NOT NULL DEFAULT 'WALL_MOUNTED',
    "enclosureMaterial" TEXT NOT NULL DEFAULT 'PLASTIC',
    "enclosureModel" TEXT NOT NULL DEFAULT '',
    "norm" TEXT NOT NULL DEFAULT 'EN 61439-3',
    "widthMm" INTEGER NOT NULL DEFAULT 292,
    "heightMm" INTEGER NOT NULL DEFAULT 507,
    "depthMm" INTEGER NOT NULL DEFAULT 120,
    "ipRating" TEXT NOT NULL DEFAULT 'IP 41',
    "networkSystem" TEXT NOT NULL DEFAULT '3 x 230/400 V, 50Hz, TN-S',
    "supplyPhases" INTEGER NOT NULL DEFAULT 3,
    "shortCircuitKa" REAL NOT NULL DEFAULT 6,
    "ambientTempC" REAL NOT NULL DEFAULT 30,
    "simultaneityFactor" REAL NOT NULL DEFAULT 0.5,
    "internalWiringLossW" REAL NOT NULL DEFAULT 4.1,
    "dinRailsCount" INTEGER NOT NULL DEFAULT 3,
    "modulesPerRail" INTEGER NOT NULL DEFAULT 12,
    "photoUrl" TEXT,
    "dominantManufacturer" TEXT NOT NULL DEFAULT 'ABB',
    "analysisMode" TEXT,
    "coverState" TEXT,
    "incomerFrom" TEXT NOT NULL DEFAULT 'TOP',
    "designMode" TEXT NOT NULL DEFAULT 'PHOTO',
    "railModulesJson" TEXT,
    "enclosureId" TEXT,
    "enclosurePmaxW" REAL,
    "environment" TEXT NOT NULL DEFAULT 'INDOOR_DRY',
    "standardEdition" TEXT NOT NULL DEFAULT 'CSN_61439_3_ED2',
    "routineTestJson" TEXT,
    "railPhotosJson" TEXT,
    "fanId" TEXT,
    "fanCount" INTEGER NOT NULL DEFAULT 1,
    "floorplanJson" TEXT,
    "cableReportJson" TEXT,
    "createdById" TEXT,
    "companyId" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardProject_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "PanelEnclosure" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_fanId_fkey" FOREIGN KEY ("fanId") REFERENCES "EnclosureFan" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "equipmentId", "fanCount", "fanId", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "equipmentId", "fanCount", "fanId", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_updatedAt_idx" ON "PanelBoardProject"("companyId", "updatedAt");
CREATE INDEX "PanelBoardProject_enclosureId_idx" ON "PanelBoardProject"("enclosureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
