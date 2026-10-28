import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { parseInspectionDate, recordInspection, renderInspectionReport, type RecordInspectionInput } from "./inspection";

const NOW = new Date("2026-10-28T10:00:00Z");

function fakePrisma(intervalMonths = 36) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "insp-1", ...data }));
  const prisma = {
    equipment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "eq-r-ml-01"
          ? {
              id: "eq-r-ml-01",
              tag: "R-ML-01",
              name: "R-ML-01 - Rozváděč montážní linky 1",
              ratedVoltage: "400 V AC / 50 Hz",
              ratedCurrent: "160 A",
              inspectionIntervalMonths: intervalMonths,
              floor: { name: "1. NP - Montážní linky", building: { name: "Hala B - Montáž" } },
            }
          : null,
      ),
    },
    inspectionRecord: { create },
  };
  return { prisma: prisma as unknown as PrismaClient, create };
}

const input: RecordInspectionInput = {
  equipmentId: "eq-r-ml-01",
  type: "PERIODIC",
  inspectionDate: "2026-10-27",
  reportNumber: " RZ-2026-201/JBC ",
  inspectorName: "Ing. Pavel Horák",
  inspectorLicense: "TIČR č. E-0815/2021 (E1A)",
  result: "CAPABLE",
};

describe("parseInspectionDate", () => {
  it("přijme platné datum a odmítne nesmysl", () => {
    expect(parseInspectionDate("2026-02-28").toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(() => parseInspectionDate("2026-02-30")).toThrow(WorkflowError);
    expect(() => parseInspectionDate("28.2.2026")).toThrow(WorkflowError);
  });
});

describe("recordInspection", () => {
  it("dopočítá platnost z lhůty zařízení a ořízne texty", async () => {
    const { prisma, create } = fakePrisma(36);
    const record = await recordInspection(prisma, { ...input, reportUrl: "/api/files/documents/x.svg" }, NOW);
    expect(record.validUntil).toEqual(new Date("2029-10-27T10:00:00Z"));
    expect(create.mock.calls[0][0].data).toMatchObject({ reportNumber: "RZ-2026-201/JBC", defectsSummary: null, type: "PERIODIC" });
  });

  it("termovize má výchozí platnost 12 měsíců, vlastní platnost má přednost", async () => {
    const { prisma } = fakePrisma();
    expect((await recordInspection(prisma, { ...input, type: "THERMOVISION", reportUrl: "/x" }, NOW)).validUntil).toEqual(new Date("2027-10-27T10:00:00Z"));
    expect((await recordInspection(prisma, { ...input, validityMonths: 24, reportUrl: "/x" }, NOW)).validUntil).toEqual(new Date("2028-10-27T10:00:00Z"));
  });

  it("vyžaduje soupis závad u posudku s výhradou", async () => {
    const { prisma, create } = fakePrisma();
    await expect(recordInspection(prisma, { ...input, result: "CAPABLE_WITH_DEFECTS", defectsSummary: "  ", reportUrl: "/x" }, NOW)).rejects.toThrow(/závady/);
    expect(create).not.toHaveBeenCalled();
  });

  it("odmítne datum v budoucnosti, neplatnou lhůtu a neznámé zařízení", async () => {
    const { prisma } = fakePrisma();
    await expect(recordInspection(prisma, { ...input, inspectionDate: "2026-10-29", reportUrl: "/x" }, NOW)).rejects.toThrow(/budoucnosti/);
    await expect(recordInspection(prisma, { ...input, validityMonths: 0, reportUrl: "/x" }, NOW)).rejects.toThrow(/1–120/);
    await expect(recordInspection(prisma, { ...input, equipmentId: "nic", reportUrl: "/x" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("renderInspectionReport", () => {
  it("vygeneruje SVG zprávu s posudkem a závadami", async () => {
    const { prisma } = fakePrisma();
    const svg = await renderInspectionReport(prisma, { ...input, result: "CAPABLE_WITH_DEFECTS", defectsSummary: "Chybí štítek jističe F3" }, NOW);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("Zpráva o pravidelné revizi");
    expect(svg).toContain("Chybí štítek jističe F3");
    expect(svg).toContain("27.10.2029");
  });
});
