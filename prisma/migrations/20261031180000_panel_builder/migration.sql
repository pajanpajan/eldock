-- CreateTable
CREATE TABLE "CatalogComponent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturer" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "typeCode" TEXT NOT NULL,
    "articleNumber" TEXT NOT NULL,
    "ean" TEXT,
    "category" TEXT NOT NULL,
    "poles" TEXT NOT NULL,
    "ratedCurrentA" REAL NOT NULL,
    "trippingCurve" TEXT,
    "breakingCapacityKa" REAL,
    "rcdSensitivityMa" INTEGER,
    "rcdType" TEXT,
    "modulesCount" REAL NOT NULL,
    "widthMm" REAL,
    "heightMm" REAL,
    "depthMm" REAL,
    "powerLossWatts" REAL NOT NULL,
    "iecSymbol" TEXT NOT NULL DEFAULT 'GENERIC',
    "description" TEXT NOT NULL,
    "dataSource" TEXT NOT NULL DEFAULT 'SEED_CATALOG',
    "sourcePdfName" TEXT,
    "sourcePage" INTEGER,
    "searchText" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PanelBoardProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "equipmentId" TEXT,
    "customerName" TEXT,
    "manufacturerInfoJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "enclosureType" TEXT NOT NULL DEFAULT 'WALL_MOUNTED',
    "enclosureMaterial" TEXT NOT NULL DEFAULT 'PLASTIC',
    "enclosureModel" TEXT NOT NULL DEFAULT '',
    "norm" TEXT NOT NULL DEFAULT 'EN 61439-3',
    "widthMm" INTEGER NOT NULL DEFAULT 292,
    "heightMm" INTEGER NOT NULL DEFAULT 507,
    "depthMm" INTEGER NOT NULL DEFAULT 120,
    "ipRating" TEXT NOT NULL DEFAULT 'IP 41',
    "networkSystem" TEXT NOT NULL DEFAULT '3 x 230/400 V, 50Hz, TN-S',
    "shortCircuitKa" REAL NOT NULL DEFAULT 6,
    "ambientTempC" REAL NOT NULL DEFAULT 30,
    "simultaneityFactor" REAL NOT NULL DEFAULT 0.5,
    "internalWiringLossW" REAL NOT NULL DEFAULT 4.1,
    "dinRailsCount" INTEGER NOT NULL DEFAULT 3,
    "modulesPerRail" INTEGER NOT NULL DEFAULT 12,
    "photoUrl" TEXT,
    "dominantManufacturer" TEXT NOT NULL DEFAULT 'ABB',
    "analysisMode" TEXT,
    "createdById" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardProject_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PanelBoardItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "catalogComponentId" TEXT,
    "dinRailIndex" INTEGER NOT NULL,
    "positionOnRail" INTEGER NOT NULL,
    "modulesWidth" REAL NOT NULL,
    "boundingBoxJson" TEXT,
    "recognitionStatus" TEXT NOT NULL DEFAULT 'UNRECOGNIZED',
    "confidence" REAL NOT NULL DEFAULT 0,
    "rawOcrText" TEXT,
    "detectedJson" TEXT,
    "designation" TEXT NOT NULL,
    "circuitLabel" TEXT NOT NULL DEFAULT '',
    "phaseAssignment" TEXT,
    "operatingCurrentA" REAL,
    "parentItemId" TEXT,
    "fedFromIncomer" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelBoardItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "PanelBoardProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardItem_catalogComponentId_fkey" FOREIGN KEY ("catalogComponentId") REFERENCES "CatalogComponent" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PanelBoardItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "PanelBoardItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogComponent_articleNumber_key" ON "CatalogComponent"("articleNumber");

-- CreateIndex
CREATE INDEX "CatalogComponent_category_poles_ratedCurrentA_trippingCurve_idx" ON "CatalogComponent"("category", "poles", "ratedCurrentA", "trippingCurve");

-- CreateIndex
CREATE INDEX "CatalogComponent_manufacturer_typeCode_idx" ON "CatalogComponent"("manufacturer", "typeCode");

-- CreateIndex
CREATE UNIQUE INDEX "PanelBoardProject_code_key" ON "PanelBoardProject"("code");

-- CreateIndex
CREATE INDEX "PanelBoardProject_equipmentId_idx" ON "PanelBoardProject"("equipmentId");

-- CreateIndex
CREATE INDEX "PanelBoardItem_projectId_dinRailIndex_positionOnRail_idx" ON "PanelBoardItem"("projectId", "dinRailIndex", "positionOnRail");

-- CreateIndex
CREATE INDEX "PanelBoardItem_catalogComponentId_idx" ON "PanelBoardItem"("catalogComponentId");

-- CreateIndex
CREATE INDEX "PanelBoardItem_parentItemId_idx" ON "PanelBoardItem"("parentItemId");

