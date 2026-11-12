import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { companyOwner } from "@/lib/file-ownership";
import type { BackupConfig } from "@/server/backup/config";
import { S3Client, signRequest } from "@/server/backup/s3";

import { listLocalSnapshots, parseBackupSummary, restoreBackup, runBackup } from "./backup";
import { backfillFileRegistry, markFilesDeleted, registerFile, registryStats } from "./file-registry";
import { applyRetention } from "./retention";
import { cleanupStorage } from "./storage-cleanup";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 68 nad SQLite: doplnění registru souborů podle odkazů, úklid s registrem, záloha (místní i do testovacího S3),
// obnova do prázdné složky, mazání smazaných souborů ze zálohy a retence záznamů o přihlášení.

const NOW = new Date("2026-11-08T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const SECRET = "tajne-heslo-zalohy-2026";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let dir: string;
let root: string;

const put = (rel: string, content: string | Buffer, ageDays = 3) => {
  const filePath = path.join(root, ...rel.split("/"));
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  const time = new Date(NOW.getTime() - ageDays * DAY);
  utimesSync(filePath, time, time);
  return `/api/files/${rel}`;
};

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  dir = mkdtempSync(path.join(os.tmpdir(), "eldock-p68-"));
  root = path.join(dir, "uploads");
  // Závod „p“ patří registrované firmě Správy závodů, závod „demo“ obchodnímu demu
  await prisma.registeredCompany.create({ data: { id: "co", productScope: "PLANT_MANAGEMENT", ico: "27074358", companyName: "Strojírny Test s.r.o.", street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: "Karel", email: "karel@strojirny.example", phone: "+420", passwordHash: "x", termsAcceptedAt: NOW, plantId: "p" } });
  await prisma.registeredCompany.create({ data: { id: "pb", productScope: "PANEL_BUILDER", ico: "12345679", companyName: "Rozvaděče s.r.o.", street: "Nádražní 1", city: "Turnov", zip: "511 01", contactName: "Petra", email: "petra@rozvadece.example", phone: "+420", passwordHash: "x", termsAcceptedAt: NOW } });
  await prisma.plant.create({ data: { id: "demo", code: "DMO", name: "Demo závod", customerName: "Demo", buildings: { create: { id: "bd", code: "D", name: "Hala D", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0, floors: { create: { id: "fd", level: 0, code: "1NP", name: "1. NP" } } } } } });
  await prisma.equipment.create({ data: { id: "eq-demo", floorId: "fd", tag: "RD-01", name: "Demo rozváděč", type: "SWITCHBOARD", pinX: 1, pinY: 1 } });
});

afterEach(async () => {
  await db.cleanup();
  rmSync(dir, { recursive: true, force: true });
});

describe("doplnění registru souborů (starší soubory)", () => {
  it("vlastník podle záznamu: závod firmy, demo závod, firma Panel Builderu; více vlastníků nebo katalog = sdílený", async () => {
    const companyPhoto = put("photos/aaaa.jpg", "foto firmy");
    const demoPhoto = put("photos/bbbb.jpg", "foto dema");
    const panelPhoto = put("photos/cccc.jpg", "foto rozvaděče");
    const both = put("attachments/dddd.pdf", "sdílená příloha");
    const catalog = put("documents/eeee.pdf", "datasheet");
    const orphan = put("photos/ffff.jpg", "bez odkazu");
    put("documents/seed/vzor.pdf", "vzor");

    await prisma.equipment.update({ where: { id: "eq-R-LIS-01" }, data: { photoUrl: companyPhoto } });
    await prisma.equipment.update({ where: { id: "eq-demo" }, data: { photoUrl: demoPhoto } });
    await prisma.panelBoardProject.create({ data: { code: "PB-777", name: "Rozvaděč RH1", companyId: "pb", photoUrl: panelPhoto, dominantManufacturer: "ABB", dinRailsCount: 2, modulesPerRail: 12 } });
    await prisma.equipmentDocument.create({ data: { equipmentId: "eq-R-LIS-01", category: "MANUAL", title: "Návod", fileUrl: both, fileName: "navod.pdf", fileSizeBytes: 15 } });
    await prisma.equipmentDocument.create({ data: { equipmentId: "eq-demo", category: "MANUAL", title: "Návod", fileUrl: both, fileName: "navod.pdf", fileSizeBytes: 15 } });
    await prisma.catalogComponent.create({ data: { manufacturer: "ABB", series: "S200", typeCode: "S201-B16", articleNumber: "2CDS251001R0165", category: "MCB", poles: "1P", ratedCurrentA: 16, modulesCount: 1, powerLossWatts: 2, description: "Jistič", datasheetUrl: catalog, searchText: "abb" } });

    const report = await backfillFileRegistry(prisma, root);
    expect(report).toMatchObject({ scanned: 6, alreadyRegistered: 0, registered: 5, unreferenced: 1, byOwner: { company: 2, demo: 1, shared: 2 } });
    expect(report.sharedTables).toEqual(["CatalogComponent"]);

    const owners = Object.fromEntries((await prisma.storedFile.findMany()).map((row) => [row.url, `${row.ownerKind}:${row.companyId ?? ""}`]));
    expect(owners).toEqual({ [companyPhoto]: "COMPANY:co", [demoPhoto]: "DEMO:", [panelPhoto]: "COMPANY:pb", [both]: "SHARED:", [catalog]: "SHARED:" });
    expect(owners[orphan]).toBeUndefined();
    const row = await prisma.storedFile.findUniqueOrThrow({ where: { url: companyPhoto } });
    expect(row).toMatchObject({ kind: "photos", sizeBytes: Buffer.byteLength("foto firmy"), mimeType: "image/jpeg", source: "registry", sha256: createHash("sha256").update("foto firmy").digest("hex") });

    // Podruhé nic nového
    expect(await backfillFileRegistry(prisma, root)).toMatchObject({ registered: 0, alreadyRegistered: 5, unreferenced: 1 });
    const stats = await registryStats(prisma);
    expect(stats).toMatchObject({ total: 5, companies: 2, deleted: 0 });
  });

  it("úklid úložiště: registr není odkaz – nepřipojený soubor smaže a v registru označí", async () => {
    const used = put("photos/used.jpg", "použitá", 3);
    const unused = put("photos/unused.jpg", "nepřipojená", 3);
    await prisma.equipment.update({ where: { id: "eq-demo" }, data: { photoUrl: used } });
    for (const url of [used, unused]) await registerFile(prisma, { url, kind: "photos", owner: companyOwner("co"), sizeBytes: 5, mimeType: "image/jpeg" });
    const report = await cleanupStorage(prisma, root, { now: NOW.getTime() });
    expect(report.orphans.map((orphan) => orphan.url)).toEqual([unused]);
    expect(report.removed).toBe(1);
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { url: unused } })).deletedAt).not.toBeNull();
    expect((await prisma.storedFile.findUniqueOrThrow({ where: { url: used } })).deletedAt).toBeNull();
    expect(await markFilesDeleted(prisma, [unused])).toBe(0);
  });
});

/** Testovací úložiště S3 (path-style) v paměti: ověří podpis a otisk obsahu každého požadavku. */
async function fakeS3() {
  const objects = new Map<string, Buffer>();
  const rejected: string[] = [];
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const url = new URL(req.url ?? "/", "http://localhost");
      const [, bucket, ...rest] = url.pathname.split("/");
      const key = rest.map(decodeURIComponent).join("/");
      const query = Object.fromEntries(url.searchParams);
      const payloadHash = String(req.headers["x-amz-content-sha256"]);
      const expected = signRequest({
        method: req.method ?? "GET",
        host: String(req.headers.host),
        path: url.pathname,
        query,
        headers: Object.fromEntries(
          String(req.headers.authorization)
            .match(/SignedHeaders=([^,]+)/)![1]
            .split(";")
            .filter((name) => !["host", "x-amz-content-sha256", "x-amz-date"].includes(name))
            .map((name) => [name, String(req.headers[name])]),
        ),
        payloadHash,
        region: "eu-central",
        accessKeyId: "AKTEST",
        secretAccessKey: "SKTEST",
        now: new Date(String(req.headers["x-amz-date"]).replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, "$1-$2-$3T$4:$5:$6Z")),
      });
      const signatureOk = expected.authorization === req.headers.authorization;
      const hashOk = req.method !== "PUT" || createHash("sha256").update(body).digest("hex") === payloadHash;
      if (bucket !== "zalohy" || !signatureOk || !hashOk) {
        rejected.push(`${req.method} ${url.pathname}`);
        res.writeHead(403, { "content-type": "application/xml" }).end("<Error><Code>SignatureDoesNotMatch</Code><Message>bad</Message></Error>");
        return;
      }
      if (req.method === "PUT") {
        objects.set(key, body);
        res.writeHead(200).end();
      } else if (req.method === "DELETE") {
        objects.delete(key);
        res.writeHead(204).end();
      } else if (req.method === "GET" && query["list-type"] === "2") {
        const prefix = query.prefix ?? "";
        const contents = [...objects.entries()].filter(([name]) => name.startsWith(prefix)).map(([name, data]) => `<Contents><Key>${name}</Key><Size>${data.length}</Size></Contents>`);
        res.writeHead(200, { "content-type": "application/xml" }).end(`<ListBucketResult><IsTruncated>false</IsTruncated>${contents.join("")}</ListBucketResult>`);
      } else if (req.method === "GET" && objects.has(key)) {
        res.writeHead(200).end(objects.get(key));
      } else {
        res.writeHead(404, { "content-type": "application/xml" }).end("<Error><Code>NoSuchKey</Code></Error>");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  return { objects, rejected, port, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

const configFor = (patch: Partial<BackupConfig> = {}): BackupConfig => ({
  scheduleEnabled: false,
  time: { hour: 2, minute: 30 },
  dir: path.join(dir, "backups"),
  keepLocal: 2,
  secret: null,
  s3: null,
  keepDaily: 14,
  keepMonthly: 6,
  deletedRetentionDays: 30,
  issues: [],
  ...patch,
});

describe("zálohy", () => {
  it("místní snímek bez šifrování: kontrola integrity, souhrn a rotace", async () => {
    const config = configFor();
    const first = await runBackup({ prisma, config, storageRoot: root, now: () => new Date("2026-11-06T01:30:00Z") }, "CLI");
    expect(first.status).toBe("OK");
    const summary = parseBackupSummary(first.summaryJson)!;
    expect(summary.snapshot).toMatchObject({ name: "eldock-20261106T013000Z.db.gz", encrypted: false, counts: { plants: 2, equipment: 3 } });
    expect(summary.snapshot.tables).toBeGreaterThan(20);
    expect(summary.offsiteSkipped).toMatch(/není nastavené/);
    await runBackup({ prisma, config, storageRoot: root, now: () => new Date("2026-11-07T01:30:00Z") }, "SCHEDULE");
    await runBackup({ prisma, config, storageRoot: root, now: () => new Date("2026-11-08T01:30:00Z") }, "MANUAL");
    expect((await listLocalSnapshots(config.dir)).map((item) => item.name)).toEqual(["eldock-20261108T013000Z.db.gz", "eldock-20261107T013000Z.db.gz"]);
    expect(readdirSync(path.join(config.dir, ".tmp"))).toEqual([]);

    // Obnova místního snímku do prázdné složky (nikdy do živých dat)
    const target = path.join(dir, "obnova");
    const restored = await restoreBackup({ config, from: "local", snapshot: "latest", targetDir: target, liveDirs: [root, config.dir] });
    expect(restored).toMatchObject({ snapshot: "eldock-20261108T013000Z.db.gz", counts: { plants: 2 } });
    await expect(restoreBackup({ config, from: "local", snapshot: "latest", targetDir: target, liveDirs: [root] })).rejects.toThrow(/není prázdná/);
    await expect(restoreBackup({ config, from: "local", snapshot: "latest", targetDir: path.join(root, "x"), liveDirs: [root] })).rejects.toThrow(/živými daty/);
  });

  it("běžící záloha nespustí druhou; přerušená po 3 h se uzavře", async () => {
    await prisma.maintenanceRun.create({ data: { kind: "BACKUP", trigger: "SCHEDULE", startedAt: new Date(NOW.getTime() - 60_000) } });
    await expect(runBackup({ prisma, config: configFor(), storageRoot: root, now: () => NOW }, "MANUAL")).rejects.toThrow(/už běží/);
    const later = new Date(NOW.getTime() + 4 * 60 * 60 * 1000);
    expect((await runBackup({ prisma, config: configFor(), storageRoot: root, now: () => later }, "MANUAL")).status).toBe("OK");
    expect(await prisma.maintenanceRun.count({ where: { status: "FAILED", error: { contains: "přerušena" } } })).toBe(1);
  });

  it("mimo server: šifrovaný snímek a soubory, přírůstkově, retence snímků, smazané soubory po 30 dnech a obnova", async () => {
    const s3 = await fakeS3();
    try {
      const config = configFor({ secret: SECRET, s3: { endpoint: `http://127.0.0.1:${s3.port}`, region: "eu-central", bucket: "zalohy", accessKeyId: "AKTEST", secretAccessKey: "SKTEST", pathStyle: true, prefix: "eldock" }, keepDaily: 2, keepMonthly: 0 });
      const photo = put("photos/1111.jpg", Buffer.alloc(5000, 9));
      put("documents/seed/vzor.pdf", "%PDF vzor");
      await prisma.equipment.update({ where: { id: "eq-demo" }, data: { photoUrl: photo } });
      const client = new S3Client(config.s3!);

      const first = await runBackup({ prisma, config, storageRoot: root, s3: client, now: () => new Date("2026-11-06T01:30:00Z") }, "SCHEDULE");
      expect(s3.rejected).toEqual([]);
      expect(first.status).toBe("OK");
      expect(parseBackupSummary(first.summaryJson)!.offsite).toMatchObject({ uploadedDb: true, filesUploaded: 2, filesSkipped: 0, errors: [] });
      expect([...s3.objects.keys()].sort()).toEqual(["eldock/db/eldock-20261106T013000Z.db.gz.enc", "eldock/files/documents/seed/vzor.pdf.enc", "eldock/files/photos/1111.jpg.enc"]);
      expect(s3.objects.get("eldock/files/photos/1111.jpg.enc")!.subarray(0, 8).toString()).toBe("ELDOCKB1");

      // Druhý den: nezměněné soubory se nenahrávají, třetí den se nejstarší snímek smaže (keepDaily = 2)
      const second = await runBackup({ prisma, config, storageRoot: root, s3: client, now: () => new Date("2026-11-07T01:30:00Z") }, "SCHEDULE");
      expect(parseBackupSummary(second.summaryJson)!.offsite).toMatchObject({ filesUploaded: 0, filesSkipped: 2 });
      unlinkSync(path.join(root, "photos", "1111.jpg"));
      const third = await runBackup({ prisma, config, storageRoot: root, s3: client, now: () => new Date("2026-11-08T01:30:00Z") }, "SCHEDULE");
      expect(parseBackupSummary(third.summaryJson)!.offsite).toMatchObject({ dbDeleted: 1, filesMarkedMissing: 1, filesDeleted: 0 });
      expect([...s3.objects.keys()].filter((key) => key.includes("/db/")).sort()).toEqual(["eldock/db/eldock-20261107T013000Z.db.gz.enc", "eldock/db/eldock-20261108T013000Z.db.gz.enc"]);

      // Obnova z úložiště mimo server do prázdné složky: databáze i soubory (smazaná fotka je v záloze ještě 30 dní)
      const target = path.join(dir, "obnova-s3");
      const restored = await restoreBackup({ config, from: "s3", snapshot: "latest", targetDir: target, withFiles: true, liveDirs: [root, config.dir], s3: client });
      expect(restored).toMatchObject({ snapshot: "eldock-20261108T013000Z.db.gz.enc", files: 2, counts: { equipment: 3 } });
      expect(readFileSync(path.join(target, "uploads", "photos", "1111.jpg")).equals(Buffer.alloc(5000, 9))).toBe(true);
      expect(existsSync(path.join(target, "eldock.db"))).toBe(true);

      // Po 30 dnech zmizí smazaný soubor i ze zálohy
      const month = await runBackup({ prisma, config, storageRoot: root, s3: client, now: () => new Date("2026-12-09T01:30:00Z") }, "SCHEDULE");
      expect(parseBackupSummary(month.summaryJson)!.offsite).toMatchObject({ filesDeleted: 1 });
      expect(s3.objects.has("eldock/files/photos/1111.jpg.enc")).toBe(false);
      expect(await prisma.backupObject.count({ where: { kind: "file" } })).toBe(1);
      expect(s3.rejected).toEqual([]);
    } finally {
      await s3.close();
    }
  });

  it("úložiště mimo server odmítne požadavek → záloha selže s českou chybou, místní snímek zůstane", async () => {
    const s3 = await fakeS3();
    try {
      const config = configFor({ secret: SECRET, s3: { endpoint: `http://127.0.0.1:${s3.port}`, region: "eu-central", bucket: "jiny-bucket", accessKeyId: "AKTEST", secretAccessKey: "SKTEST", pathStyle: true, prefix: "eldock" } });
      const run = await runBackup({ prisma, config, storageRoot: root, s3: new S3Client(config.s3!), now: () => NOW }, "MANUAL");
      expect(run.status).toBe("FAILED");
      expect(run.error).toMatch(/Úložiště záloh odmítlo požadavek \(SignatureDoesNotMatch/);
      expect((await listLocalSnapshots(config.dir)).map((item) => item.name)).toEqual(["eldock-20261108T100000Z.db.gz.enc"]);
    } finally {
      await s3.close();
    }
  });
});

describe("retence", () => {
  it("bezpečnostní deník 1 rok, relace a odkazy na heslo 30 dní – nové a platné záznamy zůstanou", async () => {
    const old = new Date(NOW.getTime() - 400 * DAY);
    const recent = new Date(NOW.getTime() - 10 * DAY);
    await prisma.securityEvent.createMany({ data: [{ kind: "LOGIN_OK", createdAt: old }, { kind: "LOGIN_FAILED", createdAt: recent }] });
    await prisma.user.create({ data: { id: "emp", name: "Zaměstnanec", email: "emp@strojirny.example", role: "MAINTENANCE", accountType: "MAINTENANCE_TECH", companyId: "co" } });
    await prisma.userSession.createMany({
      data: [
        { userId: "emp", expiresAt: new Date(NOW.getTime() - 40 * DAY) },
        { userId: "emp", expiresAt: new Date(NOW.getTime() + 5 * DAY), revokedAt: new Date(NOW.getTime() - 31 * DAY) },
        { userId: "emp", expiresAt: new Date(NOW.getTime() + 5 * DAY) },
        { userId: "emp", expiresAt: new Date(NOW.getTime() - 5 * DAY) },
      ],
    });
    await prisma.authToken.createMany({
      data: [
        { userId: "emp", kind: "INVITE", tokenHash: "a", expiresAt: new Date(NOW.getTime() - 31 * DAY) },
        { userId: "emp", kind: "RESET", tokenHash: "b", expiresAt: new Date(NOW.getTime() + DAY), usedAt: new Date(NOW.getTime() - 35 * DAY) },
        { userId: "emp", kind: "RESET", tokenHash: "c", expiresAt: new Date(NOW.getTime() + DAY) },
      ],
    });
    expect(await applyRetention(prisma, NOW)).toEqual({ securityEvents: 1, sessions: 2, authTokens: 2, maintenanceRuns: 0, dataRequests: 0, closedCompanies: 0, contactMessages: 0, syncTombstones: 0, syncMutations: 0, syncDevices: 0, syncPairings: 0 });
    expect(await prisma.securityEvent.count()).toBe(1);
    expect(await prisma.userSession.count()).toBe(2);
    expect(await prisma.authToken.count()).toBe(1);
  });
});
