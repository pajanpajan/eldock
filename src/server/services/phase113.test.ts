import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { HLIDAC_TRIAL_DEVICES } from "@/lib/credits";
import { addFloor, emptyDraft, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";
import { BACKUP_STORAGE_KEY, SMTP_KEY } from "@/lib/platform-settings";
import { backupConfig } from "@/server/backup/config";
import { smtpTransportFromEnv } from "@/server/mailer";

import { chargeNewFloorplan, chargeNewSwitchboard, confirmCreditOrder, createCreditOrder, unlockOutput } from "./credits";
import { MAX_DRAFT_CHARS, createFloorplan, getFloorplan, saveFloorplanDraft } from "./floorplans";
import { assertDeviceCapacity, createHlidacBuilding, createRoomDevice, hlidacOverview, plantDeviceEntitlement } from "./hlidac";
import { clearBackupStorage, loadPlatformSettings, platformCache, saveBackupStorage, saveSmtpSettings } from "./platform-settings";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 113: ⭐ neomezený přístup a limit zařízení Hlídače revizí, objednávka startovací mix sady QR štítků (série pro
// každý druh štítku), SMTP a úložiště záloh z velínu (tajné hodnoty šifrovaně) a uložení vícepodlažního půdorysu.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

async function newCompany(id: string, data: Record<string, unknown> = {}) {
  return prisma.registeredCompany.create({
    data: { id, productScope: "PANEL_BUILDER", ico: "27082440", companyName: `Elektro ${id}`, street: "Ulice 1", city: "Liberec", zip: "460 01", contactName: "Elektrikář", email: `${id}@firma.cz`, phone: "+420 777 000 000", passwordHash: "x", termsAcceptedAt: new Date(), ...data },
  });
}

describe("fáze 113 – ⭐ neomezený přístup a limity tarifů", () => {
  it("neomezená firma: půdorys a rozváděč v plné verzi bez kreditů a bez spotřeby zkušebního projektu", async () => {
    const owner = await newCompany("majitel", { unlimitedAccess: true });
    const floorplan = await chargeNewFloorplan(prisma, owner.id);
    const switchboard = await chargeNewSwitchboard(prisma, owner.id);
    expect(floorplan.plan).toMatchObject({ license: "UNLIMITED", cost: 0 });
    expect(switchboard.plan).toMatchObject({ license: "UNLIMITED", cost: 0 });
    expect(await prisma.registeredCompany.findUniqueOrThrow({ where: { id: owner.id } })).toMatchObject({ trialFloorplanUsed: false, trialSwitchboardUsed: false, creditsRemaining: 0 });
    expect(await prisma.creditTransaction.count()).toBe(0);
    // Běžná firma: první půdorys zkušební, další bez kreditů = prodejní modal
    const regular = await newCompany("bezny");
    expect((await chargeNewFloorplan(prisma, regular.id)).plan.license).toBe("TRIAL");
    await expect(chargeNewFloorplan(prisma, regular.id)).rejects.toThrow(/kreditů/);
    // Zkušební půdorys neomezené firmy se odemkne zdarma
    const created = await createFloorplan(prisma, owner.id, { meta: { name: "Ukázka" }, draft: emptyDraft() });
    expect(created.license).toBe("UNLIMITED");
    expect(await unlockOutput(prisma, owner.id, "quote", created.id)).toMatchObject({ cost: 0, license: "UNLIMITED" });
  });

  it("Hlídač revizí: zkušební limit zařízení, tarif REVIZE & BUDOVY a závod s neomezenou firmou", async () => {
    await seedMinimal(prisma);
    const building = await createHlidacBuilding(prisma, { plantId: "p", mode: "OFFICE", name: "Kanceláře", floors: [{ usage: "Kanceláře", rooms: ["Kancelář 101"] }] });
    const floorId = (await hlidacOverview(prisma, "p")).find((row) => row.id === building.buildingId)!.floors[0].id;
    // Závod bez registrované firmy (ukázkový / interní) limit nemá
    expect((await plantDeviceEntitlement(prisma, "p")).reason).toBe("INTERNAL");
    const plantCompany = await prisma.registeredCompany.create({
      data: { productScope: "PLANT_MANAGEMENT", ico: "27082440", companyName: "Kanceláře s.r.o.", street: "Ulice 2", city: "Liberec", zip: "460 01", contactName: "Správce", email: "spravce@kancelare.cz", phone: "+420 777 000 001", passwordHash: "x", termsAcceptedAt: new Date(), plantId: "p" },
    });
    const trial = await plantDeviceEntitlement(prisma, "p");
    expect(trial).toMatchObject({ reason: "TRIAL", limit: HLIDAC_TRIAL_DEVICES });
    await expect(assertDeviceCapacity(prisma, "p", HLIDAC_TRIAL_DEVICES)).rejects.toThrow(/Zkušební limit Hlídače revizí je 50 zařízení/);
    await expect(assertDeviceCapacity(prisma, "p", 1)).resolves.toBeUndefined();
    await createRoomDevice(prisma, { floorId, room: "Kancelář 101", label: "Monitor", type: "APPLIANCE", protectionClass: "I", handHeld: false, mode: "OFFICE" });
    expect((await plantDeviceEntitlement(prisma, "p")).used).toBe(trial.used + 1);
    // Tarif REVIZE & BUDOVY: limit 500
    await prisma.registeredCompany.update({ where: { id: plantCompany.id }, data: { subscriptionPlan: "BUILDINGS", subscriptionUntil: new Date(Date.now() + 30 * 24 * 3600_000) } });
    expect(await plantDeviceEntitlement(prisma, "p")).toMatchObject({ reason: "SUBSCRIPTION", limit: 500 });
    await expect(assertDeviceCapacity(prisma, "p", HLIDAC_TRIAL_DEVICES)).resolves.toBeUndefined();
    // ⭐ neomezený přístup: bez limitu
    await prisma.registeredCompany.update({ where: { id: plantCompany.id }, data: { subscriptionPlan: null, subscriptionUntil: null, unlimitedAccess: true } });
    expect((await plantDeviceEntitlement(prisma, "p")).unlimited).toBe(true);
    await expect(assertDeviceCapacity(prisma, "p", 100_000)).resolves.toBeUndefined();
  });
});

describe("fáze 113 – startovací mix sada QR štítků", () => {
  it("objednávka bez nastavení ve velínu, neplátce DPH, po úhradě série spotřebič / rozváděč / stroj", async () => {
    const company = await newCompany("mix");
    const order = await createCreditOrder(prisma, company.id, "LABELS_A60S30M10");
    expect(order).toMatchObject({ packageCode: "LABELS_A60S30M10", creditsCount: 0, priceCzkExclVat: 890, priceCzkInclVat: 890 });
    const confirmed = await confirmCreditOrder(prisma, order.id);
    expect(confirmed).toMatchObject({ orderedLabels: 100, bonusLabels: 0 });
    const batches = await prisma.qrLabelBatch.findMany({ where: { companyName: "Elektro mix" }, orderBy: { firstSequence: "asc" } });
    expect(batches.map((batch) => [batch.purpose, batch.count])).toEqual([
      ["APPLIANCE", 60],
      ["SWITCHBOARD", 30],
      ["MACHINE", 10],
    ]);
    expect(batches[1].note).toMatch(/50 × 25 mm/);
  });
});

describe("fáze 113 – SMTP a cloud zálohy z velínu", () => {
  afterEach(() => {
    platformCache().smtp = null;
    platformCache().storage = null;
  });

  it("heslo SMTP a klíče úložiště se ukládají šifrovaně, prostředí bez SMTP použije velín", async () => {
    await expect(saveSmtpSettings(prisma, { host: "x", port: 465, secure: true, user: "", from: "ELDOCK" })).rejects.toThrow();
    await saveSmtpSettings(prisma, { host: "smtp.seznam.cz", port: 465, secure: true, user: "info@eldock.cz", password: "Heslo-SMTP-123", from: "ELDOCK <info@eldock.cz>" });
    const stored = await prisma.platformSetting.findUniqueOrThrow({ where: { key: SMTP_KEY } });
    expect(stored.valueJson).not.toContain("Heslo-SMTP-123");
    platformCache().smtp = null;
    await loadPlatformSettings(prisma);
    expect(platformCache().smtp).toMatchObject({ host: "smtp.seznam.cz", pass: "Heslo-SMTP-123" });
    // Prázdné heslo při další úpravě = ponechat uložené
    await saveSmtpSettings(prisma, { host: "smtp.seznam.cz", port: 587, secure: false, user: "info@eldock.cz", password: "", from: "ELDOCK <info@eldock.cz>" });
    expect(platformCache().smtp).toMatchObject({ port: 587, pass: "Heslo-SMTP-123" });
    if (!process.env.ELDOCK_SMTP_URL) expect(smtpTransportFromEnv()).toBeTypeOf("function");

    await expect(saveBackupStorage(prisma, { endpoint: "https://abc.r2.cloudflarestorage.com", bucket: "eldock-zalohy", accessKeyId: "AKIA1234" })).rejects.toThrow(/Secret/);
    await expect(saveBackupStorage(prisma, { endpoint: "https://abc.r2.cloudflarestorage.com", bucket: "eldock-zalohy", accessKeyId: "AKIA1234", secretAccessKey: "tajny-klic", backupKey: "kratke" })).rejects.toThrow(/16 znaků/);
    await saveBackupStorage(prisma, { endpoint: "https://abc.r2.cloudflarestorage.com/cesta", bucket: "eldock-zalohy", accessKeyId: "AKIA1234", secretAccessKey: "tajny-klic", backupKey: "dlouhe-heslo-zaloh-2026" });
    const storage = await prisma.platformSetting.findUniqueOrThrow({ where: { key: BACKUP_STORAGE_KEY } });
    expect(storage.valueJson).not.toContain("tajny-klic");
    expect(storage.valueJson).not.toContain("dlouhe-heslo-zaloh-2026");
    if (!process.env.ELDOCK_BACKUP_S3_ENDPOINT && !process.env.ELDOCK_BACKUP_KEY) {
      const config = backupConfig();
      expect(config.s3).toMatchObject({ endpoint: "https://abc.r2.cloudflarestorage.com", bucket: "eldock-zalohy", region: "auto", prefix: "eldock" });
      expect(config.secret).toBe("dlouhe-heslo-zaloh-2026");
      expect(config.keepLocal).toBe(14);
    }
    await clearBackupStorage(prisma);
    expect(platformCache().storage).toBeNull();
  });
});

describe("fáze 113 – uložení vícepodlažního půdorysu", () => {
  it("2. NP s vlastním PDF podkladem se uloží celé (podklady, měřítko, popisky) a projde i velký nákres", async () => {
    const company = await newCompany("patra", { unlimitedAccess: true });
    let draft: FloorplanDraft = { ...emptyDraft(), background: { url: "/api/files/photos/prizemi.webp", widthPx: 2400, heightPx: 1697, rotation: 0 as const, crop: null, pagePt: null, labels: [{ text: "1.01 Obývací pokoj", x: 300, y: 400, h: 18 }] }, mmPerPx: 6.25 };
    draft = addFloor(draft, { name: "2. NP", levelMm: 3000 });
    draft = { ...draft, background: { url: "/api/files/photos/patro.webp", widthPx: 2400, heightPx: 1697, rotation: 0 as const, crop: null, pagePt: null, labels: [{ text: "2.01 Ložnice", x: 500, y: 600, h: 18 }] }, mmPerPx: 7 };
    const created = await createFloorplan(prisma, company.id, { meta: { name: "RD dvě podlaží" }, draft });
    // Velký nákres (přes dřívější limit 900 kB): 2 podlaží × 200 poznámek po 500 znacích + ruční trasy
    const notes = (prefix: string) => Array.from({ length: 200 }, (_, index) => ({ id: `${prefix}${index}`, kind: "text" as const, x: index * 10, y: index * 10, x2: index * 10, y2: index * 10, color: "#000000", hatch: "none" as const, thicknessMm: 100, text: `Poznámka ${index}: ${"kabel CYKY 3×2,5 v liště ".repeat(30)}`.slice(0, 500), fontMm: 250, bold: false, background: true }));
    const routeEdits = Object.fromEntries(Array.from({ length: 300 }, (_, index) => [`z${index}>panel`, Array.from({ length: 60 }, (_, at) => ({ x: 10_000 + at * 37, y: 20_000 + index }))]));
    const extra = (id: string, name: string, levelMm: number) => ({ ...draft.otherFloors[0], id, name, levelMm, background: null, annotations: notes(id) });
    const big = { ...draft, annotations: notes("a"), routeEdits, otherFloors: [...draft.otherFloors.map((floor) => ({ ...floor, annotations: notes("b") })), extra("f3", "3. NP", 6000), extra("f4", "4. NP", 9000)] };
    expect(JSON.stringify(big).length).toBeGreaterThan(900_000);
    expect(JSON.stringify(big).length).toBeLessThan(MAX_DRAFT_CHARS);
    const saved = await saveFloorplanDraft(prisma, company.id, created.id, { baseVersion: created.version, draft: big });
    expect(saved.status).toBe("saved");
    const loaded = await getFloorplan(prisma, company.id, created.id);
    expect(loaded?.draft?.background?.url).toBe("/api/files/photos/patro.webp");
    expect(loaded?.draft?.background?.labels?.[0].text).toBe("2.01 Ložnice");
    expect(loaded?.draft?.otherFloors[0]).toMatchObject({ name: "1. NP", mmPerPx: 6.25, background: { url: "/api/files/photos/prizemi.webp" } });
    expect(loaded?.draft?.annotations).toHaveLength(200);
    expect(loaded?.draft?.otherFloors[0].annotations).toHaveLength(200);
    expect(Object.keys(loaded?.draft?.routeEdits ?? {})).toHaveLength(300);
    expect(loaded?.floorCount).toBe(4);
  });
});
