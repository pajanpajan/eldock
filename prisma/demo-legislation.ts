// Ukázková data legislativního paketu 2027 do existující databáze bez mazání: `npm run db:demo-legislation`.
// Spouští ho i `docker-entrypoint.sh` (ELDOCK_SEED_DEMO=1) – jednorázově podle značky `demo.legislation-2027`.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedLegislation2027 } from "./seed-legislation-2027";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedLegislation2027(prisma)
  .then((result) =>
    console.log(
      result.skipped
        ? "Legislativa 2027: ukázková data už jsou v databázi."
        : `Legislativa 2027: +${result.documents} návodů / datasheetů, +${result.backups} záloh SW${result.battery ? ", pas baterie RZ1" : ""}.`,
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
