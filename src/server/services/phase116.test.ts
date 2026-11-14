import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { thermalCheck } from "@/lib/passport-docs";

import { recordWalkInspection } from "./inspection";
import { replaceBomComponent, setComponentStock, updateBomComponent, updateOperatingProfile } from "./lifespan";
import { equipmentLifespan, getPurchaseSettings, plantPurchaseReport, savePurchaseSettings, sendDuePurchaseReports } from "./lifespan-report";
import { generatePassportDocument, updateLotoResponsible, uploadPassportDocument } from "./passport";
import { createTestDb } from "./test-db";

// Fáze 116: pasport 5 z 5, životnost z kusovníku (četnost, sklad závodu, výměna), souhrnný nákupní report a e-mail
// nákupu, rychlý zápis z pochůzky revizního technika – služby nad SQLite.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
const NOW = new Date("2026-11-14T08:00:00Z");

const BOM = [
  { designation: "Q1", description: "Hlavní vypínač 3P 63 A", manufacturer: "Eaton", partNumber: "P3-63/EA/SVB" },
  { designation: "K1", description: "Stykač 3P 25 A, cívka 24 V DC", manufacturer: "Schneider Electric", partNumber: "LC1D25BD" },
  { designation: "K2", description: "Stykač 3P 25 A, cívka 24 V DC", manufacturer: "Schneider Electric", partNumber: "LC1D25BD" },
  { designation: "X1", description: "Průchozí svorka 2,5 mm²", manufacturer: "Phoenix Contact", partNumber: "UT 2,5" },
];

async function board(id: string, buildingId: string, year: number, shiftRegime: number) {
  await prisma.equipment.create({ data: { id, floorId: `f-${buildingId}`, tag: id.toUpperCase(), name: `${id.toUpperCase()} - Rozváděč`, type: "SWITCHBOARD", pinX: 20, pinY: 30, yearInstalled: year, shiftRegime, ratedCurrent: "63 A" } });
  await prisma.documentRevision.create({
    data: {
      id: `rev-${id}`,
      equipmentId: id,
      version: "v1.0",
      major: 1,
      minor: 0,
      status: "ACTIVE",
      title: `Schéma ${id}`,
      schematicUrl: `/api/files/revisions/seed/${id}.svg`,
      schematicFormat: "SVG",
      authorId: "u1",
      bomItems: { create: BOM.map((item, index) => ({ ...item, position: index + 1, quantity: item.designation === "X1" ? 12 : 1, unit: "ks" })) },
    },
  });
}

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await prisma.user.create({ data: { id: "u1", name: "Karel Novotný", email: "karel@example.com", role: "MAINTENANCE" } });
  await prisma.plant.create({ data: { id: "plant", code: "JBC", name: "Závod Jablonec", customerName: "Test" } });
  for (const code of ["A", "B"]) {
    await prisma.building.create({ data: { id: code, plantId: "plant", code, name: `Hala ${code}`, mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
    await prisma.floor.create({ data: { id: `f-${code}`, buildingId: code, level: 0, code: "1NP", name: "1. NP" } });
  }
  // Hala A: 3 směny od 2019 → stykače LC1D25BD (B10d 1 369 863, odhad 30 sepnutí/h) po životnosti; Hala B: 2 směny od 2016
  await board("ra", "A", 2019, 3);
  await board("rb", "B", 2016, 2);
});

afterEach(async () => {
  await db.cleanup();
});

describe("pasport & shoda (61439)", () => {
  it("doplnění chybějících dokumentů: liniové schéma ze záložky Schéma, oteplení, vnější vlivy, prohlášení a kusová zkouška → 5 z 5", async () => {
    await uploadPassportDocument(prisma, { equipmentId: "ra", category: "CONFORMITY_DECLARATION", fileUrl: "/api/files/documents/seed/doc-ra.pdf", documentNumber: "DoC-1", issuer: "Elektro Test s.r.o.", issuedAt: "2026-11-01" });
    const single = await generatePassportDocument(prisma, { equipmentId: "ra", author: "Karel Novotný", payload: { kind: "SINGLE_LINE_DIAGRAM", revisionId: "rev-ra", version: "", schematicUrl: "", sheetCount: 1 } });
    expect(single).toMatchObject({ source: "LINKED", fileUrl: "/api/files/revisions/seed/ra.svg", documentNumber: "LS-RA-20261114" });
    const losses = [{ designation: "K1", description: "Stykač", quantity: 2, lossW: 3.75, source: "list" }];
    const enclosure = { heightMm: 1000, widthMm: 600, depthMm: 250, installation: "WALL_MOUNTED" as const, material: "PAINTED_STEEL" as const };
    const thermal = await generatePassportDocument(prisma, { equipmentId: "ra", author: "Karel Novotný", payload: { kind: "THERMAL_CALCULATION", enclosure, ambientTempC: 35, maxRiseK: 30, losses, wiringLossW: 1.5, result: thermalCheck({ enclosure, ambientTempC: 35, maxRiseK: 30, losses, wiringLossW: 1.5 }), date: "2026-11-14", author: "Karel Novotný" } });
    expect(thermal.source).toBe("GENERATED");
    expect(thermal.fileUrl).toBe(`/equipment/ra/pasport/${thermal.id}`);
    expect(thermal.notes).toMatch(/^VYHOVUJE/);
    await generatePassportDocument(prisma, { equipmentId: "ra", author: "Karel Novotný", payload: { kind: "EXTERNAL_INFLUENCES", space: "Hala A › 1. NP", codes: ["AA5", "AB5", "AD1", "AE1", "AF1", "AG1", "BA4", "BC2", "BD1", "BE1"], conclusion: "NORMAL", chair: "Karel Novotný", members: [], basis: "ČSN 33 2000-5-51 ed. 3", date: "2026-11-14" } });
    await generatePassportDocument(prisma, {
      equipmentId: "ra",
      author: "Karel Novotný",
      payload: { kind: "ROUTINE_VERIFICATION", items: ["11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10"].map((clause) => ({ clause, label: clause, result: "OK" as const })), testVoltageV: 2500, insulationMOhm: 500, instrument: "Metrel", performedBy: "Karel Novotný", date: "2026-11-14" },
    });
    const categories = new Set((await prisma.complianceDocument.findMany({ where: { equipmentId: "ra" }, select: { category: true } })).map((doc) => doc.category));
    expect(categories.size).toBe(5);
    // Neúplný výpočet oteplení se neuloží
    await expect(generatePassportDocument(prisma, { equipmentId: "rb", author: "x", payload: { kind: "THERMAL_CALCULATION", enclosure, ambientTempC: 35, maxRiseK: 30, losses: [{ ...losses[0], lossW: null }], wiringLossW: 0, result: thermalCheck({ enclosure, ambientTempC: 35, maxRiseK: 30, losses, wiringLossW: 0 }), date: "2026-11-14", author: "x" } })).rejects.toThrow("Doplňte ztrátový výkon");
    const loto = await updateLotoResponsible(prisma, { equipmentId: "ra", persons: { ooez: { name: "Karel Novotný", phone: "+420 777 000 111" }, oprpc: null } });
    expect(JSON.parse(loto.lotoResponsibleJson!)).toEqual({ ooez: { name: "Karel Novotný", phone: "+420 777 000 111" }, oprpc: null });
  });
});

describe("životnost součástek z kusovníku", () => {
  it("automatický model, četnost spínání, sklad závodu podle MPN a výměna (Reset 100 %)", async () => {
    const before = await equipmentLifespan(prisma, "rb", { now: NOW });
    const k1 = before!.rows.find(({ row }) => row.key === "K1")!;
    expect(k1.row.componentId).toBeNull();
    expect(k1.assessment!.remainingPercent).toBeLessThan(15);
    expect(before!.rows.find(({ row }) => row.key === "X1")!.assessment).toBeNull();

    await updateBomComponent(prisma, { equipmentId: "rb", designation: "-K1", cyclesPerHour: 10, now: NOW });
    const slower = (await equipmentLifespan(prisma, "rb", { now: NOW }))!.rows.find(({ row }) => row.key === "K1")!;
    expect(slower.row.componentId).not.toBeNull();
    expect(slower.assessment!.remainingPercent).toBeGreaterThan(k1.assessment!.remainingPercent);

    const stock = await setComponentStock(prisma, { equipmentId: "rb", designation: "K2", quantity: 2 });
    expect(stock).toEqual({ shared: true, partNumber: "LC1D25BD", quantity: 2 });
    // Sklad závodu platí i pro rozváděč v Hale A
    expect((await equipmentLifespan(prisma, "ra", { now: NOW }))!.rows.find(({ row }) => row.key === "K1")!.stock).toBe(2);

    await replaceBomComponent(prisma, { equipmentId: "rb", designation: "K2", now: NOW });
    const replaced = (await equipmentLifespan(prisma, "rb", { now: NOW }))!.rows.find(({ row }) => row.key === "K2")!;
    expect(replaced.assessment!.remainingPercent).toBe(100);
    expect(replaced.stock).toBe(1);
    await expect(updateBomComponent(prisma, { equipmentId: "rb", designation: "X1", cyclesPerHour: 5 })).rejects.toThrow("pasivní prvek");
    await updateOperatingProfile(prisma, { equipmentId: "rb", shiftRegime: 4, internalTempC: 40, lifespanAlertDays: 180 });
    await expect(updateOperatingProfile(prisma, { equipmentId: "rb", shiftRegime: 4, internalTempC: 40, lifespanAlertDays: 45 })).rejects.toThrow("Předstih upozornění");
  });

  it("nákupní report závodu: stykače obou hal v jednom řádku MPN, sklad odečten; e-mail nákupu jen při nové součástce", async () => {
    await prisma.sparePartStock.create({ data: { plantId: "plant", partKey: "LC1D25BD", partNumber: "LC1D25BD", quantity: 1 } });
    const { report } = await plantPurchaseReport(prisma, "plant", 365, NOW);
    expect(report.triggered).toBe(true);
    const contactors = report.lines.find((line) => line.partNumber === "LC1D25BD")!;
    expect(contactors).toMatchObject({ needed: 4, inStock: 1, toOrder: 3 });
    expect(new Set(contactors.machines.map((machine) => machine.buildingName))).toEqual(new Set(["Hala A", "Hala B"]));

    await savePurchaseSettings(prisma, "plant", { email: "nakup@example.com", frequency: "FIRST_WARNING", horizonDays: 365 }, "u1");
    const sentMails: string[] = [];
    const transport = async (message: { to: string[]; subject: string }) => void sentMails.push(`${message.to.join(",")}|${message.subject}`);
    const first = await sendDuePurchaseReports(prisma, { now: NOW, origin: "https://eldock.test", transport });
    expect(first).toEqual([{ plantId: "plant", delivery: "SENT" }]);
    expect(sentMails[0]).toContain("nakup@example.com|📦 Nákupní report součástek před koncem životnosti – Závod Jablonec");
    expect((await getPurchaseSettings(prisma, "plant")).notifiedKeys.length).toBeGreaterThan(0);
    // Další den bez nové součástky v předstihu se nic neposílá
    expect(await sendDuePurchaseReports(prisma, { now: new Date("2026-11-15T08:00:00Z"), origin: "https://eldock.test", transport })).toEqual([]);
    await expect(savePurchaseSettings(prisma, "plant", { email: "neplatny", frequency: "MONTHLY", horizonDays: 90 }, "u1")).rejects.toThrow("platný e-mail");
  });
});

describe("⚡ rychlý zápis z pochůzky revizního technika", () => {
  it("dnešní revize VYHOVUJE s R_iso, R_PE a Z_s; druhý zápis téhož dne se odmítne", async () => {
    await prisma.equipment.create({ data: { id: "pp", floorId: "f-A", tag: "PP-0031", name: "PP-0031 - Prodlužovací buben", type: "EXTENSION_CORD", protectionClass: "I", handHeld: true, usageGroup: "C", pinX: 40, pinY: 40, inspectionIntervalMonths: 12 } });
    const input = { equipmentId: "pp", inspectorName: "Jan Test", inspectorLicense: "TEST-1234", insulationResistance: 318, protectiveConductorResistance: 0.21, loopImpedanceOhm: 0.45, reportUrl: "/api/files/documents/x.svg" };
    const record = await recordWalkInspection(prisma, input, NOW);
    expect(record).toMatchObject({ type: "PERIODIC", result: "CAPABLE", loopImpedanceOhm: 0.45, reportNumber: "RP-20261114-PP-0031" });
    await expect(recordWalkInspection(prisma, input, NOW)).rejects.toThrow("dnes už zapsaná");
    await expect(recordWalkInspection(prisma, { ...input, equipmentId: "rb", protectiveConductorResistance: 5 }, NOW)).rejects.toThrow();
    // Rozváděč (revize VTZ): bez rozsahu a platnosti osvědčení se nezapíše, s nimi ano
    await expect(recordWalkInspection(prisma, { ...input, equipmentId: "ra" }, NOW)).rejects.toThrow("rozsah osvědčení");
    const vtz = await recordWalkInspection(prisma, { ...input, equipmentId: "ra", inspectorScope: "E2A", inspectorValidUntil: "2030-12-31" }, NOW);
    expect(vtz).toMatchObject({ result: "CAPABLE", inspectorScope: "E2A", loopImpedanceOhm: 0.45 });
  });
});
