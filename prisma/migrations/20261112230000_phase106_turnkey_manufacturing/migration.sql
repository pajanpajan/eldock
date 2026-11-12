-- Fáze 106: zasmluvnění výrobci rozváděčů (portál /vyroba-rozvadecu) a zakázky výroby rozváděče na klíč
-- (poptávka s rezervací QR štítku EL-…, přijetí výrobcem, kusová zkouška, uzamčení Verze 1.0).

-- CreateTable
CREATE TABLE "PanelManufacturer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "ico" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "region" TEXT NOT NULL,
    "leadDays" INTEGER NOT NULL DEFAULT 10,
    "accessHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ManufacturingOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "region" TEXT NOT NULL,
    "broadcast" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "qrSerial" TEXT NOT NULL,
    "configJson" TEXT NOT NULL,
    "estimateJson" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "deliveryAddress" TEXT,
    "note" TEXT,
    "acceptedPriceCzk" REAL,
    "acceptedDays" INTEGER,
    "routineTestJson" TEXT,
    "enclosureSerial" TEXT,
    "version" TEXT,
    "acceptedAt" DATETIME,
    "testedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManufacturingOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManufacturingOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ManufacturingOrder_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "PanelManufacturer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PanelManufacturer_email_key" ON "PanelManufacturer"("email");
CREATE INDEX "PanelManufacturer_region_active_idx" ON "PanelManufacturer"("region", "active");
CREATE UNIQUE INDEX "ManufacturingOrder_number_key" ON "ManufacturingOrder"("number");
CREATE INDEX "ManufacturingOrder_manufacturerId_status_idx" ON "ManufacturingOrder"("manufacturerId", "status");
CREATE INDEX "ManufacturingOrder_region_status_idx" ON "ManufacturingOrder"("region", "status");
CREATE INDEX "ManufacturingOrder_companyId_idx" ON "ManufacturingOrder"("companyId");
CREATE INDEX "ManufacturingOrder_projectId_idx" ON "ManufacturingOrder"("projectId");
