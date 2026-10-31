-- AlterTable
ALTER TABLE "CatalogComponent" ADD COLUMN "coilVoltage" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "contactConfig" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "moduleSubtype" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "relaySubtype" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "spdType" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "surgeCurrentKa" REAL;

-- AlterTable
ALTER TABLE "PanelBoardItem" ADD COLUMN "configJson" TEXT;
ALTER TABLE "PanelBoardItem" ADD COLUMN "customTypeCode" TEXT;

