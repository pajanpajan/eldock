-- AlterTable
ALTER TABLE "Equipment" ADD COLUMN "photoUrl" TEXT;
ALTER TABLE "Equipment" ADD COLUMN "qrToken" TEXT;

-- Kódy QR štítků pro existující zařízení (10 hex znaků, viz src/lib/qr-label.ts)
UPDATE "Equipment" SET "qrToken" = upper(hex(randomblob(5))) WHERE "qrToken" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_qrToken_key" ON "Equipment"("qrToken");
