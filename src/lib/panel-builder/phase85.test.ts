import { describe, expect, it } from "vitest";

import { renderPanelDrawingSvg, type DrawingItem } from "./drawings";
import { brandLabel, doorOf, ENCLOSURE_CHOICE_BRANDS, enclosureMpn, enclosureOrderText, enclosureRails, enclosureSeries, enclosureSummary, isOrientational, modelLabel, modelsOfSeries, railLimits } from "./enclosure-choice";
import { standardEnclosureMatrix, type EnclosureLike } from "./enclosures";
import { MAX_RAIL_MODULES, MAX_RAILS } from "./rails";

/** Skříň z katalogu výrobce (databáze prvků) – objednací číslo z katalogu. */
const mistral: EnclosureLike = {
  id: "e1",
  manufacturer: "ABB",
  series: "Mistral",
  model: "MISTRAL65 3×18M",
  articleNumber: "1SL1208A00",
  rows: 3,
  modulesPerRow: 18,
  totalModules: 54,
  widthMm: 430,
  heightMm: 600,
  depthMm: 155,
  ipRating: "IP65",
  installation: "SURFACE",
  material: "PLASTIC",
  pMaxW: 45,
  dataSource: "EXTERNAL",
};
const opale: EnclosureLike = { ...mistral, id: "e2", manufacturer: "Schneider", series: "mini", model: "mini Opale 13396", articleNumber: "SCHNEIDER:13396", rows: 1, modulesPerRow: 6, totalModules: 6, widthMm: 119, heightMm: 160, depthMm: 65, ipRating: "IP30", pMaxW: null };
const matrix = standardEnclosureMatrix().map((row, index) => ({ ...row, id: `s${index}` })) as EnclosureLike[];

describe("fáze 85 – výběr konkrétní skříně / rozvodnice", () => {
  it("kaskáda výrobců ABB, Eaton, Hager, Rittal, Schneider Electric, Schrack", () => {
    expect(ENCLOSURE_CHOICE_BRANDS.map((brand) => brand.label)).toEqual(["ABB", "Eaton", "Hager", "Rittal", "Schneider Electric", "Schrack"]);
    expect(brandLabel("Schneider")).toBe("Schneider Electric");
    expect(brandLabel("OEZ")).toBe("OEZ");
  });

  it("objednací číslo jen z katalogu výrobce – orientační skříň Eldocku ho nemá (nic se nevymýšlí)", () => {
    expect(enclosureMpn(mistral)).toBe("1SL1208A00");
    expect(enclosureMpn(opale)).toBe("13396");
    const amparo = matrix.find((row) => row.manufacturer === "Schrack" && row.series === "Amparo" && row.totalModules === 24)!;
    expect(isOrientational(amparo)).toBe(true);
    expect(enclosureMpn(amparo)).toBeNull();
    expect(modelLabel(amparo)).toContain("orientační");
    expect(modelLabel(mistral)).toBe("MISTRAL65 3×18M · 3× 18 M · 430 × 600 × 155 mm · IP65 · 1SL1208A00");
  });

  it("řady výrobce: katalogové před orientačními, „Golf“ a „golf“ jedna řada, modely od nejmenší", () => {
    const golf = [
      { ...mistral, id: "g1", manufacturer: "Hager", series: "Golf", model: "Golf VS 24M", articleNumber: "VS224PD", rows: 2, modulesPerRow: 12, totalModules: 24 },
      { ...mistral, id: "g2", manufacturer: "Hager", series: "golf", model: "golf VS 12M", articleNumber: "VS112PD", rows: 1, modulesPerRow: 12, totalModules: 12 },
    ];
    const hager = [...matrix.filter((row) => row.manufacturer === "Hager"), ...golf];
    const series = enclosureSeries(hager);
    expect(series[0]).toMatchObject({ label: "Golf", count: 2, orientational: false });
    expect(series.map((row) => row.label)).toEqual(["Golf", "Golf (orientační)", "Volta (orientační)"]);
    expect(modelsOfSeries(hager, series[0].key).map((row) => row.model)).toEqual(["golf VS 12M", "Golf VS 24M"]);
  });

  it("zvolená skříň určí lišty návrhu a jejich limity", () => {
    expect(enclosureRails(mistral)).toEqual([18, 18, 18]);
    expect(enclosureRails(opale)).toEqual([6]);
    expect(railLimits(mistral)).toEqual({ maxRails: 3, maxModules: 18 });
    expect(railLimits(null)).toEqual({ maxRails: MAX_RAILS, maxModules: MAX_RAIL_MODULES });
    expect(enclosureRails({ rows: 20, modulesPerRow: 60 })).toEqual(Array.from({ length: MAX_RAILS }, () => MAX_RAIL_MODULES));
  });

  it("technický popis, objednací údaje ke zkopírování a dvířka náhledu", () => {
    const summary = enclosureSummary(mistral);
    expect(summary).toMatchObject({
      title: "ABB MISTRAL65 3×18M",
      typeDesignation: "MISTRAL65 3×18M",
      description: "Plastová nástěnná (na omítku) rozvodnice MISTRAL65 3×18M, IP65, kapacita 3× 18 modulů (54 M), 600 × 430 × 155 mm (V × Š × H), P_max 45 W.",
      mpn: "1SL1208A00",
      layout: "3 řady × 18 M (celkem 54 M)",
      dimensions: "600 × 430 × 155 mm (V × Š × H)",
      execution: "Na omítku · plast · IP65 · P_max 45 W",
      door: "transparent",
    });
    const text = enclosureOrderText(mistral, { code: "PB-007", name: "RD Liberec" });
    expect(text.split("\n")).toEqual([
      "Rozvodnice / skříň: ABB MISTRAL65 3×18M",
      "Výrobce: ABB",
      "Řada: Mistral",
      "Typové označení: MISTRAL65 3×18M",
      "Popis: Plastová nástěnná (na omítku) rozvodnice MISTRAL65 3×18M, IP65, kapacita 3× 18 modulů (54 M), 600 × 430 × 155 mm (V × Š × H), P_max 45 W.",
      "Objednací číslo (MPN): 1SL1208A00",
      "Rozložení: 3 řady × 18 M (celkem 54 M)",
      "Rozměry: 600 × 430 × 155 mm (V × Š × H)",
      "Provedení: Na omítku · plast · IP65 · P_max 45 W",
      "Množství: 1 ks",
      "Projekt: PB-007 – RD Liberec",
    ]);
    const rittal = matrix.find((row) => row.manufacturer === "Rittal")!;
    expect(enclosureOrderText(rittal)).toContain("Objednací číslo (MPN): ověřte v katalogu výrobce");
    expect(enclosureSummary(rittal).source).toMatch(/Orientační rozměry/);
    expect(doorOf(rittal)).toBe("opaque");
    expect(enclosureSummary({ ...opale, installation: "FLUSH" }).description).toBe("Plastová podomítková rozvodnice mini Opale 13396, IP30, kapacita 1× 6 modulů (6 M), 160 × 119 × 65 mm (V × Š × H).");
    expect(doorOf({ ...mistral, installation: "FLUSH" })).toBe("opaque");
  });

  it("náhled čela s dvířky: kouřová průhledná dvířka přes lišty a přístroje", () => {
    const dims = { widthMm: 430, heightMm: 600, depthMm: 155, dinRailsCount: 3, modulesPerRail: 18 };
    const items: DrawingItem[] = [{ id: "i1", designation: "-F1", typeCode: "S201-B16", manufacturer: "ABB", category: "MCB", poles: "1P", dinRailIndex: 1, positionOnRail: 1, modulesWidth: 1, parentItemId: null, fedFromIncomer: false, phaseAssignment: null, circuitLabel: "" }];
    const open = renderPanelDrawingSvg(dims, items, "ABB MISTRAL65 3×18M");
    const closed = renderPanelDrawingSvg(dims, items, "ABB MISTRAL65 3×18M", undefined, undefined, { door: "transparent" });
    expect(open).not.toContain("data-door");
    expect(closed).toContain('data-door="transparent"');
    expect(closed).toContain("-F1");
    expect(renderPanelDrawingSvg(dims, items, "", undefined, undefined, { door: "opaque" })).toContain("dvířka");
  });
});
