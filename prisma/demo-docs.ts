// Doplnění reálných PDF projektů do existující databáze bez mazání dat: `npm run db:demo-docs`.
// Spouští ho i `docker-entrypoint.sh` při každém startu (ELDOCK_SEED_DEMO=1) – je idempotentní.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoDocs } from "./seed-demo-docs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedDemoDocs(prisma)
  .then((created) => console.log(created ? `Demo dokumentace PDF: doplněno ${created} zařízení.` : "Demo dokumentace PDF: vše už je v databázi."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
