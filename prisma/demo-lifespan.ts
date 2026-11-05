// Ukázková data fáze 53 (životnost součástek, kabelové pasporty) do existující databáze bez mazání:
// `npm run db:demo-lifespan`. Spouští ho i `docker-entrypoint.sh` – jednorázově podle značky `demo.lifespan-cables`.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedLifespanCables } from "./seed-lifespan-cables";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedLifespanCables(prisma)
  .then((result) =>
    console.log(
      result.skipped
        ? "Životnost a kabely: ukázková data už jsou v databázi."
        : `Životnost a kabely: +${result.cables} kabelových pasportů, +${result.components} sledovaných součástek.`,
    ),
  )
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
