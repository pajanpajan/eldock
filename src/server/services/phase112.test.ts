import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { hdoControlDesignation, hdoControlOf } from "@/lib/panel-builder/hdo";
import { DEFAULT_OPERATOR } from "@/lib/operator";
import { parseRevisionRows } from "@/lib/revision-import";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { confirmCreditOrder, createCreditOrder } from "./credits";
import { createHlidacBuilding, hlidacOverview } from "./hlidac";
import { paymentAccount, saveLabelSets, saveOperatorProfile, operatorProfileOf } from "./operator";
import { createProjectFromFloorplan, createProjectFromRevision } from "./panel-projects";
import { createLabelBatch } from "./qr-labels";
import { importRevisionAppliances, readTablePhoto } from "./revision-import";
import { processSnap } from "./snap";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 112: stykač HDO z půdorysu, rozváděč z okruhů staré revize, spotřebiče z importu do budovy s převzatou revizí,
// sekvenční sběr Scan & Snap (idempotentní odeslání z offline fronty, QR štítek, AI štítek, rychlá revize) a údaje
// provozovatele s fakturací sad QR štítků.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

const el = (id: string, item: string, x: number, y: number, room: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

function house(): FloorplanDraft {
  return {
    ...emptyDraft(),
    environment: "INDOOR_DRY",
    rooms: [
      { id: "m1", name: "Technická místnost", x: 0, y: 0, w: 4000, h: 3000 },
      { id: "m2", name: "Garáž", x: 4000, y: 0, w: 6000, h: 3000 },
    ],
    elements: [el("rh", "panel", 300, 1500, "Technická místnost"), el("z1", "socket", 2000, 100, "Technická místnost"), el("bo", "boiler", 1000, 2900, "Technická místnost"), el("ev", "wallbox", 8000, 2900, "Garáž")],
  };
}

async function newCompany(id: string, credits = 0) {
  return prisma.registeredCompany.create({
    data: { id, productScope: "PANEL_BUILDER", ico: "27082440", companyName: `Elektro ${id}`, street: "Ulice 1", city: "Liberec", zip: "460 01", contactName: "Elektrikář", email: `${id}@firma.cz`, phone: "+420 777 000 000", passwordHash: "x", termsAcceptedAt: new Date(), creditsRemaining: credits },
  });
}

describe("fáze 112 – AI Panel Builder: stykač HDO z půdorysu a rozváděč ze staré revize", () => {
  beforeEach(async () => {
    await seedPanelBuilder(prisma, { external: false });
  });

  it("bojler z půdorysu: stykač ABB ESB za jističem bojleru ve stromu, ovládací jistič B6 HDO v konfiguraci stykače", async () => {
    const company = await newCompany("hdo", 100);
    const result = await createProjectFromFloorplan(prisma, { name: "RD s bojlerem", customerName: null, companyId: company.id, draft: house(), manufacturer: "ABB" });
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: result.id }, include: { catalogComponent: true } });
    const contactors = items.filter((item) => item.catalogComponent?.category === "CONTACTOR");
    expect(contactors).toHaveLength(1);
    const contactor = contactors[0];
    expect(contactor.catalogComponent).toMatchObject({ typeCode: "ESB20-20N-06" });
    const breaker = items.find((item) => item.id === contactor.parentItemId)!;
    expect(breaker.circuitLabel).toMatch(/^Bojler/);
    const control = items.find((item) => item.circuitLabel.startsWith("Ovládání HDO"))!;
    expect(control).toBeDefined();
    expect(hdoControlOf(contactor.configJson)).toBe(`item:${control.id}`);
    expect(hdoControlDesignation(hdoControlOf(contactor.configJson), items)).toBe(control.designation);
    expect(contactor.circuitLabel).toMatch(/^Stykač HDO – Bojler/);
  });

  it("okruhy staré revizní zprávy → rozváděč (jističe, kabely, chrániče podle ČSN 33 2130 ed. 4)", async () => {
    const company = await newCompany("revize", 100);
    const table = parseRevisionRows([
      ["Označení", "Název", "Místnost", "Jistič / typ", "Kabel", "Zs [Ω]"],
      ["-F1", "Zásuvky kuchyň", "Kuchyň", "B16", "CYKY-J 3×2,5", "0,62"],
      ["-F2", "Světla obývák", "Obývák", "B10", "CYKY-J 3×1,5", "0,81"],
      ["-F3", "Varná deska", "Kuchyň", "3×B16", "CYKY-J 5×2,5", "0,55"],
      ["-FI1", "Proudový chránič", "", "RCD 40A 30mA", "", ""],
    ]);
    expect(table.kind).toBe("circuits");
    const result = await createProjectFromRevision(prisma, { name: "RD z revize", customerName: null, companyId: company.id, records: table.records });
    expect(result.circuits).toBe(3);
    const items = await prisma.panelBoardItem.findMany({ where: { projectId: result.id }, include: { catalogComponent: true } });
    expect(items.filter((item) => item.catalogComponent?.category === "MCB").length).toBeGreaterThanOrEqual(3);
    expect(items.some((item) => item.catalogComponent?.category === "RCD")).toBe(true);
    expect(items.some((item) => item.circuitLabel.startsWith("Varná deska"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("bez jističe"))).toBe(true);
    await expect(createProjectFromRevision(prisma, { name: "Prázdný", customerName: null, companyId: company.id, records: table.records.filter((record) => record.protection.startsWith("RCD")) })).rejects.toThrow(/žádné okruhy s jističem/);
  });
});

describe("fáze 112 – Hlídač revizí: import spotřebičů a sekvenční sběr Scan & Snap", () => {
  let floorId: string;
  beforeEach(async () => {
    await seedMinimal(prisma);
    const created = await createHlidacBuilding(prisma, { plantId: "p", mode: "OFFICE", name: "Administrativní budova B", floors: [{ usage: "Kanceláře", rooms: ["Kancelář 301", "Serverovna"] }] });
    floorId = (await hlidacOverview(prisma, "p")).find((row) => row.id === created.buildingId)!.floors[0].id;
  });

  it("import tabulky spotřebičů: zařízení v místnosti se S/N a převzatá revize (Riso, RPE, vyhovuje / nevyhovuje)", async () => {
    const table = parseRevisionRows([
      ["Označení", "Název", "RPE [Ω]", "Riso [MΩ]", "S/N", "Výsledek", "Datum"],
      ["SP-0901", "Monitor Dell UltraSharp 27", "0,08", ">200", "CN-0892K1-74210", "Vyhovuje", "12.03.2026"],
      ["", "Prodlužovací přívod 5 zásuvek 3 m", "0,12", "150", "PP-2026-0153", "Nevyhovuje", "12.03.2026"],
      ["", "Kávovar", "", "", "", "", ""],
    ]);
    const reports: string[] = [];
    const result = await importRevisionAppliances(prisma, { floorId, room: "Kancelář 301", records: table.records, mode: "OFFICE", inspector: { name: "Ing. Revizní", license: "E2A-1234" }, source: "Metrel ES Manager", saveReport: async (svg) => (reports.push(svg), `/api/files/documents/import-${reports.length}.svg`), now: new Date("2026-11-13T10:00:00Z") });
    expect(result.created.map((row) => row.tag)).toEqual(["SP-0901", expect.stringMatching(/^PP-\d{4}$/), expect.stringMatching(/^SP-\d{4}$/)]);
    expect(result.inspections).toBe(2);
    const monitor = await prisma.equipment.findFirstOrThrow({ where: { tag: "SP-0901" }, include: { inspections: true } });
    expect(monitor).toMatchObject({ serialNumber: "CN-0892K1-74210", assignedZone: "Kancelář 301", type: "APPLIANCE", usageGroup: "E" });
    expect(monitor.inspections[0]).toMatchObject({ result: "CAPABLE", insulationResistance: 200, protectiveConductorResistance: 0.08, measuringInstrument: "Metrel ES Manager", reportNumber: "IMP-20260312-SP-0901" });
    const cord = await prisma.equipment.findFirstOrThrow({ where: { serialNumber: "PP-2026-0153" }, include: { inspections: true } });
    expect(cord.type).toBe("EXTENSION_CORD");
    expect(cord.inspections[0].result).toBe("INCAPABLE");
    // Fotka tabulky bez Gemini = srozumitelná chyba, s AI řádky tabulky
    await expect(readTablePhoto({ bytes: Buffer.from("x"), mimeType: "image/jpeg" })).rejects.toThrow(/Gemini/);
    expect(await readTablePhoto({ bytes: Buffer.from("x"), mimeType: "image/jpeg" }, { vision: async <T,>() => ({ rows: [["Označení", "Název"], ["-F1", "Zásuvky"]] }) as T })).toEqual([["Označení", "Název"], ["-F1", "Zásuvky"]]);
  });

  it("Scan & Snap: naskenovaný štítek EL-xxxxxx, AI výrobní štítek, rychlá revize; opakované odeslání z fronty nic nezdvojí", async () => {
    const batch = await createLabelBatch(prisma, { companyName: "Testovací závod", ico: null, email: null, purpose: "APPLIANCE", count: 2 });
    const codes = (await prisma.qrLabelItem.findMany({ where: { batchId: batch.id }, orderBy: { sequence: "asc" } })).map((row) => row.serialCode);
    const vision = async <T,>() => ({ rawText: "BOSCH GSB 18V-55 S/N 583012345 Class II", name: "Aku příklepová vrtačka Bosch GSB 18V-55", manufacturer: "Bosch", model: "GSB 18V-55", serialNumber: "583012345", protectionClass: "II" }) as T;
    const base = { accountId: null, floorId, room: "Kancelář 301", mode: "OFFICE" as const, passed: true, rpeOhm: null, risoMOhm: 12, inspectorName: "Ing. Revizní", inspectorLicense: "E2A-1234", text: null, photo: { url: "/api/files/photos/stitek-vrtacka.jpg", bytes: Buffer.from("foto"), mimeType: "image/jpeg" } };
    const saveReport = async () => "/api/files/documents/rychla.svg";
    const first = await processSnap(prisma, { ...base, id: "snap-0001-abcdef", labelCode: codes[0] }, { saveReport, vision });
    expect(first.duplicate).toBe(false);
    expect(first.result).toMatchObject({ label: codes[0], inspection: "CAPABLE", warning: null });
    const tool = await prisma.equipment.findUniqueOrThrow({ where: { id: first.result.equipmentId }, include: { inspections: true } });
    expect(tool).toMatchObject({ type: "POWER_TOOL", serialNumber: "583012345", protectionClass: "II", nameplatePhotoUrl: "/api/files/photos/stitek-vrtacka.jpg", manufacturer: "Bosch", assignedZone: "Kancelář 301" });
    expect(tool.name).toContain("Aku příklepová vrtačka Bosch GSB 18V-55");
    expect(tool.inspections).toHaveLength(1);

    // Druhé odeslání stejného záznamu z offline fronty (po obnovení signálu) = stejný výsledek, nic nového
    const again = await processSnap(prisma, { ...base, id: "snap-0001-abcdef", labelCode: codes[0] }, { saveReport, vision });
    expect(again).toMatchObject({ duplicate: true, result: { equipmentId: first.result.equipmentId } });
    expect(await prisma.equipment.count({ where: { floorId, assignedZone: "Kancelář 301" } })).toBe(1);

    // Už použitý štítek → zařízení dostane další štítek z registru a varování; bez fotky a bez AI = obecný název
    const second = await processSnap(prisma, { ...base, id: "snap-0002-abcdef", labelCode: codes[0], photo: null, passed: false }, { saveReport, vision });
    expect(second.result.label).not.toBe(codes[0]);
    expect(second.result.warning).toMatch(/už je spárovaný/);
    expect(second.result.inspection).toBe("INCAPABLE");
    expect(second.result.name).toContain("Spotřebič (doplnit název ze štítku)");
  });
});

describe("fáze 112 – provozovatel, QR platba a sady QR štítků", () => {
  it("údaje provozovatele z velínu: kontrola IČO / IBAN, účet pro QR platbu, neplátce DPH a objednávka sady štítků", async () => {
    expect(await operatorProfileOf(prisma)).toEqual(DEFAULT_OPERATOR);
    await expect(saveOperatorProfile(prisma, { ...DEFAULT_OPERATOR, ico: "12345678" })).rejects.toThrow(/Neplatné IČO/);
    const saved = await saveOperatorProfile(prisma, { ...DEFAULT_OPERATOR, ico: "27082440", dic: "cz 27082440", registry: "Živnostenský rejstřík MěÚ Jablonec nad Nisou", vatPayer: false, iban: "CZ65 0800 0000 1920 0014 5399", bic: "GIBACZPX", bankName: "Česká spořitelna, a.s.", accountNumber: "" });
    expect(saved).toMatchObject({ dic: "CZ27082440", iban: "CZ6508000000192000145399", accountNumber: "19-2000145399/0800" });
    expect(await paymentAccount(prisma)).toMatchObject({ iban: "CZ6508000000192000145399", bic: "GIBACZPX", bankName: "Česká spořitelna, a.s." });

    const company = await newCompany("stitky");
    // Neplátce DPH: cena bez DPH je konečná
    const credits = await createCreditOrder(prisma, company.id, "START_30");
    expect(credits).toMatchObject({ priceCzkExclVat: 750, priceCzkInclVat: 750 });
    await expect(createCreditOrder(prisma, company.id, "LABELS_50")).rejects.toThrow(/neprodává/);
    await saveLabelSets(prisma, [{ title: "Sada 50 stříbrných QR štítků ELDOCK 30 × 15 mm", count: 50, priceExclVat: 690 }]);
    const order = await createCreditOrder(prisma, company.id, "LABELS_50");
    // Fáze 113: kód objednávky podle složení sady
    expect(order).toMatchObject({ packageCode: "LABELS_A50", creditsCount: 0, priceCzkExclVat: 690, priceCzkInclVat: 690 });
    const confirmed = await confirmCreditOrder(prisma, order.id);
    expect(confirmed).toMatchObject({ orderedLabels: 50, bonusLabels: 0 });
    expect(confirmed.company.creditsRemaining).toBe(0);
    const batch = await prisma.qrLabelBatch.findFirstOrThrow({ where: { companyName: "Elektro stitky" }, include: { items: true } });
    expect(batch.items).toHaveLength(50);
    expect(batch.note).toMatch(/odeslat poštou/);
  });
});
