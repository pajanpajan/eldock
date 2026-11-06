-- AlterTable
ALTER TABLE "PanelBoardProject" ADD COLUMN "environmentConfirmedAt" DATETIME;

-- Fáze 57: dokumentace propuštěná do provozu už prostředí použila → považuje se za potvrzené
UPDATE "PanelBoardProject" SET "environmentConfirmedAt" = "releasedAt" WHERE "releasedAt" IS NOT NULL;
