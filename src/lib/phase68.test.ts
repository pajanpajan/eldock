import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { ENCRYPTION_OVERHEAD, createSealer, isSealedFile, keyFingerprint, packFile, unpackFile } from "@/server/backup/crypto";
import { amzDate, canonicalQuery, encodeRfc3986, signRequest } from "@/server/backup/s3";
import { isBackupDue, pragueClock } from "@/server/jobs";
import { snapshotName, snapshotsToKeep } from "@/server/services/backup";

import { DEMO_OWNER, canReadFile, claimVerdict, collectFileUrls, companyOwner, isRegistrableUpload, isSeedUpload, type FileViewer, type RegisteredFile } from "./file-ownership";

// Fáze 68: vlastník souborů (čtení a převzetí), podpis AWS SigV4, šifrování záloh, retence snímků a plánovač.

const viewer = (patch: Partial<FileViewer> = {}): FileViewer => ({ demo: false, companyIds: [], superadmin: false, ...patch });
const file = (patch: Partial<RegisteredFile> = {}): RegisteredFile => ({ ownerKind: "COMPANY", companyId: "co-a", deletedAt: null, ...patch });
const URL_A = "/api/files/photos/11111111-1111-1111-1111-111111111111.jpg";
const SEED = "/api/files/documents/seed/schema-r1.pdf";

describe("čtení souboru podle vlastníka", () => {
  it("soubor firmy čtou jen její přihlášení (závod i Panel Builder) a velín", () => {
    expect(canReadFile(viewer({ companyIds: ["co-a"] }), URL_A, file())).toBe(true);
    expect(canReadFile(viewer({ companyIds: ["co-b"] }), URL_A, file())).toBe(false);
    expect(canReadFile(viewer({ demo: true }), URL_A, file())).toBe(false);
    expect(canReadFile(viewer({ companyIds: ["co-b", "co-a"] }), URL_A, file())).toBe(true);
    expect(canReadFile(viewer({ superadmin: true }), URL_A, file())).toBe(true);
  });

  it("soubor dema jen demo účty, sdílený a vzorový každé přihlášení, nikdo nepřihlášený nic", () => {
    expect(canReadFile(viewer({ demo: true }), URL_A, file({ ownerKind: "DEMO", companyId: null }))).toBe(true);
    expect(canReadFile(viewer({ companyIds: ["co-a"] }), URL_A, file({ ownerKind: "DEMO", companyId: null }))).toBe(false);
    expect(canReadFile(viewer({ companyIds: ["co-b"] }), URL_A, file({ ownerKind: "SHARED", companyId: null }))).toBe(true);
    expect(canReadFile(viewer({ companyIds: ["co-b"] }), SEED, null)).toBe(true);
    expect(canReadFile(viewer(), SEED, null)).toBe(false);
    expect(canReadFile(viewer(), URL_A, file({ ownerKind: "SHARED", companyId: null }))).toBe(false);
  });

  it("neznámý nebo smazaný soubor jen velín", () => {
    expect(canReadFile(viewer({ demo: true }), URL_A, null)).toBe(false);
    expect(canReadFile(viewer({ companyIds: ["co-a"] }), URL_A, file({ deletedAt: new Date() }))).toBe(false);
    expect(canReadFile(viewer({ superadmin: true }), URL_A, null)).toBe(true);
  });

  it("adresy: vzorové soubory seed/ nejsou v registru, nahrané soubory jsou o dvou segmentech", () => {
    expect(isSeedUpload(SEED)).toBe(true);
    expect(isRegistrableUpload(SEED)).toBe(false);
    expect(isRegistrableUpload(URL_A)).toBe(true);
    expect(isRegistrableUpload("/api/files/photos/a/b.jpg")).toBe(false);
    expect(isRegistrableUpload("/demo-docs/x.pdf")).toBe(false);
  });
});

describe("převzetí souboru do záznamu", () => {
  it("vlastní, sdílený, vzorový a veřejný ano – cizí a neznámý ne", () => {
    expect(claimVerdict(companyOwner("co-a"), URL_A, file())).toBe("ok");
    expect(claimVerdict(companyOwner("co-b"), URL_A, file())).toBe("foreign");
    expect(claimVerdict(DEMO_OWNER, URL_A, file())).toBe("foreign");
    expect(claimVerdict(DEMO_OWNER, URL_A, file({ ownerKind: "DEMO", companyId: null }))).toBe("ok");
    expect(claimVerdict(companyOwner("co-a"), URL_A, file({ ownerKind: "DEMO", companyId: null }))).toBe("foreign");
    expect(claimVerdict(companyOwner("co-b"), URL_A, file({ ownerKind: "SHARED", companyId: null }))).toBe("ok");
    expect(claimVerdict(companyOwner("co-b"), SEED, null)).toBe("ok");
    expect(claimVerdict(companyOwner("co-b"), "/demo-docs/ukazka.pdf", null)).toBe("ok");
    expect(claimVerdict(companyOwner("co-a"), URL_A, null)).toBe("unknown");
    expect(claimVerdict(companyOwner("co-a"), URL_A, file({ deletedAt: new Date() }))).toBe("unknown");
  });

  it("mírný režim (nákres půdorysu) pustí neznámý soubor, cizí nikdy", () => {
    expect(claimVerdict(companyOwner("co-a"), URL_A, null, { strict: false })).toBe("ok");
    expect(claimVerdict(companyOwner("co-b"), URL_A, file(), { strict: false })).toBe("foreign");
  });

  it("adresy souborů ze vstupu akce i z vnořeného nákresu", () => {
    const input = {
      equipmentId: "eq",
      photoUrl: URL_A,
      attachments: [{ url: "/api/files/voice/x.webm", originalUrl: null }, { url: "https://example.com/x.jpg" }],
      draft: { background: { url: "/api/files/photos/bg.jpg" }, otherFloors: [{ background: { url: "/api/files/photos/bg2.jpg" } }] },
      note: "text s /api/files/photos/uvnitr.jpg se nepočítá",
    };
    expect(collectFileUrls(input).sort()).toEqual(["/api/files/photos/bg.jpg", "/api/files/photos/bg2.jpg", URL_A, "/api/files/voice/x.webm"].sort());
  });
});

describe("AWS Signature Version 4 (úložiště S3)", () => {
  it("vzorový GET Object z dokumentace AWS", () => {
    const headers = signRequest({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      headers: { Range: "bytes=0-9" },
      payloadHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
    expect(headers["x-amz-date"]).toBe("20130524T000000Z");
  });

  it("kódování klíčů a dotazu podle RFC 3986", () => {
    expect(encodeRfc3986("revize (1)!*.pdf")).toBe("revize%20%281%29%21%2A.pdf");
    expect(canonicalQuery({ prefix: "eldock/db/", "list-type": "2" })).toBe("list-type=2&prefix=eldock%2Fdb%2F");
    expect(amzDate(new Date("2026-11-08T01:30:05.123Z"))).toBe("20261108T013005Z");
  });
});

describe("šifrování záloh (AES-256-GCM)", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "eldock-crypto-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("zašifruje a rozbalí soubor s gzipem; jiný klíč a poškozená data neprojdou", async () => {
    const source = path.join(dir, "data.txt");
    const content = "Rozváděč RM1 – revize VTZ\n".repeat(500);
    writeFileSync(source, content);
    const sealer = await createSealer("tajne-heslo-zalohy-2026");
    const sealed = path.join(dir, "data.gz.enc");
    const written = await packFile(source, sealed, { sealer, gzip: true });
    expect(await isSealedFile(sealed)).toBe(true);
    expect(written.bytes).toBe(readFileSync(sealed).length);
    expect(readFileSync(sealed).includes(Buffer.from("Rozváděč"))).toBe(false);

    const restored = path.join(dir, "restored.txt");
    await unpackFile(sealed, restored, { secret: "tajne-heslo-zalohy-2026", gunzip: true });
    expect(readFileSync(restored, "utf8")).toBe(content);

    await expect(unpackFile(sealed, path.join(dir, "x.txt"), { secret: "jine-heslo-zalohy-2026", gunzip: true })).rejects.toThrow(/jiný klíč/);
    await expect(unpackFile(sealed, path.join(dir, "y.txt"), { gunzip: true })).rejects.toThrow(/ELDOCK_BACKUP_KEY/);
    const broken = readFileSync(sealed);
    broken[broken.length - 30] ^= 0xff;
    writeFileSync(path.join(dir, "broken.enc"), broken);
    await expect(unpackFile(path.join(dir, "broken.enc"), path.join(dir, "z.txt"), { secret: "tajne-heslo-zalohy-2026", gunzip: true })).rejects.toThrow();
  });

  it("velký snímek s jiným klíčem: srozumitelná chyba (ověření před gzipem) a žádný rozpracovaný výstup", async () => {
    const source = path.join(dir, "velky.db");
    writeFileSync(source, randomBytes(1_500_000));
    const sealed = path.join(dir, "velky.db.gz.enc");
    await packFile(source, sealed, { sealer: await createSealer("tajne-heslo-zalohy-2026"), gzip: true });
    const target = path.join(dir, "velky-obnova.db");
    await expect(unpackFile(sealed, target, { secret: "jine-heslo-zalohy-2026", gunzip: true })).rejects.toThrow(/jiný klíč/);
    expect(existsSync(target) || existsSync(`${target}.part`)).toBe(false);
    await unpackFile(sealed, target, { secret: "tajne-heslo-zalohy-2026", gunzip: true });
    expect(readFileSync(target).equals(readFileSync(source))).toBe(true);
  });

  it("šifrovaný soubor bez gzipu je přesně o záhlaví a značku větší; bez klíče jen kopie", async () => {
    const source = path.join(dir, "foto.jpg");
    writeFileSync(source, Buffer.alloc(1234, 7));
    const sealer = await createSealer("tajne-heslo-zalohy-2026");
    expect((await packFile(source, path.join(dir, "foto.enc"), { sealer })).bytes).toBe(1234 + ENCRYPTION_OVERHEAD);
    const plain = await packFile(source, path.join(dir, "foto.copy"), {});
    expect(plain.bytes).toBe(1234);
    await unpackFile(path.join(dir, "foto.copy"), path.join(dir, "foto.back"), {});
    expect(readFileSync(path.join(dir, "foto.back")).equals(readFileSync(source))).toBe(true);
    expect(keyFingerprint("tajne-heslo-zalohy-2026")).toMatch(/^[0-9A-F]{8}$/);
  });
});

describe("retence snímků databáze a plánovač", () => {
  it("ponechá nejnovější snímek každého z posledních dnů a měsíců", () => {
    const names = [
      snapshotName(new Date("2026-11-08T01:30:00Z"), true),
      snapshotName(new Date("2026-11-07T01:30:00Z"), true),
      snapshotName(new Date("2026-11-07T12:00:00Z"), true), // ruční záloha – novější téhož dne
      snapshotName(new Date("2026-11-06T01:30:00Z"), true),
      snapshotName(new Date("2026-10-31T01:30:00Z"), true),
      snapshotName(new Date("2026-10-01T01:30:00Z"), true),
      snapshotName(new Date("2026-09-15T01:30:00Z"), true),
      snapshotName(new Date("2026-08-15T01:30:00Z"), true),
    ];
    const keep = snapshotsToKeep(names, 2, 3);
    expect([...keep].sort()).toEqual(["eldock-20260915T013000Z.db.gz.enc", "eldock-20261031T013000Z.db.gz.enc", "eldock-20261107T120000Z.db.gz.enc", "eldock-20261108T013000Z.db.gz.enc"].sort());
  });

  it("záloha se spustí po nastaveném čase (pražský čas), jednou denně, nejvýš 3 pokusy", () => {
    const time = { hour: 2, minute: 30 };
    // 01:20 UTC = 02:20 v Praze (zimní čas) – ještě ne; 01:40 UTC = 02:40 – ano
    expect(pragueClock(new Date("2026-11-08T01:40:00Z"))).toEqual({ day: "2026-11-08", minuteOfDay: 160 });
    expect(isBackupDue(new Date("2026-11-08T01:20:00Z"), time, [])).toBe(false);
    expect(isBackupDue(new Date("2026-11-08T01:40:00Z"), time, [])).toBe(true);
    expect(isBackupDue(new Date("2026-11-08T05:00:00Z"), time, [{ status: "OK", startedAt: new Date("2026-11-08T01:40:00Z") }])).toBe(false);
    expect(isBackupDue(new Date("2026-11-08T05:00:00Z"), time, [{ status: "OK", startedAt: new Date("2026-11-07T01:40:00Z") }])).toBe(true);
    const failed = { status: "FAILED", startedAt: new Date("2026-11-08T01:40:00Z") };
    expect(isBackupDue(new Date("2026-11-08T05:00:00Z"), time, [failed, failed])).toBe(true);
    expect(isBackupDue(new Date("2026-11-08T05:00:00Z"), time, [failed, failed, failed])).toBe(false);
    expect(isBackupDue(new Date("2026-11-08T05:00:00Z"), time, [{ status: "RUNNING", startedAt: new Date("2026-11-08T04:55:00Z") }])).toBe(false);
  });
});
