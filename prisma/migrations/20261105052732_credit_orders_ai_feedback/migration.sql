-- CreateTable
CREATE TABLE "CreditOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "variableSymbol" TEXT NOT NULL,
    "packageCode" TEXT NOT NULL,
    "creditsCount" INTEGER NOT NULL,
    "priceCzkExclVat" INTEGER NOT NULL,
    "priceCzkInclVat" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiFeedbackReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "companyId" TEXT,
    "photoUrl" TEXT,
    "detectedSnapshotJson" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiFeedbackReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiFeedbackReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditOrder_variableSymbol_key" ON "CreditOrder"("variableSymbol");

-- CreateIndex
CREATE INDEX "CreditOrder_companyId_createdAt_idx" ON "CreditOrder"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditOrder_status_idx" ON "CreditOrder"("status");

-- CreateIndex
CREATE INDEX "AiFeedbackReport_status_createdAt_idx" ON "AiFeedbackReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AiFeedbackReport_projectId_idx" ON "AiFeedbackReport"("projectId");

-- CreateIndex
CREATE INDEX "AiFeedbackReport_companyId_idx" ON "AiFeedbackReport"("companyId");
