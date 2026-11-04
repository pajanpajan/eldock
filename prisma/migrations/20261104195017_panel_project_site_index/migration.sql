-- DropIndex
DROP INDEX "PanelBoardProject_companyId_idx";

-- AlterTable
ALTER TABLE "PanelBoardProject" ADD COLUMN "installationSite" TEXT;

-- CreateIndex
CREATE INDEX "PanelBoardProject_companyId_updatedAt_idx" ON "PanelBoardProject"("companyId", "updatedAt");
