import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GRID, gridFromMeters } from "@/lib/cad-grid";
import { parseLayout } from "@/lib/studio-layout";
import type { StudioDraft } from "@/lib/studio-draft";

import { EMPTY_MENU, addTemplate, updateTemplate } from "@/lib/studio-menu";

import { getStudioMenu, saveStudioBuilding, saveStudioConcept, saveStudioMenu, withTag } from "./studio";
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

  it("koncept se dvěma budovami (budova v metrech 114 × 90 m) v jedné transakci; chyba druhé budovy vrátí i první", async () => {
    const base = { plantId: "p", campus: null };
    const big = { ...draft(), grid: gridFromMeters(114, 90, 6, "1:200"), building: { mode: "new" as const, code: "C", name: "Hala C - Lisovna", type: "PRODUCTION" as const, map: { x: 10, y: 10, w: 30, h: 30 } } };
    const energy = {
      ...draft(),
      grid: gridFromMeters(24, 18, 6, "1:200"),
      building: { mode: "new" as const, code: "D", name: "Energetika D", type: "ENERGY" as const, map: { x: 60, y: 60, w: 8, h: 8 } },
      floors: [{ key: "e0", level: 0, usage: "Trafostanice", zones: [], gates: [] }],
      equipment: [],
    };
    const results = await saveStudioConcept(prisma, { ...base, buildings: [big, energy] });
    expect(results.map((result) => result.floors)).toEqual([2, 1]);
    const hall = await prisma.building.findUniqueOrThrow({ where: { id: results[0].buildingId }, include: { floors: true } });
    expect(hall.description).toContain("114 × 90 m");
    expect(await prisma.building.count({ where: { plantId: "p" } })).toBe(3);

    // Duplicitní kód druhé budovy → nic z konceptu se neuloží
    await expect(saveStudioConcept(prisma, { ...base, buildings: [{ ...big, building: { ...big.building, code: "E" } }, { ...energy, building: { ...energy.building, code: "E" } }] })).rejects.toThrow(/kódem E/);
    expect(await prisma.building.count({ where: { plantId: "p" } })).toBe(3);
  });

  it("přejmenování stávajícího patra a úprava uloženého zařízení (tag, název, napájení, místnost)", async () => {
    await saveStudioBuilding(
      prisma,
      draft({
        building: { mode: "existing", id: "b" },
        floors: [],
        equipment: [],
        floorRenames: [{ id: "f", usage: "Lisovna a expedice" }],
        equipmentEdits: [{ id: "eq-R-CNC-04", tag: "r-cnc-05", name: "Rozváděč CNC 05", parentId: "eq-R-LIS-01", circuit: "Pole 7 / QF7", zone: "Obrábění" }],
      }),
    );
    expect(await prisma.floor.findUniqueOrThrow({ where: { id: "f" } })).toMatchObject({ name: "1. NP - Lisovna a expedice", description: "Lisovna a expedice" });
    expect(await prisma.equipment.findUniqueOrThrow({ where: { id: "eq-R-CNC-04" } })).toMatchObject({
      tag: "R-CNC-05",
      name: "R-CNC-05 - Rozváděč CNC 05",
      fedFromEquipmentId: "eq-R-LIS-01",
      fedFromCircuit: "Pole 7 / QF7",
      assignedZone: "Obrábění",
    });
    await expect(
      saveStudioBuilding(prisma, draft({ building: { mode: "existing", id: "b" }, floors: [], equipment: [], equipmentEdits: [{ id: "eq-R-CNC-04", tag: "R-LIS-01", name: "x", parentId: null, circuit: null, zone: null }] })),
    ).rejects.toThrow(/R-LIS-01: na patře už zařízení/);
    expect(withTag("R-1", "R-1 - Rozváděč")).toBe("R-1 - Rozváděč");
  });
});

describe("fáze 39: inventář místností v půdorysu a vlastní nabídka", () => {
  const appliance = (key: string, tag: string, name: string, pos: { x: number; y: number }) => ({
    key,
    floor: { kind: "draft" as const, key: "f0" },
    pos,
    roomKey: "z2",
    tag,
    name,
    type: "APPLIANCE" as const,
    parent: { kind: "draft" as const, key: "rs" },
    circuit: "Zásuvkový okruh ZS1",
    zone: "Zázemí",
    isRoot: false,
  });

  it("uložený půdorys má štítky sečtené podle názvu; další kus na stávajícím patře je přepočítá", async () => {
    const base = draft();
    base.equipment.push(appliance("k1", "KAV01", "Kávovar – Zázemí", { x: 38.5, y: 19 }), appliance("k2", "KAV02", "Kávovar – Zázemí", { x: 40, y: 19 }));
    const result = await saveStudioBuilding(prisma, base);
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: result.buildingId, level: 0 } });
    expect(floor.floorplanSvg).toContain("☕ 2× Kávovar");
    // přístroj mimo nabídku má ikonu podle názvu (mikrovlnka 🍲); pevná zařízení (linka, rozváděč) se do štítků nepočítají
    expect(floor.floorplanSvg).toContain("🍲 1× Mikrovlnka");
    expect(floor.floorplanSvg).not.toMatch(/× Svařovací linka|× Rozváděč svařovny/);

    // Druhý koncept: třetí kávovar na stávající patro → štítek se přepočítá
    await saveStudioBuilding(prisma, {
      ...draft(),
      building: { mode: "existing", id: result.buildingId },
      floors: [],
      equipment: [{ ...appliance("k3", "KAV03", "Kávovar – Zázemí", { x: 41.5, y: 19 }), floor: { kind: "existing", id: floor.id }, parent: { kind: "existing", id: "eq-R-LIS-01" } }],
    });
    const after = await prisma.floor.findUniqueOrThrow({ where: { id: floor.id } });
    expect(after.floorplanSvg).toContain("☕ 3× Kávovar");
    expect(after.floorplanSvg).not.toContain("2× Kávovar");
  });

  it("vlastní nabídka tenantu: uloží se, starší verze nepřepíše novější a ikona dlaždice se použije ve štítku", async () => {
    expect(await getStudioMenu(prisma)).toBeNull();
    const added = addTemplate(updateTemplate(EMPTY_MENU, "SP", "coffee", { label: "Kávovar", prefix: "KAV" }, 100), "SP", { label: "Rychlovarná konvice", emoji: "🫖", prefix: "RK" }, 200);
    await saveStudioMenu(prisma, added.menu, null);
    expect((await getStudioMenu(prisma))?.templates.SP?.map((entry) => entry.label)).toContain("Rychlovarná konvice");
    // starší verze (jiný prohlížeč) se zahodí
    const stale = await saveStudioMenu(prisma, { ...EMPTY_MENU, updatedAt: 50 }, null);
    expect(stale.updatedAt).toBe(200);

    const base = draft();
    base.equipment.push(appliance("r1", "RK01", "Rychlovarná konvice – Zázemí", { x: 38.5, y: 19 }));
    const result = await saveStudioBuilding(prisma, base);
    const floor = await prisma.floor.findFirstOrThrow({ where: { buildingId: result.buildingId, level: 0 } });
    expect(floor.floorplanSvg).toContain("🫖 1× Rychlovarná konvice");
  });
});

describe("fáze 40: plnohodnotná úprava stávajících zařízení a budovy ve Studiu", () => {
  const existing = (overrides: Partial<StudioDraft> = {}) => draft({ building: { mode: "existing", id: "b" }, floors: [], equipment: [], ...overrides });
  const kettle = (tag: string, pos: { x: number; y: number }) => ({
    key: tag,
    floor: { kind: "existing" as const, id: "f" },
    pos,
    roomKey: null,
    tag,
    name: "Rychlovarná konvice",
    type: "APPLIANCE" as const,
    parent: { kind: "existing" as const, id: "eq-R-LIS-01" },
    circuit: "Zásuvkový okruh ZS1",
    zone: "Kuchyňka",
    isRoot: false,
  });

  it("smazání uloženého zařízení, přesun pinu v metrech a nová poloha budovy v areálu", async () => {
    await saveStudioBuilding(prisma, existing({ equipment: [kettle("RK01", { x: 6, y: 6 }), kettle("RK02", { x: 7.5, y: 6 })] }));
    const [rk1, rk2] = await prisma.equipment.findMany({ where: { tag: { in: ["RK01", "RK02"] } }, orderBy: { tag: "asc" } });

    // Rozváděč, ze kterého něco napájí, smazat nejde (nejdřív přepojit nebo smazat i odběry)
    await expect(saveStudioBuilding(prisma, existing({ equipmentDeletes: ["eq-R-LIS-01"] }))).rejects.toThrow(/R-LIS-01: napájí .*RK01/);
    // Nadřazený rozváděč nového kusu se nesmí mazat
    await expect(saveStudioBuilding(prisma, existing({ equipment: [{ ...kettle("RK03", { x: 9, y: 6 }), parent: { kind: "existing", id: "eq-R-CNC-04" } }], equipmentDeletes: ["eq-R-CNC-04"] }))).rejects.toThrow(
      /RK03: nadřazený rozváděč se maže/,
    );

    const result = await saveStudioBuilding(
      prisma,
      existing({
        building: { mode: "existing", id: "b", map: { x: 50, y: 40, w: 12, h: 8 } },
        equipmentEdits: [{ id: rk1.id, tag: "RK01", name: "Rychlovarná konvice", parentId: "eq-R-LIS-01", circuit: "Zásuvkový okruh ZS1", zone: "Kuchyňka", pos: { x: 30, y: 18 } }],
        equipmentDeletes: [rk2.id, "eq-R-CNC-04"],
      }),
    );
    expect(result).toMatchObject({ deletedEquipment: 2, editedEquipment: 1 });
    expect(await prisma.equipment.findMany({ where: { id: { in: [rk2.id, "eq-R-CNC-04"] } } })).toEqual([]);
    // Kaskáda: revize smazaného rozváděče zmizely s ním, ostatní data zůstala
    expect(await prisma.documentRevision.count({ where: { equipmentId: "eq-R-CNC-04" } })).toBe(0);
    expect(await prisma.documentRevision.count({ where: { equipmentId: "eq-R-LIS-01" } })).toBe(1);
    const moved = await prisma.equipment.findUniqueOrThrow({ where: { id: rk1.id } });
    expect([moved.pinX, moved.pinY]).not.toEqual([rk1.pinX, rk1.pinY]);
    expect(await prisma.building.findUniqueOrThrow({ where: { id: "b" } })).toMatchObject({ mapPolygon: "50,40 62,40 62,48 50,48", labelX: 56, labelY: 44 });

    // Poloha mimo půdorys a budova mimo areál neprojdou
    await expect(
      saveStudioBuilding(prisma, existing({ equipmentEdits: [{ id: rk1.id, tag: "RK01", name: "x", parentId: "eq-R-LIS-01", circuit: null, zone: null, pos: { x: 900, y: 1 } }] })),
    ).rejects.toThrow(/leží mimo půdorys/);
    await expect(saveStudioBuilding(prisma, existing({ building: { mode: "existing", id: "b", map: { x: 95, y: 95, w: 12, h: 8 } } }))).rejects.toThrow(/mimo areál/);
  });

  it("zařízení s otevřeným požadavkem na změnu ani cizí zařízení smazat nejde – nic se nezmění", async () => {
    await prisma.changeRequest.create({ data: { number: "ZM-2026-0999", equipmentId: "eq-R-CNC-04", reporterId: "u-maint", status: "IN_PROGRESS" } });
    await expect(saveStudioBuilding(prisma, existing({ equipmentDeletes: ["eq-R-CNC-04"] }))).rejects.toThrow(/otevřený požadavek na změnu ZM-2026-0999/);
    await expect(saveStudioBuilding(prisma, existing({ equipmentDeletes: ["neexistuje"] }))).rejects.toThrow(/nepatří/);
    expect(await prisma.equipment.count({ where: { id: "eq-R-CNC-04" } })).toBe(1);
  });
});
