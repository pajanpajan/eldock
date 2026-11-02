// Vzorové závody v metrové architektuře Studia do existující databáze: `npm run db:demo-plant`.
// Spouští ho i `docker-entrypoint.sh` při startu (ELDOCK_SEED_DEMO=1). Proběhne jen jednou (značka
// `demo.plant-layout` v TenantSetting), patra upravená uživatelem ve Studiu nemění a nic nemaže.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoPlant } from "./seed-demo-plant";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedDemoPlant(prisma)
  .then((result) =>
    console.log(
      result.skipped
        ? "Vzorové závody: metrové rozvržení už je v databázi."
        : `Vzorové závody: rozvržení ${result.floors} pater (ponecháno upravených ${result.keptFloors}), nových zařízení ${result.created}, přemístěných ${result.moved}, přejmenovaných ${result.renamed}.`,
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
