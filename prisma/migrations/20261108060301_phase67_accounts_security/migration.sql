-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "device" TEXT,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "companyId" TEXT,
    "actorId" TEXT,
    "email" TEXT,
    "ipKey" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "accountType" TEXT,
    "title" TEXT,
    "scopeLayers" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "homePlantId" TEXT,
    "companyId" TEXT,
    "passwordHash" TEXT,
    "passwordChangedAt" DATETIME,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" DATETIME,
    "lastLoginAt" DATETIME,
    "totpSecret" TEXT,
    "totpEnabledAt" DATETIME,
    "totpRecoveryJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_homePlantId_fkey" FOREIGN KEY ("homePlantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "RegisteredCompany" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("accountType", "avatarUrl", "company", "companyId", "createdAt", "email", "homePlantId", "id", "name", "phone", "role", "scopeLayers", "sortOrder", "title", "updatedAt") SELECT "accountType", "avatarUrl", "company", "companyId", "createdAt", "email", "homePlantId", "id", "name", "phone", "role", "scopeLayers", "sortOrder", "title", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_accountType_idx" ON "User"("accountType");
CREATE INDEX "User_homePlantId_idx" ON "User"("homePlantId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserSession_userId_revokedAt_idx" ON "UserSession"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_kind_idx" ON "AuthToken"("userId", "kind");

-- CreateIndex
CREATE INDEX "SecurityEvent_kind_email_createdAt_idx" ON "SecurityEvent"("kind", "email", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_kind_ipKey_createdAt_idx" ON "SecurityEvent"("kind", "ipKey", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_companyId_createdAt_idx" ON "SecurityEvent"("companyId", "createdAt");

-- Fáze 67: vlastní hesla uživatelů registrovaných firem Správy závodů. Každý uživatel firmy převezme dosavadní
-- společné heslo firmy (přihlásí se jako dřív); kdo není zakladatel firmy (e-mail registrace), si ho při prvním
-- přihlášení změní. Demo účty (bez firmy) heslo nemají – dál platí sdílené heslo obchodního dema.
UPDATE "User"
SET "passwordHash" = (
      SELECT c."passwordHash" FROM "RegisteredCompany" c
      WHERE c."id" = "User"."companyId" AND c."productScope" = 'PLANT_MANAGEMENT'
    ),
    "mustChangePassword" = CASE WHEN lower("User"."email") = (
      SELECT lower(c."email") FROM "RegisteredCompany" c WHERE c."id" = "User"."companyId"
    ) THEN false ELSE true END
WHERE "companyId" IS NOT NULL
  AND "passwordHash" IS NULL
  AND EXISTS (
    SELECT 1 FROM "RegisteredCompany" c WHERE c."id" = "User"."companyId" AND c."productScope" = 'PLANT_MANAGEMENT'
  );
