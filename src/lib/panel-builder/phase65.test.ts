import { describe, expect, it } from "vitest";

import { MERGE_GAP_MM, balancedChunks, planSocketGroups, type SocketPoint } from "@/engine/socket-zones";

import { analyzeDraft, emptyDraft, parseDraft, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { assignSocketCircuit, moveSocketsToCircuit, nextSocketCircuit, optimizeSocketCircuits, socketCircuitRows, usedSocketCircuits } from "./socket-circuits";

const el = (id: string, item: string, x: number, y: number, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x, y, room: "Místnost 1", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const room = (name: string, x: number, y: number, w: number, h: number): EditorRoom => ({ id: `m-${name}`, name, x, y, w, h });
const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
/** Největší vzdálenost dvou zásuvek jednoho okruhu [mm]. */
const span = (points: readonly SocketPoint[]) => Math.max(0, ...points.flatMap((a) => points.map((b) => manhattan(a, b))));

/** Zásuvky po obvodu místnosti 14 × 10 m po 1,2 m, rozváděč uprostřed (jako půdorys bytu bez zakreslených místností). */
function perimeter(panel = { x: 7000, y: 5000 }): SocketPoint[] {
  const points: SocketPoint[] = [];
  const push = (x: number, y: number) => points.push({ id: `z${points.length + 1}`, room: "Místnost 1", floor: "", x, y, home: manhattan({ x, y }, panel), weight: 1 });
  for (let x = 600; x < 14000; x += 1200) push(x, 0);
  for (let y = 600; y < 10000; y += 1200) push(14000, y);
  for (let x = 13400; x > 0; x -= 1200) push(x, 10000);
  for (let y = 9400; y > 0; y -= 1200) push(0, y);
  return points;
}

describe("fáze 65 – zásuvkové okruhy v kompaktních zónách", () => {
  it("velká místnost s rozváděčem uprostřed: dosavadní rozdělení tvoří prstence přes celý byt, kompaktní zóny souvislé úseky stěn", () => {
    const points = perimeter();
    const byId = new Map(points.map((point) => [point.id, point]));
    const spans = (grouping: "compact" | "distance") => planSocketGroups(points, { grouping, maxOutlets: 10 }).groups.map((group) => span(group.ids.map((id) => byId.get(id)!)));
    const legacy = spans("distance");
    const compact = spans("compact");
    expect(compact).toHaveLength(legacy.length);
    // Prstenec: okruh sbírá zásuvky ze dvou protilehlých stěn (přes 14 m)
    expect(Math.max(...legacy)).toBeGreaterThan(15_000);
    // Zóna: 10 sousedních zásuvek po 1,2 m na obvodu (přes roh i kratší) – vždy výrazně méně než prstenec
    expect(Math.max(...compact)).toBeLessThanOrEqual(12_000);
    // Každá zásuvka právě v jednom okruhu, nejvýš 10 na okruh
    const groups = planSocketGroups(points, { grouping: "compact", maxOutlets: 10 }).groups;
    expect(groups.flatMap((group) => group.ids).sort()).toEqual(points.map((point) => point.id).sort());
    expect(groups.every((group) => group.weight <= 10)).toBe(true);
  });

  it("místnost se nedělí, pokud se vejde; sousední malé místnosti se spojí, vzdálené ne; po místnostech nikdy nespojí", () => {
    const at = (id: string, roomName: string, x: number, y: number): SocketPoint => ({ id, room: roomName, floor: "", x, y, home: x + y, weight: 1 });
    const points = [at("a1", "Kuchyně", 1000, 1000), at("a2", "Kuchyně", 1500, 1000), at("a3", "Kuchyně", 2000, 1000), at("b1", "Spíž", 2600, 1000), at("b2", "Spíž", 3000, 1000), at("c1", "Garáž", 3000 + MERGE_GAP_MM + 3000, 1000), at("c2", "Garáž", 3000 + MERGE_GAP_MM + 3500, 1000)];
    const rooms = (grouping: "compact" | "rooms" | "distance") => planSocketGroups(points, { grouping, maxOutlets: 10 }).groups.map((group) => group.rooms.join("+"));
    expect(rooms("compact")).toEqual(["Kuchyně+Spíž", "Garáž"]);
    expect(rooms("rooms")).toEqual(["Kuchyně", "Spíž", "Garáž"]);
    // Dosavadní rozdělení mezeru mezi místnostmi nehlídá
    expect(rooms("distance")).toEqual(["Kuchyně+Spíž+Garáž"]);
  });

  it("velká místnost se dělí na vyvážené souvislé úseky (23 zásuvek = 8 + 7 + 8, ne 10 + 10 + 3); víceramček se nerozpůlí", () => {
    const sizes = balancedChunks(Array.from({ length: 23 }, (_, index) => index), () => 1, 10).map((chunk) => chunk.length);
    expect(sizes).toHaveLength(3);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(23);
    expect(balancedChunks([2, 2, 2, 2, 2, 2], (weight) => weight, 10).map((chunk) => chunk.length)).toEqual([3, 3]);
    // Řada 10 zásuvek, uprostřed víceramček 2× – součet 12 → 2 okruhy, rámeček vždy v jednom
    const points: SocketPoint[] = Array.from({ length: 10 }, (_, index) => ({ id: `z${index}`, room: "Obývák", floor: "", x: 1000 + index * 800, y: 500, home: 1000 + index * 800, weight: 1, frame: index === 5 || index === 6 ? "r1" : null }));
    points.push({ id: "z10", room: "Obývák", floor: "", x: 9000, y: 500, home: 9000, weight: 1 }, { id: "z11", room: "Obývák", floor: "", x: 9800, y: 500, home: 9800, weight: 1 });
    const groups = planSocketGroups(points, { grouping: "compact", maxOutlets: 10 }).groups;
    expect(groups).toHaveLength(2);
    expect(groups.filter((group) => group.ids.includes("z5") || group.ids.includes("z6"))).toHaveLength(1);
  });

  it("ruční okruh má přednost, nad 10 zásuvek a přes podlaží jen s varováním; okruh nespojuje podlaží", () => {
    const at = (id: string, floor: string, x: number, manual: string | null = null, weight = 1): SocketPoint => ({ id, room: "Pokoj", floor, x, y: 0, home: x, weight, manual });
    const points = [at("p1", "1", 1000, "Z1"), at("p2", "1", 15_000, "Z1"), at("p3", "1", 2000), at("p4", "2", 2000), at("p5", "2", 3000, "Z2", 2), ...Array.from({ length: 6 }, (_, index) => at(`p${6 + index}`, "1", 4000 + index * 100, "Z3", 2))];
    const { groups, warnings } = planSocketGroups(points, { grouping: "compact", maxOutlets: 10 });
    expect(groups.find((group) => group.manual === "Z1")?.ids.sort()).toEqual(["p1", "p2"]);
    expect(warnings.some((warning) => warning.startsWith("Ruční okruh Z3: 12 zásuvek"))).toBe(true);
    // Automatické zásuvky dvou podlaží nikdy v jednom okruhu
    const auto = groups.filter((group) => !group.manual);
    expect(auto.every((group) => new Set(group.ids.map((id) => points.find((point) => point.id === id)!.floor)).size === 1)).toBe(true);
    const split = planSocketGroups([at("q1", "1", 1000, "Z4"), at("q2", "2", 1000, "Z4")], { maxOutlets: 10 });
    expect(split.groups).toHaveLength(2);
    expect(split.warnings[0]).toContain("rozdělen po podlažích");
  });
});

describe("fáze 65 – rozdělení zásuvek v nákresu a ruční změna okruhu", () => {
  /** Půdorys bez místností: zásuvky po obvodu, rozváděč uprostřed (stejný scénář jako snímek uživatele). */
  function flatDraft(): FloorplanDraft {
    const draft = emptyDraft();
    const elements = perimeter({ x: 7000, y: 5000 }).map((point) => el(point.id, "socket", point.x, point.y));
    return { ...draft, elements: [el("rozv", "panel", 7000, 5000), ...elements] };
  }
  const socketCircuits = (draft: FloorplanDraft) => analyzeDraft(draft).circuits.circuits.filter((circuit) => circuit.kind === "sockets");
  const elementSpan = (draft: FloorplanDraft, ids: readonly string[]) => span(ids.map((id) => draft.elements.find((element) => element.id === id)!).map((element) => ({ ...element, id: element.id, room: "", floor: "", home: 0, weight: 1 })));

  it("nový nákres = kompaktní zóny, nákres z doby před fází 65 = dosavadní rozdělení (stejné okruhy jako jeho rozváděč)", () => {
    expect(emptyDraft().socketGrouping).toBe("compact");
    const legacy = parseDraft({ ...flatDraft(), socketGrouping: undefined })!;
    expect(legacy.socketGrouping).toBe("distance");
    const compact = flatDraft();
    expect(Math.max(...socketCircuits(compact).map((circuit) => elementSpan(compact, circuit.nodeIds)))).toBeLessThanOrEqual(12_000);
    expect(Math.max(...socketCircuits(legacy).map((circuit) => elementSpan(legacy, circuit.nodeIds)))).toBeGreaterThan(15_000);
    // Po místnostech: každá místnost svůj okruh
    const rooms: FloorplanDraft = { ...emptyDraft(), socketGrouping: "rooms", rooms: [room("Kuchyně", 0, 0, 4000, 3000), room("Spíž", 4000, 0, 2000, 3000)], elements: [el("rozv", "panel", 100, 100, { room: "Kuchyně" }), el("k1", "socket", 1000, 0, { room: "Kuchyně" }), el("k2", "socket", 3000, 0, { room: "Kuchyně" }), el("s1", "socket", 5000, 0, { room: "Spíž" })] };
    expect(socketCircuits(rooms).map((circuit) => circuit.rooms.length)).toEqual([1, 1]);
    expect(socketCircuits({ ...rooms, socketGrouping: "compact" })).toHaveLength(1);
  });

  it("přesun zásuvky do jiného okruhu, spojení do nového ručního okruhu, návrat na automat a optimalizace", () => {
    let draft = flatDraft();
    const rows = () => socketCircuitRows(analyzeDraft(draft).circuits.circuits);
    expect(rows().every((row) => row.designation.startsWith("-F"))).toBe(true);
    const target = rows()[1];
    const moving = rows()[0].elementIds[0];
    // Do automatického okruhu: okruh se zafixuje jako ruční Z1 i se svými zásuvkami a přibude k němu přesouvaná zásuvka
    draft = moveSocketsToCircuit(draft, [moving], { nodeIds: target.elementIds });
    expect(usedSocketCircuits(draft)).toEqual(["Z1"]);
    const manual = rows().find((row) => row.manual === "Z1")!;
    expect(manual.elementIds.sort()).toEqual([...target.elementIds, moving].sort());
    expect(manual.label).not.toContain("ruční okruh");
    // Nový ruční okruh pro dvě vzdálené zásuvky
    expect(nextSocketCircuit(draft)).toBe("Z2");
    draft = assignSocketCircuit(draft, ["z1", "z20"], "Z2");
    expect(rows().find((row) => row.manual === "Z2")?.elementIds.sort()).toEqual(["z1", "z20"]);
    // Rozváděč (není zásuvka) ruční okruh nedostane
    expect(assignSocketCircuit(draft, ["rozv"], "Z3")).toBe(draft);
    // Ruční trasy: zásuvková se při optimalizaci zruší, ostatní zůstanou
    draft = { ...draft, socketGrouping: "rooms", routeEdits: { "panel>z1": [{ x: 7000, y: 5000 }, { x: 600, y: 0 }], "panel>svetlo": [{ x: 7000, y: 5000 }, { x: 1, y: 1 }] } };
    const optimized = optimizeSocketCircuits(draft);
    expect(optimized.manual).toBe(target.elementIds.length + 1 + 2);
    expect(optimized.routes).toBe(1);
    expect(Object.keys(optimized.draft.routeEdits)).toEqual(["panel>svetlo"]);
    expect(optimized.draft.socketGrouping).toBe("compact");
    expect(usedSocketCircuits(optimized.draft)).toEqual([]);
    // Ruční okruh se uloží a načte; neplatný klíč se zahodí
    const parsed = parseDraft(JSON.parse(JSON.stringify(assignSocketCircuit(flatDraft(), ["z3"], "Z7"))))!;
    expect(parsed.elements.find((element) => element.id === "z3")?.socketCircuit).toBe("Z7");
    expect(parseDraft({ ...flatDraft(), elements: [el("x", "socket", 0, 0, { socketCircuit: "F1" })] })!.elements[0].socketCircuit).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
//  Obrázkový katalog chytré domácnosti, technický list a ruční moduly na DIN lištu
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";

import { OUTPUT_FILE, productLinks, readCatalog, renderSpecs } from "../../../scripts/smart-device-specs";
import { DEVICE_TABS, PRODUCT_FAMILIES, productById, productForItem, productOfModule, productsOfTab } from "./smart-catalog";
import { datasheetRows, deviceToneOf, productBadges } from "./smart-datasheet";
import { SMART_DEVICE_SPECS } from "./smart-device-specs.generated";
import { specKey } from "./smart-device-specs";
import { SMART_SYSTEMS, planSmartHome } from "./smart-home";

describe("fáze 65 – obrázkový katalog a technické listy chytré domácnosti", () => {
  it("výtah technických údajů odpovídá katalogu výrobců (jinak npm run catalog:smart-specs) a pokrývá klíčové přístroje", () => {
    expect(readFileSync(OUTPUT_FILE, "utf8").replace(/\r\n/g, "\n")).toBe(renderSpecs(readCatalog()));
    // Většina odkazů má záznam; chybějící (např. DG-M-1.16.1, Dimmer Extension) technický list ukáže jako „ověřte“
    const found = productLinks().filter((link) => SMART_DEVICE_SPECS[specKey(link)]);
    expect(found.length).toBeGreaterThanOrEqual(30);
    for (const key of ["ABB|2CDG510025R0011", "ABB|2CKA006200A0871", "ABB|2TMA210050B0006", "LOXONE|100335", "LOXONE|100422"]) expect(SMART_DEVICE_SPECS[key], key).toBeDefined();
  });

  it("každý výrobek má záložku, druh náhledu, popis a schéma; každý modul výpočtu má kartu na DIN liště", () => {
    const products = PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products));
    for (const product of products) {
      expect(DEVICE_TABS.map((tab) => tab.id), product.id).toContain(product.tab);
      expect(product.description.length, product.id).toBeGreaterThan(30);
      expect(product.wiring, product.id).toBeTruthy();
    }
    for (const system of SMART_SYSTEMS) for (const unit of system.modules) expect(productOfModule(system.id, unit.id)?.tab, `${system.id}/${unit.id}`).toBe("din");
    // Záložky free@home: ovladače, do krabičky / bezdrátové, panely, DIN lišta
    const fah = PRODUCT_FAMILIES.find((family) => family.id === "abb-fah")!;
    expect(DEVICE_TABS.map((tab) => productsOfTab(fah, tab.id).length).every((count) => count > 0)).toBe(true);
    // Technický list z palety: sběrnicový senzor, ne bezdrátový akční člen se stejnou položkou
    expect(productForItem("abb_freeathome", "bus-2")?.id).toBe("fah-sensor-2");
    expect(productForItem("loxone", "bus-presence")?.id).toBe("lox-presence");
    expect(productById("fah-wl-act-2")?.noBus).toBe(true);
  });

  it("technický list SA-M-4.16.2.2: napětí, proud kanálu, šířka, krytí, teplota a rozměry z ověřených zdrojů; TapHome bez údaje = ověřte", () => {
    const actuator = productOfModule("abb_freeathome", "fah-sa4")!;
    const rows = Object.fromEntries(datasheetRows(actuator, "abb_freeathome").map((row) => [row.id, row]));
    expect(rows.voltage).toMatchObject({ value: "24 V DC", source: "katalog" });
    expect(rows.rating).toMatchObject({ value: "4× 16 A (AC-1)", source: "výpočet" });
    expect(rows.size).toMatchObject({ value: "4 M (72 mm)", source: "výpočet" });
    expect(rows.ip.value).toBe("IP 20");
    expect(rows.temp.value).toBe("-5 až +45 °C");
    expect(rows.dimensions.value).toBe("72 × 90 × 64 mm");
    expect(productBadges(actuator, "abb_freeathome")).toEqual(expect.arrayContaining(["DIN lišta · 4 M", "4× 16 A", "IP 20"]));
    const tap = productById("tap-4t")!;
    const tapRows = Object.fromEntries(datasheetRows(tap, "taphome").map((row) => [row.id, row]));
    expect(tapRows.voltage.value).toBeNull();
    expect(tapRows.ip.value).toBeNull();
    // Sběrnicové tlačítko free@home: napětí sběrnice a kabel jako parametr systému
    const sensor = Object.fromEntries(datasheetRows(productById("fah-sensor-2")!, "abb_freeathome").map((row) => [row.id, row]));
    expect(sensor.voltage).toMatchObject({ value: "24 V DC (sběrnice free@home)", source: "systém" });
    expect(sensor.cable.value).toContain("2×2×0,8");
    expect(productBadges(productById("fah-wl-act-1")!, "abb_freeathome")[0]).toBe("Bezdrátově · free@home wireless");
  });

  it("ručně přidané moduly se přičtou k výpočtu (označené, zatíží sběrnici, ruční zdroj zvýší kapacitu)", () => {
    const loads = Array.from({ length: 5 }, (_, index) => ({ id: `l${index}`, room: "Obývák", role: "switch" as const, powerW: 60, label: "Světlo" }));
    const base = planSmartHome({ system: "abb_freeathome", loads, busDevices: 6 });
    const plan = planSmartHome({ system: "abb_freeathome", loads, busDevices: 6, extras: { "fah-sa8": 2, "fah-psu": 1, neznamy: 3 } });
    expect(plan.modules.filter((unit) => unit.id === "fah-sa8" && unit.manual)).toHaveLength(2);
    expect(plan.modules.filter((unit) => !unit.manual).map((unit) => unit.id)).toEqual(base.modules.map((unit) => unit.id));
    expect(plan.busDevices).toBe(base.busDevices + 2);
    expect(plan.psuMa).toBe(base.psuMa + 640);
    expect(plan.widthModules).toBe(base.widthModules + 2 * 8 + 4);
  });

  it("ruční moduly v nákresu: neplatné hodnoty se zahodí, nejvýš 20 kusů; barva náhledu z řady nebo z barev výrobce", () => {
    const parsed = parseDraft({ ...emptyDraft(), smartExtras: { "fah-sa8": 3, "fah-psu": 50, spatne: -1, "x y": 2, desetina: 1.5 } })!;
    expect(parsed.smartExtras).toEqual({ "fah-sa8": 3, "fah-psu": 20 });
    expect(deviceToneOf("ABB|Levit", "x", [{ id: "black", swatch: "#3f3f46" }])).toEqual({ frame: "#3f3f46", insert: "#3f3f46" });
    const levit = deviceToneOf("ABB|Levit", emptyDraft().color);
    expect(levit.frame).toMatch(/^#/);
  });
});
