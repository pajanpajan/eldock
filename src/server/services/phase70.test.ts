import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { ensureSyncTriggers, referencedTables, syncTriggers, SYNC_TABLES } from "@/server/sync/journal";
import { flatTransaction, pushMutations } from "@/server/sync/mutations";
import { hashPassword } from "@/server/password";

import { changePassword, setUserDisabled } from "./account-security";
import { companyExportData, executeCompanyClosure, personalExportData, removeEmployee } from "./data-requests";
import { registerFile } from "./file-registry";
import { SyncError, authenticateDevice, createPairingCode, deviceSession, findCompanyFileBySha, pairDevice, pruneSync, pullChanges, revokeDevice, rotateSyncEpoch, type DeviceContext, type SyncChangeEntry } from "./sync";
import { createTestDb, seedMinimal } from "./test-db";
import { submitChangeRequest } from "./workflow";

// Fáze 70 nad SQLite: žurnál změn (triggery nad službami, kaskáda, přestavba tabulky migrací, změna kategorie),
// párování a token zařízení, stahování změn (oddělení firem, výřez účtu, stránky, reset), fronta úprav (přesně
// jednou, oprávnění, cizí záznam a soubor, souběh, sloučení do otevřené změny), retence a GDPR.

const NOW = new Date("2026-11-08T10:00:00Z");
const DAY = 86_400_000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);
const PASSWORD = "Lisovna-Kolin-2026";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

const company = (id: string, plantId: string) =>
  prisma.registeredCompany.create({
    data: { id, ico: id === "c1" ? "12345679" : "87654321", companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Kolín", zip: "280 02", contactName: `Kontakt ${id}`, email: `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: NOW, productScope: "PLANT_MANAGEMENT", plantId },
  });

async function seedSync() {
  await seedMinimal(prisma); // obchodní demo: závod „p“, uživatelé bez firmy
  await prisma.plant.createMany({ data: [{ id: "p1", code: "LIS", name: "Lisovna", customerName: "Firma c1" }, { id: "p2", code: "CIZ", name: "Cizí závod", customerName: "Firma c2" }] });
  await company("c1", "p1");
  await company("c2", "p2");
  const passwordHash = await hashPassword(PASSWORD);
  await prisma.user.createMany({
    data: [
      { id: "admin1", name: "Olga Ředitelová", email: "olga@c1.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "c1", homePlantId: "p1", passwordHash },
      { id: "tech1", name: "Marek Údržbář", email: "marek@c1.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "c1", homePlantId: "p1", passwordHash },
      { id: "insp1", name: "Iva Revizní", email: "iva@c1.example", role: "MAINTENANCE", accountType: "INSPECTOR_APPLIANCES", companyId: "c1", homePlantId: "p1", passwordHash },
      { id: "other2", name: "Cizí Ředitel", email: "cizi@c2.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "c2", homePlantId: "p2", passwordHash },
    ],
  });
  await prisma.building.createMany({
    data: [
      { id: "b1", plantId: "p1", code: "A", name: "Hala A", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 },
      { id: "b2", plantId: "p2", code: "A", name: "Cizí hala", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 },
    ],
  });
  await prisma.floor.createMany({ data: [{ id: "f1", buildingId: "b1", level: 0, code: "1NP", name: "1. NP" }, { id: "f2", buildingId: "b2", level: 0, code: "1NP", name: "1. NP" }] });
  await prisma.equipment.create({
    data: {
      id: "e-sw",
      floorId: "f1",
      tag: "RM1",
      name: "RM1 - Hlavní rozváděč",
      type: "SWITCHBOARD",
      pinX: 10,
      pinY: 10,
      photoUrl: "/api/files/photos/rm1.jpg",
      revisions: { create: { id: "rev1", version: "v1.0", major: 1, minor: 0, status: "ACTIVE", title: "Schéma RM1", schematicUrl: "/api/files/revisions/rm1.svg", authorId: "admin1", bomItems: { create: [{ id: "bom1", position: 1, designation: "-Q1", description: "Hlavní vypínač" }] } } },
      monitoredComponents: { create: { id: "comp1", designation: "-K4", name: "Stykač čerpadla", wearCategory: "SWITCHING_CONTACTOR", installedAt: new Date("2024-01-01"), replacementStockCount: 2 } },
    },
  });
  await prisma.equipment.create({
    data: {
      id: "e-tool",
      floorId: "f1",
      tag: "VR-01",
      name: "Vrtačka Makita",
      type: "POWER_TOOL",
      pinX: 20,
      pinY: 20,
      inspections: {
        create: { id: "ins1", type: "PERIODIC", inspectionDate: new Date("2026-06-01"), validUntil: new Date("2027-06-01"), reportNumber: "R-1", inspectorName: "Iva Revizní", inspectorLicense: "E2A-123", result: "CAPABLE_WITH_DEFECTS", reportUrl: "/api/files/documents/r1.pdf" },
      },
    },
  });
  await prisma.inspectionDefect.create({ data: { id: "def1", inspectionId: "ins1", equipmentId: "e-tool", description: "Poškozený přívod", deadline: new Date("2026-12-01") } });
  await prisma.equipment.create({ data: { id: "e-foreign", floorId: "f2", tag: "RM9", name: "Cizí rozváděč", type: "SWITCHBOARD", pinX: 1, pinY: 1 } });
  await registerFile(prisma, { url: "/api/files/photos/rm1.jpg", kind: "photos", owner: { kind: "COMPANY", companyId: "c1" }, sizeBytes: 3, sha256: "a".repeat(64), mimeType: "image/jpeg" });
  await registerFile(prisma, { url: "/api/files/photos/fotka-c1.jpg", kind: "photos", owner: { kind: "COMPANY", companyId: "c1" }, sizeBytes: 3, sha256: "b".repeat(64), mimeType: "image/jpeg" });
  await registerFile(prisma, { url: "/api/files/photos/cizi.jpg", kind: "photos", owner: { kind: "COMPANY", companyId: "c2" }, sizeBytes: 3, sha256: "c".repeat(64), mimeType: "image/jpeg" });
}

async function pair(userId: string, platform: "ANDROID" | "IOS" | "WINDOWS" = "ANDROID") {
  const { code } = await createPairingCode(prisma, { userId }, NOW);
  const paired = await pairDevice(prisma, { code, name: `Telefon ${userId}`, platform, appVersion: "0.1.0" }, NOW);
  const ctx = await authenticateDevice(prisma, paired.token, NOW);
  if (!ctx) throw new Error("zařízení neověřeno");
  return { ...paired, ctx };
}

/** Stáhne všechny stránky od kurzoru; vrací změny, konečný kurzor a otisk výřezu. */
async function pullAll(ctx: DeviceContext, options: { cursor?: number; scope?: string; limit?: number } = {}) {
  let cursor = options.cursor ?? 0;
  let scope = options.scope ?? (await deviceSession(prisma, ctx, NOW)).scope;
  const changes: SyncChangeEntry[] = [];
  let files: Record<string, { sha256: string | null }> = {};
  let pages = 0;
  for (;;) {
    const page = await pullChanges(prisma, ctx, { cursor, scope, limit: options.limit }, NOW);
    expect(page.reset).toBe(false);
    pages++;
    changes.push(...page.changes);
    files = { ...files, ...page.files };
    expect(page.cursor).toBeGreaterThanOrEqual(cursor);
    cursor = page.cursor;
    scope = page.scope;
    if (!page.hasMore) break;
    if (pages > 200) throw new Error("nekonečné stránkování");
  }
  return { changes, cursor, scope, files, pages };
}

const submit = (id: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ mutations: [{ id, type: "changeRequest.submit", payload, ...extra }] });

const ids = (changes: SyncChangeEntry[], entity: string, op: "upsert" | "delete" = "upsert") => changes.filter((change) => change.entity === entity && change.op === op).map((change) => change.id).sort();

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedSync();
});
afterEach(() => db.cleanup());

describe("žurnál změn (triggery SQLite)", () => {
  it("triggery sahají jen do tabulek žurnálu a každá tabulka má vložení, změnu i smazání", async () => {
    const triggers = syncTriggers();
    for (const trigger of triggers) expect(referencedTables(trigger.sql).filter((name) => name !== "SyncChange" && name !== "SyncCounter"), trigger.name).toEqual([]);
    expect(triggers).toHaveLength(SYNC_TABLES.length * 3 + 1);
    const installed = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'trigger' AND "name" LIKE 'sync%'`);
    expect(installed.map((row) => row.name).sort()).toEqual(triggers.map((trigger) => trigger.name).sort());
    // Podruhé nic nezaloží
    expect(await ensureSyncTriggers(prisma)).toMatchObject({ created: [], dropped: [], repaired: [], backfilled: 0 });
  });

  it("rozsah se dědí z rodiče, změna posune pořadí, kaskáda zanechá značky smazání", async () => {
    const row = (entity: string, entityId: string) => prisma.syncChange.findUniqueOrThrow({ where: { entity_entityId: { entity, entityId } } });
    expect(await row("Equipment", "e-sw")).toMatchObject({ plantId: "p1", equipmentId: "e-sw", deleted: false });
    expect(await row("BomItem", "bom1")).toMatchObject({ plantId: "p1", equipmentId: "e-sw" });
    expect(await row("InspectionDefect", "def1")).toMatchObject({ plantId: "p1", equipmentId: "e-tool" });
    expect(await row("User", "admin1")).toMatchObject({ plantId: null, companyId: "c1" });
    expect(await row("Equipment", "e-foreign")).toMatchObject({ plantId: "p2" });

    const before = (await row("Equipment", "e-sw")).seq;
    await prisma.equipment.update({ where: { id: "e-sw" }, data: { description: "Nový popis" } });
    expect((await row("Equipment", "e-sw")).seq).toBeGreaterThan(before);
    // Přihlášení uživatele (čas posledního přihlášení) do žurnálu nepatří
    const userSeq = (await row("User", "tech1")).seq;
    await prisma.user.update({ where: { id: "tech1" }, data: { lastLoginAt: NOW } });
    expect((await row("User", "tech1")).seq).toBe(userSeq);

    await prisma.equipment.delete({ where: { id: "e-sw" } });
    for (const [entity, id] of [["Equipment", "e-sw"], ["DocumentRevision", "rev1"], ["BomItem", "bom1"], ["MonitoredComponent", "comp1"]]) expect((await row(entity, id)).deleted, `${entity} ${id}`).toBe(true);
  });

  it("změna kategorie zařízení přežurnáluje jeho podstrom", async () => {
    const seq = async (entity: string, entityId: string) => (await prisma.syncChange.findUniqueOrThrow({ where: { entity_entityId: { entity, entityId } } })).seq;
    const before = await seq("InspectionDefect", "def1");
    await prisma.equipment.update({ where: { id: "e-tool" }, data: { name: "Vrtačka (beze změny kategorie)" } });
    expect(await seq("InspectionDefect", "def1")).toBe(before);
    await prisma.equipment.update({ where: { id: "e-tool" }, data: { type: "MACHINE" } });
    expect(await seq("InspectionDefect", "def1")).toBeGreaterThan(before);
    expect(await seq("InspectionRecord", "ins1")).toBe(await seq("InspectionDefect", "def1"));
  });

  it("přestavba tabulky migrací (DROP + RENAME) projde a chybějící triggery se doplní i se změnami mezitím", async () => {
    await prisma.equipment.create({ data: { id: "e-gone", floorId: "f1", tag: "X-1", name: "Smaže se bez triggeru", type: "MACHINE", pinX: 1, pinY: 1 } });
    const [{ sql }] = await prisma.$queryRawUnsafe<{ sql: string }[]>(`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'Equipment'`);
    // Stejný postup jako „RedefineTables“ v migraci Prismy
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = OFF");
    await prisma.$executeRawUnsafe(sql.replace('CREATE TABLE "Equipment"', 'CREATE TABLE "new_Equipment"'));
    await prisma.$executeRawUnsafe(`INSERT INTO "new_Equipment" SELECT * FROM "Equipment"`);
    await prisma.$executeRawUnsafe(`DROP TABLE "Equipment"`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "new_Equipment" RENAME TO "Equipment"`);
    await prisma.$executeRawUnsafe("PRAGMA foreign_keys = ON");
    const left = await prisma.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "sqlite_master" WHERE "type" = 'trigger' AND "tbl_name" = 'Equipment'`);
    expect(left).toEqual([]);
    // Bez triggerů: nové zařízení a smazané zařízení se do žurnálu nedostanou
    await prisma.equipment.create({ data: { id: "e-new", floorId: "f1", tag: "X-2", name: "Vzniklo bez triggeru", type: "MACHINE", pinX: 1, pinY: 1 } });
    await prisma.equipment.delete({ where: { id: "e-gone" } });
    const report = await ensureSyncTriggers(prisma);
    expect(report.repaired).toEqual(["Equipment"]);
    expect(report.created).toHaveLength(4);
    expect(report.backfilled).toBe(1);
    const row = (entityId: string) => prisma.syncChange.findUniqueOrThrow({ where: { entity_entityId: { entity: "Equipment", entityId } } });
    expect(await row("e-new")).toMatchObject({ plantId: "p1", equipmentId: "e-new", deleted: false });
    expect(await row("e-gone")).toMatchObject({ deleted: true });
    // Po opravě zase zapisují triggery
    await prisma.equipment.update({ where: { id: "e-new" }, data: { name: "Upraveno" } });
    const counter = await prisma.syncCounter.findUniqueOrThrow({ where: { id: 1 } });
    expect((await row("e-new")).seq).toBe(counter.value);
  });
});

describe("párování a token zařízení", () => {
  it("kód jen pro účet registrované firmy, jednorázový, s limitem chybných pokusů", async () => {
    await expect(createPairingCode(prisma, { userId: "u-maint" }, NOW)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { code, expiresAt } = await createPairingCode(prisma, { userId: "tech1" }, NOW);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(10 * 60_000);
    await expect(pairDevice(prisma, { code: "AAAA-AAAA", name: "x", platform: "IOS", ipKey: "ip-1" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Opsaný kód bez pomlčky a malými písmeny
    const paired = await pairDevice(prisma, { code: code.replace("-", "").toLowerCase(), name: "iPhone Marek", platform: "IOS", appVersion: "1.0.0", ipKey: "ip-1" }, NOW);
    expect(paired.token).toMatch(/^eldk_[\w-]{43}$/);
    expect(await prisma.syncDevice.findFirstOrThrow({ where: { userId: "tech1" } })).toMatchObject({ name: "iPhone Marek", platform: "IOS", companyId: "c1" });
    expect((await prisma.syncDevice.findFirstOrThrow({ where: { userId: "tech1" } })).tokenHash).not.toContain(paired.token);
    await expect(pairDevice(prisma, { code, name: "znovu", platform: "IOS" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const events = await prisma.securityEvent.groupBy({ by: ["kind"], _count: { _all: true } });
    expect(Object.fromEntries(events.map((row) => [row.kind, row._count._all]))).toMatchObject({ DEVICE_PAIRED: 1, DEVICE_PAIR_FAILED: 2 });

    const old = await createPairingCode(prisma, { userId: "tech1" }, NOW);
    await expect(pairDevice(prisma, { code: old.code, name: "pozdě", platform: "ANDROID" }, later(1))).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Chybné kódy z jedné IP: 1 výše + 9 → desátý pokus už zablokuje i platný kód
    for (let index = 0; index < 9; index++) await expect(pairDevice(prisma, { code: "BBBB-BBBB", name: "x", platform: "IOS", ipKey: "ip-1" }, NOW)).rejects.toThrow();
    const blocked = await createPairingCode(prisma, { userId: "tech1" }, NOW);
    await expect(pairDevice(prisma, { code: blocked.code, name: "x", platform: "IOS", ipKey: "ip-1" }, NOW)).rejects.toBeInstanceOf(SyncError);
  });

  it("token přestane platit po odpojení, vypršení, blokaci, změně hesla a odebrání zaměstnance", async () => {
    const tech = await pair("tech1");
    expect(tech.ctx).toMatchObject({ plantIds: ["p1"], company: { id: "c1" }, user: { accountType: "MAINTENANCE_TECH" } });
    expect(await authenticateDevice(prisma, "eldk_" + "x".repeat(43), NOW)).toBeNull();
    expect(await authenticateDevice(prisma, tech.token, later(89))).not.toBeNull();
    expect(await authenticateDevice(prisma, tech.token, later(89 + 91))).toBeNull();

    await revokeDevice(prisma, { deviceId: tech.device.id, actorId: "tech1", companyId: "c1", admin: false, reason: "test" }, NOW);
    expect(await authenticateDevice(prisma, tech.token, NOW)).toBeNull();
    // Cizí firma zařízení neodpojí
    const insp = await pair("insp1");
    await expect(revokeDevice(prisma, { deviceId: insp.device.id, actorId: "other2", companyId: "c2", admin: true, reason: "x" }, NOW)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await setUserDisabled(prisma, { id: "admin1", companyId: "c1" }, "insp1", true, NOW);
    expect(await authenticateDevice(prisma, insp.token, NOW)).toBeNull();

    const admin = await pair("admin1", "WINDOWS");
    expect(await changePassword(prisma, { userId: "admin1", current: PASSWORD, next: "novy-modry-kocour-2026" }, NOW)).toMatchObject({ devices: 1 });
    expect(await authenticateDevice(prisma, admin.token, NOW)).toBeNull();

    const again = await pair("tech1");
    await removeEmployee(prisma, { companyId: "c1", actorId: "admin1", userId: "tech1", anonymizeName: false, now: NOW });
    expect(await authenticateDevice(prisma, again.token, NOW)).toBeNull();
    expect(await prisma.syncDevice.count({ where: { userId: "tech1" } })).toBe(0);
  });

  it("nejvýš 10 aktivních zařízení na uživatele", async () => {
    for (let index = 0; index < 10; index++) await pair("tech1");
    await expect(createPairingCode(prisma, { userId: "tech1" }, NOW)).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("stahování změn", () => {
  it("první stažení = celý vlastní závod a kolegové bez tajných údajů; cizí firma ani demo ne", async () => {
    const { ctx } = await pair("admin1");
    const session = await deviceSession(prisma, ctx, NOW);
    expect(session).toMatchObject({ api: "eldock-sync", version: 1, plants: [{ id: "p1" }], user: { accountType: "PLANT_ADMIN", visibleTypes: null }, company: { id: "c1" } });
    const { changes, files } = await pullAll(ctx);
    expect(ids(changes, "Plant")).toEqual(["p1"]);
    expect(ids(changes, "Equipment")).toEqual(["e-sw", "e-tool"]);
    expect(ids(changes, "BomItem")).toEqual(["bom1"]);
    expect(ids(changes, "InspectionDefect")).toEqual(["def1"]);
    expect(ids(changes, "User")).toEqual(["admin1", "insp1", "tech1"]);
    expect(changes.every((change) => change.op === "upsert")).toBe(true);
    const user = changes.find((change) => change.entity === "User")!.data!;
    expect(Object.keys(user).sort()).toEqual(["accountType", "companyId", "disabledAt", "homePlantId", "id", "name", "role", "title"]);
    expect(JSON.stringify(changes)).not.toMatch(/e-foreign|"p2"|passwordHash|eq-R-LIS-01/);
    expect(files["/api/files/photos/rm1.jpg"]).toMatchObject({ sha256: "a".repeat(64) });
  });

  it("stránky nerozdělí stejné pořadí a dají totéž co jedna stránka", async () => {
    const { ctx } = await pair("admin1");
    const whole = await pullAll(ctx);
    // Změna kategorie dá celému podstromu stejné pořadí
    await prisma.equipment.update({ where: { id: "e-tool" }, data: { type: "WELDER" } });
    const paged = await pullAll(ctx, { limit: 2 });
    expect(paged.pages).toBeGreaterThan(3);
    const key = (change: SyncChangeEntry) => `${change.entity}:${change.id}`;
    expect(new Set(paged.changes.map(key))).toEqual(new Set(whole.changes.map(key)));
  });

  it("přírůstky od kurzoru: změna, smazání a úprava z webu", async () => {
    const { ctx } = await pair("admin1");
    const first = await pullAll(ctx);
    await prisma.equipment.update({ where: { id: "e-sw" }, data: { description: "Po revizi" } });
    await prisma.inspectionDefect.delete({ where: { id: "def1" } });
    await prisma.equipment.update({ where: { id: "e-foreign" }, data: { description: "Cizí změna" } });
    const next = await pullAll(ctx, { cursor: first.cursor, scope: first.scope });
    expect(next.changes.map((change) => `${change.op} ${change.entity}:${change.id}`)).toEqual(["upsert Equipment:e-sw", "delete InspectionDefect:def1"]);
    expect(next.changes[0].data).toMatchObject({ description: "Po revizi" });
    expect(await prisma.syncDevice.findUniqueOrThrow({ where: { id: ctx.device.id } })).toMatchObject({ lastCursor: next.cursor, lastPullAt: NOW });
    // Nic nového → prázdná stránka a stejný kurzor
    const idle = await pullChanges(prisma, ctx, { cursor: next.cursor, scope: next.scope }, NOW);
    expect(idle).toMatchObject({ changes: [], hasMore: false, cursor: next.cursor });
  });

  it("výřez účtu: směnový údržbář nevidí nářadí; změna kategorie zařízení ho přidá i odebere", async () => {
    const { ctx } = await pair("tech1");
    const first = await pullAll(ctx);
    expect(ids(first.changes, "Equipment")).toEqual(["e-sw"]);
    expect(ids(first.changes, "InspectionDefect")).toEqual([]);
    await prisma.equipment.update({ where: { id: "e-tool" }, data: { type: "MACHINE" } });
    const shown = await pullAll(ctx, { cursor: first.cursor, scope: first.scope });
    expect(ids(shown.changes, "Equipment")).toEqual(["e-tool"]);
    expect(ids(shown.changes, "InspectionDefect")).toEqual(["def1"]);
    await prisma.equipment.update({ where: { id: "e-tool" }, data: { type: "APPLIANCE" } });
    const hidden = await pullAll(ctx, { cursor: shown.cursor, scope: shown.scope });
    expect(ids(hidden.changes, "Equipment", "delete")).toEqual(["e-tool"]);
    expect(ids(hidden.changes, "InspectionDefect", "delete")).toEqual(["def1"]);
    expect(ids(hidden.changes, "Equipment")).toEqual([]);
  });

  it("nevidí nepotvrzené zápisy cizí transakce – vrácená změna nepřeskočí další (jedno spojení SQLite)", async () => {
    const { ctx } = await pair("admin1");
    const first = await pullAll(ctx);
    const open = prisma
      .$transaction(async (tx) => {
        await tx.equipment.update({ where: { id: "e-sw" }, data: { description: "nepotvrzeno" } });
        await new Promise((resolve) => setTimeout(resolve, 200));
        throw new Error("vráceno");
      })
      .catch(() => "vráceno");
    await new Promise((resolve) => setTimeout(resolve, 50));
    const during = await pullChanges(prisma, ctx, { cursor: first.cursor, scope: first.scope }, NOW);
    expect(await open).toBe("vráceno");
    expect(during.changes).toEqual([]);
    expect(during.cursor).toBe(first.cursor);
    // Čítač po vrácení použije stejné pořadí znovu – zařízení ho dostane
    await prisma.equipment.update({ where: { id: "e-sw" }, data: { description: "potvrzeno" } });
    const after = await pullAll(ctx, { cursor: during.cursor, scope: during.scope });
    expect(after.changes.map((change) => change.data?.description)).toEqual(["potvrzeno"]);
  });

  it("reset: jiný výřez, nová epocha, kurzor z jiné databáze a smazané značky", async () => {
    const { ctx, token } = await pair("tech1");
    const first = await pullAll(ctx);
    expect(await pullChanges(prisma, ctx, { cursor: first.cursor, scope: "jiny-vyrez" }, NOW)).toMatchObject({ reset: true, cursor: 0 });
    expect(await pullChanges(prisma, ctx, { cursor: first.cursor + 1000, scope: first.scope }, NOW)).toMatchObject({ reset: true });
    // Správce změní typ účtu → jiný výřez → stáhnout znovu
    await prisma.user.update({ where: { id: "tech1" }, data: { accountType: "PLANT_ADMIN" } });
    const widened = (await authenticateDevice(prisma, token, NOW))!;
    expect(await pullChanges(prisma, widened, { cursor: first.cursor, scope: first.scope }, NOW)).toMatchObject({ reset: true });
    const fresh = await pullAll(widened);
    expect(ids(fresh.changes, "Equipment")).toEqual(["e-sw", "e-tool"]);
    await rotateSyncEpoch(prisma);
    expect(await pullChanges(prisma, widened, { cursor: fresh.cursor, scope: fresh.scope }, NOW)).toMatchObject({ reset: true });
    // Značky smazání starší 90 dní zmizí – starší kurzor musí stáhnout vše znovu
    const current = await pullAll(widened);
    await prisma.inspectionDefect.delete({ where: { id: "def1" } });
    await prisma.syncChange.updateMany({ where: { deleted: true }, data: { changedAt: later(-100) } });
    expect(await pruneSync(prisma, new Date())).toMatchObject({ syncTombstones: 1 });
    expect(await pullChanges(prisma, widened, { cursor: current.cursor, scope: current.scope }, NOW)).toMatchObject({ reset: true });
  });
});

describe("fronta úprav z aplikace", () => {

  it("zadání změny s id z aplikace proběhne přesně jednou; druhé zadání se připojí k otevřené změně", async () => {
    const { ctx } = await pair("tech1");
    const payload = { id: "cr-aplikace-0001", equipmentId: "e-sw", note: "Vyměněn stykač -K4", attachments: [{ url: "/api/files/photos/fotka-c1.jpg", type: "PHOTO" }] };
    const first = await pushMutations(prisma, ctx, submit("mut-0000-0001", payload, { performedAt: "2026-11-07T06:30:00Z" }), NOW);
    expect(first.results[0]).toMatchObject({ status: "applied", entity: "ChangeRequest", entityId: "cr-aplikace-0001", result: { merged: false } });
    const created = await prisma.changeRequest.findUniqueOrThrow({ where: { id: "cr-aplikace-0001" }, include: { attachments: true } });
    expect(created).toMatchObject({ reporterId: "tech1", submittedAt: new Date("2026-11-07T06:30:00Z") });
    expect(created.number).toMatch(/^ZM-2026-\d{4}$/);
    expect(created.attachments).toHaveLength(1);

    const retry = await pushMutations(prisma, ctx, submit("mut-0000-0001", payload), NOW);
    expect(retry.results[0]).toMatchObject({ status: "applied", duplicate: true, entityId: "cr-aplikace-0001" });
    expect(await prisma.changeRequest.count({ where: { equipmentId: "e-sw" } })).toBe(1);

    const merged = await pushMutations(prisma, ctx, submit("mut-0000-0002", { id: "cr-aplikace-0002", equipmentId: "e-sw", note: "Doplněna svorka", markupImageUrl: "/api/files/photos/fotka-c1.jpg" }), NOW);
    expect(merged.results[0]).toMatchObject({ status: "applied", entityId: "cr-aplikace-0001", result: { merged: true, number: created.number } });
    expect(await prisma.changeRequest.count({ where: { equipmentId: "e-sw" } })).toBe(1);
    const comment = await prisma.changeRequestEvent.findFirstOrThrow({ where: { changeRequestId: "cr-aplikace-0001", type: "COMMENT" } });
    expect(comment.comment).toContain("Doplněna svorka");
    expect(await prisma.attachment.count({ where: { changeRequestId: "cr-aplikace-0001", type: "MARKUP_IMAGE" } })).toBe(1);

    // Změna z aplikace je v žurnálu pro ostatní zařízení
    const admin = await pair("admin1");
    expect(ids((await pullAll(admin.ctx)).changes, "ChangeRequest")).toEqual(["cr-aplikace-0001"]);
  });

  it("odmítne bez oprávnění, cizí zařízení, cizí soubor, neznámý druh a kolizi id – bez částečného zápisu", async () => {
    const { ctx: tech } = await pair("tech1");
    const { ctx: insp } = await pair("insp1");
    const forbidden = await pushMutations(prisma, insp, submit("mut-0000-0101", { equipmentId: "e-sw", note: "x" }), NOW);
    expect(forbidden.results[0]).toMatchObject({ status: "rejected", code: "FORBIDDEN" });
    expect((await pushMutations(prisma, insp, submit("mut-0000-0101", { equipmentId: "e-sw", note: "x" }), NOW)).results[0]).toMatchObject({ status: "rejected", duplicate: true });

    const results = (
      await pushMutations(
        prisma,
        tech,
        {
          mutations: [
            { id: "mut-0000-0102", type: "changeRequest.submit", payload: { equipmentId: "e-foreign", note: "cizí" } },
            { id: "mut-0000-0103", type: "changeRequest.submit", payload: { equipmentId: "e-tool", note: "mimo výřez" } },
            { id: "mut-0000-0104", type: "changeRequest.submit", payload: { equipmentId: "e-sw", note: "cizí fotka", attachments: [{ url: "/api/files/photos/cizi.jpg" }] } },
            { id: "mut-0000-0105", type: "equipment.delete", payload: { equipmentId: "e-sw" } },
            { id: "mut-0000-0106", type: "changeRequest.submit", payload: { equipmentId: "e-sw" } },
          ],
        },
        NOW,
      )
    ).results;
    expect(results.map((result) => `${result.status}:${result.code}`)).toEqual(["rejected:NOT_FOUND", "rejected:NOT_FOUND", "rejected:FORBIDDEN", "rejected:UNKNOWN_TYPE", "rejected:VALIDATION"]);

    // Kolize id nového záznamu: transakce se vrátí celá (žádná událost ani příloha navíc)
    await submitChangeRequest(prisma, { id: "admin1", role: "MAINTENANCE" }, { equipmentId: "e-tool", note: "z webu" });
    const existing = await prisma.changeRequest.findFirstOrThrow({ where: { equipmentId: "e-tool" } });
    const events = await prisma.changeRequestEvent.count();
    const { ctx: admin } = await pair("admin1");
    const collision = await pushMutations(prisma, admin, submit("mut-0000-0107", { id: existing.id, equipmentId: "e-sw", note: "kolize", attachments: [{ url: "/api/files/photos/fotka-c1.jpg" }] }), NOW);
    expect(collision.results[0]).toMatchObject({ status: "rejected", code: "DUPLICATE_ID" });
    expect(await prisma.changeRequestEvent.count()).toBe(events);
    expect(await prisma.changeRequest.count({ where: { equipmentId: "e-sw" } })).toBe(0);

    await expect(pushMutations(prisma, tech, { mutations: [{ id: "mut-0000-0108", type: "x", payload: {} }, { id: "mut-0000-0108", type: "x", payload: {} }] }, NOW)).rejects.toBeInstanceOf(SyncError);
    await expect(pushMutations(prisma, tech, { nic: true }, NOW)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("provizorium založené a ukončené offline v jedné frontě, čas provedení z aplikace", async () => {
    const { ctx } = await pair("tech1");
    const result = await pushMutations(
      prisma,
      ctx,
      {
        mutations: [
          { id: "mut-0000-0201", type: "temporaryMod.create", performedAt: "2026-11-06T08:00:00Z", payload: { id: "prov-aplikace-01", equipmentId: "e-sw", title: "Přemostění -K4", description: "Dočasně přemostěno do dodání stykače.", days: 7 } },
          { id: "mut-0000-0202", type: "temporaryMod.restore", performedAt: "2026-11-07T15:00:00Z", payload: { temporaryModId: "prov-aplikace-01", note: "Stykač vyměněn." } },
          { id: "mut-0000-0203", type: "temporaryMod.restore", payload: { temporaryModId: "prov-aplikace-01" } },
        ],
      },
      NOW,
    );
    expect(result.results.map((item) => item.status)).toEqual(["applied", "applied", "rejected"]);
    expect(result.results[2]).toMatchObject({ code: "INVALID_STATE" });
    const mod = await prisma.temporaryModification.findUniqueOrThrow({ where: { id: "prov-aplikace-01" } });
    expect(mod).toMatchObject({ status: "RESTORED_1_TO_1", createdAt: new Date("2026-11-06T08:00:00Z"), expiresAt: new Date("2026-11-13T08:00:00Z"), resolvedAt: new Date("2026-11-07T15:00:00Z"), createdByName: "Marek Údržbář" });
    // Čas z budoucnosti nebo starší 30 dní se nepřevezme
    const late = await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0204", type: "temporaryMod.create", performedAt: "2026-01-01T00:00:00Z", payload: { equipmentId: "e-sw", title: "Staré", description: "Čas mimo okno.", days: 14 } }] }, NOW);
    const lateMod = await prisma.temporaryModification.findUniqueOrThrow({ where: { id: late.results[0].entityId } });
    expect(lateMod.createdAt).toEqual(NOW);
  });

  it("odstranění závady se souběhem a výměna součástky", async () => {
    const { ctx } = await pair("admin1");
    const defect = await prisma.inspectionDefect.findUniqueOrThrow({ where: { id: "def1" } });
    const stale = await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0301", type: "defect.resolve", baseUpdatedAt: new Date(defect.updatedAt.getTime() - 1000).toISOString(), payload: { defectId: "def1", note: "Vyměněn přívod." } }] }, NOW);
    expect(stale.results[0]).toMatchObject({ status: "rejected", code: "CONFLICT" });
    const ok = await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0302", type: "defect.resolve", baseUpdatedAt: defect.updatedAt.toISOString(), payload: { defectId: "def1", note: "Vyměněn přívod.", photoUrl: "/api/files/photos/fotka-c1.jpg" } }] }, NOW);
    expect(ok.results[0]).toMatchObject({ status: "applied", entity: "InspectionDefect" });
    expect(await prisma.inspectionDefect.findUniqueOrThrow({ where: { id: "def1" } })).toMatchObject({ status: "RESOLVED", resolvedBy: "Olga Ředitelová", resolutionPhotoUrl: "/api/files/photos/fotka-c1.jpg" });
    expect((await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0303", type: "defect.resolve", payload: { defectId: "def1", note: "Znovu." } }] }, NOW)).results[0]).toMatchObject({ status: "rejected", code: "INVALID_STATE" });

    const replaced = await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0304", type: "component.replace", payload: { componentId: "comp1", equipmentId: "e-sw" } }] }, NOW);
    expect(replaced.results[0]).toMatchObject({ status: "applied", result: { replacementStockCount: 1 } });
    const photo = await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0305", type: "equipment.photo", payload: { equipmentId: "e-sw", photoUrl: "/api/files/photos/fotka-c1.jpg" } }] }, NOW);
    expect(photo.results[0]).toMatchObject({ status: "applied" });
    expect(await prisma.syncMutation.count({ where: { userId: "admin1" } })).toBe(5);
    expect(await prisma.syncDevice.findUniqueOrThrow({ where: { id: ctx.device.id } })).toMatchObject({ lastPushAt: NOW });
  });

  it("vnořená transakce služby běží uvnitř vnější (úprava a evidence najednou)", async () => {
    const result = await prisma.$transaction(async (tx) => {
      const flat = flatTransaction(tx);
      return flat.$transaction(async (inner) => inner.equipment.count());
    });
    expect(result).toBe(5);
  });
});

describe("soubory, retence a GDPR", () => {
  it("soubor se stejným obsahem jen jednou na firmu", async () => {
    expect(await findCompanyFileBySha(prisma, { companyId: "c1", sha256: "b".repeat(64), kind: "photos" })).toMatchObject({ url: "/api/files/photos/fotka-c1.jpg" });
    expect(await findCompanyFileBySha(prisma, { companyId: "c1", sha256: "c".repeat(64), kind: "photos" })).toBeNull();
  });

  it("retence: evidence úprav, odpojená a vypršelá zařízení, kódy párování", async () => {
    const { ctx } = await pair("tech1");
    const idle = await pair("insp1");
    await pushMutations(prisma, ctx, { mutations: [{ id: "mut-0000-0401", type: "x.y", payload: {} }] }, NOW);
    await revokeDevice(prisma, { deviceId: ctx.device.id, actorId: "tech1", companyId: "c1", admin: false, reason: "test" }, NOW);
    expect(await pruneSync(prisma, later(10))).toMatchObject({ syncMutations: 0, syncDevices: 0, syncPairings: 2 });
    expect(await pruneSync(prisma, later(31))).toMatchObject({ syncDevices: 1 });
    expect(await prisma.syncDevice.findUnique({ where: { id: idle.device.id } })).not.toBeNull();
    expect(await pruneSync(prisma, later(121))).toMatchObject({ syncMutations: 1, syncDevices: 1 });
  });

  it("značka smazání zapsaná triggerem (čas SQLite) se uklidí až po 90 dnech", async () => {
    await prisma.inspectionDefect.delete({ where: { id: "def1" } });
    const tombstone = await prisma.syncChange.findUniqueOrThrow({ where: { entity_entityId: { entity: "InspectionDefect", entityId: "def1" } } });
    expect(tombstone.deleted).toBe(true);
    expect(Math.abs(tombstone.changedAt.getTime() - Date.now())).toBeLessThan(60_000);
    expect(await pruneSync(prisma, new Date(Date.now() + 89 * DAY))).toMatchObject({ syncTombstones: 0 });
    expect(await pruneSync(prisma, new Date(Date.now() + 91 * DAY))).toMatchObject({ syncTombstones: 1 });
    expect((await prisma.syncCounter.findUniqueOrThrow({ where: { id: 1 } })).prunedSeq).toBe(tombstone.seq);
  });

  it("export firmy a vlastních údajů obsahuje zařízení bez tokenu; zrušení firmy je smaže", async () => {
    const { ctx } = await pair("tech1");
    await pushMutations(prisma, ctx, submit("mut-0000-0501", { equipmentId: "e-sw", note: "Pro export" }), NOW);
    const data = await companyExportData(prisma, "c1");
    expect(data.sections["zarizeni-aplikaci"]).toHaveLength(1);
    expect(JSON.stringify(data.sections["zarizeni-aplikaci"])).not.toContain("tokenHash");
    expect(data.sections["upravy-z-aplikaci"]).toEqual([expect.objectContaining({ clientId: "mut-0000-0501", type: "changeRequest.submit", status: "APPLIED" })]);
    expect((await personalExportData(prisma, "tech1", NOW)).devices).toEqual([expect.objectContaining({ name: "Telefon tech1", platform: "ANDROID" })]);
    await executeCompanyClosure(prisma, { companyId: "c1", storageRoot: "neexistuje", now: NOW });
    expect(await prisma.syncDevice.count()).toBe(0);
    expect(await prisma.syncMutation.count()).toBe(0);
    expect(await prisma.syncChange.count({ where: { plantId: "p1", deleted: false } })).toBe(0);
  });
});
