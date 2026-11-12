-- CreateTable
CREATE TABLE "TelemetryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "referrerHost" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "landing" BOOLEAN NOT NULL DEFAULT false,
    "visitorId" TEXT,
    "companyId" TEXT,
    "props" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "ico" TEXT,
    "companyName" TEXT,
    "dic" TEXT,
    "address" TEXT,
    "nace" TEXT NOT NULL DEFAULT '[]',
    "segment" TEXT,
    "role" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "utmCampaign" TEXT,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentText" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "registeredCompanyId" TEXT,
    "captures" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "TelemetryEvent_type_createdAt_idx" ON "TelemetryEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "TelemetryEvent_createdAt_idx" ON "TelemetryEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_token_key" ON "Lead"("token");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

