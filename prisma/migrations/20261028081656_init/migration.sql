-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Plant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CZ',
    "campusMapUrl" TEXT,
    "campusViewBoxW" INTEGER NOT NULL DEFAULT 1000,
    "campusViewBoxH" INTEGER NOT NULL DEFAULT 700,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'PRODUCTION',
    "description" TEXT,
    "mapPolygon" TEXT NOT NULL,
    "labelX" REAL NOT NULL,
    "labelY" REAL NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Building_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "floorplanUrl" TEXT,
    "floorplanSvg" TEXT,
    "viewBoxW" INTEGER NOT NULL DEFAULT 1200,
    "viewBoxH" INTEGER NOT NULL DEFAULT 800,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "serialNumber" TEXT,
    "yearInstalled" INTEGER,
    "ratedVoltage" TEXT,
    "ratedCurrent" TEXT,
    "ipRating" TEXT,
    "pinX" REAL NOT NULL,
    "pinY" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Equipment_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DocumentRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "schematicUrl" TEXT NOT NULL,
    "schematicFormat" TEXT NOT NULL DEFAULT 'PDF',
    "sheetCount" INTEGER NOT NULL DEFAULT 1,
    "thumbnailUrl" TEXT,
    "bomFileUrl" TEXT,
    "layoutUrl" TEXT,
    "model3dUrl" TEXT,
    "authorId" TEXT NOT NULL,
    "approverId" TEXT,
    "approvedAt" DATETIME,
    "changeRequestId" TEXT,
    "rejectionComment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentRevision_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DocumentRevision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DocumentRevision_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "revisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "designation" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "manufacturer" TEXT,
    "partNumber" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ks',
    "note" TEXT,
    CONSTRAINT "BomItem_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DocumentRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "baseRevisionId" TEXT,
    "markupSheet" INTEGER NOT NULL DEFAULT 1,
    "markupData" TEXT,
    "markupImageUrl" TEXT,
    "voiceTranscript" TEXT,
    "note" TEXT,
    "reporterId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "engineerSummary" TEXT,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" DATETIME,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangeRequest_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_baseRevisionId_fkey" FOREIGN KEY ("baseRevisionId") REFERENCES "DocumentRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeRequestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "fileName" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeRequestEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "changeRequestId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "revisionId" TEXT,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequestEvent_changeRequestId_fkey" FOREIGN KEY ("changeRequestId") REFERENCES "ChangeRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequestEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequestEvent_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "DocumentRevision" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Plant_code_key" ON "Plant"("code");

-- CreateIndex
CREATE INDEX "Building_plantId_idx" ON "Building"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "Building_plantId_code_key" ON "Building"("plantId", "code");

-- CreateIndex
CREATE INDEX "Floor_buildingId_idx" ON "Floor"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_buildingId_level_key" ON "Floor"("buildingId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_buildingId_code_key" ON "Floor"("buildingId", "code");

-- CreateIndex
CREATE INDEX "Equipment_floorId_idx" ON "Equipment"("floorId");

-- CreateIndex
CREATE INDEX "Equipment_status_idx" ON "Equipment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_floorId_tag_key" ON "Equipment"("floorId", "tag");

-- CreateIndex
CREATE INDEX "DocumentRevision_equipmentId_status_idx" ON "DocumentRevision"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "DocumentRevision_changeRequestId_idx" ON "DocumentRevision"("changeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentRevision_equipmentId_major_minor_key" ON "DocumentRevision"("equipmentId", "major", "minor");

-- CreateIndex
CREATE INDEX "BomItem_revisionId_idx" ON "BomItem"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeRequest_number_key" ON "ChangeRequest"("number");

-- CreateIndex
CREATE INDEX "ChangeRequest_equipmentId_status_idx" ON "ChangeRequest"("equipmentId", "status");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ChangeRequest_assigneeId_idx" ON "ChangeRequest"("assigneeId");

-- CreateIndex
CREATE INDEX "Attachment_changeRequestId_idx" ON "Attachment"("changeRequestId");

-- CreateIndex
CREATE INDEX "ChangeRequestEvent_changeRequestId_createdAt_idx" ON "ChangeRequestEvent"("changeRequestId", "createdAt");
