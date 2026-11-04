-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "batteryPassportJson" TEXT;

-- CreateTable
CREATE TABLE "EquipmentDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "componentTag" TEXT,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "language" TEXT NOT NULL DEFAULT 'cs',
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EquipmentDocument_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EquipmentDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SoftwareBackup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "targetUnit" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "firmwareVersion" TEXT,
    "isSafetyRelated" BOOLEAN NOT NULL DEFAULT false,
    "safetyChecksum" TEXT,
    "changeSummary" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "changeRequestId" TEXT,
    "authorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoftwareBackup_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SoftwareBackup_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SoftwareBackup_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "baseRevisionId" TEXT,
    "markupSheet" INTEGER NOT NULL DEFAULT 1,
    "markupData" TEXT,
    "markupImageUrl" TEXT,
    "voiceTranscript" TEXT,
    "note" TEXT,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "engineerSummary" TEXT,
    "safetyImpact" TEXT NOT NULL DEFAULT 'NONE_1_TO_1',
    "requiresSoftwareUpdate" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" DATETIME,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangeRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_baseRevisionId_fkey" FOREIGN KEY ("baseRevisionId") REFERENCES "DocumentRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChangeRequest" ("assignedAt", "assigneeId", "baseRevisionId", "closedAt", "engineerSummary", "equipmentId", "id", "markupData", "markupImageUrl", "markupSheet", "note", "number", "priority", "reporterId", "resolvedAt", "status", "submittedAt", "updatedAt", "voiceTranscript") SELECT "assignedAt", "assigneeId", "baseRevisionId", "closedAt", "engineerSummary", "equipmentId", "id", "markupData", "markupImageUrl", "markupSheet", "note", "number", "priority", "reporterId", "resolvedAt", "status", "submittedAt", "updatedAt", "voiceTranscript" FROM "ChangeRequest";
DROP TABLE "ChangeRequest";
ALTER TABLE "new_ChangeRequest" RENAME TO "ChangeRequest";
CREATE UNIQUE INDEX "ChangeRequest_number_key" ON "ChangeRequest"("number");
CREATE INDEX "ChangeRequest_equipmentId_status_idx" ON "ChangeRequest"("equipmentId", "status");
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");
CREATE INDEX "ChangeRequest_assigneeId_idx" ON "ChangeRequest"("assigneeId");
CREATE INDEX "ChangeRequest_reporterId_idx" ON "ChangeRequest"("reporterId");
CREATE INDEX "ChangeRequest_baseRevisionId_idx" ON "ChangeRequest"("baseRevisionId");
CREATE INDEX "ChangeRequest_submittedAt_idx" ON "ChangeRequest"("submittedAt");
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
    "environment" TEXT NOT NULL DEFAULT 'INDOOR_DRY',
    "standardEdition" TEXT NOT NULL DEFAULT 'CSN_61439_3_ED2',
    "routineTestJson" TEXT,
    "createdById" TEXT,
    "companyId" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardProject_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardProject_enclosureId_fkey" FOREIGN KEY ("enclosureId") REFERENCES "PanelEnclosure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PanelBoardProject" ("ambientTempC", "analysisMode", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "equipmentId", "heightMm", "id", "incomerFrom", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "railModulesJson", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm") SELECT "ambientTempC", "analysisMode", "code", "companyId", "coverState", "createdAt", "createdById", "customerName", "depthMm", "designMode", "dinRailsCount", "dominantManufacturer", "enclosureId", "enclosureMaterial", "enclosureModel", "enclosurePmaxW", "enclosureType", "environment", "equipmentId", "heightMm", "id", "incomerFrom", "internalWiringLossW", "ipRating", "manufacturerInfoJson", "modulesPerRail", "name", "networkSystem", "norm", "photoUrl", "railModulesJson", "releasedAt", "shortCircuitKa", "simultaneityFactor", "status", "updatedAt", "widthMm" FROM "PanelBoardProject";
DROP TABLE "PanelBoardProject";
ALTER TABLE "new_PanelBoardProject" RENAME TO "PanelBoardProject";
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");
CREATE INDEX "PanelBoardProject_companyId_idx" ON "PanelBoardProject"("companyId");
CREATE INDEX "PanelBoardProject_enclosureId_idx" ON "PanelBoardProject"("enclosureId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EquipmentDocument_equipmentId_category_idx" ON "EquipmentDocument"("equipmentId", "category");

-- CreateIndex
CREATE INDEX "EquipmentDocument_equipmentId_componentTag_idx" ON "EquipmentDocument"("equipmentId", "componentTag");

-- CreateIndex
CREATE INDEX "SoftwareBackup_equipmentId_targetUnit_status_idx" ON "SoftwareBackup"("equipmentId", "targetUnit", "status");

-- CreateIndex
CREATE INDEX "SoftwareBackup_changeRequestId_idx" ON "SoftwareBackup"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareBackup_equipmentId_targetUnit_major_minor_key" ON "SoftwareBackup"("equipmentId", "targetUnit", "major", "minor");
