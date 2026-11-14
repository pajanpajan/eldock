-- Fáze 116: životnost součástek napárovaná na kusovník (předstih upozornění, odečet motohodin, kusy),
-- sklad náhradních dílů závodu podle MPN, vygenerované protokoly pasportu, odpovědné osoby LOTO,
-- upřesnění místa pro pochůzku revizního technika a impedance smyčky Z_s v rychlém zápisu.

-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "lifespanAlertDays" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Equipment" ADD COLUMN "lotoResponsibleJson" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "locationNote" TEXT;

-- AlterTable
ALTER TABLE "MonitoredComponent" ADD COLUMN "alertLeadDays" INTEGER;
ALTER TABLE "MonitoredComponent" ADD COLUMN "hoursReading" INTEGER;
ALTER TABLE "MonitoredComponent" ADD COLUMN "hoursReadingAt" DATETIME;
ALTER TABLE "MonitoredComponent" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MonitoredComponent" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "ComplianceDocument" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'UPLOAD';
ALTER TABLE "ComplianceDocument" ADD COLUMN "generatedJson" TEXT;

-- AlterTable
ALTER TABLE "InspectionRecord" ADD COLUMN "loopImpedanceOhm" REAL;

-- CreateTable
CREATE TABLE "SparePartStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "partKey" TEXT NOT NULL,
    "partNumber" TEXT NOT NULL,
    "manufacturer" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SparePartStock_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SparePartStock_plantId_partKey_key" ON "SparePartStock"("plantId", "partKey");
