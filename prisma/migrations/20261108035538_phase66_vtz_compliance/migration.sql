-- AlterTable
ALTER TABLE "InspectionDefect" ADD COLUMN "provision" TEXT;

-- AlterTable
ALTER TABLE "InspectionRecord" ADD COLUMN "actsPerformed" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "documentsUsed" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "extraordinaryReason" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "handedOverAt" DATETIME;
ALTER TABLE "InspectionRecord" ADD COLUMN "inspectorScope" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "inspectorValidUntil" DATETIME;
ALTER TABLE "InspectionRecord" ADD COLUMN "previousEvaluation" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "reportedAt" DATETIME;
ALTER TABLE "InspectionRecord" ADD COLUMN "scopeNote" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "startedAt" DATETIME;
ALTER TABLE "InspectionRecord" ADD COLUMN "validUntilOriginal" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "description" TEXT,
    "crowdOver200" BOOLEAN NOT NULL DEFAULT false,
    "mapPolygon" TEXT NOT NULL,
    "labelX" REAL NOT NULL,
    "labelY" REAL NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Building_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Building" ("code", "color", "createdAt", "description", "id", "labelX", "labelY", "mapPolygon", "name", "plantId", "shortName", "sortOrder", "type", "updatedAt") SELECT "code", "color", "createdAt", "description", "id", "labelX", "labelY", "mapPolygon", "name", "plantId", "shortName", "sortOrder", "type", "updatedAt" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE INDEX "Building_plantId_idx" ON "Building"("plantId");
CREATE UNIQUE INDEX "Building_plantId_code_key" ON "Building"("plantId", "code");
CREATE TABLE "new_Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearInstalled" INTEGER,
    "ratedVoltage" TEXT,
    "ratedCurrent" TEXT,
    "ipRating" TEXT,
    "pinX" REAL NOT NULL,
    "pinY" REAL NOT NULL,
    "fedFromEquipmentId" TEXT,
    "fedFromCircuit" TEXT,
    "inspectionIntervalMonths" INTEGER NOT NULL DEFAULT 36,
    "externalInfluences" TEXT,
    "installationKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "lpsCritical" BOOLEAN NOT NULL DEFAULT false,
    "preventiveMaintenance" BOOLEAN NOT NULL DEFAULT false,
    "usageGroup" TEXT,
    "protectionClass" TEXT,
    "handHeld" BOOLEAN NOT NULL DEFAULT false,
    "inventoryNumber" TEXT,
    "assignedZone" TEXT,
    "photoUrl" TEXT,
    "qrToken" TEXT,
    "batteryPassportJson" TEXT,
    "shiftRegime" INTEGER NOT NULL DEFAULT 2,
    "internalTempC" REAL,
    "feederCableType" TEXT,
    "feederConductorMaterial" TEXT NOT NULL DEFAULT 'CU',
    "feederCrossSectionMm2" REAL,
    "feederParallelRuns" INTEGER NOT NULL DEFAULT 1,
    "feederLengthM" REAL,
    "feederInstallMethod" TEXT NOT NULL DEFAULT 'E',
    "feederGroupingCount" INTEGER NOT NULL DEFAULT 1,
    "feederAmbientTempC" REAL NOT NULL DEFAULT 30,
    "feederUpstreamBreakerA" REAL,
    "nominalCurrentA" REAL,
    "measuredCurrentA" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_fedFromEquipmentId_fkey" FOREIGN KEY ("fedFromEquipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("assignedZone", "batteryPassportJson", "createdAt", "description", "externalInfluences", "fedFromCircuit", "fedFromEquipmentId", "feederAmbientTempC", "feederCableType", "feederConductorMaterial", "feederCrossSectionMm2", "feederGroupingCount", "feederInstallMethod", "feederLengthM", "feederParallelRuns", "feederUpstreamBreakerA", "floorId", "id", "inspectionIntervalMonths", "internalTempC", "inventoryNumber", "ipRating", "manufacturer", "measuredCurrentA", "model", "name", "nominalCurrentA", "photoUrl", "pinX", "pinY", "protectionClass", "qrToken", "ratedCurrent", "ratedVoltage", "serialNumber", "shiftRegime", "status", "tag", "type", "updatedAt", "usageGroup", "yearInstalled") SELECT "assignedZone", "batteryPassportJson", "createdAt", "description", "externalInfluences", "fedFromCircuit", "fedFromEquipmentId", "feederAmbientTempC", "feederCableType", "feederConductorMaterial", "feederCrossSectionMm2", "feederGroupingCount", "feederInstallMethod", "feederLengthM", "feederParallelRuns", "feederUpstreamBreakerA", "floorId", "id", "inspectionIntervalMonths", "internalTempC", "inventoryNumber", "ipRating", "manufacturer", "measuredCurrentA", "model", "name", "nominalCurrentA", "photoUrl", "pinX", "pinY", "protectionClass", "qrToken", "ratedCurrent", "ratedVoltage", "serialNumber", "shiftRegime", "status", "tag", "type", "updatedAt", "usageGroup", "yearInstalled" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
CREATE UNIQUE INDEX "Equipment_qrToken_key" ON "Equipment"("qrToken");
CREATE INDEX "Equipment_floorId_idx" ON "Equipment"("floorId");
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");
CREATE INDEX "Equipment_fedFromEquipmentId_idx" ON "Equipment"("fedFromEquipmentId");
CREATE INDEX "Equipment_type_idx" ON "Equipment"("type");
CREATE UNIQUE INDEX "Equipment_floorId_tag_key" ON "Equipment"("floorId", "tag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
