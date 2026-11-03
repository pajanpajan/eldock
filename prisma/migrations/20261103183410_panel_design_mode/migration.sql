-- AlterTable
ALTER TABLE "CatalogComponent" ADD COLUMN "archetypeId" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "externalSource" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "facetsJson" TEXT;

-- AlterTable
ALTER TABLE "RegisteredCompany" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "RegisteredCompany" ADD COLUMN "stampUrl" TEXT;

-- CreateTable
CREATE TABLE "PanelEnclosure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturer" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "modulesPerRow" INTEGER NOT NULL,
    "totalModules" INTEGER NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "depthMm" INTEGER NOT NULL,
    "ipRating" TEXT NOT NULL,
    "installation" TEXT NOT NULL,
    "material" TEXT NOT NULL DEFAULT 'PLASTIC',
    "pMaxW" REAL,
    "dataSource" TEXT NOT NULL DEFAULT 'STANDARD_MATRIX',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "qty" REAL NOT NULL DEFAULT 1,
    "basis" TEXT NOT NULL DEFAULT 'catalog',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    CONSTRAINT "CatalogRelation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CatalogComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CatalogRelation_childId_fkey" FOREIGN KEY ("childId") REFERENCES "CatalogComponent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PanelBoardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT,
    "customerName" TEXT,
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
    "createdById" TEXT,
    "companyId" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardProject_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "PanelEnclosure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "dinRailsCount", "dominantManufacturer", "enclosureMaterial", "enclosureModel", "enclosureType", "equipmentId", "heightMm", "id", "incomerFrom", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "dinRailsCount", "dominantManufacturer", "enclosureMaterial", "enclosureModel", "enclosureType", "equipmentId", "heightMm", "id", "incomerFrom", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_idx" ON "PanelBoardProject"("companyId");
CREATE INDEX "PanelBoardProject_enclosureId_idx" ON "PanelBoardProject"("enclosureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PanelEnclosure_articleNumber_key" ON "PanelEnclosure"("articleNumber");

-- CreateIndex
CREATE INDEX "PanelEnclosure_manufacturer_rows_modulesPerRow_idx" ON "PanelEnclosure"("manufacturer", "rows", "modulesPerRow");

-- CreateIndex
CREATE INDEX "CatalogRelation_childId_idx" ON "CatalogRelation"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogRelation_parentId_childId_relationType_key" ON "CatalogRelation"("parentId", "childId", "relationType");
