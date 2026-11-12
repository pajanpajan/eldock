import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { inspectionSchema, snapshotParse, snapshotStringify, versionBadge } from "@/lib/switchboard-versions";
import { redlineStatusLabel } from "@/lib/redline-marketplace";

import { deletePanelProjects } from "./panel-projects";
import { createLabelBatch, ensureProjectLabel, labelBatches, pairLabelWithEquipment, pairLabelWithProject, resolveLabel } from "./qr-labels";
import { authenticateDesigner, claimTask, createPoolDesigner, routeChangeRequest, submitPoolRevision, taskPackage } from "./redlines";
import { assertEditable, publishVersion, returnToDraft, submitForInspection, unlockProject } from "./switchboard-versions";
import { createTestDb, seedMinimal } from "./test-db";
import { approveRevision, assignChangeRequest, rejectRevision, submitChangeRequest, uploadRevision } from "./workflow";

// Fáze 103 nad SQLite: verzování dokumentace rozváděče pod QR štítkem (1.0 → odemknutí → 1.1, 1.0 NEAKTUÁLNÍ),
// registr QR štítků (série firmám, čísla se nikdy neopakují), Červenky (pool „kdo první přijme“, firemní projektant).

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
afterEach(() => db.cleanup());

const NOW = new Date("2026-11-12T10:00:00Z");
const company = (id: string, data: { ico?: string; email?: string; productScope?: "PANEL_BUILDER" | "PLANT_MANAGEMENT"; plantId?: string } = {}) =>
  prisma.registeredCompany.create({ data: { id, ico: data.ico ?? "27074358", companyName: `Firma ${id}`, street: "Průmyslová 1", city: "Liberec", zip: "460 01", contactName: `Kontakt ${id}`, email: data.email ?? `${id}@firma.example`, phone: "+420 600 000 000", passwordHash: "x", termsAcceptedAt: NOW, productScope: data.productScope ?? "PANEL_BUILDER", plantId: data.plantId ?? null } });
const project = (id: string, companyId: string, code = "PB-777") => prisma.panelBoardProject.create({ data: { id, code, name: "Rozvaděč RH1", companyId, dominantManufacturer: "ABB", dinRailsCount: 2, modulesPerRail: 12 } });
const INSPECTION = inspectionSchema.parse({ inspectorName: "Ing. Jan Revizní", inspectorCert: "E2A č. 1234/2026", measuredAt: "2026-11-12", insulationMOhm: 550, insulationTestVoltage: 500, peContinuityOhm: 0.04, mechanicalOk: true, verdict: "SAFE" });
const publish = (projectId: string, companyId: string, note: string, floorplan: { name: string; json: string } | null = null) =>
  publishVersion(prisma, { projectId, companyId, inspection: INSPECTION, documentationJson: snapshotStringify({ code: "PB-777", note, thermal: { topTempC: Number.POSITIVE_INFINITY } }), floorplan, now: NOW });

describe("fáze 103 – zamykání a verzování dokumentace rozváděče", () => {
  it("uzamčení vydá Verzi 1.0, odemknutí a nové schválení Verzi 1.1 – Verze 1.0 zůstane v historii jako NEAKTUÁLNÍ", async () => {
    await company("pb");
    await project("prj", "pb");
    const first = await publish("prj", "pb", "první vydání", { name: "FP-001 Rodinný dům", json: "{}" });
    expect(first.version).toBe("1.0");
    expect(first.serial).toMatch(/^EL-\d{6}$/);
    expect(await prisma.panelBoardProject.findUnique({ where: { id: "prj" }, select: { docState: true, qrSerial: true } })).toEqual({ docState: "LOCKED_PUBLISHED", qrSerial: first.serial });
    // štítek z registru je spárovaný a aktivovaný
    expect(await resolveLabel(prisma, first.serial.toLowerCase())).toMatchObject({ targetType: "PANEL_PROJECT", targetId: "prj", batch: { registeredCompanyId: "pb", purpose: "SWITCHBOARD" } });

    // uzamčený rozváděč nejde upravit ani znovu vydat
    await expect(assertEditable(prisma, { projectId: "prj" })).rejects.toThrow(/uzamčený ve schválené verzi/);
    await expect(publish("prj", "pb", "znovu")).rejects.toThrow(/už uzamčený/);

    // 🔓 odemknutí = rozpracovaná Verze 1.1, platná zůstává 1.0
    expect(await unlockProject(prisma, "prj", "pb")).toBe("1.1");
    await expect(assertEditable(prisma, { projectId: "prj" })).resolves.toBeUndefined();
    expect((await prisma.switchboardVersion.findFirst({ where: { projectId: "prj" } }))?.status).toBe("LOCKED_PUBLISHED");

    const second = await publish("prj", "pb", "po úpravě");
    expect(second).toEqual({ version: "1.1", serial: first.serial });
    const versions = await prisma.switchboardVersion.findMany({ where: { projectId: "prj" }, orderBy: { minor: "asc" } });
    expect(versions.map((row) => [row.version, row.status, row.supersededByVersion])).toEqual([
      ["1.0", "SUPERSEDED", "1.1"],
      ["1.1", "LOCKED_PUBLISHED", null],
    ]);
    expect(versionBadge(versions[0].version, versions[0].status, versions[0].supersededByVersion)).toBe("⚠️ NEAKTUÁLNÍ VERZE (1.0) – NAHRAZENO VERZÍ 1.1");
    // neměnné snímky obou verzí zůstávají (i s navázaným půdorysem první verze)
    expect(snapshotParse<{ note: string; thermal: { topTempC: number } }>(versions[0].documentationJson)).toMatchObject({ note: "první vydání", thermal: { topTempC: Number.POSITIVE_INFINITY } });
    expect(versions[0].floorplanName).toBe("FP-001 Rodinný dům");
    expect(snapshotParse<{ note: string }>(versions[1].documentationJson).note).toBe("po úpravě");
    expect(JSON.parse(versions[1].measurementsJson)).toMatchObject({ insulationMOhm: 550, peContinuityOhm: 0.04, verdict: "SAFE" });
    // jediný štítek na rozváděč i po další verzi
    expect(await prisma.qrLabelItem.count({ where: { targetId: "prj" } })).toBe(1);
    // rozváděč s vydanou verzí pod QR štítkem nejde smazat
    await expect(deletePanelProjects(prisma, "pb", ["prj"])).rejects.toThrow(/vydanou dokumentaci pod QR štítkem/);
  });

  it("předání ke kusové zkoušce zamkne úpravy (protokol jde vyplnit dál), vrácení do úprav je odemkne", async () => {
    await company("pb");
    await project("prj", "pb");
    await submitForInspection(prisma, "prj", "pb");
    await expect(assertEditable(prisma, { projectId: "prj" })).rejects.toThrow(/čeká na kusovou zkoušku/);
    await expect(assertEditable(prisma, { projectId: "prj" }, { allowPending: true })).resolves.toBeUndefined();
    await expect(submitForInspection(prisma, "prj", "pb")).rejects.toThrow();
    // cizí firma stav nezmění
    await expect(returnToDraft(prisma, "prj", "cizi")).rejects.toThrow();
    await returnToDraft(prisma, "prj", "pb");
    await expect(assertEditable(prisma, { projectId: "prj" })).resolves.toBeUndefined();
  });
});

describe("fáze 103 – registr QR štítků ELDOCK", () => {
  it("série se trvale přiřadí firmě (podle IČO) a sekvenční čísla EL-xxxxxx se nikdy neopakují – ani souběžně", async () => {
    await company("pb-novak", { ico: "27082440" });
    const first = await createLabelBatch(prisma, { companyName: "Elektro Novák s.r.o.", ico: "27082440", purpose: "SWITCHBOARD", count: 100 });
    expect(first).toMatchObject({ first: "EL-000001", last: "EL-000100", registeredCompanyId: "pb-novak" });
    const [second, third] = await Promise.all([
      createLabelBatch(prisma, { companyName: "Strojírny Kolín a.s.", purpose: "MACHINE", count: 50 }),
      createLabelBatch(prisma, { companyName: "Revize Praha s.r.o.", email: "info@revize.example", purpose: "APPLIANCE", count: 25 }),
    ]);
    expect([second.registeredCompanyId, third.registeredCompanyId]).toEqual([null, null]);
    const items = await prisma.qrLabelItem.findMany({ orderBy: { sequence: "asc" }, select: { sequence: true, serialCode: true, batchId: true } });
    expect(items).toHaveLength(175);
    expect(new Set(items.map((item) => item.serialCode)).size).toBe(175);
    expect(items.map((item) => item.sequence)).toEqual(Array.from({ length: 175 }, (_, index) => index + 1));
    // rozsahy sérií se nepřekrývají
    const ranges = [first, second, third].map((batch) => [batch.firstSequence, batch.lastSequence]).sort((a, b) => a[0] - b[0]);
    for (let index = 1; index < ranges.length; index += 1) expect(ranges[index][0]).toBe(ranges[index - 1][1] + 1);
    expect((await prisma.qrLabelCounter.findUnique({ where: { id: 1 } }))?.lastSequenceNumber).toBe(175);
    // databáze sama odmítne duplicitní sériové číslo
    await expect(prisma.qrLabelItem.create({ data: { sequence: 999_999, serialCode: "EL-000001", batchId: first.id } })).rejects.toThrow();
    // neplatné IČO a nesmyslný počet se nevydají (počítadlo se neposune)
    await expect(createLabelBatch(prisma, { companyName: "X s.r.o.", ico: "12345678", purpose: "SWITCHBOARD", count: 10 })).rejects.toThrow(/IČO/);
    await expect(createLabelBatch(prisma, { companyName: "X s.r.o.", purpose: "SWITCHBOARD", count: 0 })).rejects.toThrow();
    expect((await prisma.qrLabelCounter.findUnique({ where: { id: 1 } }))?.lastSequenceNumber).toBe(175);
    // automatický štítek rozváděče pokračuje v téže řadě
    await project("prj", "pb-novak");
    const serial = await prisma.$transaction((tx) => ensureProjectLabel(tx, { id: "prj", qrSerial: null, companyId: "pb-novak" }, { companyName: "Elektro Novák s.r.o.", ico: "27082440", email: "pb-novak@firma.example" }));
    expect(serial).toBe("EL-000176");
  });

  it("předtištěný štítek spáruje s rozváděčem jen firma, které série patří – podruhé už ne; historie sérií počítá aktivace", async () => {
    await company("pb-novak", { ico: "27082440" });
    await company("pb-cizi", { ico: "25596641" });
    await project("prj-1", "pb-novak", "PB-001");
    await project("prj-2", "pb-novak", "PB-002");
    await project("prj-cizi", "pb-cizi", "PB-003");
    const batch = await createLabelBatch(prisma, { companyName: "Elektro Novák s.r.o.", ico: "27082440", purpose: "SWITCHBOARD", count: 3 });
    await expect(pairLabelWithProject(prisma, { code: "EL-000001", projectId: "prj-cizi", companyId: "pb-cizi" })).rejects.toThrow(/jiné firmě/);
    expect(await pairLabelWithProject(prisma, { code: "el-000001", projectId: "prj-1", companyId: "pb-novak" })).toBe("EL-000001");
    await expect(pairLabelWithProject(prisma, { code: "EL-000001", projectId: "prj-2", companyId: "pb-novak" })).rejects.toThrow(/už spárovaný/);
    await expect(pairLabelWithProject(prisma, { code: "EL-000002", projectId: "prj-1", companyId: "pb-novak" })).rejects.toThrow(/už má štítek EL-000001/);
    const [row] = await labelBatches(prisma);
    expect(row).toMatchObject({ id: batch.id, from: "EL-000001", to: "EL-000003", activated: 1, count: 3 });
  });
});

describe("fáze 103 – štítek se zařízením závodu", () => {
  it("štítek ze série firmy závodu spáruje její uživatel se strojem závodu – zařízení má jen jeden štítek, cizí firma nepáruje", async () => {
    await seedMinimal(prisma);
    await company("zavod", { ico: "27082440", productScope: "PLANT_MANAGEMENT", plantId: "p" });
    await prisma.plant.create({ data: { id: "p2", code: "TS2", name: "Cizí závod", customerName: "Cizí s.r.o." } });
    await company("cizi-zavod", { ico: "25596641", productScope: "PLANT_MANAGEMENT", plantId: "p2" });
    const batch = await createLabelBatch(prisma, { companyName: "Strojírny Test s.r.o.", ico: "27082440", purpose: "MACHINE", count: 2 });
    expect(batch.registeredCompanyId).toBe("zavod");
    await expect(pairLabelWithEquipment(prisma, { code: "EL-000001", equipmentId: "eq-R-LIS-01", companyId: "cizi-zavod" })).rejects.toThrow(/jiné firmě/);
    expect(await pairLabelWithEquipment(prisma, { code: "EL-000001", equipmentId: "eq-R-LIS-01", companyId: "zavod" })).toBe("EL-000001");
    expect(await resolveLabel(prisma, "EL-000001")).toMatchObject({ targetType: "EQUIPMENT", targetId: "eq-R-LIS-01" });
    await expect(pairLabelWithEquipment(prisma, { code: "EL-000002", equipmentId: "eq-R-LIS-01", companyId: "zavod" })).rejects.toThrow(/už má štítek EL-000001/);
    await expect(pairLabelWithEquipment(prisma, { code: "EL-000001", equipmentId: "eq-R-CNC-04", companyId: "zavod" })).rejects.toThrow(/už spárovaný/);
  });
});

describe("fáze 103 – Červenky k překreslení", () => {
  it("ELDOCK Pool: první projektant úkol přijme (CLAIMED), druhý už ho převzít nemůže; odevzdání → v1.1, schválení → v1.0 v archivu a ✅ Zapracováno", async () => {
    await seedMinimal(prisma);
    const maintenance = { id: "u-maint", role: "MAINTENANCE" as const };
    const request = await submitChangeRequest(prisma, maintenance, { equipmentId: "eq-R-LIS-01", note: "Doplněn jistič -F7 B16 pro dílnu" });
    const task = await routeChangeRequest(prisma, { mode: "POOL", changeRequestId: request.id, format: "EPLAN", sheets: 1, rewardCzk: 800, description: "Překreslit list 3", dueAt: "2026-11-20" });
    expect(task).toMatchObject({ mode: "POOL", status: "OPEN", format: "EPLAN", rewardCzk: 800 });

    const jana = await createPoolDesigner(prisma, { name: "Jana Svobodová", email: "Jana@Pool.example" });
    const petr = await createPoolDesigner(prisma, { name: "Petr Dvořák", email: "petr@pool.example" });
    expect(await authenticateDesigner(prisma, "jana@pool.example", jana.code.toLowerCase())).toEqual({ id: jana.id, name: "Jana Svobodová" });
    expect(await authenticateDesigner(prisma, "jana@pool.example", "AAAA-BBBB-CCCC")).toBeNull();

    // souběžné kliknutí dvou projektantů – vyhraje právě jeden
    const results = await Promise.allSettled([claimTask(prisma, task.id, jana.id), claimTask(prisma, task.id, petr.id)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const saved = await prisma.redlineTask.findUniqueOrThrow({ where: { id: task.id }, include: { claimedBy: true } });
    expect(saved.status).toBe("CLAIMED");
    const winner = saved.claimedBy!;
    const loser = winner.id === jana.id ? petr : jana;
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(String(rejected.reason.message)).toBe(`Úkol už přijal projektant ${winner.name}.`);
    await expect(claimTask(prisma, task.id, loser.id)).rejects.toThrow(`Úkol už přijal projektant ${winner.name}.`);
    expect(redlineStatusLabel("POOL", saved.status, winner.name)).toBe(`🔒 Přijato projektantem ${winner.name}`);

    // balíček podkladů jen pro toho, kdo úkol přijal
    await expect(taskPackage(prisma, task.id, loser.id)).rejects.toThrow(/nepřijal/);
    const pack = await taskPackage(prisma, task.id, winner.id);
    expect(pack.fileName).toBe(`eldock-${request.number}-podklady.zip`);
    expect(pack.bytes.subarray(0, 2).toString("latin1")).toBe("PK");

    // odevzdání = nová revize v1.1 čekající na schválení údržbou
    await expect(submitPoolRevision(prisma, { taskId: task.id, designerId: loser.id, pdfUrl: "/api/files/revisions/cizi.pdf", summary: "" })).rejects.toThrow(/nepřijal/);
    const revision = await submitPoolRevision(prisma, { taskId: task.id, designerId: winner.id, pdfUrl: "/api/files/revisions/prekresleno.pdf", cadUrl: "/api/files/attachments/zdroj.zip", summary: "" });
    expect(revision).toMatchObject({ version: "v1.1", status: "PENDING_APPROVAL", schematicFormat: "PDF" });
    expect(await prisma.redlineTask.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ status: "SUBMITTED", revisionId: revision.id, resultCadUrl: "/api/files/attachments/zdroj.zip" });
    await expect(submitPoolRevision(prisma, { taskId: task.id, designerId: winner.id, pdfUrl: "/api/files/revisions/znovu.pdf", summary: "" })).rejects.toThrow(/už je odevzdané/);

    // vrácení k přepracování → projektant pokračuje; nové odevzdání a schválení
    await rejectRevision(prisma, maintenance, { changeRequestId: request.id, comment: "Chybí přečíslování svorek X2" });
    expect((await prisma.redlineTask.findUniqueOrThrow({ where: { id: task.id } })).status).toBe("CLAIMED");
    const fixed = await submitPoolRevision(prisma, { taskId: task.id, designerId: winner.id, pdfUrl: "/api/files/revisions/opraveno.pdf", summary: "Přečíslovány svorky X2" });
    expect(fixed.version).toBe("v1.2");
    await approveRevision(prisma, maintenance, { changeRequestId: request.id });
    const revisions = await prisma.documentRevision.findMany({ where: { equipmentId: "eq-R-LIS-01" }, orderBy: [{ major: "asc" }, { minor: "asc" }], select: { version: true, status: true, author: { select: { name: true } } } });
    expect(revisions.map((row) => [row.version, row.status])).toEqual([
      ["v1.0", "ARCHIVED"],
      ["v1.1", "REJECTED"],
      ["v1.2", "ACTIVE"],
    ]);
    expect(revisions[2].author?.name).toBe(`${winner.name} (ELDOCK Pool)`);
    const done = await prisma.redlineTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(redlineStatusLabel(done.mode, done.status)).toBe("✅ Zapracováno do dokumentace");
  });

  it("firemní projektant (cesta A): Čeká na překreslení → Překresluje se → Hotovo – nahrána nová verze schématu", async () => {
    await seedMinimal(prisma);
    await prisma.plant.update({ where: { id: "p" }, data: { designerName: "Ing. Tomáš Král", designerEmail: "kral@test.example" } });
    const request = await submitChangeRequest(prisma, { id: "u-maint", role: "MAINTENANCE" }, { equipmentId: "eq-R-CNC-04", note: "Přesunutý stykač -K2" });
    const task = await routeChangeRequest(prisma, { mode: "INTERNAL_DESIGNER", changeRequestId: request.id });
    expect(task).toMatchObject({ status: "OPEN", internalName: "Ing. Tomáš Král", internalEmail: "kral@test.example" });
    const label = async () => {
      const row = await prisma.redlineTask.findUniqueOrThrow({ where: { id: task.id } });
      return redlineStatusLabel(row.mode, row.status);
    };
    expect(await label()).toBe("Čeká na překreslení");
    const cae = { id: "u-cae", role: "CAE_ENGINEER" as const };
    await assignChangeRequest(prisma, cae, { changeRequestId: request.id });
    expect(await label()).toBe("Překresluje se");
    await uploadRevision(prisma, cae, { changeRequestId: request.id, schematicUrl: "/api/files/revisions/k2.pdf", schematicFormat: "PDF", summary: "Stykač -K2 přesunut na lištu 2" });
    expect(await label()).toBe("Nahrána nová verze – čeká na schválení údržbou");
    await approveRevision(prisma, { id: "u-maint", role: "MAINTENANCE" }, { changeRequestId: request.id });
    expect(await label()).toBe("Hotovo – nahrána nová verze schématu");
    // uzavřený požadavek už znovu předat nejde
    await expect(routeChangeRequest(prisma, { mode: "POOL", changeRequestId: request.id, format: "PDF", sheets: 1, rewardCzk: 800 })).rejects.toThrow(/Uzavřený/);
  });
});
