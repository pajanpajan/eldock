-- Fáze 78: kód půdorysu FP-001 (po firmách v pořadí založení) a knihovna 2D půdorysu firmy (šablony sestav, oblíbené)
ALTER TABLE "Floorplan" ADD COLUMN "code" TEXT;
ALTER TABLE "RegisteredCompany" ADD COLUMN "floorplanLibraryJson" TEXT;

-- Stávající půdorysy dostanou kód podle pořadí založení ve firmě (i v koši – kód se neopakuje)
UPDATE "Floorplan" SET "code" = (
  SELECT 'FP-' || printf('%03d', "ranked"."n")
  FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "companyId" ORDER BY "createdAt", "id") AS "n" FROM "Floorplan") AS "ranked"
  WHERE "ranked"."id" = "Floorplan"."id"
);

-- CreateIndex
CREATE UNIQUE INDEX "Floorplan_companyId_code_key" ON "Floorplan"("companyId", "code");
