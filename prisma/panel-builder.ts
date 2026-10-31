// Přírůstkový seed AI Panel Builderu bez mazání dat: `npm run db:panel-builder`.
// Spouští ho i `docker-entrypoint.sh` při každém startu (ELDOCK_SEED_DEMO=1) – je idempotentní.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedPanelBuilder } from "./seed-panel-builder";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedPanelBuilder(prisma)
  .then(({ components, project }) => console.log(`AI Panel Builder: katalog ${components} prvků aktualizován, vzorový projekt PB-001 ${project ? "založen" : "už existuje"}.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
