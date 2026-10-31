import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { CATALOG, seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { importDatasheet } from "./panel-builder";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(async () => db.cleanup());

const REFERENCE_PAGES = [
  ["2CDD283101R0040 SD203/40 Vypínac 3P, 40A /12.1 Odpínač", "2CDS251001R1165 -F8 S201-B16 Jistic 1P, 16A, char. B, 6kA /12.4 Zásuvky kuchyně"],
  ["PCS2220017 =SYS0/+1.1/-UC1.F1 -- PCS-MCB-017 Circuit Breaker (MCB) 4P 10A /5.3", "PCS2250101 =SYS0.1/+1.1/-UC1.Q1 -- PCS-CON01 Contactor 3POL 1NO 1NC type1 /7.3"],
];

describe("AI Panel Builder – katalog a seed", () => {
  it("seed: ≥ 40 prvků, PB-001 s 13 přístroji (-Q1, -F1 až -F12) na 3 lištách (1 žlutý, 1 červený), opakovaně bez duplicit", async () => {
    expect(CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(await seedPanelBuilder(prisma)).toEqual({ components: CATALOG.length, project: true });
    expect(await seedPanelBuilder(prisma)).toEqual({ components: CATALOG.length, project: false });
    expect(await prisma.catalogComponent.count()).toBe(CATALOG.length);
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" }, include: { items: true } });
    expect(project.items).toHaveLength(13);
    expect(new Set(project.items.map((item) => item.dinRailIndex))).toEqual(new Set([1, 2, 3]));
    expect(project.items.filter((item) => item.recognitionStatus === "PARTIAL").map((item) => item.designation)).toEqual(["-F9"]);
    expect(project.items.filter((item) => item.recognitionStatus === "UNRECOGNIZED").map((item) => item.designation)).toEqual(["-F6"]);
    expect(project.items.find((item) => item.designation === "-F6")?.catalogComponentId).toBeNull();
  });

  it("atomizace PDF: nové přístroje jako samostatné řádky, známá objednací čísla se nepřepisují", async () => {
    await seedPanelBuilder(prisma);
    const first = await importDatasheet(prisma, { fileName: "kusovnik.pdf", pages: REFERENCE_PAGES });
    expect(first.mode).toBe("DEMO");
    expect(first.components.map((c) => [c.articleNumber, c.status])).toEqual([
      ["2CDD283101R0040", "existing"],
      ["2CDS251001R1165", "existing"],
      ["PCS2220017", "created"],
      ["PCS2250101", "created"],
    ]);
    const mcb = await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "PCS2220017" } });
    expect(mcb).toMatchObject({ category: "MCB", poles: "4P", ratedCurrentA: 10, dataSource: "IEC_ESTIMATE", sourcePdfName: "kusovnik.pdf", sourcePage: 2 });
    expect(mcb.searchText).toContain("pcs-mcb-017");

    const second = await importDatasheet(prisma, { fileName: "kusovnik.pdf", pages: REFERENCE_PAGES });
    expect(second.components.every((c) => c.status === "existing")).toBe(true);
    await expect(importDatasheet(prisma, { fileName: "prazdne.pdf", pages: [["Obsah", "Titulní strana"]] })).rejects.toBeInstanceOf(WorkflowError);
  });
});
