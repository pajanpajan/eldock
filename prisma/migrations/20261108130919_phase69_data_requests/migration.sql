-- AlterTable
ALTER TABLE "RegisteredCompany" ADD COLUMN "closedAt" DATETIME;

-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DONE',
    "companyId" TEXT,
    "companyName" TEXT,
    "companyIco" TEXT,
    "productScope" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "summaryJson" TEXT,
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "DataRequest_kind_status_scheduledAt_idx" ON "DataRequest"("kind", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "DataRequest_companyId_kind_idx" ON "DataRequest"("companyId", "kind");
