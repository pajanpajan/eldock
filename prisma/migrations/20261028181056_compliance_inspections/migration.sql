-- CreateTable
CREATE TABLE "ComplianceDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL,
    "issuer" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ComplianceDocument_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InspectionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "inspectionDate" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "inspectorLicense" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "defectsSummary" TEXT,
    "reportUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Equipment_fedFromEquipmentId_fkey" FOREIGN KEY ("fedFromEquipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Equipment" ("createdAt", "description", "floorId", "id", "ipRating", "manufacturer", "model", "name", "pinX", "pinY", "ratedCurrent", "ratedVoltage", "serialNumber", "status", "tag", "type", "updatedAt", "yearInstalled") SELECT "createdAt", "description", "floorId", "id", "ipRating", "manufacturer", "model", "name", "pinX", "pinY", "ratedCurrent", "ratedVoltage", "serialNumber", "status", "tag", "type", "updatedAt", "yearInstalled" FROM "Equipment";
DROP TABLE "Equipment";
ALTER TABLE "new_Equipment" RENAME TO "Equipment";
CREATE INDEX "Equipment_floorId_idx" ON "Equipment"("floorId");
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");
CREATE INDEX "Equipment_fedFromEquipmentId_idx" ON "Equipment"("fedFromEquipmentId");
CREATE UNIQUE INDEX "Equipment_floorId_tag_key" ON "Equipment"("floorId", "tag");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ComplianceDocument_equipmentId_category_idx" ON "ComplianceDocument"("equipmentId", "category");

-- CreateIndex
CREATE INDEX "InspectionRecord_equipmentId_inspectionDate_idx" ON "InspectionRecord"("equipmentId", "inspectionDate");

-- CreateIndex
CREATE INDEX "InspectionRecord_validUntil_idx" ON "InspectionRecord"("validUntil");
