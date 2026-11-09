// Fáze 72: celý řetězec cloud ↔ server závodu ↔ zařízení v hale v jednom procesu – cloud = skutečné trasy API nad
// testovací SQLite, server závodu = `PlantServer` s vlastní databází `node:sqlite`, zařízení = jádro synchronizace.

import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import os from "node:os";
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
vi.mock("@/server/file-access", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/file-access")>()), fileViewer: async () => ({ demo: false, companyIds: [], superadmin: false }) }));

const { createTestDb } = await import("@/server/services/test-db");
const { cloudFetcher } = await import("@/server/services/test-cloud");
const { createPairingCode, pairDevice } = await import("@/server/services/sync");
const { UPLOAD_ROOT } = await import("@/server/storage");
const { MemoryStore, MemoryTokenStore, SyncEngine } = await import("@/sync-client");
const { PlantServer, startPlantServer, PROVISIONAL_NUMBER } = await import("./index");

type Engine = InstanceType<typeof SyncEngine>;

const PLANT = "http://plant.test";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let plant: InstanceType<typeof PlantServer>;
let plantDir: string;
let started: number;
const cloud = { online: true, calls: [] as string[] };
const hall = { online: true };
let adminCookie = "";

const plantFetch = async (input: string, init?: RequestInit) => {
  if (!hall.online) throw new TypeError("fetch failed");
  return plant.handle(new Request(input, init), { remoteAddress: "10.0.0.20" });
};

/** Volání správy serveru závodu (cookie přihlášení si drží). */
async function admin(route: string, body?: unknown, remoteAddress = "127.0.0.1") {
  const init: RequestInit = body === undefined ? { headers: { cookie: adminCookie } } : { method: "POST", headers: { "content-type": "application/json", cookie: adminCookie, origin: PLANT }, body: JSON.stringify(body) };
  const response = await plant.handle(new Request(`${PLANT}/api/plant/v1/${route}`, init), { remoteAddress });
  const cookie = response.headers.get("set-cookie");
  if (cookie) adminCookie = cookie.split(";")[0] ?? "";
  return { status: response.status, data: (await response.json()) as Record<string, unknown> };
}

/** Správce nastaví heslo a spáruje server závodu kódem z Administrace → Zařízení. */
async function setupPlant() {
  expect((await admin("setup", { password: "Heslo-Serveru-2026" })).status).toBe(200);
  const { code } = await createPairingCode(prisma, { userId: "admin1", purpose: "PLANT_SERVER" });
  const paired = await admin("cloud/pair", { server: "https://cloud.test", code });
  expect(paired.status, JSON.stringify(paired.data)).toBe(200);
}

async function hallDevice(userId: string, name: string) {
  const pairing = await admin("pairing", { userId });
  expect(pairing.status, JSON.stringify(pairing.data)).toBe(200);
  const tokens = new MemoryTokenStore();
  const engine = new SyncEngine({ store: new MemoryStore(), tokens, platform: "WINDOWS", appVersion: "1.0.0-test", fetcher: plantFetch });
  await engine.pair({ server: PLANT, code: String(pairing.data.code), name });
  return { engine, tokens };
}

const store = (engine: Engine) => engine.store as InstanceType<typeof MemoryStore>;
const ids = (engine: Engine, entity: Parameters<InstanceType<typeof MemoryStore>["list"]>[0]) => store(engine).list(entity).map((record) => String(record.id)).sort();
const record = (engine: Engine, entity: Parameters<InstanceType<typeof MemoryStore>["list"]>[0], id: string) => store(engine).list(entity).find((row) => row.id === id);

async function seed() {
  await prisma.plant.createMany({ data: [{ id: "p1", code: "LIS", name: "Lisovna", customerName: "Firma c1" }, { id: "p2", code: "CIZ", name: "Cizí závod", customerName: "Firma c2" }] });
  const companyData = (id: string, ico: string, plantId: string) => ({ id, ico, companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Kolín", zip: "280 02", contactName: `Kontakt ${id}`, email: `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: new Date(), productScope: "PLANT_MANAGEMENT" as const, plantId });
  await prisma.registeredCompany.create({ data: companyData("c1", "12345679", "p1") });
  await prisma.registeredCompany.create({ data: companyData("c2", "87654321", "p2") });
  await prisma.user.createMany({
    data: [
      { id: "admin1", name: "Olga Ředitelová", email: "olga@c1.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "c1", homePlantId: "p1", passwordHash: "x" },
      { id: "tech1", name: "Marek Údržbář", email: "marek@c1.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "c1", homePlantId: "p1", passwordHash: "x" },
      { id: "insp1", name: "Iva Revizní", email: "iva@c1.example", role: "MAINTENANCE", accountType: "INSPECTOR_APPLIANCES", companyId: "c1", homePlantId: "p1", passwordHash: "x" },
      { id: "other2", name: "Cizí Ředitel", email: "cizi@c2.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "c2", homePlantId: "p2", passwordHash: "x" },
    ],
  });
  await prisma.building.createMany({ data: [{ id: "b1", plantId: "p1", code: "A", name: "Hala A", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 }, { id: "b2", plantId: "p2", code: "A", name: "Cizí hala", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 }] });
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
  started = Date.now() - 1000;
  db = await createTestDb();
  prisma = db.prisma;
  state.prisma = prisma;
  cloud.online = true;
  cloud.calls = [];
  hall.online = true;
  adminCookie = "";
  await seed();
  plantDir = mkdtempSync(path.join(os.tmpdir(), "eldock-zavod-"));
  plant = new PlantServer({ dataDir: plantDir, cloudFetch: await cloudFetcher(cloud), syncIntervalMs: 0, relayDelayMs: 600_000, serverName: "Server závodu – test" });
});

afterEach(async () => {
  plant.close();
  rmSync(plantDir, { recursive: true, force: true });
  // Fotky, které cloud během testu uložil do storage/uploads (jen nové soubory z testovací databáze)
  for (const { url } of await prisma.storedFile.findMany({ select: { url: true } })) {
    const file = path.join(UPLOAD_ROOT, ...url.slice("/api/files/".length).split("/"));
    if (existsSync(file) && statSync(file).mtimeMs >= started) rmSync(file, { force: true });
  }
  await db.cleanup();
});

describe("cloud a server závodu", () => {
  it("kód pro server závodu vytvoří jen správce a nespáruje jím aplikaci (ani naopak)", async () => {
    await expect(createPairingCode(prisma, { userId: "tech1", purpose: "PLANT_SERVER" })).rejects.toThrow(/jen správce firmy/);
    const serverCode = await createPairingCode(prisma, { userId: "admin1", purpose: "PLANT_SERVER" });
    await expect(pairDevice(prisma, { code: serverCode.code, name: "Tablet", platform: "WINDOWS" })).rejects.toThrow(/kód je pro server závodu/);
    const deviceCode = await createPairingCode(prisma, { userId: "admin1" });
    await expect(pairDevice(prisma, { code: deviceCode.code, name: "Server", platform: "PLANT_SERVER" })).rejects.toThrow(/Spárovat server závodu/);
  });

  it("první nastavení jen z tohoto počítače, pak spárování s cloudem a stažení celého závodu", async () => {
    expect((await admin("setup", { password: "Heslo-Serveru-2026" }, "10.0.0.7")).status).toBe(403);
    expect((await admin("overview")).status).toBe(401);
    await setupPlant();
    expect((await admin("setup", { password: "Jine-heslo-2026" })).status).toBe(409);
    // Celý závod bez výřezu kategorií, nic z cizí firmy
    expect(plant.store.effective("Equipment", "e-sw")).not.toBeNull();
    expect(plant.store.effective("Equipment", "e-tool")).not.toBeNull();
    expect(plant.store.effective("InspectionDefect", "def1")).not.toBeNull();
    expect(plant.store.effective("Equipment", "e-foreign")).toBeNull();
    // Přístupy uživatelů firmy v závodě spočítal cloud
    const users = plant.session?.plantServer?.users ?? [];
    expect(users.map((user) => user.id).sort()).toEqual(["admin1", "insp1", "tech1"]);
    expect(users.find((user) => user.id === "tech1")?.permissions).toContain("temporaryMods");
    const device = await prisma.syncDevice.findFirstOrThrow({ where: { platform: "PLANT_SERVER" } });
    expect(device).toMatchObject({ userId: "admin1", name: "Server závodu – test" });
    // Správa ukáže stav a přihlášení heslem z jiného počítače
    const overview = await admin("overview");
    expect(overview.data.cloud).toMatchObject({ paired: true, company: "Firma c1", plants: ["Lisovna"] });
    adminCookie = "";
    expect((await admin("login", { password: "spatne-heslo" }, "10.0.0.7")).status).toBe(401);
    expect((await admin("login", { password: "Heslo-Serveru-2026" }, "10.0.0.7")).status).toBe(200);
    expect((await admin("overview")).status).toBe(200);
  });
});

describe("zařízení v hale", () => {
  it("párování kódem ze správy a výřez účtu jako v cloudu", async () => {
    await setupPlant();
    const tech = await hallDevice("tech1", "Tablet Marek");
    const boss = await hallDevice("admin1", "Tablet Olga");
    expect(await tech.tokens.get()).toMatch(/^eldk_/);
    expect(await tech.engine.sync()).toMatchObject({ ok: true });
    expect(await boss.engine.sync()).toMatchObject({ ok: true });
    // Údržbář nevidí ruční nářadí (výřez účtu), správce vidí vše
    expect(ids(tech.engine, "Equipment")).toEqual(["e-sw"]);
    expect(ids(tech.engine, "InspectionDefect")).toEqual([]);
    expect(ids(boss.engine, "Equipment")).toEqual(["e-sw", "e-tool"]);
    expect(ids(boss.engine, "BomItem")).toEqual(["bom1"]);
    const status = await tech.engine.status();
    expect(status.session?.user).toMatchObject({ id: "tech1", accountType: "MAINTENANCE_TECH" });
    expect(status.session?.company.name).toBe("Firma c1");
    // Použitý kód podruhé neplatí
    const pairing = await admin("pairing", { userId: "tech1" });
    const again = new SyncEngine({ store: new MemoryStore(), tokens: new MemoryTokenStore(), platform: "WINDOWS", appVersion: "1", fetcher: plantFetch });
    await again.pair({ server: PLANT, code: String(pairing.data.code), name: "Druhý tablet" });
    await expect(again.pair({ server: PLANT, code: String(pairing.data.code), name: "Třetí tablet" })).rejects.toMatchObject({ status: 404 });
  });

  it("provizorium z haly vidí kolega hned, cloud ho pak provede jménem technika", async () => {
    await setupPlant();
    const tech = await hallDevice("tech1", "Tablet Marek");
    const boss = await hallDevice("admin1", "Tablet Olga");
    await tech.engine.sync();
    await boss.engine.sync();
    cloud.online = false;

    const item = await tech.engine.queue("temporaryMod.create", { id: "tm-hala-0001-abcd", equipmentId: "e-sw", title: "Přemostění tepelné ochrany", description: "Čerpadlo P2 do výměny relé", days: 7 }, { equipmentId: "e-sw" });
    expect(await tech.engine.sync()).toMatchObject({ ok: true, accepted: 1 });
    expect((await tech.engine.status()).accepted).toBe(1);
    // Kolega v hale ho vidí hned – cloud je nedostupný
    await boss.engine.sync();
    expect(record(boss.engine, "TemporaryModification", "tm-hala-0001-abcd")).toMatchObject({ number: PROVISIONAL_NUMBER, title: "Přemostění tepelné ochrany", createdByName: "Marek Údržbář", status: "ACTIVE" });
    expect(await plant.syncCloud()).toMatchObject({ ok: false, offline: true });
    expect(record(boss.engine, "TemporaryModification", "tm-hala-0001-abcd")).toBeTruthy();

    // Cloud zpět: úprava se provede jako Marek, se zařízením serveru závodu, číslo přidělí cloud
    cloud.online = true;
    expect(await plant.syncCloud()).toMatchObject({ ok: true, applied: 1 });
    const mod = await prisma.temporaryModification.findUniqueOrThrow({ where: { id: "tm-hala-0001-abcd" } });
    expect(mod).toMatchObject({ createdByName: "Marek Údržbář", status: "ACTIVE" });
    expect(mod.number).toMatch(/^PROV-\d{4}-\d{4}$/);
    const evidence = await prisma.syncMutation.findFirstOrThrow({ where: { clientId: item.id }, include: { device: true } });
    expect(evidence).toMatchObject({ userId: "tech1", status: "APPLIED" });
    expect(evidence.device?.platform).toBe("PLANT_SERVER");
    // Zařízení v hale dostanou číslo z cloudu a technik výsledek
    await boss.engine.sync();
    expect(record(boss.engine, "TemporaryModification", "tm-hala-0001-abcd")?.number).toBe(mod.number);
    await tech.engine.sync();
    expect((await tech.engine.store.listOutbox()).find((entry) => entry.id === item.id)).toMatchObject({ status: "applied", entityId: "tm-hala-0001-abcd" });
    expect(record(tech.engine, "TemporaryModification", "tm-hala-0001-abcd")?.number).toBe(mod.number);
  });

  it("zablokovaný technik: cloud úpravu odmítne, předběžná data zmizí a jeho zařízení přestane platit", async () => {
    await setupPlant();
    const tech = await hallDevice("tech1", "Tablet Marek");
    const boss = await hallDevice("admin1", "Tablet Olga");
    await tech.engine.queue("temporaryMod.create", { id: "tm-hala-0002-abcd", equipmentId: "e-sw", title: "Provizorní napájení", description: "Kabel přes halu", days: 14 }, { equipmentId: "e-sw" });
    await tech.engine.sync();
    await boss.engine.sync();
    expect(record(boss.engine, "TemporaryModification", "tm-hala-0002-abcd")).toBeTruthy();

    await prisma.user.update({ where: { id: "tech1" }, data: { disabledAt: new Date() } });
    expect(await plant.syncCloud()).toMatchObject({ ok: true, rejected: 1 });
    expect(await prisma.temporaryModification.count({ where: { id: "tm-hala-0002-abcd" } })).toBe(0);
    await boss.engine.sync();
    expect(record(boss.engine, "TemporaryModification", "tm-hala-0002-abcd")).toBeUndefined();
    expect(await tech.engine.sync()).toMatchObject({ ok: false, unpaired: true });
  });

  it("server závodu odmítne na místě: oprávnění, souběh a stav záznamu", async () => {
    await setupPlant();
    const boss = await hallDevice("admin1", "Tablet Olga");
    const inspector = await hallDevice("insp1", "Tablet Iva");
    await boss.engine.sync();
    // Revizní technik spotřebičů změnu zadat nesmí (i když aplikaci obejde)
    const raw = await plantFetch(`${PLANT}/api/sync/v1/mutations`, { method: "POST", headers: { authorization: `Bearer ${await inspector.tokens.get()}`, "content-type": "application/json" }, body: JSON.stringify({ mutations: [{ id: "raw-0001-abcd", type: "changeRequest.submit", payload: { equipmentId: "e-tool", note: "x" } }] }) });
    expect(await raw.json()).toMatchObject({ results: [{ id: "raw-0001-abcd", status: "rejected", code: "FORBIDDEN" }] });
    // Souběh: záznam se mezitím změnil
    await boss.engine.queue("equipment.photo", { equipmentId: "e-sw", photoUrl: null }, { equipmentId: "e-sw", baseUpdatedAt: "2020-01-01T00:00:00.000Z" });
    // Stav: dvakrát odstraněná závada
    await boss.engine.queue("defect.resolve", { defectId: "def1", note: "Vyměněn přívod" }, { equipmentId: "e-tool" });
    expect(await boss.engine.sync()).toMatchObject({ ok: true, accepted: 1, rejected: 1 });
    expect(record(boss.engine, "InspectionDefect", "def1")).toMatchObject({ status: "RESOLVED", resolvedBy: "Olga Ředitelová" });
    await boss.engine.queue("defect.resolve", { defectId: "def1", note: "Znovu" }, { equipmentId: "e-tool" });
    expect(await boss.engine.sync()).toMatchObject({ rejected: 1 });
    const outbox = await boss.engine.store.listOutbox();
    expect(outbox.filter((entry) => entry.status === "rejected").map((entry) => entry.code).sort()).toEqual(["CONFLICT", "INVALID_STATE"]);
    // Nic z toho do cloudu neodešlo kromě první opravy závady
    await plant.syncCloud();
    expect(await prisma.syncMutation.count()).toBe(1);
    expect((await prisma.inspectionDefect.findUniqueOrThrow({ where: { id: "def1" } })).status).toBe("RESOLVED");
  });

  it("fotka z haly: na serveru závodu hned u kolegy, po přeposlání v cloudu a zpět z cloudu", async () => {
    await setupPlant();
    const tech = await hallDevice("tech1", "Tablet Marek");
    const boss = await hallDevice("admin1", "Tablet Olga");
    await tech.engine.sync();
    const ref = await tech.engine.addLocalFile(new Blob([JPEG], { type: "image/jpeg" }), { name: "foto.jpg" });
    await tech.engine.queue("changeRequest.submit", { id: "cr-hala-0001-abcd", equipmentId: "e-sw", note: "Výměna stykače -K4", attachments: [{ url: ref, type: "PHOTO", fileName: "foto.jpg", mimeType: "image/jpeg", sizeBytes: JPEG.byteLength }] }, { equipmentId: "e-sw" });
    expect(await tech.engine.sync()).toMatchObject({ ok: true, accepted: 1 });

    await boss.engine.sync();
    expect(record(boss.engine, "ChangeRequest", "cr-hala-0001-abcd")).toMatchObject({ number: PROVISIONAL_NUMBER, note: "Výměna stykače -K4", reporterId: "tech1" });
    const [provisional] = store(boss.engine).list("Attachment");
    expect(String(provisional?.url)).toMatch(/^\/api\/files\/photos\/plant-[a-f0-9]{64}\.jpg$/);
    expect(await (await boss.engine.fileBlob(String(provisional?.url)))?.arrayBuffer()).toEqual(JPEG.buffer);

    expect(await plant.syncCloud()).toMatchObject({ ok: true, applied: 1 });
    const cloudAttachment = await prisma.attachment.findFirstOrThrow({ where: { changeRequestId: "cr-hala-0001-abcd" } });
    expect(cloudAttachment.url).toMatch(/^\/api\/files\/photos\/(?!plant-)/);
    const request = await prisma.changeRequest.findUniqueOrThrow({ where: { id: "cr-hala-0001-abcd" } });
    expect(request.reporterId).toBe("tech1");

    await boss.engine.sync();
    expect(record(boss.engine, "ChangeRequest", "cr-hala-0001-abcd")?.number).toBe(request.number);
    expect(ids(boss.engine, "Attachment")).toEqual([cloudAttachment.id]);
    // Fotku z cloudu obslouží server závodu (stáhl si ji) – i kdyby byl cloud teď nedostupný
    cloud.online = false;
    expect(await (await boss.engine.fileBlob(cloudAttachment.url))?.arrayBuffer()).toEqual(JPEG.buffer);
  });

  it("smazání v cloudu (i s potomky) dojde až do haly", async () => {
    await setupPlant();
    const boss = await hallDevice("admin1", "Tablet Olga");
    await boss.engine.sync();
    expect(ids(boss.engine, "InspectionDefect")).toEqual(["def1"]);
    await prisma.equipment.delete({ where: { id: "e-tool" } });
    await plant.syncCloud();
    await boss.engine.sync();
    expect(ids(boss.engine, "Equipment")).toEqual(["e-sw"]);
    expect(ids(boss.engine, "InspectionDefect")).toEqual([]);
    expect(ids(boss.engine, "InspectionRecord")).toEqual([]);
  });
});

describe("shoda s webem", () => {
  it("otevřené stavy požadavku jsou stejné jako ve stavovém automatu webu", async () => {
    const { OPEN_STATUSES } = await import("@/lib/workflow/state-machine");
    const { OPEN_CHANGE_STATUSES } = await import("./overlay");
    expect([...OPEN_CHANGE_STATUSES]).toEqual([...OPEN_STATUSES]);
  });
});

describe("HTTP server závodu", () => {
  it("poslouchá na portu, vrací informace o serveru a stránku správy", async () => {
    plant.close();
    const running = await startPlantServer({ dataDir: plantDir, cloudFetch: await cloudFetcher(cloud), syncIntervalMs: 0, port: 0, host: "127.0.0.1", serverName: "Server závodu – HTTP" });
    plant = running.plant;
    try {
      const info = (await (await fetch(`${running.url}/api/sync/v1`)).json()) as { api: string; plantServer: { name: string } };
      expect(info).toMatchObject({ api: "eldock-sync", plantServer: { name: "Server závodu – HTTP" } });
      const page = await fetch(`${running.url}/`);
      expect(page.headers.get("content-type")).toMatch(/text\/html/);
      expect(await page.text()).toContain("Eldock – server závodu");
      const unpaired = await fetch(`${running.url}/api/sync/v1/session`, { headers: { authorization: "Bearer eldk_neplatny-token-zarizeni" } });
      expect(unpaired.status).toBe(401);
      expect(unpaired.headers.get("access-control-allow-origin")).toBe("*");
    } finally {
      await running.close();
      plant = new PlantServer({ dataDir: plantDir, syncIntervalMs: 0 });
    }
  });
});
