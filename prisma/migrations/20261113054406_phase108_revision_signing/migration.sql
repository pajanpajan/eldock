-- Fáze 108: profily revizních techniků závodu (osvědčení a oprávnění TIČR, kontakty, přístroj s kalibrací, podpis, PIN)
-- a elektronický podpis revize (podpis, PIN, pečeť SHA-256, čas a IP, PDF s podpisem PAdES, zneplatnění pro zneužití TIČR).

-- CreateTable
CREATE TABLE "InspectorProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plantId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "ico" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "certificateNo" TEXT NOT NULL,
    "certificateKey" TEXT NOT NULL,
    "certificateScope" TEXT,
    "certificateValidUntil" DATETIME,
    "authorizationNo" TEXT,
    "instrument" TEXT,
    "calibrationNo" TEXT,
    "calibrationValidUntil" DATETIME,
    "signatureUrl" TEXT,
    "pinHash" TEXT,
    "pinFailures" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" DATETIME,
    "monthlyEmail" BOOLEAN NOT NULL DEFAULT false,
    "lastMonthlyReport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectorProfile_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InspectionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "equipmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "inspectionDate" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "inspectorName" TEXT NOT NULL,
    "inspectorLicense" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "defectsSummary" TEXT,
    "reportUrl" TEXT NOT NULL,
    "inspectorScope" TEXT,
    "inspectorValidUntil" DATETIME,
    "scopeNote" TEXT,
    "extraordinaryReason" TEXT,
    "startedAt" DATETIME,
    "reportedAt" DATETIME,
    "handedOverAt" DATETIME,
    "documentsUsed" TEXT,
    "actsPerformed" TEXT,
    "previousEvaluation" TEXT,
    "validUntilOriginal" DATETIME,
    "measuringInstrument" TEXT,
    "protectiveConductorResistance" REAL,
    "insulationResistance" REAL,
    "leakageCurrent" REAL,
    "functionalTest" BOOLEAN,
    "rcdTestJson" TEXT,
    "maxTempC" REAL,
    "deltaTempC" REAL,
    "inspectorProfileId" TEXT,
    "inspectorCompany" TEXT,
    "inspectorIco" TEXT,
    "inspectorPhone" TEXT,
    "inspectorEmail" TEXT,
    "inspectorAuthorization" TEXT,
    "calibrationRef" TEXT,
    "shortCircuitA" REAL,
    "connectionsOk" BOOLEAN,
    "signatureUrl" TEXT,
    "signedAt" DATETIME,
    "signedIp" TEXT,
    "signedDevice" TEXT,
    "pinVerified" BOOLEAN NOT NULL DEFAULT false,
    "sealHash" TEXT,
    "sealVersion" INTEGER,
    "padesUrl" TEXT,
    "padesUploadedAt" DATETIME,
    "padesInfo" TEXT,
    "misuseFlaggedAt" DATETIME,
    "misuseNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InspectionRecord_inspectorProfileId_fkey" FOREIGN KEY ("inspectorProfileId") REFERENCES "InspectorProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InspectionRecord_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InspectionRecord" ("actsPerformed", "createdAt", "defectsSummary", "deltaTempC", "documentsUsed", "equipmentId", "extraordinaryReason", "functionalTest", "handedOverAt", "id", "inspectionDate", "inspectorLicense", "inspectorName", "inspectorScope", "inspectorValidUntil", "insulationResistance", "leakageCurrent", "maxTempC", "measuringInstrument", "previousEvaluation", "protectiveConductorResistance", "rcdTestJson", "reportNumber", "reportUrl", "reportedAt", "result", "scopeNote", "startedAt", "type", "updatedAt", "validUntil", "validUntilOriginal") SELECT "actsPerformed", "createdAt", "defectsSummary", "deltaTempC", "documentsUsed", "equipmentId", "extraordinaryReason", "functionalTest", "handedOverAt", "id", "inspectionDate", "inspectorLicense", "inspectorName", "inspectorScope", "inspectorValidUntil", "insulationResistance", "leakageCurrent", "maxTempC", "measuringInstrument", "previousEvaluation", "protectiveConductorResistance", "rcdTestJson", "reportNumber", "reportUrl", "reportedAt", "result", "scopeNote", "startedAt", "type", "updatedAt", "validUntil", "validUntilOriginal" FROM "InspectionRecord";
DROP TABLE "InspectionRecord";
ALTER TABLE "new_InspectionRecord" RENAME TO "InspectionRecord";
CREATE INDEX "InspectionRecord_equipmentId_inspectionDate_idx" ON "InspectionRecord"("equipmentId", "inspectionDate");
CREATE INDEX "InspectionRecord_validUntil_idx" ON "InspectionRecord"("validUntil");
CREATE INDEX "InspectionRecord_equipmentId_type_validUntil_idx" ON "InspectionRecord"("equipmentId", "type", "validUntil");
CREATE INDEX "InspectionRecord_inspectorLicense_inspectionDate_idx" ON "InspectionRecord"("inspectorLicense", "inspectionDate");
CREATE INDEX "InspectionRecord_inspectorProfileId_idx" ON "InspectionRecord"("inspectorProfileId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InspectorProfile_plantId_idx" ON "InspectorProfile"("plantId");

-- CreateIndex
CREATE INDEX "InspectorProfile_certificateKey_idx" ON "InspectorProfile"("certificateKey");
