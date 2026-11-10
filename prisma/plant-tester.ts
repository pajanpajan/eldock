// Testovací firma Správy závodů (2026-11-10): `npm run db:plant-tester`. Spouští ho i `docker-entrypoint.sh`
// při každém startu kontejneru – je idempotentní (existující firmu nemění, chybějící založí znovu).
import "dotenv/config";

import { createSqlitePrisma } from "../src/lib/sqlite-adapter";
import { PLANT_TESTER } from "../src/lib/registered-company";
import { ensurePlantTester } from "../src/server/services/plant-tester";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
// Stejně jako aplikace (`src/lib/prisma.ts`): mimo produkci přísný režim transakcí, zámek souboru čeká 5 s
const prisma = createSqlitePrisma({ url, timeout: 5000, strict: process.env.NODE_ENV !== "production" });

ensurePlantTester(prisma)
  .then((result) => {
    console.log(
      result.created
        ? `Testovací firma Správy závodů založena: ${PLANT_TESTER.email} a ${PLANT_TESTER.technician.email}, závod ${result.plantCode} s halou A (${result.equipment} zařízení).`
        : `Testovací firma Správy závodů už existuje (${PLANT_TESTER.email}).`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
