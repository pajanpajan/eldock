-- AlterTable
ALTER TABLE "Plant" ADD COLUMN "designerEmail" TEXT;
ALTER TABLE "Plant" ADD COLUMN "designerName" TEXT;

-- CreateTable
CREATE TABLE "SwitchboardVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOCKED_PUBLISHED',
    "inspectorName" TEXT NOT NULL,
    "inspectorCert" TEXT NOT NULL,
    "measuredAt" DATETIME NOT NULL,
    "measurementsJson" TEXT NOT NULL,
    "documentationJson" TEXT NOT NULL,
    "floorplanJson" TEXT,
    "floorplanName" TEXT,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" DATETIME,
    "supersededByVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SwitchboardVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QrLabelCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "lastSequenceNumber" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "QrLabelBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "ico" TEXT,
    "email" TEXT,
    "registeredCompanyId" TEXT,
    "purpose" TEXT NOT NULL,
    "firstSequence" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" DATETIME
);

-- CreateTable
CREATE TABLE "QrLabelItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sequence" INTEGER NOT NULL,
    "serialCode" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "activatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrLabelItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "QrLabelBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PoolDesigner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RedlineTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeRequestId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "sheets" INTEGER NOT NULL DEFAULT 1,
    "rewardCzk" INTEGER,
    "dueAt" DATETIME,
    "description" TEXT,
    "internalName" TEXT,
    "internalEmail" TEXT,
    "claimedById" TEXT,
    "claimedAt" DATETIME,
    "resultPdfUrl" TEXT,
    "resultCadUrl" TEXT,
    "submittedAt" DATETIME,
    "revisionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RedlineTask_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RedlineTask_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "PoolDesigner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "boardCode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureFixed", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "environmentConfirmedAt", "equipmentId", "fanCount", "fanId", "feederJson", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "occupancy", "parentBoardId", "photoUrl", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "supplyPhases", "trainerPreset", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "boardCode", "cableReportJson", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureFixed", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "environmentConfirmedAt", "equipmentId", "fanCount", "fanId", "feederJson", "floorplanJson", "heightMm", "id", "incomerFrom", "installationSite", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "occupancy", "parentBoardId", "photoUrl", "railModulesJson", "railPhotosJson", "releasedAt", "routineTestJson", "shortCircuitKa", "simultaneityFactor", "standardEdition", "status", "supplyPhases", "trainerPreset", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE UNIQUE INDEX "PanelBoardProject_qrSerial_key" ON "PanelBoardProject"("qrSerial");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_updatedAt_idx" ON "PanelBoardProject"("companyId", "updatedAt");
CREATE INDEX "PanelBoardProject_enclosureId_idx" ON "PanelBoardProject"("enclosureId");
CREATE INDEX "PanelBoardProject_parentBoardId_idx" ON "PanelBoardProject"("parentBoardId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SwitchboardVersion_projectId_status_idx" ON "SwitchboardVersion"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SwitchboardVersion_projectId_major_minor_key" ON "SwitchboardVersion"("projectId", "major", "minor");

-- CreateIndex
CREATE INDEX "QrLabelBatch_registeredCompanyId_idx" ON "QrLabelBatch"("registeredCompanyId");

-- CreateIndex
CREATE INDEX "QrLabelBatch_createdAt_idx" ON "QrLabelBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QrLabelItem_sequence_key" ON "QrLabelItem"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "QrLabelItem_serialCode_key" ON "QrLabelItem"("serialCode");

-- CreateIndex
CREATE INDEX "QrLabelItem_batchId_idx" ON "QrLabelItem"("batchId");

-- CreateIndex
CREATE INDEX "QrLabelItem_targetType_targetId_idx" ON "QrLabelItem"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolDesigner_email_key" ON "PoolDesigner"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RedlineTask_changeRequestId_key" ON "RedlineTask"("changeRequestId");

-- CreateIndex
CREATE INDEX "RedlineTask_mode_status_idx" ON "RedlineTask"("mode", "status");

