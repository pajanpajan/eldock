import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { emptyDraft } from "@/lib/panel-builder/floorplan-editor";
import { addTemplate, emptyLibrary, toggleFavorite } from "@/lib/panel-builder/floorplan-library";

import { seedPanelBuilder } from "../../../prisma/seed-panel-builder";
import { createFloorplan, duplicateFloorplan, floorplanLibraryOf, listFloorplans, nextFloorplanCode, saveFloorplanLibrary, trashFloorplan } from "./floorplans";
import { createTestDb } from "./test-db";

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;
let companyId: string;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedPanelBuilder(prisma, { external: false });
  companyId = (await prisma.panelBoardProject.findUniqueOrThrow({ where: { code: "PB-001" } })).companyId!;
});
afterEach(() => db.cleanup());

describe("fáze 78 – kód půdorysu a knihovna firmy", () => {
  it("kód FP-001, FP-002 … v pořadí založení ve firmě, kopie dostane nový kód, smazaný v koši se neopakuje", async () => {
    const first = await createFloorplan(prisma, companyId, { meta: { name: "RD Novákovi" }, draft: emptyDraft() });
    const second = await createFloorplan(prisma, companyId, { meta: { name: "Byt 2+kk" }, draft: emptyDraft() });
    expect([first.code, second.code]).toEqual(["FP-001", "FP-002"]);
    const copy = await duplicateFloorplan(prisma, companyId, first.id);
    expect(copy.code).toBe("FP-003");
    await trashFloorplan(prisma, companyId, copy.id);
    expect(await nextFloorplanCode(prisma, companyId)).toBe("FP-004");
    // Seznam nese kód (editor „📂 Moje uložené půdorysy“)
    expect((await listFloorplans(prisma, companyId)).map((row) => row.code).sort()).toEqual(["FP-001", "FP-002"]);
    // Jiná firma čísluje od začátku
    const other = await prisma.registeredCompany.findFirstOrThrow({ where: { id: { not: companyId } }, select: { id: true } }).catch(() => null);
    if (other) expect(await nextFloorplanCode(prisma, other.id)).toBe("FP-001");
  });

  it("knihovna firmy: šablony a oblíbené se uloží, starší knihovna z jiného prohlížeče nepřepíše novější", async () => {
    expect(await floorplanLibraryOf(prisma, companyId)).toEqual(emptyLibrary());
    const added = addTemplate(emptyLibrary(), ["double-socket", "data-socket"], "Sestava TV stěna 3R", 2000);
    if ("error" in added) throw new Error(added.error);
    const newer = toggleFavorite(added.library, "item:socket", 3000);
    expect((await saveFloorplanLibrary(prisma, companyId, newer)).saved).toBe(true);
    // Starší stav (updatedAt 2000) se nezapíše
    expect((await saveFloorplanLibrary(prisma, companyId, added.library)).saved).toBe(false);
    const stored = await floorplanLibraryOf(prisma, companyId);
    expect(stored.templates.map((template) => template.label)).toEqual(["Sestava TV stěna 3R"]);
    expect(stored.favorites).toEqual(["item:socket"]);
    await expect(saveFloorplanLibrary(prisma, companyId, "nesmysl")).rejects.toThrow("Neplatná knihovna");
  });
});
