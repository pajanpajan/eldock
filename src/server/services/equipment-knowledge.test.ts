import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { activateSoftwareBackup, addEquipmentDocument, createSoftwareBackup, deleteEquipmentDocument, pendingSoftwareUpdates } from "./equipment-knowledge";
import { createTestDb, seedMinimal } from "./test-db";
import { submitChangeRequest } from "./workflow";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let equipmentId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
  equipmentId = (await prisma.equipment.findFirstOrThrow({ where: { tag: "R-CNC-04" } })).id;
});
afterEach(() => db.cleanup());

const maintenance = { id: "u-maint", role: "MAINTENANCE" as const };
const file = (name: string) => ({ fileUrl: `/api/files/software/${name}`, fileName: name, fileSizeBytes: 2048 });
const plc = { targetUnit: "PLC -A1 (Siemens S7-1500)", platform: "TIA Portal V19" };

describe("verzované zálohy SW (fáze 46)", () => {
  it("v1.0 → Minor v1.1 → Major v2.0: vždy jedna ACTIVE na uzel, starší ARCHIVED; rollback", async () => {
    const first = await createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "Výchozí program", ...file("a.zap19") });
    expect(first).toMatchObject({ major: 1, minor: 0, status: "ACTIVE", authorId: "u-maint" });
    await createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "Úprava časovače T12", ...file("b.zap19") });
    const major = await createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "major", changeSummary: "Nová revize programu", isSafetyRelated: true, safetyChecksum: "0x8f4a2c91", ...file("c.zap19") });
    expect(major).toMatchObject({ major: 2, minor: 0, safetyChecksum: "CRC: 0x8F4A-2C91", isSafetyRelated: true });
    // Jiný uzel stroje má vlastní číslování
    expect(await createSoftwareBackup(prisma, maintenance, { equipmentId, targetUnit: "Měnič -U1", platform: "Parametry měniče VFD", bump: "major", changeSummary: "Parametry vřetene", ...file("u1.par") })).toMatchObject({ major: 1, minor: 0 });
    const rows = await prisma.softwareBackup.findMany({ where: { equipmentId, targetUnit: plc.targetUnit }, orderBy: [{ major: "asc" }, { minor: "asc" }] });
    expect(rows.map((row) => `v${row.major}.${row.minor}:${row.status}`)).toEqual(["v1.0:ARCHIVED", "v1.1:ARCHIVED", "v2.0:ACTIVE"]);

    await activateSoftwareBackup(prisma, rows[1].id);
    const after = await prisma.softwareBackup.findMany({ where: { equipmentId, targetUnit: plc.targetUnit, status: "ACTIVE" } });
    expect(after.map((row) => `v${row.major}.${row.minor}`)).toEqual(["v1.1"]);
  });

  it("povinný popis změny, CRC u bezpečnostního programu a soubor ze správného úložiště", async () => {
    await expect(createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "x", ...file("a.zap19") })).rejects.toThrow(/Popis změny/);
    await expect(createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "Safety úprava", isSafetyRelated: true, safetyChecksum: "", ...file("a.zap19") })).rejects.toThrow(/kontrolní součet/);
    await expect(createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "Program", fileUrl: "/api/files/photos/x.zap19", fileName: "x.zap19", fileSizeBytes: 10 })).rejects.toBeInstanceOf(WorkflowError);
  });

  it("změna z Červenky: klasifikace, záloha přiložená v průvodci a úkol „čeká na zálohu SW“", async () => {
    const withBackup = await submitChangeRequest(prisma, maintenance, {
      equipmentId,
      note: "Výměna safety relé a úprava programu",
      safetyImpact: "SUBSTANTIAL_SAFETY_MOD",
      softwareBackup: { ...plc, ...file("cr.zap19"), isSafetyRelated: true, safetyChecksum: "CRC: 0x1234-ABCD" },
    });
    expect(withBackup).toMatchObject({ safetyImpact: "SUBSTANTIAL_SAFETY_MOD", requiresSoftwareUpdate: true });
    const backup = await prisma.softwareBackup.findFirstOrThrow({ where: { changeRequestId: withBackup.id } });
    expect(backup).toMatchObject({ major: 1, minor: 0, status: "ACTIVE", safetyChecksum: "CRC: 0x1234-ABCD" });
    expect(backup.changeSummary).toContain(withBackup.number);
    expect((await pendingSoftwareUpdates(prisma, [withBackup.id])).size).toBe(0);

    const other = (await prisma.equipment.findFirstOrThrow({ where: { tag: "R-LIS-01" } })).id;
    const waiting = await submitChangeRequest(prisma, maintenance, { equipmentId: other, note: "Úprava parametrů měniče", requiresSoftwareUpdate: true });
    expect(waiting).toMatchObject({ safetyImpact: "NONE_1_TO_1", requiresSoftwareUpdate: true });
    expect([...(await pendingSoftwareUpdates(prisma, [waiting.id]))]).toEqual([waiting.id]);
    // Záloha z jiného zařízení se ke změně spárovat nedá
    await expect(createSoftwareBackup(prisma, maintenance, { equipmentId, ...plc, bump: "minor", changeSummary: "Cizí změna", changeRequestId: waiting.id, ...file("x.zap19") })).rejects.toThrow(/jinému zařízení/);
  });
});

describe("knihovna návodů a datasheetů", () => {
  it("nahrání s normalizovaným označením komponenty a smazání", async () => {
    const document = await addEquipmentDocument(prisma, maintenance, {
      equipmentId,
      category: "DATASHEET",
      title: "  Datasheet stykače  ",
      componentTag: "k1",
      fileUrl: "/api/files/attachments/abc.pdf",
      fileName: "af09.pdf",
      fileSizeBytes: 120_000,
    });
    expect(document).toMatchObject({ title: "Datasheet stykače", componentTag: "-K1", version: "1.0", language: "cs", uploadedById: "u-maint" });
    await expect(addEquipmentDocument(prisma, maintenance, { equipmentId, category: "MANUAL", title: "Zálohou", fileUrl: "/api/files/software/x.zip", fileName: "x.zip", fileSizeBytes: 1 })).rejects.toBeInstanceOf(WorkflowError);
    await deleteEquipmentDocument(prisma, document.id);
    expect(await prisma.equipmentDocument.count()).toBe(0);
  });
});
