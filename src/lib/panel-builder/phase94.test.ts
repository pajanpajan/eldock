import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { ETIM_DEVICE_DEPTHS, ETIM_FRAMES, ETIM_GTIN, ETIM_SMART } from "./abb-etim.generated";
import { ABB_ETIM_COMPONENTS } from "./abb-etim-components.generated";
import { enclosureImage, productImage } from "./catalog-images";
import { CATALOG_IMAGES } from "./catalog-images.generated";
import { parsePhotoManifest } from "./catalog-photos";
import { INSTALLATION_LABELS, type EnclosureInstallation } from "./enclosures";
import { etimEnclosures, etimSeriesName } from "./etim-enclosures";
import { emptyDraft, type EditorElement, type FloorplanDraft } from "./floorplan-editor";
import { floorplanNorms } from "./floorplan-norms";
import { boxNeed, deviceDepthOf, koposBoxData, resolveBox } from "./mounting-boxes-catalog";
import { seriesPhoto } from "./series-photos";
import { VERIFIED_ENCLOSURES } from "./verified-enclosures";
import { bomTable, compileFloorplanBom } from "./wiring-bom";
import { DESIGN_BRANDS } from "./wiring-designs";

// Fáze 94: oficiální data ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – skutečné fotky v manifestu, rámečky 1R–5R s EAN,
// vestavné hloubky přístrojů v hlídači krabic, EAN v kusovníku a rozvodnice ABB navíc k ověřenému seznamu.

const IMAGES = path.join(process.cwd(), "public", "catalog-images");
const MANIFEST = parsePhotoManifest(JSON.parse(readFileSync(path.join(IMAGES, "manifest.json"), "utf8")));
const ETIM_PHOTOS = MANIFEST.filter((photo) => photo.source.includes("ETIM 9.0"));

const el = (id: string, item: string, extra: Partial<EditorElement> = {}): EditorElement => ({ id, item, x: 1000, y: 1000, room: "Obývací pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });
const drawing = (elements: EditorElement[], extra: Partial<FloorplanDraft> = {}): FloorplanDraft => ({ ...emptyDraft(), elements, ...extra });

describe("fáze 94 – manifest se skutečnými fotkami ABB (ETIM 9.0)", () => {
  it("manifest.json načte stovky fotek výrobce se zdrojem, licencí, objednacím číslem a soubor WebP je na disku", () => {
    expect(ETIM_PHOTOS.length).toBeGreaterThanOrEqual(280);
    for (const photo of ETIM_PHOTOS) {
      expect(photo.file).toMatch(/\.webp$/);
      expect(photo.sourceUrl).toMatch(/^https:\/\/cdn\.productimages\.abb\.com\//);
      expect(photo.license).toContain("ABB");
      expect(photo.mpn, photo.file).toBeTruthy();
      const file = path.join(IMAGES, ...photo.file.split("/"));
      expect(existsSync(file), photo.file).toBe(true);
      // WebP 400 × 400 – stovky B (bílý kryt na bílé) až desítky kB, ne originál z CDN
      expect(statSync(file).size).toBeGreaterThan(400);
      expect(statSync(file).size).toBeLessThan(150_000);
    }
    // Konkrétní díly: zásuvka Tango bílá, rámeček Tango, spínač Classic (reprezentativní výrobek řady bez čísla v kusovníku)
    expect(ETIM_PHOTOS.find((photo) => photo.series === "ABB|Tango" && photo.color === "abb-tango-b" && photo.part === "socket")).toMatchObject({ mpn: "6619A-A06357 B", gtin: "8592624446804" });
    expect(ETIM_PHOTOS.find((photo) => photo.series === "ABB|Tango" && photo.color === "abb-tango-b" && photo.part === "frame")?.mpn).toBe("3901A-B10 B");
    expect(ETIM_PHOTOS.find((photo) => photo.series === "ABB|Classic" && photo.color === "abb-classic-b1" && photo.part === "switch")?.mpn).toBe("3553-01289 B1");
  });

  it("fotky jsou WebP 400 × 400 px (sharp)", async () => {
    const sharp = createRequire(path.join(process.cwd(), "package.json"))("sharp") as (file: string) => { metadata: () => Promise<{ format?: string; width?: number; height?: number }> };
    for (const photo of [ETIM_PHOTOS[0], ETIM_PHOTOS[Math.floor(ETIM_PHOTOS.length / 2)], ETIM_PHOTOS.at(-1)!]) {
      const meta = await sharp(path.join(IMAGES, ...photo.file.split("/"))).metadata();
      expect(meta).toMatchObject({ format: "webp", width: 400, height: 400 });
    }
  });

  it("každá řada ABB (kromě Time Arbo, kterou data ETIM nevedou) má skutečnou fotku spínače nebo zásuvky; galerie ji bere před renderem", () => {
    const abb = DESIGN_BRANDS.find((brand) => brand.manufacturer === "ABB")!;
    const missing = abb.series.map((series) => `ABB|${series.name}`).filter((key) => !ETIM_PHOTOS.some((photo) => photo.series === key && (photo.part === "switch" || photo.part === "socket")));
    expect(missing).toEqual(["ABB|Time Arbo"]);
    // Galerie: reálná fotka (manifest → catalog-images.generated) s objednacím číslem vyfoceného dílu
    expect(seriesPhoto("ABB|Classic", "abb-classic-b1", "switch")).toMatchObject({ photo: true, mpn: "3553-01289 B1", src: "/catalog-images/abb/classic/abb-classic-b1-switch.webp" });
    expect(seriesPhoto("ABB|Tango", "abb-tango-b", "frame")).toMatchObject({ photo: true, mpn: "3901A-B10 B" });
    expect(CATALOG_IMAGES.filter((image) => image.photo && image.mpn).length).toBeGreaterThanOrEqual(ETIM_PHOTOS.length);
  });

  it("fotky rozvodnic podle objednacího čísla a výrobků chytré domácnosti", () => {
    const mistral = enclosureImage("1SLM006501A1208", CATALOG_IMAGES);
    expect(mistral?.src).toBe("/catalog-images/abb/enclosures/1slm006501a1208.webp");
    expect(existsSync(path.join(process.cwd(), "public", ...mistral!.src.split("/").filter(Boolean)))).toBe(true);
    expect(enclosureImage("NEEXISTUJE-1", CATALOG_IMAGES)).toBeNull();
    expect(enclosureImage(null, CATALOG_IMAGES)).toBeNull();
    const withPhoto = VERIFIED_ENCLOSURES.filter((row) => row.manufacturer === "ABB" && enclosureImage(row.articleNumber, CATALOG_IMAGES));
    expect(withPhoto.length).toBe(VERIFIED_ENCLOSURES.filter((row) => row.manufacturer === "ABB").length);
    expect(productImage("fah-rtc", CATALOG_IMAGES)?.src).toBe("/catalog-images/abb/smart/fah-rtc.webp");
    expect(ETIM_SMART["fah-rtc"]).toMatchObject({ mpn: "2CKA006220A0122", gtin: "4011395180099" });
  });
});

describe("fáze 94 – rámečky 1R–5R a EAN z dat výrobce", () => {
  it("rámečky řady a barvy: objednací číslo, EAN, počet násobků z ETIM = počet v kusovníku; mimo ETIM jen dvoubarevná Zoni a Swing 5R", () => {
    expect(ETIM_FRAMES["ABB|Tango|abb-tango-b"].map((frame) => [frame.gangs, frame.mpn, frame.inEtim])).toEqual([
      [1, "3901A-B10 B", true],
      [2, "3901A-B20 B", true],
      [3, "3901A-B30 B", true],
      [4, "3901A-B40 B", true],
      [5, "3901A-B50 B", true],
    ]);
    const all = Object.values(ETIM_FRAMES).flat();
    expect(all.filter((frame) => frame.inEtim).length).toBeGreaterThanOrEqual(300);
    for (const frame of all) if (frame.etimGangs !== null) expect(frame.etimGangs).toBe(frame.gangs);
    // Odvozená čísla, která výrobce v datech nevede: dvoubarevné rámečky Zoni (241–244) a rámeček Swing 5R
    const outside = all.filter((frame) => !frame.inEtim);
    expect(outside.every((frame) => /^3901T-A000[1-5]0 24[1-4]$/.test(frame.mpn) || /^3901G-A00050 /.test(frame.mpn))).toBe(true);
    expect(outside.length).toBe(25);
  });

  it("kusovník: číslo v datech ETIM má EAN a je ověřené, CSV / XLSX má sloupec EAN (GTIN)", () => {
    const bom = compileFloorplanBom(drawing([el("s", "switch-1"), el("z", "socket")], { series: "ABB|Tango", color: "abb-tango-b" }), { installation: "classic" });
    expect(bom.find((row) => row.mpn === "6619A-A06357 B")).toMatchObject({ category: "Zásuvky", verified: true, ean: "8592624446804" });
    expect(bom.find((row) => row.mpn === "3559-A01345")?.ean).toBe(ETIM_GTIN["3559-A01345"]);
    expect(bom.find((row) => row.category === "Rámečky")?.ean).toBe("8595017208782");
    // Krabice jiných výrobců EAN z dat ABB nedostanou – fáze 97: jen vlastní EAN výrobce krabice (KOPOS, stránka výrobku)
    expect(bom.filter((row) => row.box).every((row) => !row.ean || row.ean === koposBoxData(row.mpn)?.ean)).toBe(true);
    const table = bomTable(bom);
    expect(table[0]).toEqual(["Kategorie", "Objednací číslo (MPN)", "EAN (GTIN)", "Název a specifikace", "Řada a barva", "Počet", "Jednotka", "Ověření"]);
    expect(table.find((row) => row[1] === "6619A-A06357 B")).toEqual(expect.arrayContaining(["8592624446804", "data výrobce ETIM 9.0"]));
  });
});

describe("fáze 94 – vestavná hloubka přístroje v hlídači krabic KOPOS", () => {
  it("hloubka z ETIM u přístroje řady a volné místo za ním ve zvolené krabici", () => {
    expect(deviceDepthOf("ABB|Tango", "socket")).toEqual({ mpn: "6619A-A06357 B", depthMm: 40, source: "ABB ETIM 9.0" });
    expect(deviceDepthOf("ABB|Tango", "switch-1")).toEqual({ mpn: "3559-A01345", depthMm: 17, source: "ABB ETIM 9.0" });
    expect(deviceDepthOf(null, "socket")).toBeNull();
    // Zásuvka Tango 40 mm v KU 68-45 (45 mm) → 5 mm, Zoni 24,6 mm → 20,4 mm
    const tango = drawing([el("z", "socket")], { series: "ABB|Tango", color: "abb-tango-b" });
    expect(boxNeed(tango, tango.elements[0])).toMatchObject({ kind: "shallow", minDepthMm: 40, device: { depthMm: 40 } });
    expect(resolveBox(tango, tango.elements[0])).toMatchObject({ box: { type: "KU 68-45" }, freeDepthMm: 5, tooShallow: false });
    const zoni = drawing([el("z", "socket")], { series: "ABB|Zoni", color: "abb-zoni-500" });
    expect(resolveBox(zoni, zoni.elements[0]).freeDepthMm).toBe(20.4);
    // Vypínač s WAGO svorkami v hluboké KPR 68 (66 mm) – strojek 17 mm → 49 mm na svorky
    const wago = drawing([el("s", "switch-1")], { series: "ABB|Tango", color: "abb-tango-b", installation: "classic" });
    expect(resolveBox(wago, wago.elements[0])).toMatchObject({ kind: "deep", box: { type: "KPR 68" }, freeDepthMm: 49 });
  });

  it("přístroj hlubší než 40 mm chce hlubokou krabici; ručně zvolená mělká, do které se nevejde, = varování s hodnotou výrobce", () => {
    const key = "ABB|Tango|socket";
    const original = ETIM_DEVICE_DEPTHS[key];
    try {
      ETIM_DEVICE_DEPTHS[key] = { mpn: "TEST-50", depthMm: 50 };
      const auto = drawing([el("z", "socket")], { series: "ABB|Tango", color: "abb-tango-b" });
      expect(boxNeed(auto, auto.elements[0])).toMatchObject({ kind: "deep", minDepthMm: 66 });
      expect(boxNeed(auto, auto.elements[0]).reasons).toContain("vestavná hloubka přístroje 50 mm (ABB ETIM 9.0) – víc než 40 mm mělké krabice");
      expect(resolveBox(auto, auto.elements[0])).toMatchObject({ box: { type: "KPR 68" }, freeDepthMm: 16, tooShallow: false });
      const manual = drawing([el("z", "socket", { box: "shallow" })], { series: "ABB|Tango", color: "abb-tango-b" });
      expect(resolveBox(manual, manual.elements[0])).toMatchObject({ kind: "shallow", freeDepthMm: -5, tooShallow: true });
      const issue = floorplanNorms(manual).find((candidate) => candidate.rule === "box-depth");
      expect(issue?.text).toContain("Vestavná hloubka přístroje TEST-50 je podle ABB ETIM 9.0 50 mm – do zvolené krabice se nevejde (chybí 5 mm).");
      expect(issue?.source).toContain("data výrobce ABB ETIM 9.0");
    } finally {
      ETIM_DEVICE_DEPTHS[key] = original;
    }
  });
});

describe("fáze 94 – DIN přístroje a rozvodnice ABB z ETIM", () => {
  it("jistič S201-C16: EAN, ztrátový výkon 2,5 W a vestavná hloubka 69 mm podle výrobce", () => {
    expect(ABB_ETIM_COMPONENTS["2CDS251001R0164"]).toMatchObject({ ean: "4016779464406", powerLossWatts: 2.5, depthMm: 69 });
    expect(Object.keys(ABB_ETIM_COMPONENTS).length).toBeGreaterThanOrEqual(300);
  });

  it("rozvodnice navíc k ověřenému seznamu: úplné údaje, řada pro kaskádu výběru, zdroj ETIM v popisu", () => {
    const rows = etimEnclosures();
    // Jen rozvodnice, jejichž počet modulů potvrzuje i popis výrobce (multimediální a kombinované varianty vynechány)
    expect(rows.length).toBeGreaterThanOrEqual(100);
    const known = new Set(VERIFIED_ENCLOSURES.map((row) => row.articleNumber));
    for (const row of rows) {
      expect(known.has(row.articleNumber)).toBe(false);
      expect(row.series).toMatch(/^(Mistral\d+[A-Z]?|ComfortLine)/);
      expect(row.totalModules).toBe(row.rows * row.modulesPerRow);
      expect(row.ipRating).toMatch(/^IP\d{2}/);
      expect(Object.keys(INSTALLATION_LABELS)).toContain(row.installation as EnclosureInstallation);
      expect(row.description).toContain("ABB ETIM 9.0");
      const stated = /(\d+)\s*modul/i.exec(row.description) ?? /\/(\d+)\s*M\b/.exec(row.description) ?? /(\d+)\s*M\b/.exec(row.description);
      expect(Number(stated?.[1]), row.model).toBe(row.totalModules);
      expect(row.widthMm * row.heightMm * row.depthMm).toBeGreaterThan(0);
    }
    // Každá rozvodnice převzatá z ETIM má ve výběru skříně fotku výrobce
    expect(rows.filter((row) => !enclosureImage(row.articleNumber, CATALOG_IMAGES)).map((row) => row.articleNumber)).toEqual([]);
    expect(etimSeriesName("MISTRAL41W")).toBe("Mistral41W");
    expect(etimSeriesName("MISTRAL65")).toBe("Mistral65");
    expect(etimSeriesName("ComfortLine Compact CA")).toBe("ComfortLine Compact CA");
  });
});
