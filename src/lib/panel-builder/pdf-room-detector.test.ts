import { describe, expect, it } from "vitest";

import { buildBarrier, close, detectRooms, dilate, erode, fold, open, polygonArea, rectFromCorners, roomAreaOf, roomAt, roomNameOf, roomNumberOf, roomTags, scaleFromAreas, simplifyLoop, traceLoops, type Raster, type RoomTag } from "./pdf-room-detector";

// Fáze 113: rozpoznání místností z PDF – syntetický výkres 10 × 7,5 m v rastru 400 × 300 px (25 mm / px).

const W = 400;
const H = 300;
const MM = 25;

function plan({ window = true, dimension = true } = {}): Raster {
  const data = new Uint8Array(W * H).fill(255);
  const rect = (x0: number, y0: number, x1: number, y1: number, value = 0) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data[y * W + x] = value;
  };
  // Obvodové zdi 300 mm (12 px)
  rect(0, 0, W, 12);
  rect(0, H - 12, W, H);
  rect(0, 0, 12, H);
  rect(W - 12, 0, W, H);
  // Svislá příčka 150 mm mezi obývacím pokojem a pravými místnostmi, dveře 800 mm (32 px) do koupelny
  rect(200, 0, 206, H);
  rect(200, 200, 206, 232, 255);
  // Vodorovná příčka mezi ložnicí a koupelnou, dveře 800 mm
  rect(206, 140, W, 146);
  rect(300, 140, 332, 146, 255);
  if (window) {
    // Okno 1,5 m (60 px) v levé obvodové zdi – jen tenká čára zasklení
    rect(0, 100, 12, 160, 255);
    rect(5, 100, 6, 160, 30);
  }
  if (dimension) {
    // Vnitřní kóta přes celý obývací pokoj (tenká čára od zdi ke zdi)
    rect(12, 60, 200, 61, 40);
  }
  return { width: W, height: H, data, channels: 1 };
}

const tag = (name: string | null, x: number, y: number, extra: Partial<RoomTag> = {}): RoomTag => ({ number: null, name, areaM2: null, x, y, h: 8, box: { x0: x - 20, y0: y - 5, x1: x + 20, y1: y + 5 }, ...extra });

describe("fáze 113 – popisky místností z textové vrstvy PDF", () => {
  it("čte čísla, názvy a výměry", () => {
    expect(fold("Obývací  Pokoj")).toBe("obyvaci pokoj");
    expect(roomNumberOf("1.01")).toBe("1.01");
    expect(roomNumberOf("2.09 Ložnice")).toBe("2.09");
    expect(roomNumberOf("1,25")).toBeNull();
    expect(roomNumberOf("±0,000")).toBeNull();
    expect(roomNameOf("Obývací pokoj")).toBe("Obývací pokoj");
    expect(roomNameOf("1.02 Ložnice 14,2 m²")).toBe("Ložnice");
    expect(roomNameOf("Pokoj 2")).toBe("Pokoj 2");
    expect(roomNameOf("wc")).toBe("WC");
    expect(roomNameOf("Technická místnost")).toBe("Technická místnost");
    expect(roomNameOf("Investor")).toBeNull();
    expect(roomAreaOf("32,5 m²")).toBe(32.5);
    expect(roomAreaOf("7.85 m2")).toBe(7.85);
    expect(roomAreaOf("1 250 mm")).toBeNull();
  });

  it("skládá útržky nad sebou do jednoho popisku", () => {
    const tags = roomTags([
      { text: "1.01", x: 100, y: 100, h: 10 },
      { text: "Obývací pokoj", x: 102, y: 114, h: 10 },
      { text: "32,5 m²", x: 100, y: 128, h: 10 },
      { text: "1.02", x: 300, y: 100, h: 10 },
      { text: "Koupelna", x: 300, y: 114, h: 10 },
      { text: "Investor: Novák", x: 300, y: 280, h: 10 },
    ]);
    expect(tags).toHaveLength(2);
    expect(tags[0]).toMatchObject({ number: "1.01", name: "Obývací pokoj", areaM2: 32.5 });
    expect(tags[1]).toMatchObject({ number: "1.02", name: "Koupelna", areaM2: null });
  });
});

describe("fáze 113 – morfologie a obrysy", () => {
  it("dilatace, eroze, uzavření a otevření", () => {
    const w = 9;
    const h = 1;
    const line = Uint8Array.from([1, 1, 0, 0, 0, 1, 1, 0, 0]);
    expect([...dilate(line, w, h, 1)]).toEqual([1, 1, 1, 0, 1, 1, 1, 1, 0]);
    expect([...erode(line, w, h, 1)]).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect([...close(Uint8Array.from([1, 0, 0, 1, 0, 0, 0, 0, 1]), w, h, 1)]).toEqual([1, 1, 1, 1, 0, 0, 0, 0, 1]);
    const blob = new Uint8Array(25);
    blob[12] = 1;
    expect([...open(blob, 5, 5, 1)].every((value) => value === 0)).toBe(true);
  });

  it("obrys buněk mřížky L-tvaru a zjednodušení", () => {
    // L: 3 × 2 buňky nahoře + 1 buňka dole vlevo
    const grid = Uint8Array.from([1, 1, 1, 1, 0, 0]);
    const loops = traceLoops(grid, 3, 2);
    expect(loops).toHaveLength(1);
    expect(Math.abs(polygonArea(loops[0]))).toBe(4);
    expect(simplifyLoop(loops[0], 0.1)).toHaveLength(6);
  });
});

describe("fáze 113 – rozpoznání místností z rastru", () => {
  const tags = [tag("Obývací pokoj", 100, 150, { number: "1.01", areaM2: 34.4 }), tag("Ložnice", 300, 75, { number: "1.02" }), tag("Koupelna", 300, 220, { number: "1.03", areaM2: 16.8 })];

  it("stupeň 1: místnost kolem každého popisku – dveře zacelené, okno ani kóta místnost nerozbijí", () => {
    const result = detectRooms(plan(), tags, { mmPerPx: MM });
    expect(result.unmatchedTags).toBe(0);
    expect(result.rooms.map((room) => room.name).sort((a, b) => (a ?? "").localeCompare(b ?? "", "cs"))).toEqual(["Koupelna", "Ložnice", "Obývací pokoj"]);
    const living = result.rooms.find((room) => room.name === "Obývací pokoj")!;
    expect(living.rect).toBe(true);
    expect(living.number).toBe("1.01");
    // Vnitřní líc zdí: x 12–200, y 12–288 (tolerance 3 px na zacelení)
    const xs = living.points.map((point) => point.x);
    const ys = living.points.map((point) => point.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(11);
    expect(Math.min(...xs)).toBeLessThanOrEqual(15);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(197);
    expect(Math.max(...xs)).toBeLessThanOrEqual(201);
    expect(Math.min(...ys)).toBeLessThanOrEqual(15);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(285);
    // 188 × 276 px při 25 mm/px ≈ 32 m²
    expect(living.areaM2).toBeGreaterThan(28);
    expect(living.areaM2).toBeLessThan(34);
    const bath = result.rooms.find((room) => room.name === "Koupelna")!;
    expect(bath.areaM2).toBeGreaterThan(12);
    expect(bath.areaM2).toBeLessThan(18);
  });

  it("bez textové vrstvy najde uzavřené oblasti ohraničené zdivem", () => {
    const result = detectRooms(plan({ dimension: false }), [], { mmPerPx: MM });
    expect(result.rooms).toHaveLength(3);
    expect(result.rooms.every((room) => room.name === null && room.source === "region")).toBe(true);
  });

  it("stupeň 2: klik do místnosti, venku chyba", () => {
    const barrier = buildBarrier(plan(), tags, { mmPerPx: MM });
    const bath = roomAt(barrier, { x: 360, y: 260 }, tags);
    expect("error" in bath).toBe(false);
    if (!("error" in bath)) {
      expect(bath.name).toBe("Koupelna");
      expect(bath.source).toBe("click");
    }
    const outside = roomAt(buildBarrier(plan({ window: false }), [], { mmPerPx: MM }), { x: 2, y: 2 }, []);
    expect("error" in outside).toBe(true);
  });

  it("místnost tvaru L je polygon se 6 rohy a velký výkres se zpracuje rychle", () => {
    const w = 1800;
    const h = 1300;
    const data = new Uint8Array(w * h).fill(255);
    const rect = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y < y1; y++) data.fill(0, y * w + x0, y * w + x1);
    };
    // Obvod 1800 × 1300 px (10 mm / px = 18 × 13 m), zdi 30 px; vnitřní blok vpravo dole dělá z místnosti „L“
    rect(0, 0, w, 30);
    rect(0, h - 30, w, h);
    rect(0, 0, 30, h);
    rect(w - 30, 0, w, h);
    rect(900, 700, w, h);
    const started = Date.now();
    const result = detectRooms({ width: w, height: h, data, channels: 1 }, [tag("Hala", 400, 400, { h: 20 })], { mmPerPx: 10 });
    expect(Date.now() - started).toBeLessThan(4000);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].rect).toBe(false);
    expect(result.rooms[0].points).toHaveLength(6);
    // L: 1740 × 1240 px bez bloku 870 × 570 px ≈ 166 m²
    expect(result.rooms[0].areaM2).toBeGreaterThan(160);
    expect(result.rooms[0].areaM2).toBeLessThan(170);
  });

  it("měřítko z výměr v popiscích a obdélník ze dvou rohů", () => {
    expect(scaleFromAreas([{ labelAreaM2: 10, areaPx: 16_000 }, { labelAreaM2: 20, areaPx: 32_000 }])).toBeCloseTo(25, 1);
    expect(scaleFromAreas([{ labelAreaM2: 10, areaPx: 16_000 }])).toBeNull();
    expect(rectFromCorners({ x: 500, y: 900 }, { x: 100, y: 300 })).toEqual({ x: 100, y: 300, w: 400, h: 600 });
  });
});
