-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "assignedZone" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "inventoryNumber" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "protectionClass" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "usageGroup" TEXT;

-- AlterTable
ALTER TABLE "InspectionRecord" ADD COLUMN "insulationResistance" REAL;
ALTER TABLE "InspectionRecord" ADD COLUMN "measuringInstrument" TEXT;
ALTER TABLE "InspectionRecord" ADD COLUMN "protectiveConductorResistance" REAL;
