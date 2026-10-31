import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { proposeTree, treeNodeFrom, type TreeNode } from "@/lib/panel-builder/tree";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { CATALOG, seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { analyzePanelPhoto, lookupComponent } from "./geminiPanelService";
import { analyzeProject, assignCatalogComponent, createPanelProject, importDatasheet, lookupComponentForItem, saveTree } from "./panel-builder";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await db.cleanup();
});

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

describe("AI Panel Builder – projekt a analýza fotky", () => {
  const demo = { analyze: analyzePanelPhoto, readPhoto: async () => null };

  it("nový projekt dostane další kód a demo analýza rozpozná 13 přístrojů s IEC značením", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await seedPanelBuilder(prisma);
    const project = await createPanelProject(prisma, { name: "  Podružný rozváděč RP2 ", customerName: null, photoUrl: null });
    expect(project.code).toBe("PB-002");
    const result = await analyzeProject(prisma, project.id, demo);
    expect(result).toMatchObject({ mode: "DEMO", total: 13, unresolved: 2 });
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: project.id }, orderBy: { sortOrder: "asc" }, include: { catalogComponent: true } });
    expect(items.map((item) => item.designation)).toEqual(["-Q1", "-F1", "-F2", "-F3", "-F4", "-F5", "-F6", "-F7", "-F8", "-F9", "-F10", "-F11", "-F12"]);
    expect(items[0].catalogComponent?.typeCode).toBe("SD203/40");
    expect(items[9]).toMatchObject({ recognitionStatus: "PARTIAL" });
    expect(items[9].catalogComponent?.typeCode).toBe("S201-B16");
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: project.id } })).status).toBe("RECOGNIZED");
    await expect(createPanelProject(prisma, { name: " ", customerName: null, photoUrl: null })).rejects.toBeInstanceOf(WorkflowError);
  });

  it("picker: přiřazení zezelená, dohledání najde katalog nebo uloží nový přístroj", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await seedPanelBuilder(prisma);
    const f6 = await prisma.panelBoardItem.findFirstOrThrow({ where: { designation: "-F6", project: { code: "PB-001" } } });
    const s201b10 = await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CDS251001R0105" } });

    const hints = { category: "MCB" as const, poles: "1P", current: 10, curve: "B", manufacturer: "ABB" };
    expect(await lookupComponentForItem(prisma, { itemId: f6.id, text: "S201-B10", hints }, lookupComponent)).toMatchObject({ mode: "CATALOG", component: { id: s201b10.id, status: "existing" } });
    const created = await lookupComponentForItem(prisma, { itemId: f6.id, text: "S201 C13", hints }, lookupComponent);
    expect(created).toMatchObject({ mode: "DEMO", component: { typeCode: "S201-C13", articleNumber: "2CDS251001R0134", status: "created" } });
    expect(await prisma.catalogComponent.findUniqueOrThrow({ where: { articleNumber: "2CDS251001R0134" } })).toMatchObject({ dataSource: "IEC_ESTIMATE" });
    await expect(lookupComponentForItem(prisma, { itemId: f6.id, text: "x", hints }, lookupComponent)).rejects.toBeInstanceOf(WorkflowError);

    await assignCatalogComponent(prisma, f6.id, s201b10.id);
    expect(await prisma.panelBoardItem.findUniqueOrThrow({ where: { id: f6.id } })).toMatchObject({ recognitionStatus: "VERIFIED", catalogComponentId: s201b10.id, confidence: 1 });
  });
});

describe("AI Panel Builder – strom zapojení", () => {
  async function pb001() {
    await seedPanelBuilder(prisma);
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" }, include: { items: { include: { catalogComponent: true } } } });
    const nodes = project.items.map(treeNodeFrom);
    const proposal = proposeTree(nodes);
    return { project, nodes: nodes.map((node) => ({ ...node, ...proposal.get(node.id)! })) };
  }
  const assignments = (nodes: TreeNode[]) => nodes.map(({ id, parentItemId, fedFromIncomer, phaseAssignment, circuitLabel, designation }) => ({ id, parentItemId, fedFromIncomer, phaseAssignment, circuitLabel, designation }));

  it("navržený strom se uloží, plně zapojený projekt přejde do TREE_BUILT", async () => {
    const { project, nodes } = await pb001();
    const result = await saveTree(prisma, project.id, assignments(nodes));
    expect(result).toMatchObject({ status: "TREE_BUILT", connected: true });
    // i nerozpoznaný -F6 (bez katalogového kusu) dostane jističový vývod a fázi → hlídač je čistý
    expect(result.issues.map((issue) => issue.message)).toEqual([]);
    const f3 = await prisma.panelBoardItem.findFirstOrThrow({ where: { projectId: project.id, designation: "-F3" }, include: { parent: true } });
    expect(f3.parent?.designation).toBe("-F2");
    expect(f3.phaseAssignment).toBe("L1,L2,L3");
  });

  it("cyklus a duplicitní značení se odmítnou, odpojený prvek vrátí stav RECOGNIZED", async () => {
    const { project, nodes } = await pb001();
    const q1 = nodes.find((node) => node.designation === "-Q1")!;
    const f2 = nodes.find((node) => node.designation === "-F2")!;
    await expect(saveTree(prisma, project.id, assignments(nodes.map((node) => (node.id === q1.id ? { ...node, parentItemId: f2.id, fedFromIncomer: false } : node))))).rejects.toThrow("cyklus");
    await expect(saveTree(prisma, project.id, assignments(nodes.map((node) => (node.designation === "-F4" ? { ...node, designation: "-F3" } : node))))).rejects.toThrow("Značení -F3 je použito dvakrát");
    const result = await saveTree(prisma, project.id, assignments(nodes.map((node) => (node.designation === "-F12" ? { ...node, parentItemId: null, fedFromIncomer: false } : node))));
    expect(result).toMatchObject({ status: "RECOGNIZED", connected: false });
    expect(result.issues[0].message).toBe("-F12 není zapojen – vyberte, odkud je napájen.");
  });
});
