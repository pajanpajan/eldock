import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { snapshotStringify } from "@/lib/switchboard-versions";
import { DEFAULT_TURNKEY_CONFIG, turnkeyEstimate, type FactoryTestInput } from "@/lib/panel-builder/turnkey-manufacturing";

import { acceptManufacturingOrder, authenticateManufacturer, completeManufacturingOrder, createManufacturer, createManufacturingOrder, manufacturerOrders, recordFactoryTest } from "./manufacturing";
import { resolveLabel } from "./qr-labels";
import { createTestDb } from "./test-db";

// Fáze 106 nad SQLite: zakázka výroby rozváděče na klíč – poptávka rezervuje unikátní QR štítek EL-…, poptávku „všem
// v kraji“ přijme jen první výrobce, kusová zkouška výrobce a dokončení uzamkne dokumentaci jako Verzi 1.0 pod štítkem.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

const NOW = new Date("2026-11-12T10:00:00Z");
const company = (id: string) =>
  prisma.registeredCompany.create({ data: { id, ico: "27074358", companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: `Kontakt ${id}`, email: `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: NOW, productScope: "PANEL_BUILDER" } });
const project = (id: string, companyId: string) => prisma.panelBoardProject.create({ data: { id, code: "PB-106", name: "Rozvaděč RH1", companyId, dominantManufacturer: "ABB", dinRailsCount: 3, modulesPerRail: 18 } });
const ESTIMATE = turnkeyEstimate({ materialCzk: 18000, laborCzk: 9000, laborHours: 14, missingPrices: 0 });
const order = (manufacturerId: string | null) => createManufacturingOrder(prisma, { projectId: "prj", companyId: "pb", manufacturerId, region: "Liberecký kraj", config: DEFAULT_TURNKEY_CONFIG, estimate: ESTIMATE, contactName: "Jan Zákazník", contactEmail: "jan@zakaznik.example", now: NOW });
const TEST: FactoryTestInput = { testerName: "Petr Výrobce", enclosureSerial: "SN-106", measuredAt: "2026-11-12", insulationMOhm: 300, peContinuityOhm: 0.03, rcdTripCurrentMa: 21, rcdTripTimeMs: 22, torqueOk: true, wiringOk: true, checks: { ip: true, clearances: true, devices: true, circuits: true, terminals: true } };

describe("fáze 106 – výroba rozváděče na klíč", () => {
  it("poptávka zarezervuje unikátní QR štítek EL-…, výrobce ji přijme, zapíše kusovou zkoušku a uzamkne Verzi 1.0 na /q/EL-…", async () => {
    await company("pb");
    await project("prj", "pb");
    const maker = await createManufacturer(prisma, { name: "Rozváděče Liberec s.r.o.", email: "vyroba@rozvadece.example", region: "Liberecký kraj", ico: "12345678", leadDays: 6 });
    expect(maker.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(await authenticateManufacturer(prisma, "VYROBA@rozvadece.example", maker.code.toLowerCase())).toMatchObject({ name: "Rozváděče Liberec s.r.o." });
    expect(await authenticateManufacturer(prisma, "vyroba@rozvadece.example", "AAAA-BBBB-CCCC")).toBeNull();

    const created = await order(maker.id);
    expect(created.number).toBe("VYR-2026-0001");
    expect(created.qrSerial).toMatch(/^EL-\d{6}$/);
    // Štítek z registru je spárovaný s rozváděčem hned při poptávce
    expect(await prisma.panelBoardProject.findUnique({ where: { id: "prj" }, select: { qrSerial: true } })).toEqual({ qrSerial: created.qrSerial });
    expect(await resolveLabel(prisma, created.qrSerial)).toMatchObject({ targetType: "PANEL_PROJECT", targetId: "prj" });
    // Druhá poptávka téhož rozváděče, dokud je ve výrobě, neprojde
    await expect(order(maker.id)).rejects.toThrow(/už je ve výrobě/);

    await acceptManufacturingOrder(prisma, { orderId: created.id, manufacturerId: maker.id, priceCzk: 29900, days: 6 });
    const { issues } = await recordFactoryTest(prisma, { orderId: created.id, manufacturerId: maker.id, test: TEST });
    expect(issues).toEqual([]);
    const done = await completeManufacturingOrder(prisma, { orderId: created.id, manufacturerId: maker.id, documentationJson: snapshotStringify({ code: "PB-106" }), floorplan: null, now: NOW });
    expect(done).toMatchObject({ version: "1.0", serial: created.qrSerial, number: "VYR-2026-0001" });
    expect(await prisma.manufacturingOrder.findUnique({ where: { id: created.id }, select: { status: true, version: true } })).toEqual({ status: "COMPLETED", version: "1.0" });
    expect(await prisma.panelBoardProject.findUnique({ where: { id: "prj" }, select: { docState: true } })).toEqual({ docState: "LOCKED_PUBLISHED" });
    const version = await prisma.switchboardVersion.findFirstOrThrow({ where: { projectId: "prj" } });
    expect(version).toMatchObject({ version: "1.0", status: "LOCKED_PUBLISHED", inspectorName: "Petr Výrobce" });
    expect(version.inspectorCert).toContain("Rozváděče Liberec s.r.o.");
  });

  it("poptávka všem výrobcům v kraji: vidí ji všichni z kraje, přijme jen první, druhému se zamkne", async () => {
    await company("pb");
    await project("prj", "pb");
    const first = await createManufacturer(prisma, { name: "Výrobce A", email: "a@vyrobce.example", region: "Liberecký kraj" });
    const second = await createManufacturer(prisma, { name: "Výrobce B", email: "b@vyrobce.example", region: "Liberecký kraj" });
    const other = await createManufacturer(prisma, { name: "Výrobce C", email: "c@vyrobce.example", region: "Hlavní město Praha" });
    const created = await order(null);
    expect((await manufacturerOrders(prisma, first.id)).map((row) => row.id)).toEqual([created.id]);
    expect((await manufacturerOrders(prisma, other.id)).length).toBe(0);
    const results = await Promise.allSettled([acceptManufacturingOrder(prisma, { orderId: created.id, manufacturerId: first.id, priceCzk: 25000, days: 10 }), acceptManufacturingOrder(prisma, { orderId: created.id, manufacturerId: second.id, priceCzk: 24000, days: 9 })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await manufacturerOrders(prisma, second.id)).length + (await manufacturerOrders(prisma, first.id)).length).toBe(1);
    // Nevyhovující kusová zkouška = nevydává se
    const winner = (await prisma.manufacturingOrder.findUniqueOrThrow({ where: { id: created.id } })).manufacturerId!;
    const failed = await recordFactoryTest(prisma, { orderId: created.id, manufacturerId: winner, test: { ...TEST, peContinuityOhm: 0.4 } });
    expect(failed.issues.length).toBeGreaterThan(0);
    await expect(completeManufacturingOrder(prisma, { orderId: created.id, manufacturerId: winner, documentationJson: "{}", floorplan: null })).rejects.toThrow(/nevyhověla/);
  });

  it("bez výrobce v kraji poptávka všem neprojde", async () => {
    await company("pb");
    await project("prj", "pb");
    await expect(order(null)).rejects.toThrow(/není žádný certifikovaný výrobce/);
  });
});
