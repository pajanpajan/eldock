// Ukázková data fáze 53 (životnost součástek, kabelové pasporty) do existující databáze bez mazání:
// `npm run db:demo-lifespan`. Spouští ho i `docker-entrypoint.sh` – jednorázově podle značky `demo.lifespan-cables`.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedLifespanCables } from "./seed-lifespan-cables";
import { seedPhase116 } from "./seed-phase116";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

seedLifespanCables(prisma)
  .then(async (result) => {
    console.log(
      result.skipped
        ? "Životnost a kabely: ukázková data už jsou v databázi."
        : `Životnost a kabely: +${result.cables} kabelových pasportů, +${result.components} sledovaných součástek.`,
    );
    // Fáze 116: sklad dílů podle MPN, upřesnění míst, odpovědné osoby LOTO, oprava filtrační rohože
    const phase116 = await seedPhase116(prisma);
    console.log(phase116.skipped ? "Fáze 116: ukázková data už jsou v databázi." : `Fáze 116: +${phase116.stock} dílů skladem, +${phase116.locations} míst, +${phase116.loto} LOTO, ${phase116.filter} filtr opraven.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
