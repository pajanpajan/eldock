import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "@/lib/panel-builder/floorplan-editor";

import {
  AUTO_SNAPSHOT_MS,
  MAX_VERSIONS,
  createFloorplan,
  duplicateFloorplan,
  floorplanForProject,
  getFloorplan,
  importBrowserDraft,
  linkGeneratedProject,
  listFloorplanVersions,
  listFloorplans,
  loadFloorplanDraft,
  purgeFloorplan,
  restoreFloorplan,
  restoreFloorplanVersion,
  saveFloorplanDraft,
  saveFloorplanVersion,
  serializeDraft,
  stashDraft,
  trashFloorplan,
  updateFloorplanMeta,
} from "./floorplans";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

const company = (id: string) =>
  prisma.registeredCompany.create({
    data: { id, productScope: "PANEL_BUILDER", ico: "12345678", companyName: `Firma ${id}`, street: "Ulice 1", city: "Liberec", zip: "46001", contactName: "Projektant", email: `${id}@example.cz`, phone: "+420 777 000 000", passwordHash: "x", termsAcceptedAt: new Date() },
  });

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await company("c1");
  await company("c2");
});
afterEach(() => db.cleanup());

const el = (id: string, x: number): EditorElement => ({ id, item: "socket", x, y: 500, room: "Kuchyně", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null });
const draftWith = (count: number): FloorplanDraft => ({ ...emptyDraft(), elements: Array.from({ length: count }, (_, index) => el(`z${index}`, 500 + index * 300)) });
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 7, 10, 0) + minutes * 60_000);
const reasons = async (id: string) => (await listFloorplanVersions(prisma, "c1", id)).map((version) => version.reason);

describe("fáze 64 – půdorys uložený na serveru", () => {
  it("založení, uložení s kontrolou verze, souhrn pro seznam a oddělení firem", async () => {
    const created = await createFloorplan(prisma, "c1", { meta: { name: "  RD Novák ", customerName: "Novák", installationSite: null }, draft: draftWith(2) }, { now: at(0) });
    expect(created.version).toBe(1);
    const [row] = await listFloorplans(prisma, "c1");
    expect(row).toMatchObject({ name: "RD Novák", customerName: "Novák", elementCount: 2, roomCount: 0, floorCount: 1, project: null });

    const saved = await saveFloorplanDraft(prisma, "c1", created.id, { baseVersion: 1, draft: draftWith(3) }, { now: at(1) });
    expect(saved).toMatchObject({ status: "saved", version: 2 });
    expect((await getFloorplan(prisma, "c1", created.id))?.elementCount).toBe(3);
    // Stejný nákres znovu = beze změny verze
    expect((await saveFloorplanDraft(prisma, "c1", created.id, { baseVersion: 2, draft: draftWith(3) }, { now: at(2) })).version).toBe(2);

    // Jiná firma půdorys nevidí ani nezmění
    expect(await listFloorplans(prisma, "c2")).toEqual([]);
    expect(await getFloorplan(prisma, "c2", created.id)).toBeNull();
    await expect(saveFloorplanDraft(prisma, "c2", created.id, { baseVersion: 2, draft: draftWith(1) })).rejects.toThrow("Půdorys nebyl nalezen.");
    await expect(updateFloorplanMeta(prisma, "c2", created.id, { name: "Cizí" })).rejects.toThrow("Půdorys nebyl nalezen.");
    expect(await updateFloorplanMeta(prisma, "c1", created.id, { name: "RD Novák – přízemí", customerName: "", installationSite: "Liberec" })).toEqual({ name: "RD Novák – přízemí", customerName: null, installationSite: "Liberec" });

    // Neplatný nákres se odmítne
    expect(() => serializeDraft({ version: 2 })).toThrow("Půdorys se nepodařilo načíst.");
  });

  it("souběh dvou oken: odmítnuté změny jdou do historie, „Ponechat mou verzi“ přepíše server a jeho stav uloží", async () => {
    const { id } = await createFloorplan(prisma, "c1", { meta: { name: "Souběh" }, draft: draftWith(1) }, { now: at(0) });
    // Okno A uloží
    expect((await saveFloorplanDraft(prisma, "c1", id, { baseVersion: 1, draft: draftWith(2) }, { now: at(1) })).status).toBe("saved");
    // Okno B ukládá ze staré verze 1 → souběh
    const conflict = await saveFloorplanDraft(prisma, "c1", id, { baseVersion: 1, draft: draftWith(5) }, { now: at(2) });
    expect(conflict).toMatchObject({ status: "conflict", version: 2 });
    expect((await loadFloorplanDraft(prisma, "c1", id)).draft.elements).toHaveLength(2);
    const rejected = (await listFloorplanVersions(prisma, "c1", id)).find((version) => version.reason === "CONFLICT");
    expect(rejected).toMatchObject({ elementCount: 5, version: 1 });

    // „Ponechat mou verzi“
    const forced = await saveFloorplanDraft(prisma, "c1", id, { baseVersion: 1, draft: draftWith(5), force: true }, { now: at(3) });
    expect(forced).toMatchObject({ status: "saved", version: 3 });
    expect((await loadFloorplanDraft(prisma, "c1", id)).draft.elements).toHaveLength(5);
    expect((await listFloorplanVersions(prisma, "c1", id)).find((version) => version.reason === "OVERWRITE")).toMatchObject({ elementCount: 2, version: 2 });

    // Záloha ze starší verze z prohlížeče se jen uloží do historie, aktuální stav zůstane
    expect(await stashDraft(prisma, "c1", id, { baseVersion: 1, draft: draftWith(4) }, { now: at(4) })).toMatchObject({ reason: "CONFLICT", label: "Neuložené změny z prohlížeče (ze starší verze)", elementCount: 4 });
    expect(await stashDraft(prisma, "c1", id, { baseVersion: 3, draft: draftWith(5) })).toBeNull();
    expect((await loadFloorplanDraft(prisma, "c1", id)).version).toBe(3);
  });

  it("automatický snímek nejvýš jednou za 10 minut, ručně uložená verze, obnovení jde vrátit a historie drží 30 verzí", async () => {
    const { id } = await createFloorplan(prisma, "c1", { meta: { name: "Historie" }, draft: draftWith(1) }, { now: at(0) });
    await saveFloorplanDraft(prisma, "c1", id, { baseVersion: 1, draft: draftWith(2) }, { now: at(1) });
    expect(await reasons(id)).toEqual(["AUTO"]);
    await saveFloorplanDraft(prisma, "c1", id, { baseVersion: 2, draft: draftWith(3) }, { now: new Date(at(0).getTime() + AUTO_SNAPSHOT_MS) });
    expect(await reasons(id)).toEqual(["AUTO", "AUTO"]);
    expect(await saveFloorplanVersion(prisma, "c1", id, "Před úpravou kuchyně", { now: at(11) })).toMatchObject({ reason: "MANUAL", label: "Před úpravou kuchyně", elementCount: 3 });

    const first = (await listFloorplanVersions(prisma, "c1", id)).at(-1)!;
    expect(first.elementCount).toBe(1);
    const restored = await restoreFloorplanVersion(prisma, "c1", id, first.id, { now: at(12) });
    expect(restored.version).toBe(4);
    expect(restored.draft.elements).toHaveLength(1);
    const versions = await listFloorplanVersions(prisma, "c1", id);
    expect(versions[0]).toMatchObject({ reason: "RESTORE", label: "Stav před obnovením verze č. 1", elementCount: 3 });
    await expect(restoreFloorplanVersion(prisma, "c2", id, first.id)).rejects.toThrow("Půdorys nebyl nalezen.");

    let version = restored.version;
    for (let index = 0; index < MAX_VERSIONS + 5; index++) {
      const result = await saveFloorplanDraft(prisma, "c1", id, { baseVersion: version, draft: draftWith(2 + (index % 5)) }, { now: at(30 + index * 11) });
      version = result.version;
    }
    expect(await listFloorplanVersions(prisma, "c1", id)).toHaveLength(MAX_VERSIONS);
  });

  it("koš: smazání a obnovení, trvalé smazání jen z koše i s historií; kopie bez vazby na rozváděč", async () => {
    const { id } = await createFloorplan(prisma, "c1", { meta: { name: "Byt 2+kk", installationSite: "Praha" }, draft: draftWith(2) }, { now: at(0) });
    const copy = await duplicateFloorplan(prisma, "c1", id, { now: at(1) });
    const copied = await getFloorplan(prisma, "c1", copy.id);
    expect(copied).toMatchObject({ name: "Kopie – Byt 2+kk", installationSite: "Praha", elementCount: 2, project: null });
    expect(await reasons(copy.id)).toEqual(["IMPORT"]);

    await expect(purgeFloorplan(prisma, "c1", id)).rejects.toThrow("Půdorys nebyl nalezen.");
    await trashFloorplan(prisma, "c1", id, { now: at(2) });
    expect((await listFloorplans(prisma, "c1")).map((row) => row.id)).toEqual([copy.id]);
    expect((await listFloorplans(prisma, "c1", { deleted: true })).map((row) => row.id)).toEqual([id]);
    expect(await getFloorplan(prisma, "c1", id)).toBeNull();
    await restoreFloorplan(prisma, "c1", id);
    expect(await getFloorplan(prisma, "c1", id)).not.toBeNull();
    await trashFloorplan(prisma, "c1", id);
    await purgeFloorplan(prisma, "c1", id);
    expect(await prisma.floorplan.count({ where: { id } })).toBe(0);
    expect(await prisma.floorplanVersion.count({ where: { floorplanId: id } })).toBe(0);
  });

  it("převzetí nákresu z prohlížeče se nezdvojí; otevření půdorysu z hotového projektu a vazba po vygenerování rozváděče", async () => {
    const browser = draftWith(4);
    const first = await importBrowserDraft(prisma, "c1", { draft: browser, name: "Půdorys z prohlížeče (7. 11. 2026)" }, { now: at(0) });
    expect(first.created).toBe(true);
    expect(await importBrowserDraft(prisma, "c1", { draft: browser }, { now: at(60) })).toEqual({ id: first.id, created: false });
    expect((await importBrowserDraft(prisma, "c1", { draft: browser }, { now: at(25 * 60) })).created).toBe(true);
    expect(await reasons(first.id)).toEqual(["IMPORT"]);

    const project = await prisma.panelBoardProject.create({ data: { name: "Rozvodnice RD", code: "PB-777", companyId: "c1", customerName: "Novák", installationSite: "Liberec", floorplanJson: JSON.stringify(draftWith(3)) } });
    const opened = await floorplanForProject(prisma, "c1", project.id, { now: at(1) });
    expect(opened.created).toBe(true);
    expect(await getFloorplan(prisma, "c1", opened.id)).toMatchObject({ name: "Půdorys – Rozvodnice RD", customerName: "Novák", installationSite: "Liberec", elementCount: 3, project: { id: project.id, code: "PB-777" } });
    expect(await floorplanForProject(prisma, "c1", project.id)).toEqual({ id: opened.id, created: false });
    await expect(floorplanForProject(prisma, "c2", project.id)).rejects.toThrow("Projekt nebyl nalezen.");
    const manual = await prisma.panelBoardProject.create({ data: { name: "Ruční návrh", code: "PB-778", companyId: "c1" } });
    await expect(floorplanForProject(prisma, "c1", manual.id)).rejects.toThrow("Projekt nevznikl z 2D půdorysu.");

    // Nové vygenerování rozváděče z upraveného půdorysu: vazba na nový projekt a snímek nákresu
    const regenerated = await prisma.panelBoardProject.create({ data: { name: "Rozvodnice RD v2", code: "PB-779", companyId: "c1", floorplanJson: JSON.stringify(draftWith(6)) } });
    expect(await linkGeneratedProject(prisma, "c1", opened.id, regenerated.id, draftWith(6), { now: at(2) })).toEqual({ code: "PB-779" });
    expect((await getFloorplan(prisma, "c1", opened.id))?.project?.code).toBe("PB-779");
    expect((await listFloorplanVersions(prisma, "c1", opened.id))[0]).toMatchObject({ reason: "GENERATE", label: "Vygenerován rozváděč PB-779", elementCount: 6 });
    await expect(linkGeneratedProject(prisma, "c2", opened.id, regenerated.id, draftWith(6))).rejects.toThrow("Půdorys nebyl nalezen.");
    // Smazaný projekt vazbu uvolní
    await prisma.panelBoardProject.delete({ where: { id: regenerated.id } });
    expect((await getFloorplan(prisma, "c1", opened.id))?.project).toBeNull();
  });
});
