-- CreateTable
CREATE TABLE "RegisteredCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productScope" TEXT NOT NULL,
    "ico" TEXT NOT NULL,
    "dic" TEXT,
    "companyName" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "authorizationNumber" TEXT,
    "termsAcceptedAt" DATETIME NOT NULL,
    "termsVersion" TEXT NOT NULL DEFAULT '1.0-2026-11',
    "creditsRemaining" INTEGER NOT NULL DEFAULT 5,
    "plantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegisteredCompany_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "createdById" TEXT,
    "companyId" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardProject_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "code", "coverState", "createdAt", "createdById", "customerName", "depthMm", "dinRailsCount", "dominantManufacturer", "enclosureMaterial", "enclosureModel", "enclosureType", "equipmentId", "heightMm", "id", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "code", "coverState", "createdAt", "createdById", "customerName", "depthMm", "dinRailsCount", "dominantManufacturer", "enclosureMaterial", "enclosureModel", "enclosureType", "equipmentId", "heightMm", "id", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_idx" ON "PanelBoardProject"("companyId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "accountType" TEXT,
    "title" TEXT,
    "scopeLayers" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "homePlantId" TEXT,
    "companyId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_homePlantId_fkey" FOREIGN KEY ("homePlantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accountType", "avatarUrl", "company", "createdAt", "email", "id", "name", "phone", "role", "scopeLayers", "sortOrder", "title", "updatedAt") SELECT "accountType", "avatarUrl", "company", "createdAt", "email", "id", "name", "phone", "role", "scopeLayers", "sortOrder", "title", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_accountType_idx" ON "User"("accountType");
CREATE INDEX "User_homePlantId_idx" ON "User"("homePlantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredCompany_email_key" ON "RegisteredCompany"("email");

-- CreateIndex
CREATE INDEX "RegisteredCompany_productScope_idx" ON "RegisteredCompany"("productScope");

-- CreateIndex
CREATE INDEX "RegisteredCompany_ico_idx" ON "RegisteredCompany"("ico");

-- CreateIndex
CREATE INDEX "RegisteredCompany_plantId_idx" ON "RegisteredCompany"("plantId");
