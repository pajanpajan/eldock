import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import {
  parseInspectionDate,
  recordBatchInspection,
  recordInspection,
  recordQuickInspection,
  renderBatchProtocol,
  renderInspectionReport,
  type RecordInspectionInput,
} from "./inspection";

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
              type: "SWITCHBOARD",
              usageGroup: null,
              protectionClass: null,
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

// ---------------------------------------------------------------------------
//  Hromadná a rychlá revize
// ---------------------------------------------------------------------------

interface FakeEquipment {
  id: string;
  tag: string;
  name: string;
  type: string;
  usageGroup: string | null;
  protectionClass: string | null;
  ratedVoltage: string;
  ratedCurrent: string;
  inspectionIntervalMonths: number;
  floor: { name: string; building: { name: string } };
}

const KETTLE: FakeEquipment = {
  id: "eq-sp-0201",
  tag: "SP-0201",
  name: "SP-0201 - Rychlovarná konvice Eta",
  type: "APPLIANCE",
  usageGroup: "E",
  protectionClass: "I",
  ratedVoltage: "230 V AC / 50 Hz",
  ratedCurrent: "9,6 A",
  inspectionIntervalMonths: 24,
  floor: { name: "1. NP - Trafostanice a kompresorovna", building: { name: "Energetika" } },
};
const GRINDER = { ...KETTLE, id: "eq-nr-0112", tag: "NR-0112", name: "NR-0112 - Úhlová bruska", type: "POWER_TOOL", usageGroup: "C", protectionClass: "II", inspectionIntervalMonths: 12 };
const SWITCHBOARD = { ...KETTLE, id: "eq-rm1", tag: "RM1", name: "RM1 - Hlavní rozváděč", type: "SWITCHBOARD", usageGroup: null, protectionClass: null, inspectionIntervalMonths: 60 };

function fakeDb(items: FakeEquipment[]) {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: `insp-${String(data.equipmentId)}`, ...data }));
  const transaction = vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations));
  const prisma = {
    equipment: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => items.find((item) => item.id === where.id) ?? null),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => items.filter((item) => where.id.in.includes(item.id))),
    },
    inspectionRecord: { create },
    $transaction: transaction,
  };
  return { prisma: prisma as unknown as PrismaClient, create, transaction };
}

const batch = {
  inspectionDate: "2026-10-28",
  inspectorName: "Miroslav Beneš",
  inspectorLicense: "TIČR č. E-1432/2023 (E2A)",
  measuringInstrument: "Metrel MI 3309 BT",
  result: "CAPABLE" as const,
};

describe("recordBatchInspection", () => {
  it("každému zařízení spočítá platnost podle jeho lhůty a zapíše vše v jedné transakci", async () => {
    const { prisma, create, transaction } = fakeDb([KETTLE, GRINDER, SWITCHBOARD]);
    const result = await recordBatchInspection(prisma, { ...batch, equipmentIds: ["eq-sp-0201", "eq-nr-0112", "eq-rm1", "eq-rm1"], reportUrl: "/x", protocolNumber: "HR-1" }, NOW);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(3);
    const byTag = Object.fromEntries(result.items.map((item) => [item.tag, item.validUntil.toISOString().slice(0, 10)]));
    expect(byTag).toEqual({ "SP-0201": "2028-10-28", "NR-0112": "2027-10-28", RM1: "2031-10-28" });
    expect(create.mock.calls.every(([arg]) => arg.data.reportNumber === "HR-1" && arg.data.type === "PERIODIC")).toBe(true);
  });

  it("odmítne prázdný výběr a neznámé zařízení", async () => {
    const { prisma } = fakeDb([KETTLE]);
    await expect(recordBatchInspection(prisma, { ...batch, equipmentIds: [], reportUrl: "/x" }, NOW)).rejects.toThrow(/alespoň jedno/);
    await expect(recordBatchInspection(prisma, { ...batch, equipmentIds: ["eq-sp-0201", "nic"], reportUrl: "/x" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("protokol obsahuje všechna zařízení a novou platnost", async () => {
    const { prisma } = fakeDb([KETTLE, GRINDER]);
    const { svg, protocolNumber } = await renderBatchProtocol(prisma, { ...batch, equipmentIds: ["eq-sp-0201", "eq-nr-0112"] }, NOW);
    expect(protocolNumber).toMatch(/^HR-20261028-/);
    expect(svg).toContain("Protokol hromadné revize");
    expect(svg).toContain("SP-0201");
    expect(svg).toContain("28.10.2027");
  });
});

describe("recordQuickInspection", () => {
  const quick = { equipmentId: "eq-sp-0201", inspectorName: "Miroslav Beneš", inspectorLicense: "TIČR", measuringInstrument: "Metrel MI 3309 BT" };

  it("VYHOVUJE: dnešní datum, platnost dle ČSN 33 1600 a uložené měření", async () => {
    const { prisma, create } = fakeDb([KETTLE]);
    const record = await recordQuickInspection(prisma, { ...quick, passed: true, protectiveConductorResistance: 0.12, insulationResistance: 250, reportUrl: "/x" }, NOW);
    expect(record.validUntil).toEqual(new Date("2028-10-28T10:00:00Z"));
    expect(create.mock.calls[0][0].data).toMatchObject({ result: "CAPABLE", reportNumber: "RS-20261028-SP-0201", protectiveConductorResistance: 0.12, insulationResistance: 250 });
  });

  it("VYHOVUJE s nevyhovujícím měřením se odmítne", async () => {
    const { prisma, create } = fakeDb([KETTLE]);
    await expect(recordQuickInspection(prisma, { ...quick, passed: true, protectiveConductorResistance: 0.8, insulationResistance: 250, reportUrl: "/x" }, NOW)).rejects.toThrow(/R_PE/);
    expect(create).not.toHaveBeenCalled();
  });

  it("NEVYHOVUJE: posudek neschopno, platnost končí dnem revize, závada povinná", async () => {
    const { prisma } = fakeDb([KETTLE]);
    await expect(recordQuickInspection(prisma, { ...quick, passed: false, insulationResistance: 0.2, reportUrl: "/x" }, NOW)).rejects.toThrow(/závady/);
    const record = await recordQuickInspection(prisma, { ...quick, passed: false, insulationResistance: 0.2, defectsSummary: "Poškozená izolace", reportUrl: "/x" }, NOW);
    expect(record.result).toBe("INCAPABLE");
    expect(record.validUntil).toEqual(new Date("2026-10-28T10:00:00Z"));
  });

  it("je jen pro přenosné spotřebiče", async () => {
    const { prisma } = fakeDb([SWITCHBOARD]);
    await expect(recordQuickInspection(prisma, { ...quick, equipmentId: "eq-rm1", passed: true, insulationResistance: 300, reportUrl: "/x" }, NOW)).rejects.toThrow(/spotřebiče/);
  });
});
