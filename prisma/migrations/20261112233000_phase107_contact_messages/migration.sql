-- Fáze 107: kontaktní a zpětnovazební hub – zprávy s číslem tiketu #EL-…, printscreeny (storage/uploads/feedback),
-- technickou diagnostikou, stavem Nové → V řešení → Vyřešeno a interní poznámkou velínu.

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticket" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "subtype" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "name" TEXT,
    "company" TEXT,
    "ico" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "detailsJson" TEXT NOT NULL DEFAULT '{}',
    "diagnosticsJson" TEXT NOT NULL DEFAULT '{}',
    "attachmentsJson" TEXT NOT NULL DEFAULT '[]',
    "internalNote" TEXT,
    "senderCompanyId" TEXT,
    "notifiedAt" DATETIME,
    "notifyError" TEXT,
    "readAt" DATETIME,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ContactMessage_ticket_key" ON "ContactMessage"("ticket");

-- CreateIndex
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_category_createdAt_idx" ON "ContactMessage"("category", "createdAt");

-- CreateIndex
CREATE INDEX "ContactMessage_readAt_idx" ON "ContactMessage"("readAt");
