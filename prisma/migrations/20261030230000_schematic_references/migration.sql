-- CreateTable
CREATE TABLE "SchematicReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "designation" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "linkedEquipmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SchematicReference_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DocumentRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SchematicReference_linkedEquipmentId_fkey" FOREIGN KEY ("linkedEquipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SchematicReference_revisionId_page_idx" ON "SchematicReference"("revisionId", "page");

-- CreateIndex
CREATE INDEX "SchematicReference_linkedEquipmentId_idx" ON "SchematicReference"("linkedEquipmentId");

