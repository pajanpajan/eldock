import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { companyOwner } from "@/lib/file-ownership";
import type { BackupConfig } from "@/server/backup/config";
import { runDueMaintenance } from "@/server/jobs";
import { hashPassword } from "@/server/password";

import { authenticateCompany } from "./companies";
import { cancelCompanyClosure, closeCompanyNow, executeDueClosures, personalExportData, removeEmployee, removedUserEmail, requestCompanyClosure, writeCompanyExport } from "./data-requests";
import { registerFile } from "./file-registry";
import { applyRetention } from "./retention";
import { createTestDb, seedMinimal } from "./test-db";
import { readZip } from "./test-zip";

// Fáze 69 nad SQLite: export dat firmy (ZIP), vlastní údaje, odebrání zaměstnance, zrušení účtu firmy s lhůtou
// a výmazem (Správa závodů i Panel Builder s doklady), plánovač výmazů a retence evidence a zrušených firem.

const NOW = new Date("2026-11-08T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);
const PASSWORD = "Strojirny-Test-2026";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let dir: string;
let root: string;
const files: Record<string, string> = {};

const company = (id: string, data: Record<string, unknown>) =>
  prisma.registeredCompany.create({ data: { id, ico: "27074358", companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: `Kontakt ${id}`, email: `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: NOW, productScope: "PLANT_MANAGEMENT", ...data } });

async function upload(url: string, owner: string, content = `obsah ${url}`) {
  const filePath = path.join(root, ...url.replace("/api/files/", "").split("/"));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  await registerFile(prisma, { url, kind: url.split("/")[3], owner: companyOwner(owner), sizeBytes: content.length, mimeType: "image/jpeg", originalName: "foto-rozvadece.jpg" });
  return filePath;
}

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  dir = mkdtempSync(path.join(os.tmpdir(), "eldock-p69-"));
  root = path.join(dir, "uploads");
  const hash = await hashPassword(PASSWORD);

  // Firma „co“ se závodem „p“ (seed), firma „co2“ s vlastním závodem „p2“
  await company("co", { plantId: "p", passwordHash: hash });
  await prisma.plant.create({ data: { id: "p2", code: "P2", name: "Závod 2", customerName: "Firma 2", buildings: { create: { id: "b2", code: "B", name: "Hala B", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0, floors: { create: { id: "f2", level: 0, code: "1NP", name: "1. NP" } } } } } });
  await prisma.equipment.create({ data: { id: "eq-p2", floorId: "f2", tag: "RB-01", name: "Rozváděč B", type: "SWITCHBOARD", pinX: 1, pinY: 1 } });
  await company("co2", { plantId: "p2", email: "co2@firma.example", ico: "12345679" });
  await prisma.user.createMany({
    data: [
      { id: "owner", name: "Karel Ředitel", email: "karel@firma.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "co", homePlantId: "p", passwordHash: hash, totpSecret: "tajne", totpRecoveryJson: "[]", phone: "+420 601 000 000" },
      { id: "tech", name: "Petr Technik", email: "petr@firma.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "co", homePlantId: "p", passwordHash: hash, phone: "+420 602 000 000" },
      { id: "other", name: "Jan Jiný", email: "jan@firma2.example", role: "MAINTENANCE", accountType: "PLANT_ADMIN", companyId: "co2", homePlantId: "p2" },
    ],
  });
  await prisma.userSession.create({ data: { userId: "tech", expiresAt: later(10), device: "Chrome · Windows" } });
  await prisma.securityEvent.createMany({ data: [{ kind: "LOGIN_OK", companyId: "co", userId: "tech", email: "petr@firma.example" }, { kind: "LOGIN_OK", companyId: "co2", userId: "other", email: "jan@firma2.example" }] });
  files.co = "/api/files/photos/aaaa1111.jpg";
  files.coLoose = "/api/files/documents/bbbb2222.pdf";
  files.co2 = "/api/files/photos/cccc3333.jpg";
  await upload(files.co, "co");
  await upload(files.coLoose, "co");
  await upload(files.co2, "co2");
  await prisma.equipment.update({ where: { id: "eq-R-LIS-01" }, data: { photoUrl: files.co } });
  await prisma.equipment.update({ where: { id: "eq-p2" }, data: { photoUrl: files.co2 } });

  // Firma Panel Builderu „pb“ s projektem, půdorysem, objednávkou a hlášením AI; „pb2“ bez objednávek; ukázková Tester
  await company("pb", { productScope: "PANEL_BUILDER", email: "pb@firma.example", passwordHash: hash });
  await company("pb2", { productScope: "PANEL_BUILDER", email: "pb2@firma.example" });
  await company("company-tester", { productScope: "PANEL_BUILDER", email: "tester@eldock.cz" });
  files.pb = "/api/files/photos/dddd4444.jpg";
  await upload(files.pb, "pb");
  await prisma.panelBoardProject.create({ data: { id: "prj", code: "PB-777", name: "Rozvaděč RH1", companyId: "pb", photoUrl: files.pb, dominantManufacturer: "ABB", dinRailsCount: 2, modulesPerRail: 12 } });
  await prisma.floorplan.create({ data: { companyId: "pb", name: "Rodinný dům", draftJson: "{}" } });
  await prisma.creditOrder.create({ data: { companyId: "pb", variableSymbol: "20260001", packageCode: "START_10", creditsCount: 10, priceCzkExclVat: 1000, priceCzkInclVat: 1210 } });
  await prisma.aiFeedbackReport.create({ data: { companyId: "pb", projectId: "prj", photoUrl: files.pb, detectedSnapshotJson: "[]", message: "špatně rozpoznaný stykač" } });
});

afterEach(async () => {
  await db.cleanup();
  rmSync(dir, { recursive: true, force: true });
});

describe("export dat firmy", () => {
  it("Správa závodů: vlastní data a soubory v ZIP, bez cizí firmy, dema a tajemství", async () => {
    const target = path.join(dir, "export.zip");
    const result = await writeCompanyExport(prisma, { companyId: "co", storageRoot: root, targetPath: target, requestedBy: "company-admin", now: NOW });
    // Testovací revize ze seedu odkazuje na schéma, které na disku není – export ho spočítá jako chybějící
    expect(result).toMatchObject({ fileName: "eldock-export-27074358-2026-11-08.zip", files: 2, missingFiles: 1 });
    const zip = readZip(readFileSync(target));
    expect([...zip.keys()]).toEqual(expect.arrayContaining(["manifest.json", "README.txt", "data/firma.json", "data/uzivatele.json", "data/zarizeni.json", "data/revize-dokumentace.json", "data/bezpecnostni-denik.json", "data/soubory.json", "csv/zarizeni.csv", "soubory/photos/aaaa1111.jpg", "soubory/documents/bbbb2222.pdf"]));
    expect(zip.has("soubory/photos/cccc3333.jpg")).toBe(false);

    const json = (name: string) => JSON.parse(zip.get(name)!.toString("utf8"));
    expect(json("data/firma.json")[0]).not.toHaveProperty("passwordHash");
    const users = json("data/uzivatele.json");
    expect(users.map((user: { id: string }) => user.id).sort()).toEqual(["owner", "tech"]);
    expect(users[0]).toMatchObject({ passwordSet: true });
    expect(JSON.stringify(users)).not.toMatch(/tajne|passwordHash|totpSecret|scrypt/);
    expect(json("data/zarizeni.json").map((item: { tag: string }) => item.tag).sort()).toEqual(["R-CNC-04", "R-LIS-01"]);
    expect(json("data/bezpecnostni-denik.json")).toHaveLength(1);
    expect(json("data/soubory.json")).toEqual(expect.arrayContaining([expect.objectContaining({ url: files.co, path: "soubory/photos/aaaa1111.jpg", originalName: "foto-rozvadece.jpg" })]));
    expect(json("manifest.json")).toMatchObject({ format: "eldock-export", version: 1, company: { name: "Firma co", ico: "27074358", product: "PLANT_MANAGEMENT" }, counts: { zarizeni: 2, uzivatele: 2 }, files: 2 });
    expect(zip.get("csv/zarizeni.csv")!.toString("utf8")).toMatch(/^﻿Ev\. číslo;Název;Typ/);
    expect(zip.get("soubory/photos/aaaa1111.jpg")!.toString()).toBe(`obsah ${files.co}`);

    expect(await prisma.dataRequest.findFirst({ where: { kind: "COMPANY_EXPORT", companyId: "co" } })).toMatchObject({ status: "DONE", requestedBy: "company-admin", companyIco: "27074358" });
    expect(await prisma.securityEvent.count({ where: { kind: "DATA_EXPORTED", companyId: "co" } })).toBe(1);
  });

  it("Panel Builder: projekty, půdorysy, objednávky kreditů a hlášení AI se soubory firmy", async () => {
    const target = path.join(dir, "pb.zip");
    await writeCompanyExport(prisma, { companyId: "pb", storageRoot: root, targetPath: target, requestedBy: "panel-company", now: NOW });
    const zip = readZip(readFileSync(target));
    const count = (name: string) => JSON.parse(zip.get(`data/${name}.json`)!.toString("utf8")).length;
    expect([count("projekty-rozvadecu"), count("pudorysy"), count("objednavky-kreditu"), count("hlaseni-ai")]).toEqual([1, 1, 1, 1]);
    expect(zip.has("soubory/photos/dddd4444.jpg")).toBe(true);
    expect(zip.has("data/zarizeni.json")).toBe(false);
  });

  it("vlastní údaje uživatele: profil bez tajemství, zařízení, deník a přehled záznamů", async () => {
    const data = await personalExportData(prisma, "tech", NOW);
    expect(data.user).toMatchObject({ id: "tech", email: "petr@firma.example", passwordSet: true, twoFactorEnabled: false });
    expect(data.company).toEqual({ companyName: "Firma co", ico: "27074358" });
    expect(data.sessions).toHaveLength(1);
    expect(data.securityEvents).toHaveLength(1);
    expect(JSON.stringify(data)).not.toMatch(/passwordHash|scrypt/);
  });
});

describe("odebrání zaměstnance", () => {
  it("zruší přihlášení a kontakty, jméno zůstane (nebo se anonymizuje), e-mail jde znovu použít", async () => {
    await removeEmployee(prisma, { companyId: "co", actorId: "owner", userId: "tech", anonymizeName: false, now: NOW });
    const removed = await prisma.user.findUniqueOrThrow({ where: { id: "tech" } });
    expect(removed).toMatchObject({ name: "Petr Technik", email: removedUserEmail("tech"), phone: null, passwordHash: null, accountType: null, companyId: "co" });
    expect(removed.disabledAt).not.toBeNull();
    expect(await prisma.userSession.count({ where: { userId: "tech" } })).toBe(0);
    expect(await prisma.securityEvent.findFirst({ where: { userId: "tech", kind: "LOGIN_OK" } })).toMatchObject({ email: null });
    expect(await prisma.securityEvent.count({ where: { kind: "USER_REMOVED", userId: "tech", actorId: "owner" } })).toBe(1);
    expect(await prisma.dataRequest.count({ where: { kind: "USER_REMOVAL", companyId: "co" } })).toBe(1);
    // Původní e-mail jde použít pro nového zaměstnance
    await prisma.user.create({ data: { name: "Nový Technik", email: "petr@firma.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "co" } });

    await prisma.user.create({ data: { id: "tech2", name: "Eva Údržbářka", email: "eva@firma.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "co" } });
    const { name } = await removeEmployee(prisma, { companyId: "co", actorId: "owner", userId: "tech2", anonymizeName: true, now: NOW });
    expect(name).toBe("Bývalý zaměstnanec ECH2");
  });

  it("sebe, posledního technického ředitele ani zaměstnance cizí firmy odebrat nejde", async () => {
    await expect(removeEmployee(prisma, { companyId: "co", actorId: "owner", userId: "owner", anonymizeName: false })).rejects.toThrow(/Sami sebe/);
    await expect(removeEmployee(prisma, { companyId: "co", actorId: "tech", userId: "owner", anonymizeName: false })).rejects.toThrow(/aspoň jednoho aktivního technického ředitele/);
    await expect(removeEmployee(prisma, { companyId: "co", actorId: "owner", userId: "other", anonymizeName: false })).rejects.toThrow(/nebyl nalezen/);
  });
});

describe("zrušení účtu firmy", () => {
  it("lhůta 30 dní, zrušení žádosti, výmaz po lhůtě – závod, uživatelé, deník a soubory; jiná firma a demo zůstanou", async () => {
    const first = await requestCompanyClosure(prisma, { companyId: "co", requestedBy: "company-admin", actorId: "owner", now: NOW });
    expect(first).toMatchObject({ status: "PENDING", scheduledAt: later(30) });
    expect((await requestCompanyClosure(prisma, { companyId: "co", requestedBy: "company-admin", now: later(1) })).id).toBe(first.id);
    await cancelCompanyClosure(prisma, { companyId: "co", actorId: "owner", now: later(2) });
    expect(await prisma.dataRequest.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: "CANCELLED" });

    // Zaměstnanec, na kterého odkazuje záznam mimo závod firmy, se jen anonymizuje
    await prisma.changeRequest.create({ data: { number: "ZM-2026-0099", equipmentId: "eq-p2", reporterId: "tech" } });
    await requestCompanyClosure(prisma, { companyId: "co", requestedBy: "company-admin", now: later(3) });
    expect(await executeDueClosures(prisma, { storageRoot: root, now: later(32) })).toHaveLength(0);
    const [done] = await executeDueClosures(prisma, { storageRoot: root, now: later(34) });
    expect(done).toMatchObject({ status: "DONE" });
    // Deník: přihlášení + žádost, její zrušení a nová žádost o zrušení účtu
    expect(JSON.parse(done.summaryJson!)).toMatchObject({ plants: 1, equipment: 2, users: 1, usersAnonymized: 1, securityEvents: 4, files: 2, filesRemoved: 2, keptForInvoices: false });

    expect(await prisma.registeredCompany.findUnique({ where: { id: "co" } })).toBeNull();
    expect(await prisma.plant.findUnique({ where: { id: "p" } })).toBeNull();
    expect(await prisma.equipment.count({ where: { id: { in: ["eq-R-LIS-01", "eq-R-CNC-04"] } } })).toBe(0);
    expect(await prisma.documentRevision.count({ where: { equipmentId: "eq-R-LIS-01" } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: "owner" } })).toBeNull();
    expect(await prisma.user.findUniqueOrThrow({ where: { id: "tech" } })).toMatchObject({ name: "Smazaný uživatel", companyId: null, accountType: null, email: removedUserEmail("tech") });
    expect(await prisma.storedFile.count({ where: { companyId: "co" } })).toBe(0);
    expect(existsSync(path.join(root, "photos", "aaaa1111.jpg"))).toBe(false);
    // Jiná firma, její soubory a demo účty beze změny
    expect(await prisma.equipment.count({ where: { id: "eq-p2" } })).toBe(1);
    expect(existsSync(path.join(root, "photos", "cccc3333.jpg"))).toBe(true);
    expect(await prisma.securityEvent.count({ where: { companyId: "co2" } })).toBe(1);
    expect(await prisma.user.count({ where: { id: { in: ["u-maint", "u-cae", "other"] } } })).toBe(3);
  });

  it("Panel Builder: s objednávkami zůstanou jen fakturační údaje bez kontaktu a přihlášení, bez objednávek se firma smaže, Tester nejde", async () => {
    const result = await closeCompanyNow(prisma, { companyId: "pb", storageRoot: root, now: NOW });
    expect(result).toMatchObject({ status: "DONE", requestedBy: "superadmin" });
    expect(JSON.parse(result.summaryJson!)).toMatchObject({ projects: 1, floorplans: 1, aiFeedback: 1, files: 1, filesRemoved: 1, keptForInvoices: true });
    const stub = await prisma.registeredCompany.findUniqueOrThrow({ where: { id: "pb" } });
    expect(stub).toMatchObject({ companyName: "Firma pb", ico: "27074358", contactName: "Účet zrušen", email: "zruseno-pb@eldock.invalid", phone: "", passwordHash: "!", logoUrl: null, closedAt: NOW });
    expect(await prisma.creditOrder.count({ where: { companyId: "pb" } })).toBe(1);
    expect(await authenticateCompany(prisma, "pb@firma.example", PASSWORD, "PANEL_BUILDER")).toBeNull();
    expect(await authenticateCompany(prisma, "zruseno-pb@eldock.invalid", "!", "PANEL_BUILDER")).toBeNull();
    await expect(requestCompanyClosure(prisma, { companyId: "pb", requestedBy: "panel-company" })).rejects.toThrow(/nebyla nalezena/);

    await closeCompanyNow(prisma, { companyId: "pb2", storageRoot: root, now: NOW });
    expect(await prisma.registeredCompany.findUnique({ where: { id: "pb2" } })).toBeNull();
    await expect(requestCompanyClosure(prisma, { companyId: "company-tester", requestedBy: "superadmin" })).rejects.toThrow(/Tester zrušit nejde/);
    await expect(closeCompanyNow(prisma, { companyId: "company-tester", storageRoot: root })).rejects.toThrow(/Tester zrušit nejde/);
  });

  it("plánovač provede výmaz po lhůtě i s vypnutou zálohou, jednou denně", async () => {
    await requestCompanyClosure(prisma, { companyId: "co2", requestedBy: "company-admin", now: NOW });
    const config = { scheduleEnabled: false, time: { hour: 2, minute: 30 } } as BackupConfig;
    const at = new Date("2026-12-09T05:00:00Z");
    const first = await runDueMaintenance({ prisma, config, storageRoot: root, now: () => at });
    expect(first.backup).toBeNull();
    expect(first.retention?.status).toBe("OK");
    expect(first.erasure?.status).toBe("OK");
    expect(await prisma.registeredCompany.findUnique({ where: { id: "co2" } })).toBeNull();
    const second = await runDueMaintenance({ prisma, config, storageRoot: root, now: () => new Date(at.getTime() + 60 * 60 * 1000) });
    expect([second.backup, second.retention, second.erasure]).toEqual([null, null, null]);
  });
});

describe("retence žádostí a zrušených firem", () => {
  it("evidence žádostí 3 roky (čekající zůstanou), zrušená firma s doklady 10 let", async () => {
    await closeCompanyNow(prisma, { companyId: "pb", storageRoot: root, now: NOW });
    await requestCompanyClosure(prisma, { companyId: "co", requestedBy: "company-admin", now: NOW });
    expect(await applyRetention(prisma, later(365 * 3 + 5))).toMatchObject({ dataRequests: 1, closedCompanies: 0 });
    expect(await prisma.dataRequest.count({ where: { status: "PENDING" } })).toBe(1);
    expect(await applyRetention(prisma, later(3653 + 5))).toMatchObject({ closedCompanies: 1 });
    expect(await prisma.registeredCompany.findUnique({ where: { id: "pb" } })).toBeNull();
    expect(await prisma.creditOrder.count({ where: { companyId: "pb" } })).toBe(0);
  });
});
