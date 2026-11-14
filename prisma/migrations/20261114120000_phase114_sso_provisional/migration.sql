-- Fáze 114: SSO přemostění AI Panel Builderu a Správy závodů / Hlídače revizí (e-mail firmy jedinečný v rámci produktu,
-- spárovaný účet druhého produktu) a předběžné připsání kreditů po QR platbě s notifikací majiteli.

-- DropIndex
DROP INDEX "RegisteredCompany_email_key";

-- AlterTable
ALTER TABLE "RegisteredCompany" ADD COLUMN "linkedCompanyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredCompany_linkedCompanyId_key" ON "RegisteredCompany"("linkedCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "RegisteredCompany_email_productScope_key" ON "RegisteredCompany"("email", "productScope");

-- AlterTable
ALTER TABLE "CreditOrder" ADD COLUMN "provisionalAt" DATETIME;
ALTER TABLE "CreditOrder" ADD COLUMN "provisionalRevokedAt" DATETIME;
ALTER TABLE "CreditOrder" ADD COLUMN "ownerNotifiedAt" DATETIME;
ALTER TABLE "CreditOrder" ADD COLUMN "ownerNotifyError" TEXT;
