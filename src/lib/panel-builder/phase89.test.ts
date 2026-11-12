import { describe, expect, it } from "vitest";

import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { newestLibrary, parseFloorplanLibrary } from "./floorplan-library";
import { initialStep, isFloorplanUiMode, nextStep, resolveUiMode, WIZARD_STEPS } from "./floorplan-wizard";
import { addRoomBySize, formatRoomSize, freeSpot, overlapArea, parseRoomSize, ROOM_PRESETS, ROOM_SNAP_MM, snapRoomRect, uniqueRoomName } from "./room-builder";

const el = (id: string, x: number, y: number): EditorElement => ({ id, item: "socket", x, y, room: "", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null });
const withRooms = (rooms: FloorplanDraft["rooms"]): FloorplanDraft => ({ ...emptyDraft(), rooms });

describe("fáze 89 – místnost zadáním rozměrů X × Y a přichytávání stěn", () => {
  it("rozměr z pole: tečka i čárka, metry i milimetry, rozsah 0,5–100 m", () => {
    expect(parseRoomSize("5.5")).toBe(5_500);
    expect(parseRoomSize("4,0")).toBe(4_000);
    expect(parseRoomSize(" 3,85 ")).toBe(3_850);
    expect(parseRoomSize("4500", "mm")).toBe(4_500);
    expect(parseRoomSize("12 500", "mm")).toBe(12_500);
    for (const bad of ["", "abc", "0", "-3", "0,2", "101"]) expect(parseRoomSize(bad)).toBeNull();
    expect(formatRoomSize(4_500)).toBe("4,5");
    expect(formatRoomSize(4_500, "mm")).toBe("4500");
    expect(ROOM_PRESETS.map((preset) => preset.name)).toEqual(["Obývací pokoj", "Kuchyň", "Obývák + KK", "Ložnice", "Dětský pokoj", "Pracovna", "Koupelna", "WC", "Chodba / Zádveří", "Technická místnost", "Šatna", "Spíž", "Garáž"]);
  });

  it("nová místnost 5,5 × 4,0 m na volném místě s unikátním názvem; prvky uvnitř do ní patří", () => {
    const base = { ...emptyDraft(), elements: [el("z1", 3000, 2500)] };
    const first = addRoomBySize(base, { name: "Obývací pokoj", w: 5_500, h: 4_000, id: "m1" });
    expect(first.room).toEqual({ id: "m1", name: "Obývací pokoj", x: 1000, y: 1000, w: 5_500, h: 4_000 });
    expect(first.draft.elements[0].room).toBe("Obývací pokoj");
    // Druhá místnost se stejným názvem vedle první (bez překryvu, odstup 0,5 m)
    const second = addRoomBySize(first.draft, { name: "Obývací pokoj", w: 4_000, h: 3_000, id: "m2" });
    expect(second.room.name).toBe("Obývací pokoj 2");
    expect(overlapArea(first.room, second.room)).toBe(0);
    expect(second.room.x).toBeGreaterThanOrEqual(first.room.x + first.room.w + 500);
    expect(uniqueRoomName([{ name: "WC" }, { name: "WC 2" }], "WC")).toBe("WC 3");
  });

  it("místnost větší než volné místo jde vpravo vedle nákresu a plocha se rozšíří", () => {
    const full = withRooms([{ id: "a", name: "Hala", x: 1000, y: 1000, w: 18_000, h: 14_000 }]);
    expect(freeSpot(full.rooms, full, { w: 6_000, h: 5_000 })).toEqual({ x: 20_000, y: 1000 });
    const { draft, room } = addRoomBySize(full, { name: "Garáž", w: 6_000, h: 5_000, id: "g" });
    expect(room).toMatchObject({ x: 20_000, y: 1000 });
    expect(draft.widthMm).toBeGreaterThanOrEqual(room.x + room.w + 1000);
  });

  it("magnetické přichycení ke stěně a do rohu sousední místnosti (tolerance 150 mm), bez mezery i překryvu", () => {
    const living = { x: 1000, y: 1000, w: 5_500, h: 4_000 };
    // Ložnice přisouvaná zprava s mezerou 120 mm a posunem 90 mm dolů → stěna ke stěně a zarovnaný roh
    const moved = snapRoomRect({ x: 6_620, y: 1_090, w: 4_000, h: 3_500 }, [living]);
    expect(moved).toMatchObject({ x: 6_500, y: 1_000 });
    expect(moved.guides).toEqual([
      { axis: "x", at: 6_500, from: 1_000, to: 5_000, kind: "wall" },
      { axis: "y", at: 1_000, from: 1_000, to: 10_500, kind: "align" },
    ]);
    expect(overlapArea({ ...moved, w: 4_000, h: 3_500 }, living)).toBe(0);
    // Mírný překryv 100 mm zleva se také srovná na líc
    expect(snapRoomRect({ x: 6_400, y: 2_000, w: 3_000, h: 3_000 }, [living]).x).toBe(6_500);
    // Mimo toleranci nic
    const far = snapRoomRect({ x: 6_500 + ROOM_SNAP_MM + 50, y: 1_400, w: 3_000, h: 3_000 }, [living]);
    expect(far.x).toBe(6_700);
    expect(far.guides.filter((guide) => guide.axis === "x")).toEqual([]);
    // Místnost daleko v druhé ose se k cizí stěně nepřichytí
    expect(snapRoomRect({ x: 6_600, y: 9_000, w: 3_000, h: 3_000 }, [living]).x).toBe(6_600);
  });
});

describe("fáze 89 – průvodce 5 fázemi a kompaktní režim", () => {
  it("5 kroků se štítky a tlačítky na další krok, výchozí krok podle nákresu", () => {
    // Fáze 98: 5 fází průvodce
    expect(WIZARD_STEPS.map((step) => step.label)).toEqual(["1. Půdorys a místnosti", "2. Rozváděč, okna, dveře a vybavení", "3. Zásuvkové okruhy a spotřebiče", "4. Světla, vypínače a chytrá domácnost", "5. Trasy kabelů, Kusovník a Rozváděč"]);
    expect(WIZARD_STEPS.map((step) => step.next)).toEqual(["Další fáze: Rozváděč, okna, dveře a vybavení →", "Další fáze: Zásuvkové okruhy a spotřebiče →", "Další fáze: Světla, vypínače a chytrá domácnost →", "Další fáze: Trasy kabelů, Kusovník a Rozváděč →", null]);
    expect(nextStep(4)).toBe(5);
    expect(nextStep(5)).toBe(5);
    expect(initialStep(emptyDraft())).toBe(1);
    expect(initialStep(withRooms([{ id: "a", name: "A", x: 0, y: 0, w: 1000, h: 1000 }]))).toBe(2);
    expect(initialStep({ ...emptyDraft(), elements: [el("z", 1, 1)] })).toBe(3);
  });

  it("režim: prohlížeč má přednost, pak profil firmy, jinak průvodce; profil firmy nese režim v knihovně", () => {
    expect(resolveUiMode(null, null)).toBe("wizard");
    expect(resolveUiMode("compact", null)).toBe("compact");
    expect(resolveUiMode(null, "compact")).toBe("compact");
    expect(resolveUiMode("wizard", "compact")).toBe("wizard");
    expect(resolveUiMode("nesmysl", undefined)).toBe("wizard");
    expect(isFloorplanUiMode("compact")).toBe(true);
    const library = parseFloorplanLibrary({ templates: [], favorites: [], uiMode: "compact", updatedAt: 5 });
    expect(library).toMatchObject({ uiMode: "compact", updatedAt: 5 });
    expect(parseFloorplanLibrary({ templates: [], favorites: [], uiMode: "jiný", updatedAt: 5 })).not.toHaveProperty("uiMode");
    expect(newestLibrary(library, parseFloorplanLibrary({ templates: [], favorites: [], uiMode: "wizard", updatedAt: 9 }))?.uiMode).toBe("wizard");
  });
});
