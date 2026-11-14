-- Fáze 113: neomezený přístup (účet provozovatele, ukázková firma), EAN a ceníková cena rozvodnic, provozovatel
-- jako neplátce DPH a výchozí sady QR štítků v prodeji.

-- AlterTable
ALTER TABLE "RegisteredCompany" ADD COLUMN "unlimitedAccess" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PanelEnclosure" ADD COLUMN "ean" TEXT;
ALTER TABLE "PanelEnclosure" ADD COLUMN "listPriceCzk" REAL;

-- Ukázková firma (Elektro Tester s.r.o.): ⭐ neomezený přístup pro prezentace; zkušební projekty a půdorysy → plná verze
UPDATE "RegisteredCompany" SET "unlimitedAccess" = true WHERE "id" = 'company-tester';
-- Testovací firma Správy závodů (testy webu a aplikací): Hlídač revizí bez limitu zařízení
UPDATE "RegisteredCompany" SET "unlimitedAccess" = true WHERE "email" = 'test@eldock.cz';
UPDATE "PanelBoardProject" SET "license" = 'UNLIMITED' WHERE "companyId" = 'company-tester' AND "license" = 'TRIAL';
UPDATE "Floorplan" SET "license" = 'UNLIMITED' WHERE "companyId" = 'company-tester' AND "license" = 'TRIAL';

-- Provozovatel před založením s.r.o.: neplátce DPH – uložené údaje (účet, IBAN, adresa) zůstávají beze změny
UPDATE "PlatformSetting" SET "valueJson" = json_set("valueJson", '$.vatPayer', json('false')), "updatedAt" = CURRENT_TIMESTAMP WHERE "key" = 'operator' AND json_valid("valueJson");

-- Výchozí sady QR štítků (jen když je velín ještě neuložil – uložený ceník se nepřepíše)
INSERT OR IGNORE INTO "PlatformSetting" ("key", "valueJson", "updatedAt") VALUES ('label-sets', '[{"title":"Sada SPOTŘEBIČ & KANCELÁŘ (100 ks · 30×15 mm)","description":"Pro monitory, PC, prodlužovačky a nářadí dle ČSN 33 1600 ed. 2.","items":[{"kind":"A","count":100}],"priceExclVat":490},{"title":"Sada SPOTŘEBIČ & KANCELÁŘ – VELKÁ (500 ks · 30×15 mm)","description":"Zvýhodněný kotouč pro revizní techniky a administrativní budovy.","items":[{"kind":"A","count":500}],"priceExclVat":1750},{"title":"Sada ROZVÁDĚČ PROFI (50 ks · 50×25 mm · Stříbrný Datapol PET)","description":"Pro domovní a komerční rozváděče dle ČSN EN IEC 61439 (−40 až +150 °C).","items":[{"kind":"S","count":50}],"priceExclVat":745},{"title":"Sada PRŮMYSL & STROJE (50 ks · 70×40 mm · Stříbrný 3M/Datapol PET)","description":"Pro výrobní stroje, linky a rozvodny dle Nařízení EU 2023/1230.","items":[{"kind":"M","count":50}],"priceExclVat":1450},{"title":"STARTOVACÍ MIX SADA ELDOCK (100 ks celkem: 60× Spotřebič + 30× Rozváděč + 10× Stroj)","description":"Vyzkoušejte všechny druhy štítků – spotřebiče, rozváděče i stroje v jedné zásilce.","items":[{"kind":"A","count":60},{"kind":"S","count":30},{"kind":"M","count":10}],"priceExclVat":890}]', CURRENT_TIMESTAMP);
