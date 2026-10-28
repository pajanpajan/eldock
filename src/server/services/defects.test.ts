import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

import { recordInspection, resolveDefect } from "./inspection";
import { createTestDb, seedMinimal } from "./test-db";

// Integrační test nad SQLite z migrací: revize s výhradou založí závady, údržba je odstraní.

const NOW = new Date("2026-10-28T10:00:00Z");
let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

const inspect = (result: "CAPABLE" | "CAPABLE_WITH_DEFECTS" | "INCAPABLE", defectsSummary: string | null) =>
  recordInspection(
    prisma,
    {
      equipmentId: "eq-R-CNC-04",
      type: "PERIODIC",
      inspectionDate: "2026-10-20",
      reportNumber: "RZ-2026-300/TST",
      inspectorName: "Ing. Pavel Horák",
      inspectorLicense: "TIČR č. E-0815/2021",
      result,
      defectsSummary,
      reportUrl: "/api/files/documents/x.svg",
    },
    NOW,
  );

describe("revizní závady", () => {
  it("revize s výhradou založí závady s lhůtou 30 dnů, bez závad žádné", async () => {
    await inspect("CAPABLE_WITH_DEFECTS", "Uvolněná svorka PE na X1. Chybí výstražná tabulka na dveřích.");
    const defects = await prisma.inspectionDefect.findMany({ orderBy: { description: "asc" } });
    expect(defects.map((defect) => [defect.description, defect.severity, defect.status])).toEqual([
      ["Chybí výstražná tabulka na dveřích", "MAJOR", "OPEN"],
      ["Uvolněná svorka PE na X1", "MAJOR", "OPEN"],
    ]);
    expect(defects[0].deadline).toEqual(new Date("2026-11-19T10:00:00Z"));
    await inspect("CAPABLE", null);
    expect(await prisma.inspectionDefect.count()).toBe(2);
  });

  it("neschopno provozu = kritická závada s okamžitou lhůtou", async () => {
    await inspect("INCAPABLE", "Poškozená izolace přívodu");
    expect(await prisma.inspectionDefect.findFirstOrThrow()).toMatchObject({ severity: "CRITICAL", deadline: new Date("2026-10-20T10:00:00Z") });
  });

  it("potvrzení odstranění uloží opravu, kdo a kdy; podruhé nejde", async () => {
    await inspect("CAPABLE_WITH_DEFECTS", "Uvolněná svorka PE na X1");
    const defect = await prisma.inspectionDefect.findFirstOrThrow();
    const resolved = await resolveDefect(
      prisma,
      { id: "u-maint", role: "MAINTENANCE" },
      { defectId: defect.id, note: "Svorka dotažena momentem 2,5 Nm.", photoUrl: "/api/files/photos/x1.jpg" },
      NOW,
    );
    expect(resolved).toMatchObject({ status: "RESOLVED", resolvedBy: "Petr Novák", resolutionNote: "Svorka dotažena momentem 2,5 Nm.", resolutionPhotoUrl: "/api/files/photos/x1.jpg" });
    await expect(resolveDefect(prisma, { id: "u-maint", role: "MAINTENANCE" }, { defectId: defect.id, note: "Znovu" }, NOW)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await expect(resolveDefect(prisma, { id: "u-maint", role: "MAINTENANCE" }, { defectId: defect.id, note: " " }, NOW)).rejects.toThrow(/odstraněna/);
  });
});
