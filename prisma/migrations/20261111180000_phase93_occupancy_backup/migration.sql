-- Fáze 93: typ objektu a normativní režim projektu rozváděče (bytová instalace / obchodní centrum BD4 / zdravotnictví)
ALTER TABLE "PanelBoardProject" ADD COLUMN "occupancy" TEXT NOT NULL DEFAULT 'RESIDENTIAL';

-- Fáze 93: zálohování napájení rozváděče a jeho přívodní trasy, kapacita zdroje zálohy, nájemní jednotka / oddělení
-- a varianta revizní kategorie (zdravotnické přístroje a prostory)
ALTER TABLE "Equipment" ADD COLUMN "powerBackupTier" TEXT NOT NULL DEFAULT 'GRID_STANDARD';
ALTER TABLE "Equipment" ADD COLUMN "backupCapacityKva" REAL;
ALTER TABLE "Equipment" ADD COLUMN "tenantUnit" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "inspectionVariant" TEXT;
