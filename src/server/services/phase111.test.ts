import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { idLabelData } from "@/lib/equipment-id-label";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { parseRailLayout } from "@/lib/panel-builder/rail-layout";
import { railCapacities } from "@/lib/panel-builder/rails";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { chargeNewSwitchboard, confirmCreditOrder, createCreditOrder, creditSubscriptions, refundCharge, settleSwitchboardCharge, unlockOutput } from "./credits";
import { createFloorplan } from "./floorplans";
import { addHlidacDevice, createHlidacBuilding, hlidacOverview, setHlidacMode, getHlidacMode } from "./hlidac";
import { applyNameplate, readNameplate, saveNameplatePhoto } from "./nameplate";
import { applyProjectLayout, setAllRailCapacities, setRailFields } from "./panel-design";
import { createProjectFromFloorplan, deletePanelProjects, parseFeederInfo, previewFloorplanLayouts } from "./panel-projects";
import { ensureEquipmentLabel } from "./qr-labels";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 111: uspořádání skříně a lišt se skutečnými rozvodnicemi z databáze, kredity nového ceníku (1 testovací projekt,
// balíček celá zakázka, prodejní modal) a Hlídač revizí s AI čtečkou výrobního štítku a identifikačním štítkem EL-xxxxxx.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra }) as EditorElement;

/** Rodinný dům se Smart Home ABB-free@home: zásuvky, spotřebiče, světla, žaluzie a sběrnicové ovladače v 5 místnostech. */
function smartHouse(): FloorplanDraft {
  const rooms = ["Obývák", "Kuchyň", "Ložnice", "Dětský pokoj", "Pracovna"].map((name, index) => ({ id: `m${index}`, name, x: (index % 3) * 5000, y: Math.floor(index / 3) * 4500, w: 5000, h: 4500 }));
  const elements: EditorElement[] = [el("rh", "panel", 200, 2000, "Obývák")];
  rooms.forEach((room, index) => {
    const x = room.x;
    const y = room.y;
    elements.push(
      el(`z${index}a`, "socket", x + 1000, y + 100, room.name),
      el(`z${index}b`, "socket", x + 3500, y + 4400, room.name),
      el(`l${index}`, "ceiling-light", x + 2500, y + 2250, room.name),
      el(`b${index}`, "bus-blind", x + 4800, y + 1500, room.name),
      el(`t${index}`, "bus-2", x + 4800, y + 1200, room.name, { controls: [`l${index}`] }),
    );
  });
  elements.push(el("cooktop", "cooktop", 6000, 300, "Kuchyň"), el("oven", "oven", 7000, 300, "Kuchyň"), el("dw", "dishwasher", 8000, 300, "Kuchyň"));
  return { ...emptyDraft(), installation: "bus_loxone", smartSystem: "abb_freeathome", environment: "INDOOR_DRY", rooms, elements };
}

/** Byt bez chytré domácnosti (klasická instalace). */
function flat(): FloorplanDraft {
  return {
    ...emptyDraft(),
    rooms: [{ id: "m1", name: "Obývák", x: 0, y: 0, w: 6000, h: 4000 }],
    elements: [el("rh", "panel", 300, 2000, "Obývák"), el("z1", "socket", 2000, 0, "Obývák"), el("z2", "socket", 4000, 4000, "Obývák"), el("l1", "ceiling-light", 3000, 2000, "Obývák"), el("s1", "switch-1", 1000, 4000, "Obývák", { controls: ["l1"] })],
  };
}

async function newCompany(id: string, credits = 0) {
  return prisma.registeredCompany.create({
    data: { id, productScope: "PANEL_BUILDER", ico: "27082440", companyName: `Elektro ${id}`, street: "Ulice 1", city: "Liberec", zip: "460 01", contactName: "Elektrikář", email: `${id}@firma.cz`, phone: "+420 777 000 000", passwordHash: "x", termsAcceptedAt: new Date(), creditsRemaining: credits },
  });
}
const credits = async (companyId: string) => (await prisma.registeredCompany.findUniqueOrThrow({ where: { id: companyId } })).creditsRemaining;

describe("fáze 111 – kredity: 1 testovací projekt zdarma, pak ceník a prodejní modal", () => {
  beforeEach(async () => {
    await seedPanelBuilder(prisma, { external: false });
  });

  it("zkušební půdorys + zkušební rozváděč zdarma, další jen za kredity; balíček celá zakázka 25 kr. s nabídkou v ceně", async () => {
    const company = await newCompany("trial");
    const trialPlan = await createFloorplan(prisma, company.id, { meta: { name: "RD Novák" }, draft: flat() });
    expect(trialPlan).toMatchObject({ license: "TRIAL", cost: 0 });
    const trialCharge = await chargeNewSwitchboard(prisma, company.id, { floorplanId: trialPlan.id });
    expect(trialCharge.plan).toMatchObject({ license: "TRIAL", cost: 0 });
    const trialProject = await createProjectFromFloorplan(prisma, { name: "RH Novák", customerName: null, companyId: company.id, draft: flat() });
    await settleSwitchboardCharge(prisma, trialCharge, [trialProject.id], { floorplanId: trialPlan.id });
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: trialProject.id } })).license).toBe("TRIAL");
    expect(await unlockOutput(prisma, company.id, "quote", trialProject.id)).toMatchObject({ cost: 0, license: "TRIAL" });

    // Testovací projekt vyčerpaný: další půdorys / rozváděč bez kreditů = prodejní modal, nic nevznikne
    await expect(createFloorplan(prisma, company.id, { meta: { name: "RD 2" }, draft: flat() })).rejects.toMatchObject({ name: "PaywallError", paywall: { reason: "NO_CREDITS", cost: 15, balance: 0 } });
    await expect(chargeNewSwitchboard(prisma, company.id)).rejects.toMatchObject({ paywall: { cost: 15, balance: 0 } });
    expect(await prisma.floorplan.count({ where: { companyId: company.id } })).toBe(1);

    // Dobití START 30 → půdorys 15 kr. + rozváděč z něj doplatek 10 kr. = balíček celá zakázka 25 kr.
    const order = await createCreditOrder(prisma, company.id, "START_30");
    await confirmCreditOrder(prisma, order.id);
    const paidPlan = await createFloorplan(prisma, company.id, { meta: { name: "RD Svoboda" }, draft: flat() });
    expect(paidPlan).toMatchObject({ license: "PAID", cost: 15 });
    const bundle = await chargeNewSwitchboard(prisma, company.id, { floorplanId: paidPlan.id });
    expect(bundle.plan).toMatchObject({ license: "BUNDLE", cost: 10, reason: "BUNDLE_SWITCHBOARD" });
    const project = await createProjectFromFloorplan(prisma, { name: "RH Svoboda", customerName: null, companyId: company.id, draft: flat() });
    await settleSwitchboardCharge(prisma, bundle, [project.id], { floorplanId: paidPlan.id });
    expect(await credits(company.id)).toBe(5);
    expect((await prisma.floorplan.findUniqueOrThrow({ where: { id: paidPlan.id } })).license).toBe("BUNDLE");
    // Cenová nabídka v balíčku zdarma (u projektu i u půdorysu), přegenerování z půdorysu zakázky bez kreditu
    expect(await unlockOutput(prisma, company.id, "quote", project.id)).toMatchObject({ cost: 0, license: "BUNDLE" });
    expect(await unlockOutput(prisma, company.id, "quote", paidPlan.id)).toMatchObject({ cost: 0, license: "BUNDLE" });
    expect((await chargeNewSwitchboard(prisma, company.id, { floorplanId: paidPlan.id })).plan).toMatchObject({ cost: 0, reason: "REGENERATE" });
    // CNC balíček 8 kr. – zbývá 5 → prodejní modal s odemčením
    await expect(unlockOutput(prisma, company.id, "cnc", project.id)).rejects.toMatchObject({ paywall: { cost: 8, balance: 5, unlock: { kind: "cnc", id: project.id } } });

    const ledger = await prisma.creditTransaction.findMany({ where: { companyId: company.id }, select: { reason: true, amount: true, refId: true } });
    expect(ledger.map((row) => `${row.reason}:${row.amount}`).sort()).toEqual(["BUNDLE_SWITCHBOARD:-10", "FLOORPLAN:-15", "TOP_UP:30"]);
    expect(ledger.find((row) => row.reason === "BUNDLE_SWITCHBOARD")?.refId).toBe(project.id);
  });

  it("plná verze zkušebního rozváděče 15 kr., samostatná nabídka 8 kr. jen jednou, vrácení při smazání a nepovedeném založení", async () => {
    const company = await newCompany("pro", 40);
    const trial = await chargeNewSwitchboard(prisma, company.id);
    const trialProject = await createProjectFromFloorplan(prisma, { name: "Zkušební RH", customerName: null, companyId: company.id, draft: flat() });
    await settleSwitchboardCharge(prisma, trial, [trialProject.id]);
    expect(await unlockOutput(prisma, company.id, "switchboard", trialProject.id)).toMatchObject({ cost: 15, license: "PAID", balance: 25 });
    expect(await unlockOutput(prisma, company.id, "switchboard", trialProject.id)).toMatchObject({ cost: 0 });
    // Plná verze bez balíčku: nabídka 8 kr. jednou
    expect(await unlockOutput(prisma, company.id, "quote", trialProject.id)).toMatchObject({ cost: 8, balance: 17 });
    expect(await unlockOutput(prisma, company.id, "quote", trialProject.id)).toMatchObject({ cost: 0 });

    const paid = await chargeNewSwitchboard(prisma, company.id);
    expect(paid.plan).toMatchObject({ license: "PAID", cost: 15 });
    // Nepovedené založení vrátí kredity
    await refundCharge(prisma, paid);
    expect(await credits(company.id)).toBe(17);
    const again = await chargeNewSwitchboard(prisma, company.id);
    const project = await createProjectFromFloorplan(prisma, { name: "RH", customerName: null, companyId: company.id, draft: flat() });
    await settleSwitchboardCharge(prisma, again, [project.id]);
    expect(await credits(company.id)).toBe(2);
    // Smazání nedokončeného projektu vrátí přesně odečtených 15 kr.
    expect(await deletePanelProjects(prisma, company.id, [project.id])).toMatchObject({ deleted: 1, refunded: 15 });
    expect(await credits(company.id)).toBe(17);
  });

  it("předplatné PRO: 100 kreditů hned po úhradě a pak každý měsíc; ukázková firma má vše zkušební bez kreditů", async () => {
    const company = await newCompany("predplatne");
    const order = await createCreditOrder(prisma, company.id, "SUB_PRO_MONTH", new Date("2026-11-01T08:00:00Z"));
    expect(order).toMatchObject({ creditsCount: 100, priceCzkExclVat: 1490 });
    await confirmCreditOrder(prisma, order.id, new Date("2026-11-01T09:00:00Z"));
    expect(await prisma.registeredCompany.findUniqueOrThrow({ where: { id: company.id } })).toMatchObject({ creditsRemaining: 100, subscriptionPlan: "PRO" });
    expect(await creditSubscriptions(prisma, new Date("2026-11-20T09:00:00Z"))).toEqual({ credited: 0 });
    // Roční předplatné prodlouží období; měsíc po posledním připsání dalších 100 kreditů
    await confirmCreditOrder(prisma, (await createCreditOrder(prisma, company.id, "SUB_PRO_YEAR")).id, new Date("2026-11-21T09:00:00Z"));
    expect(await creditSubscriptions(prisma, new Date("2026-12-22T09:00:00Z"))).toEqual({ credited: 1 });
    await expect(createCreditOrder(prisma, company.id, "SUB_ENTERPRISE_MONTH")).rejects.toThrow(/aktivuje obchod/);
    const tester = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
    expect((await chargeNewSwitchboard(prisma, tester)).plan).toMatchObject({ license: "TRIAL", cost: 0 });
    expect((await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).license).toBe("PAID");
  });
});

describe("fáze 111 – uspořádání skříně a lišt z 2D půdorysu se skutečnými rozvodnicemi", () => {
  let companyId: string;
  beforeEach(async () => {
    await seedPanelBuilder(prisma, { external: false });
    companyId = (await newCompany("layout", 500)).id;
  });

  it("náhled: 4 koncepce, se Smart Home doporučená dvoupolová skříň Silnoproud | Slaboproud, skříně jsou v databázi", async () => {
    const preview = await previewFloorplanLayouts(prisma, { draft: smartHouse(), manufacturer: "ABB" });
    expect(preview.smart).toBe(true);
    expect(preview.options.map((option) => option.concept)).toEqual(["two_field", "wide24", "compact18", "two_boards"]);
    const twoField = preview.options.find((option) => option.concept === "two_field")!;
    expect(twoField).toMatchObject({ recommended: true, available: true, fields: 2, fieldBLow: true });
    expect(twoField.main.enclosures[0]).toMatchObject({ manufacturer: "ABB", fields: 2, fieldWidth: 12 });
    expect(twoField.main.rails.filter((rail) => rail.field === 1).every((rail) => rail.low)).toBe(true);
    for (const option of preview.options.filter((candidate) => candidate.available)) {
      for (const enclosure of [...option.main.enclosures, ...(option.second?.enclosures ?? [])]) expect(await prisma.panelEnclosure.count({ where: { id: enclosure.id } })).toBe(1);
    }
    const wide = preview.options.find((option) => option.concept === "wide24")!;
    expect(wide.main.rails.every((rail) => rail.capacity === 24)).toBe(true);
    expect(wide.partitionAfterRail).toBeGreaterThan(0);
    // Žádná koncepce nenechá skupinu chrániče samotnou na poloprázdné liště, když se vedle vejde další skupina
    expect(twoField.main.rails.filter((rail) => rail.field === 0 && rail.used <= 6).length).toBeLessThanOrEqual(1);
  });

  it("generování: dvoupolová skříň s uspořádáním v projektu; dva rozváděče RH1 + RH2 propojené přívodem", async () => {
    const preview = await previewFloorplanLayouts(prisma, { draft: smartHouse(), manufacturer: "ABB" });
    const pick = preview.options.find((option) => option.concept === "two_field")!.main.enclosures[0];
    const twoField = await createProjectFromFloorplan(prisma, { name: "RD Smart", customerName: null, companyId, draft: smartHouse(), manufacturer: "ABB", layout: { concept: "two_field", enclosureId: pick.id } });
    const project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: twoField.id }, include: { items: { include: { catalogComponent: true } } } });
    const layout = parseRailLayout(project.railLayoutJson, project.dinRailsCount);
    expect(layout).toMatchObject({ concept: "two_field", fields: 2, fieldBLow: true });
    expect(project.enclosureId).toBe(pick.id);
    expect(railCapacities(project).every((capacity) => capacity === 12)).toBe(true);
    const fieldB = project.items.filter((item) => item.dinRailIndex > layout.fieldARails);
    expect(fieldB.length).toBeGreaterThan(0);
    expect(fieldB.every((item) => item.circuitLabel === "Ovládání a řídicí obvody" || ["PLC", "PSU"].includes(item.catalogComponent?.category ?? ""))).toBe(true);

    const boards = await createProjectFromFloorplan(prisma, { name: "RD Smart 2", customerName: null, companyId, draft: smartHouse(), manufacturer: "ABB", layout: { concept: "two_boards" } });
    expect(boards.boards.map((board) => board.code)).toEqual(["RH1", "RH2"]);
    const rh2 = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: boards.boards[1].id }, include: { items: { include: { catalogComponent: true } } } });
    expect(rh2).toMatchObject({ boardCode: "RH2", parentBoardId: boards.id });
    expect(parseFeederInfo(rh2.feederJson)).toMatchObject({ board: "RH2", fromBoard: "RH1", protection: "B6 1P" });
    expect(rh2.items.every((item) => ["PLC", "PSU"].includes(item.catalogComponent?.category ?? ""))).toBe(true);
    expect(rh2.enclosureId).not.toBeNull();
    const rh1 = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: boards.id }, include: { items: true } });
    expect(rh1.boardCode).toBe("RH1");
    expect(rh1.items.some((item) => item.circuitLabel === "Ovládání a řídicí obvody")).toBe(true);
  });

  it("osazený projekt: přeuspořádání na 24M lišty s přepážkou, šířka všech lišt a 2 pole vedle sebe", async () => {
    const created = await createProjectFromFloorplan(prisma, { name: "RD", customerName: null, companyId, draft: smartHouse(), manufacturer: "ABB" });
    const before = await prisma.panelBoardItem.count({ where: { projectId: created.id } });
    const wide = await applyProjectLayout(prisma, created.id, { concept: "wide24" });
    let project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: created.id } });
    expect(railCapacities(project).every((capacity) => capacity === 24)).toBe(true);
    expect(parseRailLayout(project.railLayoutJson, project.dinRailsCount)).toMatchObject({ concept: "wide24", fields: 1, partitionAfterRail: expect.any(Number) });
    expect(wide.enclosure).toMatch(/ABB/);
    expect(await prisma.panelBoardItem.count({ where: { projectId: created.id } })).toBe(before);

    const narrow = await setAllRailCapacities(prisma, created.id, 12);
    project = await prisma.panelBoardProject.findUniqueOrThrow({ where: { id: created.id } });
    expect(railCapacities(project)).toEqual(Array.from({ length: narrow.rails }, () => 12));
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: created.id } });
    for (let rail = 1; rail <= narrow.rails; rail++) expect(items.filter((item) => item.dinRailIndex === rail).reduce((sum, item) => sum + item.modulesWidth, 0)).toBeLessThanOrEqual(12);

    const fields = await setRailFields(prisma, created.id, 2);
    expect(fields.layout).toMatchObject({ fields: 2, concept: "two_field" });
    expect(fields.layout.fieldARails).toBeGreaterThan(0);
    expect((await setRailFields(prisma, created.id, 1)).layout.fields).toBe(1);
  });
});

describe("fáze 111 – Hlídač revizí, AI čtečka výrobního štítku a identifikační štítek", () => {
  beforeEach(async () => {
    await seedMinimal(prisma);
  });

  it("budova s patry a místnostmi, spotřebiče z palety na 1 klik, fotka štítku se S/N a štítek EL-xxxxxx", async () => {
    expect(await getHlidacMode(prisma, "p")).toBe("FACTORY");
    await setHlidacMode(prisma, "p", "OFFICE", null);
    expect(await getHlidacMode(prisma, "p")).toBe("OFFICE");
    const created = await createHlidacBuilding(prisma, { plantId: "p", mode: "OFFICE", name: "Administrativní budova A", floors: [{ usage: "Kanceláře", rooms: ["Kancelář 101", "Kuchyňka"] }, { usage: "", rooms: ["Kancelář 204"] }] });
    const building = (await hlidacOverview(prisma, "p")).find((row) => row.id === created.buildingId)!;
    expect(building.type).toBe("OFFICE");
    expect(building.floors.map((floor) => floor.rooms.map((room) => room.name))).toEqual([["Kancelář 101", "Kuchyňka"], ["Kancelář 204"]]);

    const floorId = building.floors[0].id;
    const monitor = await addHlidacDevice(prisma, { floorId, room: "Kancelář 101", itemId: "monitor", mode: "OFFICE" });
    const cord = await addHlidacDevice(prisma, { floorId, room: "Kancelář 101", itemId: "extension", mode: "OFFICE" });
    const kettle = await addHlidacDevice(prisma, { floorId, room: "Kuchyňka", itemId: "coffee", mode: "OFFICE" });
    expect(monitor).toMatchObject({ tag: expect.stringMatching(/^SP-\d{4}$/), name: expect.stringMatching(/ - Monitor$/), inspectionIntervalMonths: 24 });
    expect(cord).toMatchObject({ tag: expect.stringMatching(/^PP-\d{4}$/), inspectionIntervalMonths: 12 });
    expect(kettle.tag).not.toBe(monitor.tag);
    const row = await prisma.equipment.findUniqueOrThrow({ where: { id: monitor.id } });
    expect(row).toMatchObject({ assignedZone: "Kancelář 101", usageGroup: "E", protectionClass: "I", type: "APPLIANCE" });
    expect(row.qrToken).toMatch(/^[0-9A-F]{10}$/);

    // 📷 Výrobní štítek – AI (podvržená odpověď Gemini) přečte S/N a parametry, fotka zůstane u zařízení
    const result = await readNameplate(
      { image: { bytes: Buffer.from("foto"), mimeType: "image/jpeg" } },
      { vision: async <T,>() => ({ rawText: "DELL\nMonitor Dell UltraSharp 27\nModel: U2723QE\nS/N: CN-0892K1-74210\n100-240V~ 50/60Hz 1.5A\nClass I", name: "Monitor Dell UltraSharp 27", manufacturer: "Dell", model: "U2723QE", serialNumber: "cn-0892k1-74210", protectionClass: "I" }) as T },
    );
    expect(result).toMatchObject({ mode: "GEMINI", reading: { serialNumber: "CN-0892K1-74210", model: "U2723QE", manufacturer: "Dell", protectionClass: "I", currentA: 1.5, voltage: "100–240 V AC / 50/60 Hz" } });
    await saveNameplatePhoto(prisma, monitor.id, { photoUrl: "/api/files/photos/stitek-monitor.jpg", result });
    const applied = await applyNameplate(prisma, monitor.id, { ...result.reading, usageGroup: "E", title: "Monitor Dell UltraSharp 27" });
    expect(applied).toMatchObject({ name: `${monitor.tag} - Monitor Dell UltraSharp 27`, serialNumber: "CN-0892K1-74210", manufacturer: "Dell", model: "U2723QE", protectionClass: "I", inspectionIntervalMonths: 24 });
    const stored = await prisma.equipment.findUniqueOrThrow({ where: { id: monitor.id }, include: { floor: { include: { building: true } } } });
    expect(stored).toMatchObject({ nameplatePhotoUrl: "/api/files/photos/stitek-monitor.jpg", ratedVoltage: "100–240 V AC / 50/60 Hz", ratedCurrent: "1,5 A" });
    expect(JSON.parse(stored.nameplateDataJson!)).toMatchObject({ serialNumber: "CN-0892K1-74210", mode: "GEMINI" });

    // Identifikační štítek: unikátní QR EL-xxxxxx z registru (idempotentně), název, S/N, místnost, třída a skupina
    const serial = await ensureEquipmentLabel(prisma, monitor.id);
    expect(serial).toMatch(/^EL-\d{6}$/);
    expect(await ensureEquipmentLabel(prisma, monitor.id)).toBe(serial);
    expect(await ensureEquipmentLabel(prisma, cord.id)).not.toBe(serial);
    const label = idLabelData(stored, { serial, building: stored.floor.building.name, floor: stored.floor.name, validUntil: null });
    expect(label).toMatchObject({ serial, qrUrl: `https://eldock.cz/q/${serial}`, title: "Monitor Dell UltraSharp 27", brandModel: "Dell U2723QE", serialNumber: "CN-0892K1-74210", classGroup: "Tř. I · sk. E (ČSN 33 1600)", nextRevision: "Revize: zatím neprovedena" });
    expect(label.location).toContain("Kancelář 101");

    const overview = await hlidacOverview(prisma, "p");
    const devices = overview.find((entry) => entry.id === created.buildingId)!.floors[0].rooms[0].devices;
    expect(devices.find((device) => device.id === monitor.id)).toMatchObject({ hasNameplate: true, serialNumber: "CN-0892K1-74210" });

    // Bez Gemini (demo režim) údaje z přepsaného textu štítku
    const demo = await readNameplate({ image: null, text: "Hilti AG 125-15DB\nÚhlová bruska\nTYPE AG 125-15DB 230 V 6,5 A 50-60 Hz 1500 W\nSer. No. 4180123456 回" });
    expect(demo).toMatchObject({ mode: "DEMO", reading: { manufacturer: "Hilti", serialNumber: "4180123456", protectionClass: "II", powerW: 1500, voltage: "230 V AC / 50/60 Hz" } });
  });
});
