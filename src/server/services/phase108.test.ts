import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { summarizeInspections } from "@/lib/inspection";
import { STANDARD_MEASUREMENTS, sealPayload } from "@/lib/revision-signature";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { buildingImpact, deleteBuilding, deleteEquipment, moveBuilding, updateBuilding } from "./buildings";
import {
  attachPades,
  flagMisuse,
  monthlyCsv,
  monthlyReport,
  recordSignedRevision,
  saveInspectorProfile,
  sendDueMonthlyReports,
  sendMonthlyReport,
  sha256,
  verifySeal,
  type SignedRevisionInput,
} from "./revision-signing";
import { createTestDb, seedMinimal } from "./test-db";

// Fáze 108 nad SQLite: úprava / přesun / smazání budovy z mapy i detailu, podepsaná revize technika (profil TIČR,
// kontakty, měření, PIN, pečeť SHA-256), PAdES, měsíční report pod číslem osvědčení a zneplatnění cizí revize.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  await prisma.plant.update({ where: { id: "p" }, data: { campusWidthM: 400, campusDepthM: 280 } });
  await prisma.building.update({ where: { id: "b" }, data: { mapPolygon: "8,10 36,10 36,30 8,30" } });
  await prisma.building.create({ data: { id: "b2", plantId: "p", code: "B", name: "Hala B", mapPolygon: "60,60 80,60 80,80 60,80", labelX: 70, labelY: 70 } });
});
afterEach(() => db.cleanup());

const NOW = new Date("2026-11-13T09:00:00Z");
const PIN = "482916";
const PNG = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(120, 7)]).toString("base64")}`;

const profile = () =>
  saveInspectorProfile(
    prisma,
    {
      plantId: "p",
      name: "Ing. Martin Dvořák",
      company: "Revize Dvořák s.r.o.",
      ico: "27074358",
      phone: "+420 777 123 456",
      email: "dvorak@revize.example",
      certificateNo: "1248/23/R-EZ-E2A",
      certificateScope: "E2A",
      certificateValidUntil: "2028-03-31",
      authorizationNo: "OPR-0815/2024",
      instrument: "Metrel EurotestXC MI 3155",
      calibrationNo: "KL-2026-0842",
      calibrationValidUntil: "2027-10-31",
      pin: PIN,
    },
    { now: NOW },
  );

const stored: string[] = [];
const context = {
  now: NOW,
  ip: "203.0.113.7",
  ipKey: "hmac-ip",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36",
  actorId: "u-maint",
  storeSignature: async () => {
    stored.push("signature");
    return "/api/files/attachments/sig-108.png";
  },
  storeReport: async (svg: string) => {
    stored.push(svg);
    return "/api/files/documents/report-108.svg";
  },
};

const sign = (profileId: string, extra: Partial<SignedRevisionInput> = {}) =>
  recordSignedRevision(
    prisma,
    {
      equipmentIds: ["eq-R-LIS-01", "eq-R-CNC-04"],
      inspectorProfileId: profileId,
      pin: PIN,
      type: "PERIODIC",
      intervalYears: null,
      inspectionDate: "2026-11-12",
      measurements: { ...STANDARD_MEASUREMENTS, insulationResistance: 820, insulationAbove: false },
      result: "CAPABLE",
      defectsSummary: "Bez zjištěných závad",
      signaturePng: PNG,
      rememberSignature: true,
      confirmMeasured: true,
      ...extra,
    },
    context,
  );

describe("fáze 108 – budovy: úprava, přesun a smazání", () => {
  it("budovu jde upravit (název, kód, rozměr v metrech) a přesunout; přes jinou halu ani mimo areál ne", async () => {
    await updateBuilding(prisma, { buildingId: "b", name: "Hala A – Lisovna", code: "A1", shortName: "Lisovna", map: { x: 40, y: 28, w: 80, h: 56 } });
    expect(await prisma.building.findUnique({ where: { id: "b" }, select: { name: true, code: true, shortName: true, mapPolygon: true } })).toEqual({
      name: "Hala A – Lisovna",
      code: "A1",
      shortName: "Lisovna",
      mapPolygon: "10,10 30,10 30,30 10,30",
    });
    await expect(updateBuilding(prisma, { buildingId: "b", name: "Hala A", code: "B" })).rejects.toThrow(/kód|B/);
    await expect(moveBuilding(prisma, "b", { x: 62, y: 62, w: 10, h: 10 })).rejects.toThrow(/Hala B/);
    await expect(moveBuilding(prisma, "b", { x: 95, y: 10, w: 20, h: 20 })).rejects.toThrow(/mimo areál/);
    await moveBuilding(prisma, "b", { x: 10, y: 50, w: 20, h: 20 });
    expect((await prisma.building.findUniqueOrThrow({ where: { id: "b" } })).mapPolygon).toBe("10,50 30,50 30,70 10,70");
  });

  it("budovu se zařízeními a revizemi smaže jen opsaný název; smazání zmizí z DB a zapíše se do bezpečnostního deníku", async () => {
    const created = await profile();
    await sign(created.id);
    const impact = await buildingImpact(prisma, "b");
    expect(impact).toMatchObject({ floors: 1, equipment: 2, inspections: 2 });
    await expect(deleteBuilding(prisma, { buildingId: "b", confirmName: "Hala" })).rejects.toThrow(/opište/);
    const result = await deleteBuilding(prisma, { buildingId: "b", confirmName: "hala a", actorId: "u-maint" });
    expect(result).toMatchObject({ plantId: "p", name: "Hala A" });
    expect(await prisma.building.count({ where: { id: "b" } })).toBe(0);
    expect(await prisma.equipment.count({ where: { floorId: "f" } })).toBe(0);
    const event = await prisma.securityEvent.findFirstOrThrow({ where: { kind: "BUILDING_DELETED" } });
    expect(JSON.parse(event.detail ?? "{}")).toMatchObject({ buildingId: "b", name: "Hala A", equipment: 2 });
    // Prázdnou budovu jde smazat bez opisování
    await deleteBuilding(prisma, { buildingId: "b2" });
    expect(await prisma.building.count({ where: { plantId: "p" } })).toBe(0);
  });

  it("vybrané zařízení v hale jde smazat (s historií revizí jen po opsání označení)", async () => {
    // Rozváděč má revizi výkresu (dokumentaci) – bez opsání označení se nesmaže
    await expect(deleteEquipment(prisma, { equipmentId: "eq-R-CNC-04" })).rejects.toThrow(/opište jeho označení/);
    await deleteEquipment(prisma, { equipmentId: "eq-R-CNC-04", confirmTag: "r-cnc-04" });
    expect(await prisma.equipment.count({ where: { id: "eq-R-CNC-04" } })).toBe(0);
    expect(await prisma.equipment.count({ where: { id: "eq-R-LIS-01" } })).toBe(1);
  });
});

describe("fáze 108 – formulář revizního technika a podpis", () => {
  it("uloží TIČR číslo, kontakty, přístroj a měření, vygeneruje protokol s pečetí SHA-256 a časem / IP podpisu", async () => {
    const created = await profile();
    expect(created).toMatchObject({ certificateNo: "1248/23/R-EZ-E2A", email: "dvorak@revize.example", ico: "27074358", locked: false });
    expect(await prisma.inspectorProfile.findUniqueOrThrow({ where: { id: created.id }, select: { pinHash: true } })).toEqual({ pinHash: expect.stringMatching(/^scrypt\$/) });

    const signed = await sign(created.id);
    expect(signed.count).toBe(2);
    expect(signed.sealHash).toMatch(/^[0-9a-f]{64}$/);
    const records = await prisma.inspectionRecord.findMany({ where: { reportNumber: signed.reportNumber }, orderBy: { equipmentId: "asc" } });
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      inspectorName: "Ing. Martin Dvořák",
      inspectorLicense: "1248/23/R-EZ-E2A",
      inspectorScope: "E2A",
      inspectorEmail: "dvorak@revize.example",
      inspectorPhone: "+420 777 123 456",
      inspectorAuthorization: "OPR-0815/2024",
      inspectorCompany: "Revize Dvořák s.r.o.",
      insulationResistance: 820,
      protectiveConductorResistance: 0.05,
      shortCircuitA: 657,
      connectionsOk: true,
      signedIp: "203.0.113.7",
      signedDevice: "Chrome · Windows",
      pinVerified: true,
      sealHash: signed.sealHash,
      sealVersion: 1,
      signatureUrl: "/api/files/attachments/sig-108.png",
      reportUrl: "/api/files/documents/report-108.svg",
    });
    expect(records[0].signedAt?.toISOString()).toBe(NOW.toISOString());
    expect(records[0].measuringInstrument).toContain("Kalibrační list č. KL-2026-0842");
    expect(records[0].actsPerformed).toContain("Izolační odpor R_iso 820 MΩ při 500 V DC");
    // Pečeť = SHA-256 kanonického obsahu uložených údajů
    expect(sha256(sealPayload(records))).toBe(signed.sealHash);
    // Protokol (SVG) nese pečeť, razítko TIČR a časové razítko v patičce
    const svg = stored.at(-1) ?? "";
    expect(svg).toContain(`Pečeť SHA-256: ${signed.sealHash}`);
    expect(svg).toContain("Osv. TIČR č. 1248/23/R-EZ-E2A");
    expect(svg).toContain("2026-11-13 09:00:00 UTC");
    expect(svg).toContain("IP 203.0.113.7");
    expect(svg).not.toContain("Demo dokument");
    // Podpis se uložil do profilu, revize platí a událost je v auditu
    expect((await prisma.inspectorProfile.findUniqueOrThrow({ where: { id: created.id } })).signatureUrl).toBe("/api/files/attachments/sig-108.png");
    expect(await prisma.securityEvent.count({ where: { kind: "REVISION_SIGNED" } })).toBe(1);
    expect(await verifySeal(prisma, records[0].id)).toMatchObject({ status: "VALID", count: 2 });
  });

  it("změna údaje po podpisu = pečeť nesouhlasí; chybný PIN se zapíše do auditu a po 5 pokusech podpis zamkne", async () => {
    const created = await profile();
    const signed = await sign(created.id);
    await prisma.inspectionRecord.update({ where: { id: signed.recordIds[0] }, data: { insulationResistance: 0.4 } });
    expect(await verifySeal(prisma, signed.recordIds[0])).toMatchObject({ status: "TAMPERED" });

    await expect(sign(created.id, { pin: "000000" })).rejects.toThrow(/Chybný PIN \(zbývá 4/);
    expect(await prisma.securityEvent.count({ where: { kind: "INSPECTOR_PIN_FAILED" } })).toBe(1);
    for (let attempt = 0; attempt < 4; attempt++) await expect(sign(created.id, { pin: "000000" })).rejects.toThrow(WorkflowError);
    await expect(sign(created.id)).rejects.toThrow(/zablokovaný/);
    await expect(sign(created.id, { confirmMeasured: false })).rejects.toThrow(/skutečnému měření/);
  });

  it("vrstva B: k uzamčené revizi se připojí jen PDF s podpisem PAdES – jednou pro celý protokol", async () => {
    const created = await profile();
    const signed = await sign(created.id);
    const storePdf = async () => "/api/files/documents/signed-108.pdf";
    await expect(attachPades(prisma, { inspectionId: signed.recordIds[0], bytes: new TextEncoder().encode("%PDF-1.7\n<< /Type /Page >>") }, { storePdf })).rejects.toThrow(/neobsahuje elektronický podpis/);
    const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj << /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 840 4936 1200] /Contents <3082> >> endobj");
    const attached = await attachPades(prisma, { inspectionId: signed.recordIds[0], bytes: pdf }, { storePdf, now: NOW });
    expect(attached).toMatchObject({ url: "/api/files/documents/signed-108.pdf", count: 2 });
    expect(await prisma.inspectionRecord.count({ where: { padesUrl: "/api/files/documents/signed-108.pdf" } })).toBe(2);
    await expect(attachPades(prisma, { inspectionId: signed.recordIds[1], bytes: pdf }, { storePdf })).rejects.toThrow(/už je připojený/);
  });
});

describe("fáze 108 – měsíční report TIČR a ochrana proti zneužití", () => {
  it("vypíše všechny revize pod číslem osvědčení v měsíci a technik zneplatní cizí záznam (blok + audit + lhůta)", async () => {
    const created = await profile();
    const signed = await sign(created.id);
    // Cizí revize pod stejným číslem (jiný zápis čísla), kterou technik neprovedl
    const forged = await prisma.inspectionRecord.create({
      data: {
        equipmentId: "eq-R-CNC-04",
        type: "PERIODIC",
        inspectionDate: new Date("2026-11-20T10:00:00Z"),
        validUntil: new Date("2030-11-20T10:00:00Z"),
        reportNumber: "FAKE-77",
        inspectorName: "Martin Dvořák",
        inspectorLicense: "1248/23/r-ez-e2a (E2A)",
        result: "CAPABLE",
        reportUrl: "/api/files/documents/fake.svg",
      },
    });
    // Jiné číslo osvědčení se do reportu nedostane
    await prisma.inspectionRecord.create({
      data: { equipmentId: "eq-R-LIS-01", type: "PERIODIC", inspectionDate: new Date("2026-11-05T10:00:00Z"), validUntil: new Date("2029-11-05T10:00:00Z"), reportNumber: "JINY-1", inspectorName: "Jan Jiný", inspectorLicense: "9999/20/R-EZ-E1A", result: "CAPABLE", reportUrl: "/api/files/documents/x.svg" },
    });

    const report = await monthlyReport(prisma, { certificateNo: "1248/23/R-EZ-E2A", month: "2026-11", plant: { id: "p" } });
    expect(report.totals).toMatchObject({ count: 3, signed: 2, flagged: 0 });
    expect(report.rows.map((row) => row.reportNumber)).toEqual([signed.reportNumber, signed.reportNumber, "FAKE-77"]);
    expect(report.rows[0]).toMatchObject({ ip: "203.0.113.7", device: "Chrome · Windows", sealHash: signed.sealHash, plantName: "Testovací závod", buildingName: "Hala A" });
    expect(report.label).toBe("Listopad 2026");

    // Jiný technik (jiné číslo osvědčení) cizí záznam zneplatnit nesmí
    const other = await saveInspectorProfile(prisma, { plantId: "p", name: "Jan Jiný", certificateNo: "9999/20/R-EZ-E1A", pin: "1111" });
    await expect(flagMisuse(prisma, { inspectionId: forged.id, inspectorProfileId: other.id, pin: "1111" })).rejects.toThrow(/není vystavený pod vaším číslem/);
    await expect(flagMisuse(prisma, { inspectionId: forged.id, inspectorProfileId: created.id, pin: "999999" })).rejects.toThrow(/Chybný PIN/);

    const flagged = await flagMisuse(prisma, { inspectionId: forged.id, inspectorProfileId: created.id, pin: PIN, note: "Ten den jsem byl jinde." }, { now: NOW, actorId: "u-maint" });
    expect(flagged).toMatchObject({ already: false });
    expect(await prisma.inspectionRecord.findUniqueOrThrow({ where: { id: forged.id }, select: { misuseFlaggedAt: true, misuseNote: true } })).toEqual({ misuseFlaggedAt: NOW, misuseNote: "Ten den jsem byl jinde." });
    const event = await prisma.securityEvent.findFirstOrThrow({ where: { kind: "REVISION_MISUSE" } });
    expect(JSON.parse(event.detail ?? "{}")).toMatchObject({ inspectionId: forged.id, reportNumber: "FAKE-77" });

    // Zneplatněná revize se do lhůty nepočítá – platí podepsaná revize technika
    const records = await prisma.inspectionRecord.findMany({ where: { equipmentId: "eq-R-CNC-04" } });
    expect(summarizeInspections(records, NOW).validUntil?.toISOString()).toBe(records.find((entry) => entry.reportNumber === signed.reportNumber)?.validUntil.toISOString());

    const after = await monthlyReport(prisma, { certificateNo: "1248/23/R-EZ-E2A", month: "2026-11", plant: { id: "p" } });
    expect(after.totals.flagged).toBe(1);
    const csv = monthlyCsv(after);
    expect(csv.startsWith("﻿Datum a čas podpisu (UTC);Závod")).toBe(true);
    expect(csv).toContain("ZNEPLATNĚNO – podezření ze zneužití osvědčení");
    expect(csv).toContain(signed.sealHash);
  });

  it("měsíční e-mail: ručně ihned a automaticky 1. den v měsíci jen jednou za měsíc", async () => {
    const created = await profile();
    await sign(created.id);
    const sent: { to: string[]; subject: string; text: string }[] = [];
    const transport = async (message: { to: string[]; subject: string; text: string }) => {
      sent.push(message);
    };
    const manual = await sendMonthlyReport(prisma, { profileId: created.id, month: "2026-11", origin: "https://eldock.cz", transport, triggeredBy: "u-maint" });
    expect(manual).toMatchObject({ delivery: "SENT", to: "dvorak@revize.example", count: 2 });
    expect(sent[0].subject).toBe("Kontrolní report revizí TIČR 1248/23/R-EZ-E2A – Listopad 2026");
    expect(sent[0].text).toContain("https://eldock.cz/inspections/ticr?month=2026-11");

    await prisma.inspectorProfile.update({ where: { id: created.id }, data: { monthlyEmail: true } });
    expect(await sendDueMonthlyReports(prisma, { now: new Date("2026-11-30T09:00:00Z"), origin: "https://eldock.cz", transport })).toEqual([]);
    const first = await sendDueMonthlyReports(prisma, { now: new Date("2026-12-01T07:00:00Z"), origin: "https://eldock.cz", transport });
    expect(first).toHaveLength(1);
    expect(sent.at(-1)?.subject).toContain("Listopad 2026");
    expect(await sendDueMonthlyReports(prisma, { now: new Date("2026-12-01T15:00:00Z"), origin: "https://eldock.cz", transport })).toEqual([]);
    expect(await prisma.notificationLog.count({ where: { kind: "TICR_MONTHLY" } })).toBe(2);
  });
});
