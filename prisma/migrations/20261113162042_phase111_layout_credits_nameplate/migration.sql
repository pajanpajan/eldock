-- Fáze 111: uspořádání skříně a lišt (pole Silnoproud | Slaboproud), licence výstupů projektů a půdorysů (zkušební /
-- zaplacené / celá zakázka), pohyby kreditů, zkušební projekt a předplatné firmy, fotka výrobního štítku zařízení.

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "nameplateDataJson" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "nameplatePhotoUrl" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "nameplateReadAt" DATETIME;

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Floorplan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
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
    "license" TEXT NOT NULL DEFAULT 'PAID',
    "quoteUnlockedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Floorplan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Floorplan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Floorplan" ("code", "companyId", "createdAt", "customerName", "deletedAt", "draftJson", "elementCount", "floorCount", "id", "installationSite", "name", "projectId", "roomCount", "updatedAt", "version") SELECT "code", "companyId", "createdAt", "customerName", "deletedAt", "draftJson", "elementCount", "floorCount", "id", "installationSite", "name", "projectId", "roomCount", "updatedAt", "version" FROM "Floorplan";
DROP TABLE "Floorplan";
ALTER TABLE "new_Floorplan" RENAME TO "Floorplan";
CREATE INDEX "Floorplan_companyId_deletedAt_updatedAt_idx" ON "Floorplan"("companyId", "deletedAt", "updatedAt");
CREATE INDEX "Floorplan_projectId_idx" ON "Floorplan"("projectId");
CREATE UNIQUE INDEX "Floorplan_companyId_code_key" ON "Floorplan"("companyId", "code");
CREATE TABLE "new_PanelBoardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT,
    "customerName" TEXT,
    "installationSite" TEXT,
    "manufacturerInfoJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "docState" TEXT NOT NULL DEFAULT 'DRAFT',
    "qrSerial" TEXT,
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
    "railLayoutJson" TEXT,
    "license" TEXT NOT NULL DEFAULT 'PAID',
    "quoteUnlockedAt" DATETIME,
    "cncUnlockedAt" DATETIME,
    "enclosureId" TEXT,
    "enclosurePmaxW" REAL,
    "enclosureFixed" BOOLEAN NOT NULL DEFAULT false,
    "environment" TEXT NOT NULL DEFAULT 'INDOOR_DRY',
    "environmentConfirmedAt" DATETIME,
    "standardEdition" TEXT NOT NULL DEFAULT 'CSN_61439_3_ED2',
    "routineTestJson" TEXT,
    "railPhotosJson" TEXT,
    "fanId" TEXT,
    "fanCount" INTEGER NOT NULL DEFAULT 1,
    "floorplanJson" TEXT,
    "cableReportJson" TEXT,
    "boardCode" TEXT,
    "parentBoardId" TEXT,
    "feederJson" TEXT,
    "trainerPreset" TEXT,
    "occupancy" TEXT NOT NULL DEFAULT 'RESIDENTIAL',
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
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "boardCode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "docState", "dominantManufacturer", "enclosureFixed", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "environmentConfirmedAt", "equipmentId", "fanCount", "fanId", "feederJson", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "occupancy", "parentBoardId", "photoUrl", "qrSerial", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "supplyPhases", "trainerPreset", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "boardCode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "docState", "dominantManufacturer", "enclosureFixed", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "environmentConfirmedAt", "equipmentId", "fanCount", "fanId", "feederJson", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "occupancy", "parentBoardId", "photoUrl", "qrSerial", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "supplyPhases", "trainerPreset", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE UNIQUE INDEX "PanelBoardProject_qrSerial_key" ON "PanelBoardProject"("qrSerial");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_updatedAt_idx" ON "PanelBoardProject"("companyId", "updatedAt");
CREATE INDEX "PanelBoardProject_enclosureId_idx" ON "PanelBoardProject"("enclosureId");
CREATE INDEX "PanelBoardProject_parentBoardId_idx" ON "PanelBoardProject"("parentBoardId");
CREATE TABLE "new_RegisteredCompany" (
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
    "creditsRemaining" INTEGER NOT NULL DEFAULT 0,
    "trialFloorplanUsed" BOOLEAN NOT NULL DEFAULT false,
    "trialSwitchboardUsed" BOOLEAN NOT NULL DEFAULT false,
    "creditsValidUntil" DATETIME,
    "subscriptionPlan" TEXT,
    "subscriptionUntil" DATETIME,
    "subscriptionCreditedAt" DATETIME,
    "firstTopUpBonusAt" DATETIME,
    "plantId" TEXT,
    "logoUrl" TEXT,
    "stampUrl" TEXT,
    "circuitChipsJson" TEXT,
    "applianceLibraryJson" TEXT,
    "floorplanLibraryJson" TEXT,
    "quoteSettingsJson" TEXT,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RegisteredCompany_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RegisteredCompany" ("applianceLibraryJson", "authorizationNumber", "circuitChipsJson", "city", "closedAt", "companyName", "contactName", "createdAt", "creditsRemaining", "dic", "email", "floorplanLibraryJson", "ico", "id", "logoUrl", "passwordHash", "phone", "plantId", "productScope", "quoteSettingsJson", "stampUrl", "street", "termsAcceptedAt", "termsVersion", "updatedAt", "zip") SELECT "applianceLibraryJson", "authorizationNumber", "circuitChipsJson", "city", "closedAt", "companyName", "contactName", "createdAt", "creditsRemaining", "dic", "email", "floorplanLibraryJson", "ico", "id", "logoUrl", "passwordHash", "phone", "plantId", "productScope", "quoteSettingsJson", "stampUrl", "street", "termsAcceptedAt", "termsVersion", "updatedAt", "zip" FROM "RegisteredCompany";
DROP TABLE "RegisteredCompany";
ALTER TABLE "new_RegisteredCompany" RENAME TO "RegisteredCompany";
CREATE UNIQUE INDEX "RegisteredCompany_email_key" ON "RegisteredCompany"("email");
CREATE INDEX "RegisteredCompany_productScope_idx" ON "RegisteredCompany"("productScope");
CREATE INDEX "RegisteredCompany_ico_idx" ON "RegisteredCompany"("ico");
CREATE INDEX "RegisteredCompany_plantId_idx" ON "RegisteredCompany"("plantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "CreditTransaction_companyId_createdAt_idx" ON "CreditTransaction"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditTransaction_refType_refId_idx" ON "CreditTransaction"("refType", "refId");

-- Fáze 111: převod zůstatků na nový ceník – 1 původní kredit (= 1 rozváděč) = 15 kreditů nového ceníku (rozváděč 15 kr.)
INSERT INTO "CreditTransaction" ("id", "companyId", "amount", "balanceAfter", "reason", "note")
SELECT 'conv' || lower(hex(randomblob(10))), "id", "creditsRemaining" * 14, "creditsRemaining" * 15, 'CONVERSION', 'Převod na ceník fáze 111: 1 původní kredit (1 rozváděč) = 15 kreditů'
FROM "RegisteredCompany" WHERE "creditsRemaining" > 0;
UPDATE "RegisteredCompany" SET "creditsRemaining" = "creditsRemaining" * 15 WHERE "creditsRemaining" > 0;

-- Vzorový rozváděč PB-001 (ukázka dokumentace na webu) – bez zkušebního označení
UPDATE "PanelBoardProject" SET "license" = 'SAMPLE' WHERE "code" = 'PB-001';
