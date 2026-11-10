import { describe, expect, it } from "vitest";

import { DxfError, aciColor, decodeDxfText, guessUnits, isBallastLayer, mtextPlain, parseDxf } from "./dxf-import";
import { floorplanDxf } from "./dxf-export";
import { analyzeDraft, emptyDraft } from "./floorplan-editor";

/** Sestaví DXF z dvojic (kód, hodnota). */
const dxf = (...sections: (string | number)[][]) => [...sections.flat(), 0, "EOF"].join("\n");
const section = (name: string, ...body: (string | number)[]) => [0, "SECTION", 2, name, ...body, 0, "ENDSEC"];
const header = (insunits: number) => section("HEADER", 9, "$INSUNITS", 70, insunits);
const layers = (...rows: [string, number, number?][]) => section("TABLES", 0, "TABLE", 2, "LAYER", ...rows.flatMap(([name, color, flags = 0]) => [0, "LAYER", 2, name, 70, flags, 62, color]), 0, "ENDTAB");

describe("fáze 79 – import DXF", () => {
  it("LINE a LWPOLYLINE po hladinách s barvou ACI; jednotky z $INSUNITS (cm → mm), osa Y dolů od levého horního rohu", () => {
    const text = dxf(
      header(5),
      layers(["STENY", 1], ["NABYTEK", 3], ["OSY", 5, 1]),
      section("ENTITIES", 0, "LINE", 8, "STENY", 10, 0, 20, 0, 11, 500, 21, 0, 0, "LWPOLYLINE", 8, "STENY", 90, 4, 70, 1, 10, 0, 20, 0, 10, 500, 20, 0, 10, 500, 20, 400, 10, 0, 20, 400, 0, "LINE", 8, "NABYTEK", 62, 2, 10, 100, 20, 100, 11, 200, 21, 100),
    );
    const drawing = parseDxf(text);
    expect(drawing).toMatchObject({ units: "cm", unitsSource: "header", widthMm: 5000, heightMm: 4000 });
    const walls = drawing.layers.find((layer) => layer.name === "STENY")!;
    expect(walls.color).toBe("#ff0000");
    expect(walls.entities).toBe(2);
    // LINE (1 úsečka) + uzavřená polyčára (4 úsečky)
    expect(walls.segments.length / 4).toBe(5);
    // Spodní hrana výkresu (y = 0 v DXF) je v půdorysu dole (y = 4000 mm)
    expect(walls.segments.slice(0, 4)).toEqual([0, 4000, 5000, 4000]);
    expect(drawing.layers.find((layer) => layer.name === "OSY")).toBeUndefined();
  });

  it("bez $INSUNITS jednotky podle rozměru; oblouk a kružnice po 10°, polyčára s vydutím", () => {
    expect(guessUnits(12_000)).toBe("mm");
    expect(guessUnits(1200)).toBe("cm");
    expect(guessUnits(12)).toBe("m");
    const drawing = parseDxf(dxf(section("ENTITIES", 0, "CIRCLE", 8, "0", 10, 5, 20, 5, 40, 1, 0, "ARC", 8, "0", 10, 0, 20, 0, 40, 10, 50, 0, 51, 90, 0, "LWPOLYLINE", 8, "0", 90, 2, 10, 0, 20, 0, 42, 1, 10, 2, 20, 0)));
    expect(drawing.units).toBe("m");
    const layer = drawing.layers[0];
    // kružnice 36 úseček, čtvrtkruh 9, půlkruh z vydutí 18
    expect(layer.segments.length / 4).toBe(36 + 9 + 18);
  });

  it("TEXT a MTEXT bez formátování, INSERT bloku s měřítkem a otočením; entity bloku na hladině 0 přebírají hladinu vložení", () => {
    const text = dxf(
      header(4),
      section("BLOCKS", 0, "BLOCK", 2, "OKNO", 10, 0, 20, 0, 0, "LINE", 8, "0", 10, 0, 20, 0, 11, 1000, 21, 0, 0, "ENDBLK"),
      section(
        "ENTITIES",
        0,
        "INSERT",
        8,
        "OKNA",
        2,
        "OKNO",
        10,
        2000,
        20,
        3000,
        41,
        2,
        42,
        2,
        50,
        90,
        0,
        "TEXT",
        8,
        "POPISY",
        10,
        0,
        20,
        0,
        40,
        250,
        1,
        "Obývák",
        0,
        "MTEXT",
        8,
        "POPISY",
        10,
        100,
        20,
        100,
        40,
        200,
        1,
        "{\\fArial|b1;Kuchyně}\\P12 m²",
      ),
    );
    const drawing = parseDxf(text);
    const windows = drawing.layers.find((layer) => layer.name === "OKNA")!;
    expect(windows.segments.length).toBe(4);
    // Úsečka 1000 mm × měřítko 2 otočená o 90° → svislá 2000 mm
    const [x1, y1, x2, y2] = windows.segments;
    expect(Math.abs(x2 - x1)).toBeLessThan(0.5);
    expect(Math.abs(y2 - y1)).toBeCloseTo(2000, 0);
    const labels = drawing.layers.find((layer) => layer.name === "POPISY")!.texts.map((label) => label.value);
    expect(labels).toEqual(["Obývák", "Kuchyně\n12 m²"]);
    expect(mtextPlain("\\A1;{\\H1.5x;Text}\\Pdalší")).toBe("Text\ndalší");
  });

  it("DWG a binární DXF srozumitelnou chybou; balast podle názvu hladiny; barvy ACI", () => {
    expect(() => parseDxf("AC1032\u0000\u0000binární data")).toThrow(DxfError);
    expect(() => parseDxf("AC1032\u0000")).toThrow(/Uložte výkres v CAD programu jako DXF/);
    expect(() => parseDxf(dxf(section("HEADER", 9, "$ACADVER", 1, "AC1032")))).toThrow(/ENTITIES/);
    for (const name of ["A-DIM", "Kóty", "ŠRAFY", "hatch_1", "TEXTY", "A-FURN", "Nábytek", "OSA_1", "Axis"]) expect(isBallastLayer(name), name).toBe(true);
    for (const name of ["STENY", "Příčky", "Okna", "DVERE", "0"]) expect(isBallastLayer(name), name).toBe(false);
    expect(aciColor(1)).toBe("#ff0000");
    expect(aciColor(7)).toBe("#ffffff");
    expect(aciColor(250)).toBe("#333333");
    expect(aciColor(30)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("fáze 79 – vlastní export DXF (R12) načtený zpět", () => {
  it("hladiny Eldocku, mm podle rozměru výkresu (R12 bez $INSUNITS) a popisy s diakritikou zapsanou jako U+XXXX", () => {
    const el = (id: string, item: string, x: number, y: number) => ({ id, item, x, y, room: "Obývák", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null });
    const draft = { ...emptyDraft(), rooms: [{ id: "m1", name: "Obývák", x: 0, y: 0, w: 5000, h: 4000 }], elements: [el("rh", "panel", 300, 2000), el("z1", "socket", 2000, 0), el("l1", "ceiling-light", 2500, 2000)] };
    const drawing = parseDxf(floorplanDxf(draft, analyzeDraft(draft)));
    expect(drawing.units).toBe("mm");
    expect(drawing.unitsSource).toBe("extent");
    expect(drawing.layers.map((layer) => layer.name)).toEqual(expect.arrayContaining(["STAVBA_MISTNOSTI", "ZASUVKY_230V_400V", "SVETLA_VYPINACE", "POPISY_A_KOTY"]));
    // Místnost 5 × 4 m (výkres je o značky a popisy větší)
    expect(drawing.widthMm).toBeGreaterThanOrEqual(5000);
    expect(drawing.widthMm).toBeLessThan(7000);
    const labels = drawing.layers.find((layer) => layer.name === "POPISY_A_KOTY")!.texts.map((text) => text.value);
    expect(labels.some((label) => label.startsWith("Obývák"))).toBe(true);
    expect(decodeDxfText(String.raw`Ob\U+00FDv\U+00E1k 20%%d`)).toBe("Obývák 20°");
  });
});
