import { describe, expect, it } from "vitest";

import { buildScene, roomWallSegments } from "./pseudo3d";
import { emptyDraft, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import type { EnclosureLike } from "./enclosures";
import { fillRailsToEnclosure, matchLayoutEnclosures, reserveText, sizeTiers, tierLabel, type PlannedRail } from "./rail-layout";
import { mergeCandidates, mergeRectInto, mergeRooms } from "./room-builder";
import { buildBarrier, detectRooms, floodRegion, roomAt, type Raster, type RoomTag } from "./pdf-room-detector";
import { isRectilinear, pointInPolygon, polygonArea, roomPolygon, roomRelation, roomShapeLabel, unionRoomPolygons, unionRooms, type Pt } from "./room-geometry";

// Fáze 114: místnosti tvaru L / T / U ze dvou obdélníků (nástroj „roh ➔ roh“, „Kreslit místnost“ a 🔗 Spojit).

const rect = (x: number, y: number, w: number, h: number): Pt[] => roomPolygon({ x, y, w, h });
const room = (id: string, name: string, x: number, y: number, w: number, h: number): EditorRoom => ({ id, name, x, y, w, h });

describe("fáze 114 – sjednocení obdélníků do L / T / U místnosti", () => {
  it("dva překrývající se obdélníky z nástroje roh ➔ roh → jedna L-místnost se sečtenou plochou", () => {
    // Vodorovná část 5 × 3 m a svislá noha 2 × 4 m, překryv 2 × 1 m
    const points = unionRoomPolygons(rect(0, 0, 5000, 3000), rect(0, 2000, 2000, 4000))!;
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 2000, y: 3000 },
      { x: 2000, y: 6000 },
      { x: 0, y: 6000 },
    ]);
    expect(polygonArea(points) / 1e6).toBe(21);
    expect(isRectilinear(points)).toBe(true);
    expect(roomShapeLabel(points)).toBe("L-tvar");
  });

  it("sousední obdélníky se společnou stěnou (i s mezerou do 2 cm) → L; T a U tvar", () => {
    const l = unionRoomPolygons(rect(0, 0, 4000, 2000), rect(0, 2010, 1500, 2500))!;
    expect(l).toHaveLength(6);
    expect(polygonArea(l) / 1e6).toBeCloseTo(4 * 2 + 1.5 * 2.5, 1);
    const t = unionRoomPolygons(rect(0, 0, 6000, 2000), rect(2000, 2000, 2000, 3000))!;
    expect(t).toHaveLength(8);
    expect(roomShapeLabel(t)).toBe("T / U-tvar");
    const u = unionRoomPolygons(unionRoomPolygons(rect(0, 0, 1000, 4000), rect(1000, 3000, 3000, 1000))!, rect(4000, 0, 1000, 4000))!;
    expect(u).toHaveLength(8);
    expect(polygonArea(u) / 1e6).toBe(11);
  });

  it("místnosti od sebe, jen přes roh, se šikmou stěnou nebo s dírou uprostřed spojit nejde", () => {
    expect(unionRoomPolygons(rect(0, 0, 2000, 2000), rect(3000, 0, 2000, 2000))).toBeNull();
    expect(unionRoomPolygons(rect(0, 0, 2000, 2000), rect(2000, 2000, 2000, 2000))).toBeNull();
    const slanted = [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }];
    expect(unionRooms(slanted, rect(0, 2000, 2000, 2000))).toMatchObject({ ok: false, reason: "slanted" });
    // U + víko = prstenec (dvorek uprostřed)
    const ring = unionRooms(unionRoomPolygons(unionRoomPolygons(rect(0, 0, 1000, 4000), rect(1000, 3000, 3000, 1000))!, rect(4000, 0, 1000, 4000))!, rect(1000, 0, 3000, 1000));
    expect(ring).toMatchObject({ ok: false, reason: "hole" });
  });

  it("vztah místností: překryv, společná stěna, odděleně", () => {
    expect(roomRelation({ x: 0, y: 0, w: 4000, h: 3000 }, { x: 3000, y: 2000, w: 2000, h: 2000 }).relation).toBe("overlap");
    expect(roomRelation({ x: 0, y: 0, w: 4000, h: 3000 }, { x: 4000, y: 1000, w: 2000, h: 2000 })).toMatchObject({ relation: "touch", sharedMm: 2000 });
    expect(roomRelation({ x: 0, y: 0, w: 4000, h: 3000 }, { x: 4000, y: 2900, w: 2000, h: 2000 }).relation).toBe("apart");
    expect(roomRelation({ x: 0, y: 0, w: 4000, h: 3000 }, { x: 5000, y: 0, w: 2000, h: 2000 }).relation).toBe("apart");
  });

  it("🔗 spojení v nákresu: jedna polygonová místnost, prvky přejdou, ve 2D i 3D bez vnitřních stěn", () => {
    let draft: FloorplanDraft = {
      ...emptyDraft(),
      rooms: [room("m1", "Koupelna 2.06", 0, 0, 3000, 2000), room("m2", "Místnost 5", 0, 1500, 1200, 2500), room("m3", "Chodba", 6000, 0, 2000, 2000)],
    };
    draft = { ...draft, elements: [{ id: "e1", item: "socket", x: 600, y: 3500, room: "Místnost 5", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null }] };
    const candidates = mergeCandidates(draft.rooms, draft.rooms[1], "m2");
    expect(candidates.map((candidate) => [candidate.room.id, candidate.relation])).toEqual([["m1", "overlap"]]);
    const merged = mergeRooms(draft, "m1", "m2");
    expect("error" in merged).toBe(false);
    if ("error" in merged) return;
    expect(merged.draft.rooms.map((entry) => entry.id)).toEqual(["m1", "m3"]);
    expect(merged.room.name).toBe("Koupelna 2.06");
    expect(merged.room.points).toHaveLength(6);
    expect(merged.room).toMatchObject({ x: 0, y: 0, w: 3000, h: 4000 });
    expect(merged.draft.elements[0].room).toBe("Koupelna 2.06");
    // 3D náhled: stěny spojené místnosti = jen obvod L (žádná stěna uvnitř)
    const walls = roomWallSegments(buildScene(merged.draft)).filter((wall) => wall.a.x < 5000);
    expect(walls).toHaveLength(6);
    const outline = merged.room.points!;
    for (const wall of walls) {
      const mid = { x: (wall.a.x + wall.b.x) / 2, y: (wall.a.y + wall.b.y) / 2 };
      // střed stěny leží na obvodu, ne uvnitř místnosti (posun o 5 cm do obou stran: jedna strana venku)
      const normal = wall.a.x === wall.b.x ? { x: 50, y: 0 } : { x: 0, y: 50 };
      const inside = [pointInPolygon(outline, mid.x + normal.x, mid.y + normal.y), pointInPolygon(outline, mid.x - normal.x, mid.y - normal.y)];
      expect(inside.filter(Boolean)).toHaveLength(1);
    }
    expect(polygonArea(outline) / 1e6).toBeCloseTo(3 * 2 + 1.2 * 2, 3);
  });

  it("nový obdélník z nástroje se připojí k místnosti a převezme prvky bez místnosti", () => {
    const draft: FloorplanDraft = { ...emptyDraft(), rooms: [room("m1", "Chodba 2.01", 0, 0, 4000, 1500)] };
    const result = mergeRectInto(draft, "m1", { x: 2500, y: 1000, w: 1500, h: 3000 });
    expect("error" in result).toBe(false);
    if ("error" in result) return;
    expect(result.draft.rooms).toHaveLength(1);
    expect(result.room.points).toHaveLength(6);
    expect(polygonArea(result.room.points!) / 1e6).toBeCloseTo(4 * 1.5 + 1.5 * 2.5, 3);
    expect(mergeRectInto(draft, "m1", { x: 6000, y: 0, w: 1000, h: 1000 })).toMatchObject({ error: expect.stringContaining("nesdílejí stěnu") });
  });
});

// ---------------------------------------------------------------------------
//  Šrafovaný CAD výkres s kótami (8 × 6 m, 10 mm / px): zdi jako šrafované pásy, tenké 1px kóty a nábytek
// ---------------------------------------------------------------------------

const PW = 800;
const PH = 600;

function hatchedPlan({ wc = false } = {}): Raster {
  const data = new Uint8Array(PW * PH).fill(255);
  const dot = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < PW && y < PH) data[y * PW + x] = 0;
  };
  /** Šrafovaný pás zdi: obrysové čáry 1 px a šikmé šrafy po 22 px (zdivo 300 mm / příčka 120 mm) – řidší než ~8 cm. */
  const hatched = (x0: number, y0: number, x1: number, y1: number) => {
    for (let x = x0; x < x1; x++) {
      dot(x, y0);
      dot(x, y1 - 1);
    }
    for (let y = y0; y < y1; y++) {
      dot(x0, y);
      dot(x1 - 1, y);
      for (let x = x0; x < x1; x++) if ((x + y) % 22 === 0) dot(x, y);
    }
  };
  const clear = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y < y1; y++) data.fill(255, y * PW + x0, y * PW + x1);
  };
  // Obvodové zdi 300 mm
  hatched(0, 0, PW, 30);
  hatched(0, PH - 30, PW, PH);
  hatched(0, 0, 30, PH);
  hatched(PW - 30, 0, PW, PH);
  // Příčka 120 mm se dveřmi 800 mm
  hatched(400, 30, 412, PH - 30);
  clear(400, 250, 412, 330);
  // Kóty přes levý pokoj (1 px od zdi ke zdi) a oblouk dveří
  for (let x = 30; x < 400; x++) dot(x, 150);
  for (let y = 30; y < PH - 30; y++) dot(150, y);
  for (let angle = 0; angle <= 90; angle += 0.5) dot(Math.round(400 - 80 * Math.cos((angle * Math.PI) / 180)), Math.round(250 + 80 * Math.sin((angle * Math.PI) / 180)));
  // Nábytek (obrys 1 px) v pravém pokoji
  for (let x = 500; x < 620; x++) {
    dot(x, 100);
    dot(x, 180);
  }
  for (let y = 100; y <= 180; y++) {
    dot(500, y);
    dot(619, y);
  }
  if (wc) {
    // WC 1,1 × 1,1 m s plnými zdmi v pravém dolním rohu pravého pokoje
    for (let y = 440; y < 570; y++) for (let x = 640; x < 770; x++) if (x < 650 || y < 450) data[y * PW + x] = 0;
  }
  return { width: PW, height: PH, data, channels: 1 };
}

describe("fáze 114 – rozpoznání místností na šrafovaném CAD výkresu s kótami", () => {
  it("🪄 klik do buňky mezi kótami najde celý pokoj (šrafy zacelené, 1px čáry pryč, kolo pod 3,5 m²)", () => {
    const raster = hatchedPlan();
    const barrier = buildBarrier(raster, [], { mmPerPx: 10 });
    // Dřívější chování: všechny čáry → jen malá buňka 1,2 × 1,2 m mezi kótami
    const small = floodRegion(barrier.layer("all"), PW, PH, { x: 90, y: 90 });
    expect((small!.count * 100) / 1e6).toBeLessThan(3.5);
    const room = roomAt(barrier, { x: 90, y: 90 }, []);
    expect("error" in room).toBe(false);
    if ("error" in room) return;
    // Levý pokoj 3,7 × 5,4 m ≈ 20 m² (zacelení zdí ubere pár cm)
    expect(room.areaM2).toBeGreaterThan(17);
    expect(room.areaM2).toBeLessThan(21);
  });

  it("🔍 automaticky bez popisků: dva pokoje, ne útržky mezi kótami; s popiskem celý pokoj", () => {
    const result = detectRooms(hatchedPlan(), [], { mmPerPx: 10 });
    expect(result.rooms).toHaveLength(2);
    expect(result.rooms.every((entry) => entry.areaM2 > 15)).toBe(true);
    const tag: RoomTag = { number: "2.06", name: "Koupelna", areaM2: null, x: 260, y: 400, h: 10, box: { x0: 240, y0: 395, x1: 280, y1: 405 } };
    const labelled = detectRooms(hatchedPlan(), [tag], { mmPerPx: 10 });
    expect(labelled.rooms).toHaveLength(1);
    expect(labelled.rooms[0].name).toBe("Koupelna");
    expect(labelled.rooms[0].areaM2).toBeGreaterThan(17);
  });

  it("malé WC (pod 3,5 m²) se po marném dalším kole vrátí z první vrstvy", () => {
    const barrier = buildBarrier(hatchedPlan({ wc: true }), [], { mmPerPx: 10 });
    const wc = roomAt(barrier, { x: 710, y: 510 }, []);
    expect("error" in wc).toBe(false);
    if ("error" in wc) return;
    expect(wc.areaM2).toBeGreaterThan(1);
    expect(wc.areaM2).toBeLessThan(1.6);
  });
});

// ---------------------------------------------------------------------------
//  Velikost rozvodnice a rezerva v % (průvodce uspořádáním skříně)
// ---------------------------------------------------------------------------

const box = (patch: Partial<EnclosureLike> & Pick<EnclosureLike, "id" | "model" | "rows" | "modulesPerRow">): EnclosureLike => ({
  manufacturer: "ABB",
  series: "test",
  articleNumber: patch.id,
  totalModules: patch.rows * patch.modulesPerRow,
  widthMm: 600,
  heightMm: 900,
  depthMm: 150,
  ipRating: "IP41",
  installation: "SURFACE",
  material: "PLASTIC",
  pMaxW: 120,
  dataSource: "MANUFACTURER_CATALOG",
  ...patch,
});

describe("fáze 114 – větší rozvodnice s rezervou v procentech", () => {
  const boxes = [
    box({ id: "ca26", model: "CA26V (2 pole po 12 M)", rows: 6, modulesPerRow: 24 }),
    box({ id: "ca27", model: "CA27V (2 pole po 12 M)", rows: 7, modulesPerRow: 24 }),
    box({ id: "oez7", manufacturer: "OEZ", model: "RZA 2 × 7 (2 pole po 12 M)", rows: 7, modulesPerRow: 24 }),
    box({ id: "ca28", model: "CA28V (2 pole po 12 M)", rows: 8, modulesPerRow: 24 }),
    box({ id: "hager9", manufacturer: "Hager", model: "Univers 9 řad (2 pole po 12 M)", rows: 9, modulesPerRow: 24 }),
    box({ id: "ca210", model: "CA210V (2 pole po 12 M)", rows: 10, modulesPerRow: 24 }),
  ];

  it("karty od nejmenší vyhovující: kapacita, rezerva v % a ve volných modulech, doporučená od 30 %, modely více výrobců", () => {
    const need = { rows: 5, fields: 2 as const, fieldWidth: 12, usedModules: 111, requiredModules: 139, lossW: 40 };
    const tiers = sizeTiers(matchLayoutEnclosures(boxes, need, { manufacturer: "ABB", limit: 400 }), need.usedModules);
    expect(tiers.map((tier) => tierLabel(tier))).toEqual(["144 M (2 pole × 6 řad)", "168 M (2 pole × 7 řad)", "192 M (2 pole × 8 řad)", "216 M (2 pole × 9 řad)", "240 M (2 pole × 10 řad)"]);
    expect(tiers.map((tier) => [tier.reservePercent, tier.freeModules])).toEqual([[23, 33], [34, 57], [42, 81], [49, 105], [54, 129]]);
    expect(reserveText(tiers[0])).toBe("🟢 Rezerva 23 % (33 volných M)");
    expect(reserveText(tiers[1])).toBe("🟢 Rezerva 34 % (57 volných M – Doporučeno pro budoucí rozšíření)");
    expect(tiers.filter((tier) => tier.recommended).map((tier) => tier.key)).toEqual(["2x7x12"]);
    // 168 M: ABB i OEZ, výrobce přístrojů napřed
    expect(tiers[1].matches.map((match) => match.enclosure.id)).toEqual(["ca27", "oez7"]);
  });

  it("rozváděč se vygeneruje s tolika DIN lištami, kolik má zvolená skříň řad (2 pole i lišty s přepážkou)", () => {
    const rail = (field: 0 | 1, used: number, low = false): PlannedRail<{ id: string }> => ({ capacity: 12, devices: [{ id: `d${used}` }], used, field, low });
    const twoField = fillRailsToEnclosure([rail(0, 10), rail(0, 9), rail(0, 8), rail(1, 6, true)], { version: 1, concept: "two_field", fields: 2, fieldARails: 3, partitionAfterRail: null, fieldBLow: true }, boxes[1]);
    expect(twoField.rails).toHaveLength(14);
    expect(twoField.layout).toMatchObject({ fields: 2, fieldARails: 7, fieldBLow: true });
    expect(twoField.rails.filter((entry) => entry.field === 1).every((entry) => entry.low)).toBe(true);
    const wide = fillRailsToEnclosure([rail(0, 20), rail(0, 18), rail(0, 6, true)].map((entry) => ({ ...entry, capacity: 24 })), { version: 1, concept: "wide24", fields: 1, fieldARails: 0, partitionAfterRail: 2, fieldBLow: false }, box({ id: "w6", model: "Mistral41W 6×24", rows: 6, modulesPerRow: 24 }));
    expect(wide.rails.map((entry) => entry.used)).toEqual([20, 18, 0, 0, 0, 6]);
    expect(wide.layout.partitionAfterRail).toBe(5);
  });
});
