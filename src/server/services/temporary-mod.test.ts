import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { createTemporaryMod, resolveAndConvertToChangeRequest, resolveAsOneToOne } from "./temporary-mod";
import { createTestDb, seedMinimal } from "./test-db";
import { submitChangeRequest, type Actor } from "./workflow";

// Integrační testy nad skutečnou SQLite z migrací: obě větve ukončení provizoria.

const MAINTENANCE: Actor = { id: "u-maint", role: "MAINTENANCE" };
const CAE: Actor = { id: "u-cae", role: "CAE_ENGINEER" };
const NOW = new Date("2026-10-28T10:00:00Z");

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

const create = (equipmentId = "eq-R-LIS-01", days = 14) =>
  createTemporaryMod(
    prisma,
    MAINTENANCE,
    {
      equipmentId,
      title: "Provizorní náhrada stykače K2",
      description: "Stykač K2 nahrazen dočasně typem 3RT2025, čeká se na originál.",
      days,
      photoUrl: "/api/files/photos/k2.jpg",
    },
    NOW,
  );

describe("createTemporaryMod", () => {
  it("založí aktivní provizorium s číslem, autorem a lhůtou, bez zásahu do dokumentace a CAE", async () => {
    const mod = await create();
    expect(mod).toMatchObject({ number: "PROV-2026-0001", status: "ACTIVE", createdByName: "Petr Novák", createdByRole: "Údržba" });
    expect(mod.expiresAt).toEqual(new Date("2026-11-11T10:00:00Z"));
    expect((await create("eq-R-CNC-04", 7)).number).toBe("PROV-2026-0002");
    expect(await prisma.changeRequest.count()).toBe(0);
    expect(await prisma.documentRevision.count({ where: { status: "ACTIVE" } })).toBe(2);
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).status).toBe("ACTIVE");
  });

  it("odmítne jinou lhůtu než 7 / 14 dní a prázdný popis", async () => {
    await expect(createTemporaryMod(prisma, MAINTENANCE, { equipmentId: "eq-R-LIS-01", title: "Test", description: "Popis", days: 30 }, NOW)).rejects.toThrow(/7 nebo 14/);
    await expect(createTemporaryMod(prisma, MAINTENANCE, { equipmentId: "eq-R-LIS-01", title: "Test", description: " ", days: 7 }, NOW)).rejects.toThrow(WorkflowError);
  });
});

describe("resolveAsOneToOne", () => {
  it("uzavře provizorium do archivu, oficiální schéma i CAE zůstanou nedotčené", async () => {
    const mod = await create();
    const resolved = await resolveAsOneToOne(prisma, MAINTENANCE, { id: mod.id, note: "Dodán originální stykač Siemens 3RT2026." }, NOW);
    expect(resolved).toMatchObject({ status: "RESTORED_1_TO_1", resolvedByName: "Petr Novák", resolutionNote: "Dodán originální stykač Siemens 3RT2026.", spawnedChangeRequestId: null });
    expect(resolved.resolvedAt).toEqual(NOW);
    expect(await prisma.changeRequest.count()).toBe(0);
    expect(await prisma.documentRevision.count()).toBe(2);
  });

  it("bez poznámky doplní výchozí text a podruhé ukončit nejde", async () => {
    const mod = await create();
    expect((await resolveAsOneToOne(prisma, MAINTENANCE, { id: mod.id }, NOW)).resolutionNote).toMatch(/1:1/);
    await expect(resolveAsOneToOne(prisma, MAINTENANCE, { id: mod.id }, NOW)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("resolveAndConvertToChangeRequest", () => {
  it("v jedné transakci uzavře provizorium a založí požadavek na změnu pro CAE", async () => {
    const mod = await create();
    const result = await resolveAndConvertToChangeRequest(
      prisma,
      MAINTENANCE,
      { id: mod.id, note: "Finálně osazen stykač jiného typu, přepojena svorka A2.", photoUrl: "/api/files/photos/final.jpg" },
      NOW,
    );
    expect(result.appended).toBe(false);
    expect(result.temporaryMod).toMatchObject({ status: "CONVERTED_TO_CR", spawnedChangeRequestId: result.changeRequest.id });

    const changeRequest = await prisma.changeRequest.findUniqueOrThrow({ where: { id: result.changeRequest.id }, include: { attachments: true, events: true } });
    expect(changeRequest).toMatchObject({ status: "SUBMITTED", priority: "HIGH", reporterId: "u-maint" });
    expect(changeRequest.number).toMatch(/^ZM-\d{4}-0001$/);
    expect(changeRequest.note).toContain(mod.number);
    expect(changeRequest.note).toContain("přepojena svorka A2");
    expect(changeRequest.attachments.map((attachment) => attachment.url)).toEqual(["/api/files/photos/final.jpg"]);
    expect(changeRequest.events.map((event) => event.type)).toEqual(["SUBMITTED"]);
    // Zařízení zoranžovělo (čeká na aktualizaci dokumentace).
    expect((await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } })).status).toBe("PENDING_UPDATE");
  });

  it("má-li zařízení otevřený požadavek, doplní do něj komentář místo druhého ticketu", async () => {
    const open = await submitChangeRequest(prisma, MAINTENANCE, { equipmentId: "eq-R-CNC-04", note: "Vyměněn stykač K4." });
    const mod = await create("eq-R-CNC-04", 7);
    const result = await resolveAndConvertToChangeRequest(prisma, MAINTENANCE, { id: mod.id, note: "Finální stav jiný než ve schématu." }, NOW);
    expect(result.appended).toBe(true);
    expect(result.changeRequest.id).toBe(open.id);
    expect(await prisma.changeRequest.count()).toBe(1);
    const events = await prisma.changeRequestEvent.findMany({ where: { changeRequestId: open.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((event) => event.type)).toEqual(["SUBMITTED", "COMMENT"]);
  });

  it("chyba při založení požadavku vrátí vše zpět (provizorium zůstane aktivní)", async () => {
    const mod = await create();
    // CAE projektant nesmí zadávat změny → transakce se celá zruší.
    await expect(resolveAndConvertToChangeRequest(prisma, CAE, { id: mod.id, note: "Jiné zapojení." }, NOW)).rejects.toBeInstanceOf(WorkflowError);
    expect((await prisma.temporaryModification.findUniqueOrThrow({ where: { id: mod.id } })).status).toBe("ACTIVE");
    expect(await prisma.changeRequest.count()).toBe(0);
  });

  it("vyžaduje popis finálního stavu", async () => {
    const mod = await create();
    await expect(resolveAndConvertToChangeRequest(prisma, MAINTENANCE, { id: mod.id, note: " " }, NOW)).rejects.toThrow(/finální zapojení/);
  });
});
