import { describe, expect, it } from "vitest";

import { CAD_MARGIN_MM, buildSnapIndex, geometryOf, layerPath, layerStroke, parseCadUnderlay, planSizeFor, snapToCad, underlayOf } from "./cad-underlay";
import { parseDxf } from "./dxf-import";
import { assetUrls, buildEldockFile, isCadAsset, parseEldockFile, replaceBackgroundUrls, stripMissingAssets } from "./eldock-file";
import { addFloor, emptyDraft, parseDraft, switchFloor } from "./floorplan-editor";

const dxf = (...sections: (string | number)[][]) => [...sections.flat(), 0, "EOF"].join("\n");
const section = (name: string, ...body: (string | number)[]) => [0, "SECTION", 2, name, ...body, 0, "ENDSEC"];

/** Byt v mm: obvodová stěna 6 × 4 m (STENY), kóta (KOTY) a nábytek (NABYTEK). */
const FLAT = dxf(
  section("HEADER", 9, "$INSUNITS", 70, 4),
  section("TABLES", 0, "TABLE", 2, "LAYER", 0, "LAYER", 2, "STENY", 70, 0, 62, 7, 0, "LAYER", 2, "KOTY", 70, 0, 62, 1, 0, "LAYER", 2, "NABYTEK", 70, 0, 62, 3, 0, "ENDTAB"),
  section("ENTITIES", 0, "LWPOLYLINE", 8, "STENY", 90, 4, 70, 1, 10, 0, 20, 0, 10, 6000, 20, 0, 10, 6000, 20, 4000, 10, 0, 20, 4000, 0, "LINE", 8, "KOTY", 10, 0, 20, -500, 11, 6000, 21, -500, 0, "LINE", 8, "NABYTEK", 10, 1000, 20, 1000, 11, 2000, 21, 1000),
);

describe("fáze 79 – podklad CAD v půdorysu", () => {
  it("výkres posunutý o okraj, půdorys zvětšený na výkres + okraj, hladiny s barvou a počtem objektů", () => {
    const drawing = parseDxf(FLAT);
    const geometry = geometryOf(drawing);
    const walls = geometry.layers.find((layer) => layer.name === "STENY")!;
    expect(Math.min(...walls.segments.filter((_, index) => index % 2 === 0))).toBe(CAD_MARGIN_MM);
    expect(planSizeFor(drawing, { widthMm: 5000, heightMm: 5000 })).toEqual({ widthMm: 8000, heightMm: 6500 });
    const cad = underlayOf(drawing, "/api/files/markups/x.json", "byt.dxf");
    expect(cad.layers.map((layer) => [layer.name, layer.entities, layer.visible])).toEqual([
      ["KOTY", 1, true],
      ["NABYTEK", 1, true],
      ["STENY", 1, true],
    ]);
    expect(cad).toMatchObject({ units: "mm", unitsSource: "header", widthMm: 6000, heightMm: 4500, monochrome: false, snap: true });
    expect(layerPath([0, 0, 10, 0, 10, 0, 10, 10, 50, 50, 60, 60])).toBe("M0 0L10 0L10 10M50 50L60 60");
    expect(layerStroke({ color: "#ffffff" }, false, true)).toBe("#111827");
    expect(layerStroke({ color: "#ff0000" }, true)).toBe("#9ca3af");
  });

  it("přichytávání: vrchol má přednost před bodem úsečky, skryté a zamčené hladiny se nepřichytávají", () => {
    const drawing = parseDxf(FLAT);
    const geometry = geometryOf(drawing, 0);
    const cad = underlayOf(drawing, "/api/files/markups/x.json", "byt.dxf");
    const index = buildSnapIndex(geometry, cad);
    // Osa Y dolů: horní stěna výkresu (y = 4000 v DXF) je v půdorysu y = 0, nábytek (y = 1000) y = 3000
    expect(snapToCad(index, 30, 20, 100)).toMatchObject({ kind: "vertex", x: 0, y: 0 });
    expect(snapToCad(index, 3000, 40, 100)).toMatchObject({ kind: "edge", x: 3000, y: 0 });
    expect(snapToCad(index, 3000, 2000, 100)).toBeNull();
    // Skrytá hladina (nábytek) se nepřichytává
    const hidden = buildSnapIndex(geometry, { layers: cad.layers.map((layer) => (layer.name === "NABYTEK" ? { ...layer, visible: false } : layer)) });
    expect(snapToCad(hidden, 1500, 3010, 50)).toBeNull();
    expect(snapToCad(index, 1500, 3010, 50)).toMatchObject({ kind: "edge", x: 1500, y: 3000 });
    // Zamčené hladiny také ne
    const locked = buildSnapIndex(geometry, { layers: cad.layers.map((layer) => ({ ...layer, locked: true })) });
    expect(snapToCad(locked, 30, 20, 100)).toBeNull();
  });

  it("nastavení podkladu v nákresu: ověření, podlaží si podklad drží při přepínání, nové podlaží bez podkladu", () => {
    const cad = underlayOf(parseDxf(FLAT), "/api/files/markups/x.json", "byt.dxf");
    expect(parseCadUnderlay({ ...cad, url: "https://cizi.example/x.json" })).toBeNull();
    expect(parseCadUnderlay({ ...cad, opacity: 0.05, layers: [{ name: "A", color: "red", entities: -3 }] })).toMatchObject({ opacity: 0.2, layers: [{ name: "A", color: "#ffffff", entities: 0, visible: true, locked: false }] });
    const draft = parseDraft({ ...emptyDraft(), cad: { ...cad, monochrome: true, opacity: 0.5 } })!;
    expect(draft.cad).toMatchObject({ monochrome: true, opacity: 0.5, fileName: "byt.dxf" });
    const upper = addFloor(draft, { name: "2. NP" });
    expect(upper.cad).toBeNull();
    const back = switchFloor(upper, draft.floorId);
    expect(back.cad).toMatchObject({ url: "/api/files/markups/x.json" });
    expect(parseDraft(JSON.parse(JSON.stringify(back)))!.otherFloors[0].cad).toBeNull();
  });
});

describe("fáze 79 – podklad CAD v souboru projektu .eldock.json", () => {
  it("geometrie CAD jde se souborem jako data URL JSON, po nahrání nová adresa, chybějící podklad se zahodí", () => {
    const cad = underlayOf(parseDxf(FLAT), "/api/files/markups/a.json", "byt.dxf");
    const draft = parseDraft({ ...emptyDraft(), cad })!;
    expect(assetUrls(draft)).toEqual(["/api/files/markups/a.json"]);
    const json = `data:application/json;base64,${Buffer.from('{"version":1,"layers":[]}').toString("base64")}`;
    const parsed = parseEldockFile(JSON.stringify(buildEldockFile({ meta: { code: null, name: "Byt", customerName: null, installationSite: null }, draft, templates: [], assets: { "/api/files/markups/a.json": json } })));
    if ("error" in parsed) throw new Error(parsed.error);
    expect(isCadAsset(parsed.file.assets["/api/files/markups/a.json"])).toBe(true);
    expect(replaceBackgroundUrls(parsed.file.draft, new Map([["/api/files/markups/a.json", "/api/files/markups/b.json"]])).cad?.url).toBe("/api/files/markups/b.json");
    expect(stripMissingAssets(parsed.file.draft, new Set(["/api/files/markups/a.json"])).cad).toBeNull();
  });
});
