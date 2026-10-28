-- AlterTable
ALTER TABLE "InspectionRecord" ADD COLUMN "deltaTempC" REAL;
ALTER TABLE "InspectionRecord" ADD COLUMN "maxTempC" REAL;

-- CreateTable
CREATE TABLE "InspectionDefect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inspectionId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MAJOR',
    "deadline" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "resolvedBy" TEXT,
    "resolutionNote" TEXT,
    "resolutionPhotoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionDefect_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "InspectionRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InspectionDefect_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemporaryModification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdByRole" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "photoUrl" TEXT,
    "markupJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "resolvedAt" DATETIME,
    "resolvedByName" TEXT,
    "resolutionNote" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "spawnedChangeRequestId" TEXT,
    CONSTRAINT "TemporaryModification_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemporaryModification_spawnedChangeRequestId_fkey" FOREIGN KEY ("spawnedChangeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "InspectionDefect_equipmentId_status_idx" ON "InspectionDefect"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "InspectionDefect_inspectionId_idx" ON "InspectionDefect"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryModification_number_key" ON "TemporaryModification"("number");

-- CreateIndex
CREATE INDEX "TemporaryModification_equipmentId_status_idx" ON "TemporaryModification"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "TemporaryModification_status_expiresAt_idx" ON "TemporaryModification"("status", "expiresAt");
