// Fáze 71: jádro synchronizace aplikací proti skutečným trasám API (`src/app/api/sync/v1/*`, `/api/files`)
// nad testovací SQLite – podvržený `fetch` volá Route Handlery přímo, „offline“ = `fetch` selže jako bez sítě.

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

const state = vi.hoisted(() => ({ prisma: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));
vi.mock("@/lib/prisma", () => ({
  get prisma() {
    return state.prisma;
  },
  prismaReady: Promise.resolve(),
}));
// Bez tokenu se /api/files ptá na cookie relaci – v testu nikdo přihlášený není
vi.mock("@/server/file-access", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/file-access")>()), fileViewer: async () => ({ demo: false, companyIds: [], superadmin: false }) }));

const { cloudFetcher } = await import("@/server/services/test-cloud");
const { createTestDb } = await import("@/server/services/test-db");
const { createPairingCode } = await import("@/server/services/sync");
const { registerFile } = await import("@/server/services/file-registry");
const { UPLOAD_ROOT } = await import("@/server/storage");
const { SYNC_ENTITIES } = await import("@/server/sync/journal");
const { MemoryStore, MemoryTokenStore, SyncEngine, ENTITY_NAMES, parseScan, labelState, sha256Hex } = await import("./index");

const SERVER = "https://cloud.test";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const PHOTO_TEXT = "fotka-rm1-z-registru";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
const written: string[] = [];

/** `fetch` aplikace → Route Handlery cloudu (offline = výjimka jako bez sítě). */
const control = { online: true, calls: [] as string[] };
let cloudFetch: Awaited<ReturnType<typeof cloudFetcher>> | null = null;
async function fetcher(input: string, init?: RequestInit): Promise<Response> {
  cloudFetch ??= await cloudFetcher(control);
  return cloudFetch(input, init);
}

function engineFor(store = new MemoryStore(), tokens = new MemoryTokenStore()) {
  const engine = new SyncEngine({ store, tokens, platform: "WINDOWS", appVersion: "1.0.0-test", fetcher });
  return { engine, store, tokens };
}

async function pairedEngine(userId: string, base = engineFor()) {
  const { code } = await createPairingCode(prisma, { userId });
  await base.engine.pair({ server: "cloud.test", code, name: "Tablet hala A" });
  return base;
}

const records = (store: InstanceType<typeof MemoryStore>, entity: (typeof ENTITY_NAMES)[number]) => store.list(entity).map((record) => record.id as string).sort();

async function seed() {
  await prisma.plant.createMany({ data: [{ id: "p1", code: "LIS", name: "Lisovna", customerName: "Firma c1" }, { id: "p2", code: "CIZ", name: "Cizí závod", customerName: "Firma c2" }] });
  const companyData = (id: string, ico: string, plantId: string) => ({ id, ico, companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Kolín", zip: "280 02", contactName: `Kontakt ${id}`, email: `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: new Date(), productScope: "PLANT_MANAGEMENT" as const, plantId });
  await prisma.registeredCompany.create({ data: companyData("c1", "12345679", "p1") });
  await prisma.registeredCompany.create({ data: companyData("c2", "87654321", "p2") });
  await prisma.user.createMany({
    data: [
      { id: "admin1", name: "Olga Ředitelová", email: "olga@c1.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "c1", homePlantId: "p1", passwordHash: "x" },
      { id: "tech1", name: "Marek Údržbář", email: "marek@c1.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "c1", homePlantId: "p1", passwordHash: "x" },
    ],
  });
  await prisma.building.createMany({
    data: [
      { id: "b1", plantId: "p1", code: "A", name: "Hala A", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 },
      { id: "b2", plantId: "p2", code: "A", name: "Cizí hala", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 },
    ],
  });
  await prisma.floor.createMany({ data: [{ id: "f1", buildingId: "b1", level: 0, code: "1NP", name: "1. NP" }, { id: "f2", buildingId: "b2", level: 0, code: "1NP", name: "1. NP" }] });

  // Fotka rozváděče skutečně v úložišti (stažení s ověřením otisku)
  const photoName = `test-sync-${Date.now()}.jpg`;
  const photoPath = path.join(UPLOAD_ROOT, "photos", photoName);
  mkdirSync(path.dirname(photoPath), { recursive: true });
  writeFileSync(photoPath, PHOTO_TEXT);
  written.push(photoPath);
  const photoUrl = `/api/files/photos/${photoName}`;
  await registerFile(prisma, { url: photoUrl, kind: "photos", owner: { kind: "COMPANY", companyId: "c1" }, sizeBytes: PHOTO_TEXT.length, sha256: await sha256Hex(new TextEncoder().encode(PHOTO_TEXT)), mimeType: "image/jpeg" });

  await prisma.equipment.create({
    data: {
      id: "e-sw",
      floorId: "f1",
      tag: "RM1",
      name: "RM1 - Hlavní rozváděč",
      type: "SWITCHBOARD",
      pinX: 10,
      pinY: 10,
      qrToken: "A3F09C11B2",
      photoUrl,
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
      inspections: { create: { id: "ins1", type: "PERIODIC", inspectionDate: new Date("2026-06-01"), validUntil: new Date("2027-06-01"), reportNumber: "R-1", inspectorName: "Iva Revizní", inspectorLicense: "E2A-123", result: "CAPABLE_WITH_DEFECTS", reportUrl: "/api/files/documents/r1.pdf" } },
    },
  });
  await prisma.inspectionDefect.create({ data: { id: "def1", inspectionId: "ins1", equipmentId: "e-tool", description: "Poškozený přívod", deadline: new Date("2026-12-01") } });
  await prisma.equipment.create({ data: { id: "e-foreign", floorId: "f2", tag: "RM9", name: "Cizí rozváděč", type: "SWITCHBOARD", pinX: 1, pinY: 1 } });
}

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  state.prisma = prisma;
  control.online = true;
  control.calls = [];
  await seed();
});

afterEach(async () => {
  // Soubory, které test zapsal do storage/uploads (seed + nahrání z aplikace) – jen ty z testovací databáze
  const uploaded = await prisma.storedFile.findMany({ select: { url: true } });
  for (const { url } of uploaded) {
    const file = path.join(UPLOAD_ROOT, ...url.slice("/api/files/".length).split("/"));
    if (written.includes(file) || url.startsWith("/api/files/photos/")) {
      if (existsSync(file) && (written.includes(file) || control.calls.some((call) => call.startsWith("POST /api/sync/v1/files")))) rmSync(file, { force: true });
    }
  }
  written.length = 0;
  await db.cleanup();
});

describe("jádro synchronizace proti trasám API", () => {
  it("ověří server, spáruje zařízení a stáhne data vlastní firmy", async () => {
    const { engine, store, tokens } = await pairedEngine("admin1");
    expect(await tokens.get()).toMatch(/^eldk_/);
    expect(await store.getMeta("serverUrl")).toBe(SERVER);
    const report = await engine.sync();
    expect(report).toMatchObject({ ok: true, reset: false, unpaired: false, offline: false, error: null });
    expect(records(store, "Plant")).toEqual(["p1"]);
    expect(records(store, "Equipment")).toEqual(["e-sw", "e-tool"]);
    expect(records(store, "InspectionDefect")).toEqual(["def1"]);
    expect(records(store, "BomItem")).toEqual(["bom1"]);
    expect(records(store, "User")).toEqual(["admin1", "tech1"]);
    const status = await engine.status();
    expect(status).toMatchObject({ paired: true, server: SERVER, pending: 0, rejected: 0, stale: false, offline: false });
    expect(status.user?.id).toBe("admin1");
    // Druhá synchronizace nic nového nestáhne
    expect(await engine.sync()).toMatchObject({ ok: true, pulled: 0 });
  });

  it("QR štítek najde zařízení offline a pozná přegenerovaný štítek", async () => {
    const { engine, store } = await pairedEngine("admin1");
    await engine.sync();
    control.online = false;
    const scan = parseScan("https://eldock.cz/equipment/e-sw?qr=A3F09C11B2");
    expect(scan).toEqual({ kind: "equipment", equipmentId: "e-sw", qrToken: "A3F09C11B2" });
    if (scan.kind !== "equipment") throw new Error("štítek");
    const record = await store.getRecord("Equipment", scan.equipmentId);
    expect(record?.data.tag).toBe("RM1");
    expect(labelState(scan.qrToken, record?.data.qrToken as string)).toBe("valid");
    expect(labelState("FFFFFFFFFF", record?.data.qrToken as string)).toBe("replaced");
    expect(parseScan(`eldock://pair?server=${encodeURIComponent("https://eldock.cz/")}&code=k7qx-3mzp`)).toEqual({ kind: "pairing", server: "https://eldock.cz", code: "K7QX3MZP" });
    expect(parseScan("  RM1 ")).toEqual({ kind: "text", text: "RM1" });
  });

  it("úprava zadaná offline s fotkou odejde po připojení a vrátí se jako záznam", async () => {
    const { engine, store } = await pairedEngine("admin1");
    await engine.sync();
    control.online = false;
    const ref = await engine.addLocalFile(new Blob([JPEG], { type: "image/jpeg" }), { name: "foto.jpg" });
    expect(ref).toMatch(/^local:[a-f0-9]{64}$/);
    const item = await engine.queue(
      "changeRequest.submit",
      { id: "cr-app-0001-hala", equipmentId: "e-tool", note: "Uvolněná svorka na přívodu", attachments: [{ url: ref, type: "PHOTO", fileName: "foto.jpg", mimeType: "image/jpeg", sizeBytes: JPEG.byteLength }] },
      { label: "Zadání změny – VR-01", equipmentId: "e-tool" },
    );
    const offline = await engine.sync();
    expect(offline).toMatchObject({ ok: false, offline: true });
    expect((await engine.status()).pending).toBe(1);

    control.online = true;
    const report = await engine.sync();
    expect(report).toMatchObject({ ok: true, applied: 1, rejected: 0 });
    const sent = (await store.listOutbox()).find((entry) => entry.id === item.id);
    expect(sent).toMatchObject({ status: "applied", entity: "ChangeRequest", entityId: "cr-app-0001-hala" });
    expect(String(sent?.result?.number)).toMatch(/^ZM-\d{4}-\d{4}$/);
    const serverAttachment = await prisma.attachment.findFirstOrThrow({ where: { changeRequestId: "cr-app-0001-hala" } });
    expect(serverAttachment.url).toMatch(/^\/api\/files\/photos\//);
    expect(JSON.stringify(sent?.payload)).toContain(serverAttachment.url);
    // Změna i příloha přišly zpět ve stažených datech, fotka je v mezipaměti pod adresou ze serveru
    expect(records(store, "ChangeRequest")).toEqual(["cr-app-0001-hala"]);
    expect(records(store, "Attachment")).toEqual([serverAttachment.id]);
    expect((await store.getFile(serverAttachment.url))?.sha256).toBe(await sha256Hex(JPEG));
    // Místní kopie se po odeslání uklidí – zůstane jen pod adresou ze serveru
    expect(await store.getFile(ref)).toBeUndefined();
    // Opakované odeslání stejné úpravy (výpadek po odeslání) server pozná – nová změna nevznikne
    expect(await prisma.changeRequest.count({ where: { equipmentId: "e-tool" } })).toBe(1);
  });

  it("odmítnutá úprava zůstane s důvodem a podruhé se neposílá", async () => {
    const { engine, store } = await pairedEngine("admin1");
    await engine.sync();
    const item = await engine.queue("defect.resolve", { defectId: "neexistuje", note: "Opraveno" });
    expect(await engine.sync()).toMatchObject({ ok: true, rejected: 1, applied: 0 });
    const rejected = (await store.listOutbox()).find((entry) => entry.id === item.id);
    expect(rejected).toMatchObject({ status: "rejected", code: "NOT_FOUND" });
    expect(rejected?.message).toBeTruthy();
    control.calls = [];
    await engine.sync();
    expect(control.calls).not.toContain("POST /api/sync/v1/mutations");
    expect((await engine.status()).rejected).toBe(1);
    await engine.dismiss(item.id);
    expect((await engine.status()).rejected).toBe(0);
  });

  it("úprava mimo oprávnění účtu nebo s neplatnými daty se do fronty nezapíše", async () => {
    const { engine } = await pairedEngine("admin1");
    await engine.sync();
    await expect(engine.queue("temporaryMod.create", { equipmentId: "e-sw", title: "", description: "x", days: 7 })).rejects.toThrow(/Neplatná data úpravy \(title\)/);
    await expect(engine.queue("changeRequest.submit", { equipmentId: "e-sw", attachments: [{ url: `local:${"0".repeat(64)}` }] })).rejects.toThrow(/Fotka k úpravě se v zařízení nenašla/);
    expect((await engine.status()).pending).toBe(0);
  });

  it("změna výřezu účtu: reset, nové stažení a fronta zůstane", async () => {
    const { engine, store } = await pairedEngine("tech1");
    await engine.sync();
    const before = records(store, "Equipment");
    expect(before).not.toContain("e-tool");
    // Cizí úprava ve frontě (jiný uživatel) reset přežije
    await store.addOutbox({ id: "foreign-0001", type: "defect.resolve", payload: { defectId: "def1", note: "x" }, performedAt: new Date().toISOString(), baseUpdatedAt: null, userId: "nekdo-jiny", createdAt: new Date().toISOString(), status: "pending", attempts: 0, label: "Cizí", equipmentId: null });
    await prisma.user.update({ where: { id: "tech1" }, data: { accountType: "PLANT_ADMIN" } });
    const report = await engine.sync();
    expect(report).toMatchObject({ ok: true, reset: true, foreign: 1 });
    expect(records(store, "Equipment")).toEqual(["e-sw", "e-tool"]);
    expect((await store.listOutbox()).map((entry) => entry.id)).toEqual(["foreign-0001"]);
  });

  it("odpojené zařízení: 401 zruší token, fronta zůstane do nového spárování", async () => {
    const { engine, store, tokens } = await pairedEngine("admin1");
    await engine.sync();
    await engine.queue("changeRequest.comment", { changeRequestId: "neznama", comment: "Doplňuji" });
    await prisma.syncDevice.updateMany({ data: { revokedAt: new Date(), revokedReason: "test" } });
    const report = await engine.sync();
    expect(report).toMatchObject({ ok: false, unpaired: true });
    expect(await tokens.get()).toBeNull();
    const status = await engine.status();
    expect(status).toMatchObject({ paired: false, pending: 1 });
    expect(status.unpairedReason).toMatch(/spárujte ho znovu/);
    expect(await store.countRecords()).toBeGreaterThan(0);
  });

  it("fronta jiného uživatele se po spárování jiným účtem neodešle", async () => {
    const base = await pairedEngine("admin1");
    await base.engine.sync();
    control.online = false;
    await base.engine.queue("equipment.photo", { equipmentId: "e-sw", photoUrl: null }, { equipmentId: "e-sw" });
    control.online = true;
    // Tablet převezme kolega – spáruje ho svým účtem (data se stáhnou znovu, fronta zůstane Olze)
    await pairedEngine("tech1", base);
    control.calls = [];
    const report = await base.engine.sync();
    expect(report).toMatchObject({ ok: true, foreign: 1, applied: 0 });
    expect(control.calls).not.toContain("POST /api/sync/v1/mutations");
    expect((await base.engine.status()).foreign).toBe(1);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "e-sw" } })).photoUrl).not.toBeNull();
  });

  it("soubory pro offline se stáhnou s ověřením otisku a podruhé se nestahují", async () => {
    const { engine, store } = await pairedEngine("admin1");
    const report = await engine.sync();
    const photoUrl = (await store.getRecord("Equipment", "e-sw"))?.data.photoUrl as string;
    expect(report.downloaded).toBeGreaterThanOrEqual(1);
    const cached = await store.getFile(photoUrl);
    expect(cached?.sha256).toBe(await sha256Hex(new TextEncoder().encode(PHOTO_TEXT)));
    expect(await cached?.data.text()).toBe(PHOTO_TEXT);
    // Soubory v registru bez obsahu na disku (404) synchronizaci nezastaví
    expect(report.ok).toBe(true);
    control.calls = [];
    await engine.sync();
    expect(control.calls.filter((call) => call === `GET ${photoUrl}`)).toEqual([]);
    // Offline se fotka zobrazí z mezipaměti
    control.online = false;
    expect(await (await engine.fileBlob(photoUrl))?.text()).toBe(PHOTO_TEXT);
  });

  it("odpojení v aplikaci zruší token na serveru i místní data", async () => {
    const { engine, store, tokens } = await pairedEngine("admin1");
    await engine.sync();
    await engine.disconnect();
    expect(await tokens.get()).toBeNull();
    expect(await store.countRecords()).toBe(0);
    expect(await prisma.syncDevice.count({ where: { revokedAt: null } })).toBe(0);
  });

  it("chybný kód párování a adresa bez Eldocku skončí srozumitelnou chybou", async () => {
    const { engine } = engineFor();
    await expect(engine.pair({ server: "cloud.test", code: "K7QX-3MZP", name: "Tablet" })).rejects.toMatchObject({ status: 404 });
    await expect(engine.pair({ server: "cloud.test", code: "123", name: "Tablet" })).rejects.toThrow(/8 znaků/);
    control.online = false;
    await expect(engine.pair({ server: "cloud.test", code: "K7QX-3MZP", name: "Tablet" })).rejects.toMatchObject({ network: true });
  });
});

describe("CORS pro rozhraní aplikací", () => {
  it("předběžný dotaz povolí token a odpovědi API nesou Access-Control-Allow-Origin", async () => {
    const preflight = await fetcher(`${SERVER}/api/sync/v1/changes`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(preflight.headers.get("access-control-allow-headers")).toMatch(/Authorization/);
    expect(preflight.headers.get("access-control-allow-methods")).toMatch(/GET/);
    const info = await fetcher(`${SERVER}/api/sync/v1`);
    expect(info.headers.get("access-control-allow-origin")).toBe("*");
    const unauthorized = await fetcher(`${SERVER}/api/sync/v1/session`);
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("soubor s tokenem zařízení dostane CORS, bez tokenu ne", async () => {
    const { tokens } = await pairedEngine("admin1");
    const photoUrl = (await prisma.equipment.findUniqueOrThrow({ where: { id: "e-sw" } })).photoUrl as string;
    const withToken = await fetcher(`${SERVER}${photoUrl}`, { headers: { Authorization: `Bearer ${await tokens.get()}` } });
    expect(withToken.status).toBe(200);
    expect(withToken.headers.get("access-control-allow-origin")).toBe("*");
    expect(withToken.headers.get("access-control-expose-headers")).toMatch(/X-Content-SHA256/);
    expect(withToken.headers.get("x-content-sha256")).toMatch(/^[a-f0-9]{64}$/);
    const withoutToken = await fetcher(`${SERVER}${photoUrl}`);
    expect(withoutToken.status).toBe(401);
    expect(withoutToken.headers.get("access-control-allow-origin")).toBeNull();
    const preflight = await fetcher(`${SERVER}${photoUrl}`, { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
  });

  it("seznam entit aplikace odpovídá serveru", () => {
    expect([...ENTITY_NAMES].sort()).toEqual([...SYNC_ENTITIES].sort());
  });
});
