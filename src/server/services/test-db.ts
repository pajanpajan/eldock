// Pomocník pro integrační testy služeb: čistá SQLite databáze v dočasné složce, na kterou se
// aplikují migrace z `prisma/migrations` (stejné schéma jako v aplikaci). Jen pro Vitest.

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

const MIGRATIONS = path.resolve("prisma", "migrations");

export async function createTestDb() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "eldock-test-"));
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${path.join(dir, "test.db")}` }) });
  const folders = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    const sql = readFileSync(path.join(MIGRATIONS, folder, "migration.sql"), "utf8")
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*(?:\n|$)/).map((part) => part.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(statement);
    }
  }
  return {
    prisma,
    async cleanup() {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Minimální data: závod, budova, patro, uživatelé obou rolí a zařízení s platnou revizí dokumentace. */
export async function seedMinimal(prisma: PrismaClient) {
  await prisma.user.createMany({
    data: [
      { id: "u-maint", name: "Petr Novák", email: "novak@test.example", role: "MAINTENANCE" },
      { id: "u-cae", name: "Ing. Tomáš Král", email: "kral@test.example", role: "CAE_ENGINEER" },
    ],
  });
  await prisma.plant.create({ data: { id: "p", code: "TST", name: "Testovací závod", customerName: "Test s.r.o." } });
  await prisma.building.create({ data: { id: "b", plantId: "p", code: "A", name: "Hala A", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
  await prisma.floor.create({ data: { id: "f", buildingId: "b", level: 0, code: "1NP", name: "1. NP" } });
  for (const tag of ["R-LIS-01", "R-CNC-04"]) {
    await prisma.equipment.create({
      data: {
        id: `eq-${tag}`,
        floorId: "f",
        tag,
        name: `${tag} - Rozváděč`,
        type: "SWITCHBOARD",
        pinX: 10,
        pinY: 10,
        revisions: {
          create: { version: "v1.0", major: 1, minor: 0, status: "ACTIVE", title: `Schéma ${tag}`, schematicUrl: "/api/files/revisions/x.svg", authorId: "u-cae" },
        },
      },
    });
  }
}
