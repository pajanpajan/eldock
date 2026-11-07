-- Fáze 64: 2D půdorysy uložené na serveru (seznam firmy, průběžné ukládání s verzí) a historie verzí nákresu
-- CreateTable
CREATE TABLE "Floorplan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT,
    "installationSite" TEXT,
    "draftJson" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "elementCount" INTEGER NOT NULL DEFAULT 0,
    "roomCount" INTEGER NOT NULL DEFAULT 0,
    "floorCount" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Floorplan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Floorplan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FloorplanVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorplanId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "label" TEXT,
    "draftJson" TEXT NOT NULL,
    "elementCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FloorplanVersion_floorplanId_fkey" FOREIGN KEY ("floorplanId") REFERENCES "Floorplan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Floorplan_companyId_deletedAt_updatedAt_idx" ON "Floorplan"("companyId", "deletedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Floorplan_projectId_idx" ON "Floorplan"("projectId");

-- CreateIndex
CREATE INDEX "FloorplanVersion_floorplanId_createdAt_idx" ON "FloorplanVersion"("floorplanId", "createdAt");

