import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEMO_SCENARIOS, demoDraft } from "@/lib/panel-builder/demo-scenarios";
import { parseDraft } from "@/lib/panel-builder/floorplan-editor";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createProjectFromFloorplan } from "./panel-projects";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

async function generated(id: (typeof DEMO_SCENARIOS)[number]["id"]) {
  const scenario = DEMO_SCENARIOS.find((entry) => entry.id === id)!;
  const result = await createProjectFromFloorplan(prisma, { name: scenario.name, customerName: scenario.customer, companyId, draft: demoDraft(id) });
  const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: result.id }, include: { items: { include: { catalogComponent: true } } } });
  return { result, project, items: project.items.map((item) => ({ designation: item.designation, label: item.circuitLabel ?? "", category: item.catalogComponent?.category ?? null, rcdType: item.catalogComponent?.rcdType ?? null, sensitivity: item.catalogComponent?.rcdSensitivityMa ?? null, parent: item.parentItemId, id: item.id, poles: item.catalogComponent?.poles ?? null })) };
}

// Fáze 99: demo scénáře pro živou ukázku – nákresy projdou kontrolou tvaru a generátor z nich udělá kompletní rozváděč
describe("fáze 99 – demo scénáře 2D půdorysu", () => {
  it("nákresy jsou platné (parseDraft) a odkazují jen na existující místnosti", () => {
    for (const scenario of DEMO_SCENARIOS) {
      const draft = demoDraft(scenario.id);
      const parsed = parseDraft(JSON.parse(JSON.stringify(draft)));
      expect(parsed, scenario.id).not.toBeNull();
      expect(parsed!.elements).toHaveLength(draft.elements.length);
      const rooms = new Set(draft.rooms.map((room) => room.name));
      for (const element of draft.elements) expect(rooms.has(element.room), `${scenario.id}: ${element.id}`).toBe(true);
      expect(parsed!.occupancy).toBe(draft.occupancy);
    }
  });

  it("🏠 rodinný dům: 3f rozváděč s chrániči typu B pro TČ, FVE a wallbox a akčními členy free@home", async () => {
    const { project, items } = await generated("rd-4kk");
    expect(project.supplyPhases).toBe(3);
    expect(items.find((item) => item.category === "MAIN_SWITCH")?.poles).toBe("3P");
    const typeB = items.filter((item) => item.category === "RCD" && item.rcdType === "B");
    expect(typeB.length).toBeGreaterThanOrEqual(3);
    for (const label of ["Tepelné čerpadlo", "Střídač FVE", "Nabíječka elektromobilu", "Varná deska", "Žaluzie"]) expect(items.some((item) => item.label.includes(label)), label).toBe(true);
    expect(items.some((item) => /akční stmívací/.test(item.label))).toBe(true);
    expect(items.some((item) => /akční žaluziový/.test(item.label))).toBe(true);
  }, 60_000);

  it("🏥 ordinace Skupiny 1: zásuvky vyšetřovny ve 2 okruzích A / B, každý pod vlastním chráničem 30 mA typu A", async () => {
    const { items } = await generated("ordinace");
    const exam = items.filter((item) => item.label.startsWith("Zásuvky – Vyšetřovna"));
    expect(exam.map((item) => item.label.match(/Okruh ([AB])/)?.[1]).sort()).toEqual(["A", "B"]);
    for (const item of exam) expect(item).toMatchObject({ category: "RCBO", rcdType: "A", sensitivity: 30 });
  }, 60_000);

  it("🛍️ nájemní jednotka OC (BD4): vypínací spoušť CENTRAL STOP a podružný elektroměr MID", async () => {
    const { project, items } = await generated("oc-jednotka");
    expect(project.occupancy).toBe("COMMERCIAL_BD4");
    expect(items.some((item) => item.label.includes("CENTRAL STOP"))).toBe(true);
    expect(items.some((item) => item.label.includes("elektroměr MID"))).toBe(true);
  }, 60_000);
});
