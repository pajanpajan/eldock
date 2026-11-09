-- Fáze 74: rozváděč z půdorysu s podružnými rozváděči (kód rozváděče, vazba na hlavní rozváděč, přívod)
ALTER TABLE "PanelBoardProject" ADD COLUMN "boardCode" TEXT;
ALTER TABLE "PanelBoardProject" ADD COLUMN "parentBoardId" TEXT;
ALTER TABLE "PanelBoardProject" ADD COLUMN "feederJson" TEXT;

-- CreateIndex
CREATE INDEX "PanelBoardProject_parentBoardId_idx" ON "PanelBoardProject"("parentBoardId");
