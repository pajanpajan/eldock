-- CreateTable
CREATE TABLE "MonitoredComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "modelNumber" TEXT,
    "wearCategory" TEXT NOT NULL,
    "installedAt" DATETIME NOT NULL,
    "cyclesPerHour" REAL,
    "manualCyclesOffset" INTEGER NOT NULL DEFAULT 0,
    "maxElectricalCycles" INTEGER,
    "maxOperatingHours" INTEGER,
    "maxCalendarMonths" INTEGER,
    "replacementStockCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MonitoredComponent_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "usageGroup" TEXT,
    "protectionClass" TEXT,
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
INSERT INTO "new_Equipment" ("assignedZone", "batteryPassportJson", "createdAt", "description", "externalInfluences", "fedFromCircuit", "fedFromEquipmentId", "floorId", "id", "inspectionIntervalMonths", "inventoryNumber", "ipRating", "manufacturer", "model", "name", "photoUrl", "pinX", "pinY", "protectionClass", "qrToken", "ratedCurrent", "ratedVoltage", "serialNumber", "status", "tag", "type", "updatedAt", "usageGroup", "yearInstalled") SELECT "assignedZone", "batteryPassportJson", "createdAt", "description", "externalInfluences", "fedFromCircuit", "fedFromEquipmentId", "floorId", "id", "inspectionIntervalMonths", "inventoryNumber", "ipRating", "manufacturer", "model", "name", "photoUrl", "pinX", "pinY", "protectionClass", "qrToken", "ratedCurrent", "ratedVoltage", "serialNumber", "status", "tag", "type", "updatedAt", "usageGroup", "yearInstalled" FROM "Equipment";
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

-- CreateIndex
CREATE INDEX "MonitoredComponent_equipmentId_idx" ON "MonitoredComponent"("equipmentId");
