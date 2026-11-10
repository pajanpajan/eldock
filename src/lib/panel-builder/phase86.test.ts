import { describe, expect, it } from "vitest";

import { ENCLOSURE_CHOICE_BRANDS, doorOf, enclosureMpn, enclosureRails, enclosureSeries, enclosureSummary, isOrientational, modelLabel, modelsOfSeries } from "./enclosure-choice";
import { standardEnclosureMatrix, type EnclosureLike } from "./enclosures";
import { MAX_RAIL_MODULES, MAX_RAILS, MIN_RAIL_MODULES } from "./rails";
import { VERIFIED_ENCLOSURES, VERIFIED_ENCLOSURE_SOURCE, enclosureSourceUrl, verifiedEnclosureData } from "./verified-enclosures";

const rows = VERIFIED_ENCLOSURES.map((row, index) => ({ ...verifiedEnclosureData(row), id: `v${index}` })) as (EnclosureLike & { description: string })[];
const matrix = standardEnclosureMatrix().map((row, index) => ({ ...row, id: `s${index}` })) as EnclosureLike[];
const of = (series: string) => VERIFIED_ENCLOSURES.filter((row) => row.series === series);
const mpns = (series: string) => of(series).map((row) => row.articleNumber).sort();
const row = (mpn: string) => rows.find((enclosure) => enclosure.articleNumber === mpn)!;
const cascade = (manufacturer: string) => enclosureSeries([...rows, ...matrix].filter((enclosure) => enclosure.manufacturer === manufacturer)).map((series) => `${series.label} (${series.count})`);

/** Oficiální stránky výrobců, ze kterých údaje jsou. */
const SOURCES: Record<string, string> = { ABB: "https://nizke-napeti.cz.abb.com/", Hager: "https://hager.com/cz/katalog/produkt/", Schrack: "https://www.schrack.cz/eshop/" };

describe("fáze 86 – ověřené rozvodnice z katalogů výrobců", () => {
  it("počty modelů po výrobcích a řadách", () => {
    expect(VERIFIED_ENCLOSURES).toHaveLength(91);
    const count = (key: "manufacturer" | "series") => Object.fromEntries([...new Set(VERIFIED_ENCLOSURES.map((enclosure) => enclosure[key]))].map((value) => [value, VERIFIED_ENCLOSURES.filter((enclosure) => enclosure[key] === value).length]));
    expect(count("manufacturer")).toEqual({ ABB: 31, Hager: 23, Schrack: 37 });
    expect(count("series")).toEqual({
      "ComfortLine CA (rozteč 125 mm)": 16,
      "ComfortLine CA (rozteč 150 mm)": 15,
      "Vector II": 9,
      "Univers FWU": 14,
      "TOPO nástěnná": 21,
      "TOPO zapuštěná": 16,
    });
  });

  it("objednací čísla (MPN) každé řady", () => {
    expect(mpns("ComfortLine CA (rozteč 125 mm)")).toEqual(Array.from({ length: 16 }, (_, index) => `2CPX0521${80 + index}R9999`));
    expect(mpns("ComfortLine CA (rozteč 150 mm)")).toEqual(["229", "230", "231", "232", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244"].map((suffix) => `2CPX052${suffix}R9999`));
    expect(mpns("Vector II")).toEqual(["VE106SN", "VE110SN", "VE112SN", "VE118SN", "VE212SN", "VE218SN", "VE312SN", "VE318SN", "VE412SN"]);
    expect(mpns("Univers FWU")).toEqual(["FWU31S", "FWU32S", "FWU33S", "FWU41S", "FWU42S", "FWU43S", "FWU51S", "FWU52S", "FWU53S", "FWU61S", "FWU62S", "FWU63S", "FWU71S", "FWU72S"]);
    expect(mpns("TOPO nástěnná")).toEqual(
      ["100", "101", "102", "103", "104", "105", "106", "107", "108", "110", "150", "151", "152", "153", "154", "155", "156", "157", "158", "159", "160"].map((suffix) => `BK080${suffix}--`),
    );
    expect(mpns("TOPO zapuštěná")).toEqual(["001", "002", "003", "004", "006", "007", "008", "050", "051", "052", "053", "054", "055", "056", "058", "059"].map((suffix) => `BK080${suffix}--`));
    // Typy s rozpornými nebo chybějícími údaji výrobce nejsou (nic se nedopočítává)
    for (const missing of ["FWU73S", "BK080109--", "BK080113--", "BK080163--", "BK080057--", "2CPX052233R9999"]) expect(rows.some((enclosure) => enclosure.articleNumber === missing)).toBe(false);
  });

  it("údaje jsou úplné a vnitřně konzistentní, se zdrojem u každého typu", () => {
    expect(new Set(rows.map((enclosure) => enclosure.articleNumber)).size).toBe(rows.length);
    for (const enclosure of VERIFIED_ENCLOSURES) {
      expect(enclosure.totalModules).toBe(enclosure.rows * enclosure.modulesPerRow);
      expect(enclosure.rows).toBeGreaterThanOrEqual(1);
      expect(enclosure.rows).toBeLessThanOrEqual(MAX_RAILS);
      expect(enclosure.modulesPerRow).toBeGreaterThanOrEqual(MIN_RAIL_MODULES);
      expect(enclosure.modulesPerRow).toBeLessThanOrEqual(MAX_RAIL_MODULES);
      expect(Math.min(enclosure.widthMm, enclosure.heightMm, enclosure.depthMm)).toBeGreaterThan(90);
      expect(enclosure.ipRating).toMatch(/^IP\d\d$/);
      expect(["SURFACE", "FLUSH"]).toContain(enclosure.installation);
      expect(["PLASTIC", "PAINTED_STEEL"]).toContain(enclosure.material);
      expect(enclosure.dataSource).toBe(VERIFIED_ENCLOSURE_SOURCE);
      // Odkaz vede na oficiální stránku výrobce s týmž objednacím číslem a je i v popisu
      expect(enclosure.sourceUrl.startsWith(SOURCES[enclosure.manufacturer])).toBe(true);
      expect(enclosure.sourceUrl.toLowerCase()).toContain(enclosure.articleNumber.replace(/-+$/, "").toLowerCase());
      expect(enclosure.description).toContain(`Zdroj: ${enclosure.sourceUrl}`);
      expect(enclosureSourceUrl(enclosure.description)).toBe(enclosure.sourceUrl);
      // P_max jen tam, kde ho výrobce uvádí (Schrack „ztrátový výkon“)
      expect(enclosure.pMaxW === null).toBe(enclosure.manufacturer !== "Schrack");
    }
    expect(verifiedEnclosureData(VERIFIED_ENCLOSURES[0])).not.toHaveProperty("sourceUrl");
  });

  it("orientační matice Eldocku je nepřebije – žádný klíč `STD-…` ani shodné objednací číslo", () => {
    const matrixKeys = new Set(matrix.map((enclosure) => enclosure.articleNumber));
    for (const enclosure of rows) {
      expect(enclosure.articleNumber.startsWith("STD-")).toBe(false);
      expect(matrixKeys.has(enclosure.articleNumber)).toBe(false);
      expect(isOrientational(enclosure)).toBe(false);
    }
  });

  it("vybrané typy podle stránek výrobců", () => {
    expect(row("2CPX052241R9999")).toMatchObject({ manufacturer: "ABB", model: "CA35R (3 pole po 12 M)", rows: 4, modulesPerRow: 36, totalModules: 144, widthMm: 800, heightMm: 800, depthMm: 160, ipRating: "IP44", installation: "SURFACE", material: "PAINTED_STEEL", pMaxW: null });
    expect(row("2CPX052180R9999")).toMatchObject({ model: "CA13V", rows: 3, modulesPerRow: 12, widthMm: 300, heightMm: 500, depthMm: 160 });
    expect(row("2CPX052195R9999")).toMatchObject({ model: "CA45V (4 pole po 12 M)", rows: 5, modulesPerRow: 48, totalModules: 240, widthMm: 1050, heightMm: 800 });
    expect(row("VE412SN")).toMatchObject({ manufacturer: "Hager", series: "Vector II", rows: 4, modulesPerRow: 12, heightMm: 677, widthMm: 310, depthMm: 151, ipRating: "IP65", installation: "SURFACE", material: "PLASTIC" });
    expect(row("FWU32S")).toMatchObject({ model: "Univers FWU32S (2 pole po 12 M)", rows: 3, modulesPerRow: 24, totalModules: 72, heightMm: 553, widthMm: 603, depthMm: 125, ipRating: "IP30", installation: "FLUSH", material: "PAINTED_STEEL" });
    expect(row("BK080151--")).toMatchObject({ manufacturer: "Schrack", series: "TOPO nástěnná", model: "TOPO 1×12, dveře bílé", rows: 1, modulesPerRow: 12, widthMm: 287, heightMm: 235, depthMm: 112, ipRating: "IP40", pMaxW: 23 });
    expect(row("BK080059--")).toMatchObject({ series: "TOPO zapuštěná", rows: 4, modulesPerRow: 12, heightMm: 674, widthMm: 282, depthMm: 108, installation: "FLUSH", pMaxW: 44 });
    expect(row("BK080100--").model).toBe("TOPO 1×8 (4+4), dveře průhledné");
  });

  it("kaskáda: nové řady s MPN před orientačními, Rittal a Eaton beze změny", () => {
    expect(ENCLOSURE_CHOICE_BRANDS.map((brand) => brand.value)).toEqual(expect.arrayContaining(["ABB", "Hager", "Schrack"]));
    expect(cascade("ABB")).toEqual(["ComfortLine CA (rozteč 125 mm) (16)", "ComfortLine CA (rozteč 150 mm) (15)", "Mistral41W (orientační) (12)", "UK600 (orientační) (9)"]);
    expect(cascade("Hager")).toEqual(["Univers FWU (14)", "Vector II (9)", "Golf (orientační) (12)", "Volta (orientační) (9)"]);
    expect(cascade("Schrack")).toEqual(["TOPO nástěnná (21)", "TOPO zapuštěná (16)", "Amparo (orientační) (12)", "Amparo UP (orientační) (9)"]);
    expect(cascade("Rittal")).toEqual(["AX (orientační) (12)"]);
    const hager = rows.filter((enclosure) => enclosure.manufacturer === "Hager");
    const vector = enclosureSeries(hager).find((series) => series.label === "Vector II")!;
    expect(modelsOfSeries(hager, vector.key).map((enclosure) => enclosure.articleNumber)).toEqual(["VE106SN", "VE110SN", "VE112SN", "VE118SN", "VE212SN", "VE218SN", "VE312SN", "VE412SN", "VE318SN"]);
    expect(modelLabel(row("BK080151--"))).toBe("TOPO 1×12, dveře bílé · 1× 12 M · 287 × 235 × 112 mm · IP40 · BK080151--");
    expect(enclosureMpn(row("2CPX052183R9999"))).toBe("2CPX052183R9999");
    expect(enclosureRails(row("2CPX052195R9999"))).toEqual([48, 48, 48, 48, 48]);
  });

  it("souhrn skříně: popis, zdroj s odkazem na výrobce a dvířka náhledu", () => {
    const vector = enclosureSummary(row("VE412SN"));
    expect(vector).toMatchObject({
      title: "Hager Vector II VE412SN",
      mpn: "VE412SN",
      orientational: false,
      layout: "4 řady × 12 M (celkem 48 M)",
      dimensions: "677 × 310 × 151 mm (V × Š × H)",
      source: "Údaje z oficiálního katalogu výrobce (ověřeno 10. 11. 2026).",
      sourceUrl: "https://hager.com/cz/katalog/produkt/ve412sn-rozvod-nasten-uv-vector-ii-ip65-48m",
      door: "transparent",
    });
    expect(enclosureSummary(row("BK080153--"))).toMatchObject({ execution: "Na omítku · plast · IP40 · P_max 44 W", door: "opaque" });
    // Dvířka: průhledná jen tam, kde to výrobce uvádí
    expect(doorOf(row("BK080101--"))).toBe("transparent");
    expect(doorOf(row("BK080001--"))).toBe("transparent");
    expect(doorOf(row("BK080051--"))).toBe("opaque");
    expect(doorOf(row("2CPX052230R9999"))).toBe("opaque");
    expect(doorOf(row("FWU42S"))).toBe("opaque");
    // Skříň z importu databáze prvků a orientační matice beze změny
    const amparo = matrix.find((enclosure) => enclosure.manufacturer === "Schrack" && enclosure.series === "Amparo")!;
    expect(enclosureSummary(amparo)).toMatchObject({ mpn: null, sourceUrl: null, source: "Orientační rozměry Eldocku – typ i objednací číslo ověřte v katalogu výrobce." });
    expect(enclosureSummary({ ...row("VE112SN"), dataSource: "EXTERNAL", description: "Rozvodnice VE112SN" })).toMatchObject({ source: "Údaje z katalogu výrobce (databáze prvků Eldocku).", sourceUrl: null });
  });
});
