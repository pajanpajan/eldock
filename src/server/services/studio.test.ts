import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GRID } from "@/lib/cad-grid";
import { parseLayout } from "@/lib/studio-layout";
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
    { key: "f0", level: 0, usage: "Svařovací linky", zones: [{ key: "z1", x: 0, y: 0, w: 30, h: 18, name: "Linka 1", kind: "PRODUCTION" }, { key: "z2", x: 36, y: 18, w: 18, h: 12, name: "Zázemí", kind: "FACILITIES" }], gates: [{ at: "C10", label: "Vrata" }] },
    { key: "f-1", level: -1, usage: "Rozvodna", zones: [], gates: [] },
  ],
  equipment: [
    { key: "rs", floor: { kind: "draft", key: "f0" }, pos: { x: 48, y: 6 }, roomKey: null, tag: "R-SV-01", name: "Rozváděč svařovny", type: "SWITCHBOARD", parent: { kind: "existing", id: "eq-R-LIS-01" }, circuit: "Pole 3 / QF4", zone: null, isRoot: false },
    { key: "line", floor: { kind: "draft", key: "f0" }, pos: { x: 12, y: 6 }, roomKey: null, tag: "SVL-01", name: "Svařovací linka", type: "PRODUCTION_LINE", parent: { kind: "draft", key: "rs" }, circuit: "Vývod FA1", zone: null, isRoot: false },
    { key: "mw", floor: { kind: "draft", key: "f0" }, pos: { x: 37, y: 19 }, roomKey: "z2", tag: "SP-9001", name: "Mikrovlnka", type: "APPLIANCE", parent: { kind: "draft", key: "rs" }, circuit: "Zásuvkový okruh ZS1", zone: "Zázemí", isRoot: false },
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
    expect(building.floors[1].floorplanSvg).toContain("osa X 54 m × osa Y 30 m");
    expect(building.floors[1].floorplanSvg).toContain("30 m × 18 m (540 m²)");
    expect(building.floors[1].floorplanSvg).toContain("🚪 Vrata");

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

  it("odmítne duplicitní kód budovy, patro, bod mimo půdorys, obsazený bod a místnost přes obvod", async () => {
    await expect(saveStudioBuilding(prisma, draft({ building: { mode: "new", code: "A", name: "Hala A2", type: "PRODUCTION", map: { x: 0, y: 0, w: 5, h: 5 } } }))).rejects.toThrow(/kódem A/);
    await expect(saveStudioBuilding(prisma, draft({ building: { mode: "existing", id: "b" }, floors: [{ key: "x", level: 0, usage: "", zones: [], gates: [] }], equipment: [] }))).rejects.toThrow(/1. NP už v budově existuje/);
    const outside = draft();
    outside.equipment[0] = { ...outside.equipment[0], pos: { x: 60, y: 6 } };
    await expect(saveStudioBuilding(prisma, outside)).rejects.toThrow(/mimo půdorys/);
    const taken = draft();
    taken.equipment[1] = { ...taken.equipment[1], pos: { x: 48, y: 6 } };
    await expect(saveStudioBuilding(prisma, taken)).rejects.toThrow(/SVL-01: bod je už obsazen zařízením R-SV-01/);
    const wide = draft();
    wide.floors[0] = { ...wide.floors[0], zones: [{ key: "w", x: 40, y: 0, w: 20, h: 6, name: "Sklad", kind: "STORAGE" }] };
    await expect(saveStudioBuilding(prisma, wide)).rejects.toThrow("Sklad: přesahuje obvod patra 1. NP (54 × 30 m).");
    // Spotřebiče a nářadí se v místnosti mohou řadit na stejné kotvě
    const twoAppliances = draft();
    twoAppliances.equipment.push({ ...twoAppliances.equipment[2], key: "mw2", tag: "SP-9002" });
    await expect(saveStudioBuilding(prisma, twoAppliances)).resolves.toMatchObject({ equipment: 4 });
  });

  it("do existující budovy přidá patro a osadí zařízení i na stávající patro", async () => {
    const result = await saveStudioBuilding(
      prisma,
      draft({
        building: { mode: "existing", id: "b" },
        floors: [{ key: "n2", level: 1, usage: "Vzduchotechnika", zones: [], gates: [] }],
        equipment: [{ key: "m", floor: { kind: "existing", id: "f" }, pos: { x: 18, y: 18 }, roomKey: null, tag: "ML-09", name: "Linka", type: "PRODUCTION_LINE", parent: { kind: "existing", id: "eq-R-LIS-01" }, circuit: "Vývod FA9", zone: null, isRoot: false }],
      }),
    );
    expect(result).toMatchObject({ buildingId: "b", floors: 1, equipment: 1 });
    expect(await prisma.equipment.findFirstOrThrow({ where: { tag: "ML-09" } })).toMatchObject({ floorId: "f", fedFromEquipmentId: "eq-R-LIS-01" });
  });

  it("nový závod od nuly: závod s rozměrem pozemku, budova, patro a hlavní rozváděč v jedné transakci", async () => {
    const result = await saveStudioBuilding(
      prisma,
      draft({
        plantId: "",
        newPlant: { name: "Závod Turnov – Optika", code: "tur", location: "Nádražní 15, Turnov" },
        campus: { widthM: 300, depthM: 200 },
        floors: [{ key: "f0", level: 0, usage: "Montáž optiky", zones: [], gates: [] }],
        equipment: [{ key: "rm", floor: { kind: "draft", key: "f0" }, pos: { x: 48, y: 6 }, roomKey: null, tag: "RM1", name: "Hlavní rozváděč", type: "SWITCHBOARD", parent: null, circuit: null, zone: null, isRoot: true }],
      }),
    );
    expect(result).toMatchObject({ plantCreated: true, floors: 1, equipment: 1 });
    const plant = await prisma.plant.findUniqueOrThrow({ where: { id: result.plantId }, include: { buildings: { include: { floors: { include: { equipment: true } } } } } });
    expect(plant).toMatchObject({ code: "TUR", city: "Turnov", address: "Nádražní 15", campusWidthM: 300, campusDepthM: 200, campusViewBoxW: 1000, campusViewBoxH: 667 });
    expect(plant.buildings.map((building) => building.code)).toEqual(["C"]);
    expect(plant.buildings[0].floors[0].equipment.map((item) => item.tag)).toEqual(["RM1"]);
  });

  it("nový závod: duplicitní kód, rozměr mimo meze nebo existující budova neprojdou a nic nevznikne", async () => {
    const base = { name: "Závod X", code: "TST", location: "" };
    await expect(saveStudioBuilding(prisma, draft({ newPlant: base }))).rejects.toThrow(/TST už existuje/);
    await expect(saveStudioBuilding(prisma, draft({ newPlant: { ...base, code: "NEW" }, campus: { widthM: 10, depthM: 200 } }))).rejects.toThrow(/Rozměr areálu/);
    await expect(saveStudioBuilding(prisma, draft({ newPlant: { ...base, code: "NEW" }, building: { mode: "existing", id: "b" } }))).rejects.toThrow(/novou budovou/);
    // Odkaz na rozváděč jiného závodu v novém závodě neplatí
    await expect(saveStudioBuilding(prisma, draft({ newPlant: { ...base, code: "NEW" } }))).rejects.toThrow(/R-SV-01/);
    expect(await prisma.plant.count({ where: { code: "NEW" } })).toBe(0);
  });

  it("změna rozměru stávajícího areálu přepočítá polohy budov (metry zůstanou); budova mimo areál neprojde", async () => {
    const result = await saveStudioBuilding(prisma, draft({ campus: { widthM: 800, depthM: 560 }, building: { mode: "new", code: "C", name: "Hala C", type: "PRODUCTION", map: { x: 50, y: 50, w: 10, h: 10 } } }));
    expect(result.campusResized).toBe(true);
    expect(await prisma.plant.findUniqueOrThrow({ where: { id: "p" } })).toMatchObject({ campusWidthM: 800, campusDepthM: 560, campusViewBoxH: 700 });
    expect(await prisma.building.findUniqueOrThrow({ where: { id: "b" } })).toMatchObject({ mapPolygon: "0,0 0.5,0 0.5,0.5" });

    await prisma.building.update({ where: { id: "b" }, data: { mapPolygon: "80,80 95,80 95,95" } });
    await expect(saveStudioBuilding(prisma, draft({ campus: { widthM: 300, depthM: 200 }, building: { mode: "new", code: "D", name: "Hala D", type: "PRODUCTION", map: { x: 1, y: 1, w: 10, h: 10 } } }))).rejects.toThrow(
      /Hala A by po změně rozměru ležela mimo areál 300 × 200 m/,
    );
  });

  it("nové patro uloží studioLayoutJson a stávající patro jde zpětně upravit (piny zůstanou na místě v metrech)", async () => {
    const created = await saveStudioBuilding(prisma, draft());
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: created.buildingId, level: 0 } });
    expect(parseLayout(floor.studioLayoutJson)).toMatchObject({ grid: { cols: 10, rows: 6, stepMeters: 6 }, zones: [{ name: "Linka 1" }, { name: "Zázemí" }], gates: [{ at: "C10" }] });
    const before = await prisma.equipment.findFirstOrThrow({ where: { tag: "SVL-01" } });

    // Úprava: posun stěny Linky 1 a nová místnost, rastr zůstává z JSON
    const layout = parseLayout(floor.studioLayoutJson)!;
    const result = await saveStudioBuilding(
      prisma,
      draft({
        building: { mode: "existing", id: created.buildingId },
        floors: [{ key: "edit", existingId: floor.id, level: 0, usage: "", grid: layout.grid, zones: [{ ...layout.zones[0], w: 36 }, { key: "n", x: 42, y: 0, w: 12, h: 12, name: "Nová dílna", kind: "WORKSHOP" }], gates: layout.gates }],
        equipment: [],
      }),
    );
    expect(result).toMatchObject({ floors: 0, editedFloors: 1 });
    const updated = await prisma.floor.findUniqueOrThrow({ where: { id: floor.id } });
    expect(updated.floorplanSvg).toContain("Nová dílna");
    expect(updated.floorplanSvg).toContain("36 m × 18 m");
    expect(parseLayout(updated.studioLayoutJson)?.zones.map((zone) => zone.name)).toEqual(["Linka 1", "Nová dílna"]);
    const after = await prisma.equipment.findFirstOrThrow({ where: { tag: "SVL-01" } });
    expect(after.pinX).toBeCloseTo(before.pinX, 1);
    expect(after.pinY).toBeCloseTo(before.pinY, 1);
  });

  it("starší patro bez JSON: rozvržení se dopočte ze SVG a piny se přepočítají do nového rámu", async () => {
    // Patro „f“ ze seedMinimal: výchozí půdorys 12 × 8 (obvod 70/70/1050/690)
    await prisma.equipment.update({ where: { id: "eq-R-LIS-01" }, data: { pinX: 5.8, pinY: 95 } }); // roh A12… = (0 m, 42 m)
    await saveStudioBuilding(
      prisma,
      draft({
        building: { mode: "existing", id: "b" },
        floors: [{ key: "edit", existingId: "f", level: 0, usage: "", zones: [{ key: "a", x: 0, y: 0, w: 12, h: 12, name: "Rozvodna", kind: "ELECTRICAL" }], gates: [] }],
        equipment: [],
      }),
    );
    const moved = await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-LIS-01" } });
    // Nový jednotný rám 66 × 42 m: levý dolní roh obvodu
    expect(moved.pinX).toBeCloseTo(5.8, 1);
    expect(moved.pinY).toBeCloseTo(93.6, 1);
    const floor = await prisma.floor.findUniqueOrThrow({ where: { id: "f" } });
    expect(parseLayout(floor.studioLayoutJson)?.grid).toMatchObject({ cols: 12, rows: 8, stepMeters: 6 });
  });

  it("úprava patra cizí budovy neprojde", async () => {
    const created = await saveStudioBuilding(prisma, draft());
    await expect(
      saveStudioBuilding(prisma, draft({ building: { mode: "existing", id: "b" }, floors: [{ key: "x", existingId: (await prisma.floor.findFirstOrThrow({ where: { buildingId: created.buildingId } })).id, level: 0, usage: "", zones: [], gates: [] }], equipment: [] })),
    ).rejects.toThrow(/nepatří/);
  });
});
