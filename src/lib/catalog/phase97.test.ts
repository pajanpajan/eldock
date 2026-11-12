import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { BRAND_DEVICE_DEPTHS, ETIM_FRAME_LIMITS, KOPOS_BOX_DATA } from "../panel-builder/brand-etim.generated";
import { boxImage, catalogImageEntry } from "../panel-builder/catalog-images";
import { CATALOG_IMAGES } from "../panel-builder/catalog-images.generated";
import { parsePhotoManifest, parseProductPhotos, renderPhotoManifest, upsertProductPhoto, type ManifestProductPhoto } from "../panel-builder/catalog-photos";
import { DEVICE_PHOTOS } from "../panel-builder/device-photos.generated";
import { MOUNTING_BOXES, deviceDepthOf } from "../panel-builder/mounting-boxes-catalog";
import { frameRulesOf } from "../panel-builder/residential-series-catalog";
import { DESIGN_BRANDS } from "../panel-builder/wiring-designs";
import { detectColumns, findHeaderRow, imageFormat, imageProblem, millimetres, oezSlug, packageKind, parseKoposProductPage, parseOezProductPage, parseRobots, robotsAllows, validGtin, zipEntryEncrypted } from "./manufacturer-data";
import { wiringPhotoPicks, type WiringRecord } from "./series-photo-targets";
import { catalogEan } from "@/server/catalog-data";

// Fáze 97: vyhledání a stažení datových balíčků výrobců, univerzální parser a promítnutí dat do katalogů Eldocku.

const ROOT = path.join(__dirname, "..", "..", "..");
const jpeg = (size: number) => Uint8Array.from({ length: size }, (_, index) => (index < 3 ? [0xff, 0xd8, 0xff][index] : index % 251));

describe("fáze 97 – robots.txt", () => {
  const legrand = parseRobots(["User-agent: *", "Disallow: /core/", "Disallow: /node/*", "", "User-agent: *", "Disallow: *?page=*", "Disallow: *?items_per_page=*"].join("\n"));

  it("sloučí opakované skupiny * a dodrží zákaz stránkování i cest", () => {
    expect(robotsAllows(legrand, "/cs/katalog/produkty/valena-life-spinac-c1-bila-752101")).toBe(true);
    expect(robotsAllows(legrand, "/cs/e-katalog-0/valena-life?page=2")).toBe(false);
    expect(robotsAllows(legrand, "/cs/sitemap.xml?page=1")).toBe(false);
    expect(robotsAllows(legrand, "/core/misc/drupal.js")).toBe(false);
  });

  it("nejdelší pravidlo rozhoduje, prázdný Disallow nic nezakazuje, $ = konec cesty", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /misc/\nAllow: /misc/*.css$\nDisallow:\n");
    expect(robotsAllows(rules, "/misc/style.css")).toBe(true);
    expect(robotsAllows(rules, "/misc/style.css?v=2")).toBe(false);
    expect(robotsAllows(rules, "/cs/produkt/12902-krabice-univerzalni")).toBe(true);
    expect(robotsAllows(parseRobots("User-agent: *\nDisallow: *artnr=*\n"), "/cz/katalog/?artnr=WL5310&file=datasheet")).toBe(false);
  });

  it("vlastní skupina robota má přednost před *", () => {
    const rules = parseRobots("User-agent: AhrefsBot\nDisallow: /\n\nUser-agent: *\nDisallow: /sitecore\n", "catalog-data-fetch");
    expect(robotsAllows(rules, "/cz/katalog/produkt/10253609")).toBe(true);
    expect(robotsAllows(parseRobots("User-agent: AhrefsBot\nDisallow: /\n", "AhrefsBot/7.0"), "/cz")).toBe(false);
  });
});

describe("fáze 97 – druh souboru a kontrola fotek", () => {
  it("pozná ZIP / XLSX, zaheslovaný sešit Office, chybovou stránku HTML a XML", () => {
    expect(packageKind("Hager_BMEcat_ETIM10.zip", Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe("zip");
    expect(packageKind("cenik_kopos_platny_od_01082026.xlsx", Uint8Array.from([0x50, 0x4b, 0x03, 0x04]))).toBe("xlsx");
    expect(packageKind("LEGRAND_BTICINO_brutto_ceník.xlsx", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))).toBe("encrypted-office");
    expect(packageKind("data.xml", new TextEncoder().encode("<!DOCTYPE html><html>404</html>"))).toBe("html");
    expect(packageKind("BMEcat_CZ_10.xml", new TextEncoder().encode('<?xml version="1.0"?><BMECAT>'))).toBe("xml");
  });

  it("zašifrovaná položka ZIPu (bit 0 příznaků lokální hlavičky – Legrand ETIM V10)", () => {
    expect(zipEntryEncrypted(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00]))).toBe(true);
    expect(zipEntryEncrypted(Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x08]))).toBe(false);
  });

  it("fotka projde jen s HTTP 200, image/*, nad 1,5 kB a platnou hlavičkou", () => {
    expect(imageFormat(jpeg(10))).toBe("jpeg");
    expect(imageFormat(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
    expect(imageProblem({ status: 200, contentType: "image/jpeg", bytes: jpeg(22_566) })).toBeNull();
    // Zástupný obrázek Schneider „DefaultProductImage.png“ (201 × 201, 1 329 B)
    expect(imageProblem({ status: 200, contentType: "image/png", bytes: Uint8Array.from({ length: 1329 }, (_, index) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index] ?? 0) })).toMatch(/1329 B/);
    expect(imageProblem({ status: 404, contentType: "text/html", bytes: new Uint8Array(1345) })).toBe("HTTP 404");
    expect(imageProblem({ status: 200, contentType: "text/html; charset=utf-8", bytes: new TextEncoder().encode("<html>".padEnd(5000, " ")) })).toMatch(/Content-Type/);
    expect(imageProblem({ status: 200, contentType: "image/jpeg", bytes: new TextEncoder().encode("<!DOCTYPE html>".padEnd(5000, " ")) })).toMatch(/hlavička/);
    // Položka archivu (fotobanka Legrand) – bez hlavičky HTTP, kontroluje se velikost a hlavička
    expect(imageProblem({ bytes: jpeg(40_000) })).toBeNull();
  });
});

describe("fáze 97 – tabulky a stránky výrobců", () => {
  it("rozpozná záhlaví ceníku KOPOS (až na 15. řádku) i listu Hager ETIM", () => {
    const kopos = [[""], ["", "", "", "Elektroinstalační úložný materiál KOPOS KOLÍN a. s. - základní ceník"], ["Položka", "Název položky", "Popis", "cena od 1. 8. 2026 CZK/1000MJ", "aktuální cena CZK/1000MJ", "Rabatová \r\nskupina", "MJ", "EAN"]];
    expect(findHeaderRow(kopos)).toBe(2);
    expect(detectColumns(kopos[2])).toMatchObject({ mpn: 0, name: 1, description: 2, price: 3, ean: 7 });
    expect(detectColumns(["comrefname", "ShortDescription", "LongDescription", "ETIM Class", "BaseUnitOfMeasure", "PackTypeL0EAN", "PackTypeL1EAN"])).toMatchObject({ mpn: 0, name: 1, description: 2, etimClass: 3, ean: 5 });
    expect(detectColumns(["ComRefName", "Datasheet", "Product page", "Product_ProductMainPicture_StandardSizeL2160xwebp"])).toMatchObject({ mpn: 0, datasheet: 1, page: 2, image: 3 });
  });

  it("EAN / GTIN s kontrolní číslicí", () => {
    expect(validGtin("8595568936233")).toBe(true);
    expect(validGtin("4011334383352")).toBe(true);
    expect(validGtin("8595568936234")).toBe(false);
    expect(validGtin("39259081")).toBe(false);
    expect(validGtin("12345")).toBe(false);
    expect(millimetres("45 mm")).toBe(45);
    expect(millimetres("79,7 mm")).toBe(79.7);
    expect(millimetres("0,045 m")).toBe(45);
    expect(millimetres("ano")).toBeNull();
  });

  it("stránka výrobku e-shopu KOPOS → kód, EAN, hloubka, průměr, fotka a datový list", () => {
    const html = `<title>KU 68-45_KA | KOPOS KOLÍN a.s.</title><h1 class="page__title title" id="page-title">Krabice univerzální</h1><div class="undertitle">KU 68-45_KA</div>
      <a href="https://www.kopos.cz/sites/default/files/product/2022/08/08/ku68-45_vykres.jpg">výkres</a><a href="https://www.kopos.cz/sites/default/files/product/2022/08/08/ku_68-45.jpg">foto</a>
      <table><tbody><tr class="odd"><td>EAN kód</td><td>8595568936233</td></tr><tr class="even"><td>Materiál</td><td>PVC</td></tr><tr class="odd"><td>Průměr</td><td>71 mm</td></tr><tr class="even"><td>Hloubka</td><td>45 mm</td></tr></tbody></table>
      <table><caption>Datový list</caption><tbody><tr><td><a href="https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45_cz.pdf">ku68-45_cz.pdf</a></td></tr></tbody></table>`;
    expect(parseKoposProductPage(html, "https://www.kopos.cz/cs/produkt/12902-krabice-univerzalni")).toMatchObject({ code: "KU 68-45_KA", type: "KU 68-45", name: "Krabice univerzální", ean: "8595568936233", depthMm: 45, diameterMm: 71, material: "PVC", halogenFree: false, image: "https://www.kopos.cz/sites/default/files/product/2022/08/08/ku_68-45.jpg", drawing: "https://www.kopos.cz/sites/default/files/product/2022/08/08/ku68-45_vykres.jpg", datasheet: "https://www.kopos.cz/sites/default/files/product_attachments/2026/09/ku68-45_cz.pdf" });
    expect(parseKoposProductPage(html.replace(/KU 68-45_KA/g, "KU 68-45/HF_HA"), "x")?.halogenFree).toBe(true);
    expect(parseKoposProductPage("<html>Nenalezeno</html>", "x")).toBeNull();
  });

  it("stránka výrobku OEZ → typ, objednací kód, EAN, moduly, hloubka a fotka; slug nerozliší 1,6 A od 16 A", () => {
    const html = `<h1 itemprop="name">LTN-1,6B-1</h1><div class="kratky_popis"><div class="popis_label">Popis produktu:</div>In 1,6 A, charakteristika B, 1pól</div>
      <td class="td_katalog_detail_polozka">OEZ:46634</td><td class="td_katalog_detail_polozka">8590125466345</td>
      <a href="pic_zbozi/628516_LTN-1,6B-1.jpg" rel="prettyPhoto[detail]" title="LTN-1,6B-1" id="det-img-a"><img src="x"></a>
      <table><tr><td>Krytí</td><td>IP20</td></tr><tr><td>Počet modulů</td><td>1</td></tr><tr><td>Počet pólů</td><td>1</td></tr><tr><td>Hloubka (netto)</td><td>79,7 mm</td></tr></table>`;
    expect(parseOezProductPage(html, "https://www.oez.cz/ltn-16b-1")).toMatchObject({ type: "LTN-1,6B-1", orderCode: "46634", ean: "8590125466345", modules: 1, poles: 1, depthMm: 79.7, ip: "IP20", image: "https://www.oez.cz/pic_zbozi/628516_LTN-1,6B-1.jpg" });
    expect(oezSlug("LTN-1,6B-1")).toBe(oezSlug("LTN-16B-1"));
    expect(oezSlug("RZG-Z-1S8")).toBe("rzg-z-1s8");
  });
});

describe("fáze 97 – výběr dílů řad pro galerii", () => {
  const record = (article: string, category: string, features: Record<string, unknown>, title = article): WiringRecord => ({ brand: "SCHNEIDER", article, ean: null, title, series: "Asfora", category, features });
  const records = [
    record("KIT_EPH0100121X10", "WD_SWITCH", { wd_role: "complete", wd_switch_no: "1", wd_rockers: 1, wd_color_family: "white" }, "Asfora spínač č.1 bílý balení 10 ks"),
    record("EPH0100121", "WD_SWITCH", { wd_role: "complete", wd_switch_no: "1", wd_rockers: 1, wd_color_family: "white" }, "Asfora vypínač č.1 bílý"),
    record("EPH0100321", "WD_SWITCH", { wd_role: "complete", wd_switch_no: "6", wd_rockers: 1, wd_color_family: "white" }),
    record("EPH2800121", "WD_SOCKET", { wd_role: "complete", wd_cover_kind: "socket", wd_slots: 1, wd_color_family: "white" }, "Asfora zásuvka bílá"),
    record("EPH2900121", "WD_SOCKET", { wd_role: "complete", wd_cover_kind: "socket", wd_slots: 1, wd_color_family: "white", wd_ip: "IP44" }, "Asfora zásuvka IP44 bílá"),
    record("EPH5800121", "WD_FRAME", { wd_frame_units: 1, wd_color_family: "white" }),
    record("EPH5800321", "WD_FRAME", { wd_frame_units: 3, wd_color_family: "white" }),
    record("EPH5800221", "WD_FRAME", { wd_frame_units: 2, wd_color_family: "white" }),
    record("EPH0100171", "WD_SWITCH", { wd_role: "complete", wd_switch_no: "1", wd_rockers: 1, wd_color_family: "anthracite" }, "Asfora vypínač č.1 antracit"),
  ];

  it("spínač č. 1, zásuvka, rámeček 1R a vícerámeček 2R podle barvy – bez sad a IP44", () => {
    const picks = wiringPhotoPicks(records, DESIGN_BRANDS, ["Schneider"]);
    const of = (color: string, part: string) => picks.find((pick) => pick.colorId === color && pick.part === part)?.mpn;
    expect(of("white", "switch")).toBe("EPH0100121");
    expect(of("white", "socket")).toBe("EPH2800121");
    expect(of("white", "frame")).toBe("EPH5800121");
    expect(of("white", "set")).toBe("EPH5800221");
    expect(of("black", "switch")).toBe("EPH0100171");
    expect(of("ivory", "switch")).toBeUndefined();
    expect(picks.every((pick) => pick.seriesKey === "Schneider|Asfora")).toBe(true);
  });
});

describe("fáze 97 – manifest fotek výrobků", () => {
  const box: ManifestProductPhoto = { kind: "box", brand: "KOPOS", mpn: "KU 68-45_KA", file: "kopos/boxes/ku-68-45-ka.webp", source: "KOPOS KOLÍN – e-shop kopos.cz", license: "fotka výrobce KOPOS", sourceUrl: "https://www.kopos.cz/sites/default/files/product/2022/08/08/ku_68-45.jpg", gtin: "8595568936233" };

  it("fotky výrobků se načtou, cizí složka se zahodí a zápis je zachová", () => {
    const parsed = parseProductPhotos({ version: 1, photos: [], products: [box, { ...box, file: "../etc/passwd.webp" }, { ...box, kind: "device", file: "kopos/boxes/x.webp" }] });
    expect(parsed).toEqual([box]);
    const rendered = JSON.parse(renderPhotoManifest([], upsertProductPhoto(parsed, { ...box, gtin: "8595568936233" })));
    expect(rendered.products).toHaveLength(1);
    expect(parsePhotoManifest(rendered)).toEqual([]);
  });

  it("složka boxes → fotka krabice podle objednacího kódu", () => {
    const entry = catalogImageEntry("kopos", "boxes", "ku-68-45-ka.webp", { source: "s", license: "l" }, { photo: true });
    expect(entry).toMatchObject({ series: "box", color: "ku-68-45-ka", part: "product", src: "/catalog-images/kopos/boxes/ku-68-45-ka.webp" });
    expect(boxImage("KU 68-45_KA", entry ? [entry] : [])?.src).toBe("/catalog-images/kopos/boxes/ku-68-45-ka.webp");
    expect(boxImage(null, entry ? [entry] : [])).toBeNull();
  });

  it("manifest.json: každá fotka výrobku má soubor WebP, zdroj, licenci a platný GTIN", () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, "public", "catalog-images", "manifest.json"), "utf8"));
    const products = parseProductPhotos(manifest);
    expect(products.length).toBe((manifest.products ?? []).length);
    for (const product of products) {
      expect(existsSync(path.join(ROOT, "public", "catalog-images", ...product.file.split("/"))), product.file).toBe(true);
      expect(product.license).toMatch(/provozovatel/);
      if (product.gtin) expect(validGtin(product.gtin), product.mpn).toBe(true);
    }
    // Fotky řad všech výrobců v manifestu mají soubor
    for (const photo of parsePhotoManifest(manifest)) expect(existsSync(path.join(ROOT, "public", "catalog-images", ...photo.file.split("/"))), photo.file).toBe(true);
  });
});

describe("fáze 97 – data výrobců v katalozích Eldocku", () => {
  it("krabice KOPOS: data jen ke krabicím katalogu, platný EAN, fotka a hloubka u krabic do zdiva / SDK", () => {
    const codes = new Set(MOUNTING_BOXES.filter((entry) => entry.maker === "kopos").map((entry) => entry.code));
    for (const [code, data] of Object.entries(KOPOS_BOX_DATA)) {
      expect(codes.has(code), code).toBe(true);
      if (data.ean) expect(validGtin(data.ean), code).toBe(true);
      const own = MOUNTING_BOXES.find((entry) => entry.code === code)!;
      // Fáze 104: EAN krabice jen na serveru (veřejný katalog krabic EAN nemá)
      if (data.ean) expect(catalogEan(code, "box")).toBe(data.ean);
      expect("ean" in own).toBe(false);
      if (data.depthMm && ["shallow", "deep", "electronics"].includes(own.role)) expect(own.depthMm).toBe(data.depthMm);
      if (existsSync(path.join(ROOT, "public", "catalog-images", "kopos", "boxes"))) expect(boxImage(code, CATALOG_IMAGES), code).not.toBeNull();
    }
  });

  it("vestavné hloubky a rámečky řad Hager patří řadám katalogu a promítnou se do pravidel a hlídače krabic", () => {
    const series = new Set(DESIGN_BRANDS.flatMap((brand) => brand.series.map((option) => `${brand.manufacturer}|${option.name}`)));
    for (const [key, depth] of Object.entries(BRAND_DEVICE_DEPTHS)) {
      const [manufacturer, name, item] = key.split("|");
      expect(series.has(`${manufacturer}|${name}`), key).toBe(true);
      expect(depth.depthMm).toBeGreaterThan(10);
      expect(depth.depthMm).toBeLessThan(120);
      expect(deviceDepthOf(`${manufacturer}|${name}`, item)).toMatchObject({ depthMm: depth.depthMm, source: depth.source });
    }
    for (const [key, limit] of Object.entries(ETIM_FRAME_LIMITS)) {
      expect(series.has(key), key).toBe(true);
      expect(limit.maxFrameGang).toBeGreaterThanOrEqual(1);
      expect(limit.maxFrameGang).toBeLessThanOrEqual(5);
      expect(frameRulesOf(key).maxFrameGang).toBe(limit.maxFrameGang);
      expect(frameRulesOf(key).source).toMatch(/ETIM/);
    }
    // ABB zůstává podle ETIM 9.0 (fáze 94)
    expect(deviceDepthOf("ABB|Tango", "socket")?.source ?? "ABB ETIM 9.0").toBe("ABB ETIM 9.0");
  });

  it("fotky DIN přístrojů: soubor existuje, klíč = slug objednacího čísla", () => {
    for (const [key, [src]] of Object.entries(DEVICE_PHOTOS)) {
      expect(key).toMatch(/^[a-z0-9-]+$/);
      expect(src).toMatch(/^\/catalog-images\/[a-z0-9-]+\/devices\/[a-z0-9-]+\.webp$/);
      expect(existsSync(path.join(ROOT, "public", ...src.split("/").filter(Boolean))), src).toBe(true);
    }
  });
});
