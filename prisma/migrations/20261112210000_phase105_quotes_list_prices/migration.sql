-- Fáze 105: nastavení cenových nabídek firmy (hodinová sazba, konstrukce, DPH, velkoobchod, kalibrace normohodin,
-- číslování nabídek) a ceníková cena výrobce ke kusům katalogu AI Panel Builderu (základ cenové nabídky).
ALTER TABLE "RegisteredCompany" ADD COLUMN "quoteSettingsJson" TEXT;
ALTER TABLE "CatalogComponent" ADD COLUMN "listPriceCzk" REAL;
ALTER TABLE "CatalogComponent" ADD COLUMN "listPriceSource" TEXT;
