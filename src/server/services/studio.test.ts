import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GRID } from "@/lib/cad-grid";
import type { StudioDraft } from "@/lib/studio-draft";

import { saveStudioBuilding } from "./studio";
import { createTestDb, seedMinimal } from "./test-db";

// Integrační test Studia nad SQLite z migrací.

let db: Awaited<ReturnType<typeof createTestDb>>;
let prisma: PrismaClient;

beforeEach(async () => {
  db = await createTestDb();
  prisma = db.prisma;
  await seedMinimal(prisma);
});
afterEach(async () => db.cleanup());

const draft = (overrides: Partial<StudioDraft> = {}): StudioDraft => ({
  plantId: "p",
  grid: { ...DEFAULT_GRID, cols: 10, rows: 6 },
  building: { mode: "new", code: "c", name: "Hala C - Svařovna", type: "PRODUCTION", map: { x: 10, y: 10, w: 20, h: 15 } },
  floors: [
    { key: "f0", level: 0, usage: "Svařovací linky", zones: [{ from: "A1", to: "C5", name: "Linka 1", kind: "PRODUCTION" }], gates: [{ at: "C10", label: "Vrata" }] },
    { key: "f-1", level: -1, usage: "Rozvodna", zones: [], gates: [] },
  ],
  equipment: [
    { key: "rs", floor: { kind: "draft", key: "f0" }, at: "B9", tag: "R-SV-01", name: "Rozváděč svařovny", type: "SWITCHBOARD", parent: { kind: "existing", id: "eq-R-LIS-01" }, circuit: "Pole 3 / QF4", zone: null, isRoot: false },
    { key: "line", floor: { kind: "draft", key: "f0" }, at: "B3", tag: "SVL-01", name: "Svařovací linka", type: "PRODUCTION_LINE", parent: { kind: "draft", key: "rs" }, circuit: "Vývod FA1", zone: null, isRoot: false },
    { key: "mw", floor: { kind: "draft", key: "f0" }, at: "E2", tag: "SP-9001", name: "Mikrovlnka", type: "APPLIANCE", parent: { kind: "draft", key: "rs" }, circuit: "Zásuvkový okruh ZS1", zone: "Zázemí", isRoot: false },
  ],
  ...overrides,
});

describe("saveStudioBuilding", () => {
  it("v jedné transakci založí budovu, patra s půdorysem a zařízení s hierarchií napájení", async () => {
    const result = await saveStudioBuilding(prisma, draft());
    expect(result).toMatchObject({ floors: 2, equipment: 3 });

    const building = await prisma.building.findUniqueOrThrow({ where: { id: result.buildingId }, include: { floors: { orderBy: { level: "asc" } } } });
    expect(building).toMatchObject({ code: "C", name: "Hala C - Svařovna", mapPolygon: "10,10 30,10 30,25 10,25", labelX: 20, labelY: 17.5 });
    expect(building.floors.map((floor) => [floor.code, floor.name])).toEqual([
      ["1PP", "1. PP - Rozvodna"],
      ["1NP", "1. NP - Svařovací linky"],
    ]);
    expect(building.floors[1].floorplanSvg).toContain("Linka 1");
    expect(building.floors[1].floorplanSvg).toContain("54 m × 30 m");

    const equipment = await prisma.equipment.findMany({ where: { floorId: building.floors[1].id }, include: { fedFrom: { select: { tag: true } } }, orderBy: { tag: "asc" } });
    expect(equipment.map((item) => [item.tag, item.fedFrom?.tag, item.fedFromCircuit])).toEqual([
      ["R-SV-01", "R-LIS-01", "Pole 3 / QF4"],
      ["SP-9001", "R-SV-01", "Zásuvkový okruh ZS1"],
      ["SVL-01", "R-SV-01", "Vývod FA1"],
    ]);
    expect(equipment.find((item) => item.tag === "SP-9001")).toMatchObject({ assignedZone: "Zázemí", inspectionIntervalMonths: 24 });
    expect(equipment.find((item) => item.tag === "SVL-01")).toMatchObject({ pinX: expect.any(Number), inspectionIntervalMonths: 12 });
  });

  it("pravidla hierarchie: stroj bez rozváděče a spotřebič bez místnosti neprojdou, nic se neuloží", async () => {
    const bad = draft();
    bad.equipment[1] = { ...bad.equipment[1], parent: null };
    await expect(saveStudioBuilding(prisma, bad)).rejects.toThrow(/SVL-01: Zařízení musí mít napájecí rozváděč/);
    const noZone = draft();
    noZone.equipment[2] = { ...noZone.equipment[2], zone: null };
    await expect(saveStudioBuilding(prisma, noZone)).rejects.toThrow(/místnost/);
    expect(await prisma.building.count()).toBe(1);
  });

  it("odmítne duplicitní kód budovy, patro a bod mimo rastr", async () => {
    await expect(saveStudioBuilding(prisma, draft({ building: { mode: "new", code: "A", name: "Hala A2", type: "PRODUCTION", map: { x: 0, y: 0, w: 5, h: 5 } } }))).rejects.toThrow(/kódem A/);
    await expect(saveStudioBuilding(prisma, draft({ building: { mode: "existing", id: "b" }, floors: [{ key: "x", level: 0, usage: "", zones: [], gates: [] }], equipment: [] }))).rejects.toThrow(/1. NP už v budově existuje/);
    const outside = draft();
    outside.equipment[0] = { ...outside.equipment[0], at: "H12" };
    await expect(saveStudioBuilding(prisma, outside)).rejects.toThrow(/mimo rastr/);
  });

  it("do existující budovy přidá patro a osadí zařízení i na stávající patro", async () => {
    const result = await saveStudioBuilding(
      prisma,
      draft({
        building: { mode: "existing", id: "b" },
        floors: [{ key: "n2", level: 1, usage: "Vzduchotechnika", zones: [], gates: [] }],
        equipment: [{ key: "m", floor: { kind: "existing", id: "f" }, at: "D4", tag: "ML-09", name: "Linka", type: "PRODUCTION_LINE", parent: { kind: "existing", id: "eq-R-LIS-01" }, circuit: "Vývod FA9", zone: null, isRoot: false }],
      }),
    );
    expect(result).toMatchObject({ buildingId: "b", floors: 1, equipment: 1 });
    expect(await prisma.equipment.findFirstOrThrow({ where: { tag: "ML-09" } })).toMatchObject({ floorId: "f", fedFromEquipmentId: "eq-R-LIS-01" });
  });
});
