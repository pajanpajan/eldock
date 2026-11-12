import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCatalogPhotoFile, readStoredPhotos, storeCatalogPhoto, uploadedSeriesPhotos } from "@/server/services/catalog-photo-store";

import { parsePhotoManifest, photoTarget, renderPhotoManifest, upsertPhoto, type ManifestPhoto } from "./catalog-photos";
// Fáze 104: fotky dílů řad z indexu katalogu jsou jen na serveru
import { ALL_SERIES_PHOTOS } from "@/server/catalog-data";

import { seriesPhoto, withUploadedPhotos } from "./series-photos";

// Fáze 92: reálné fotky designových řad – manifest harvesteru, nahrávač Ctrl+V (velín) a přednost fotky před renderem

const photo = (patch: Partial<ManifestPhoto> = {}): ManifestPhoto => ({ series: "ABB|Tango", color: "abb-tango-b", part: "switch", file: "abb/tango/abb-tango-b-switch.webp", source: "ABB", license: "souhlas", ...patch });
const png = (width = 64, height = 48) => sharp({ create: { width, height, channels: 3, background: { r: 230, g: 230, b: 230 } } }).png().toBuffer();

describe("fáze 92 – manifest fotek řad", () => {
  it("cíl fotky ve složce řady podle id barvy; neznámá řada, barva nebo díl → null", () => {
    expect(photoTarget("ABB|Tango", "abb-tango-b", "switch")).toEqual({ maker: "abb", folder: "tango", base: "abb-tango-b-switch" });
    expect(photoTarget("ABB|Time Arbo", null, "set")).toEqual({ maker: "abb", folder: "time-arbo", base: "rada-set" });
    expect(photoTarget("ABB|Tango", "abb-zoni-500", "switch")).toBeNull();
    expect(photoTarget("ABB|Neexistuje", null, "switch")).toBeNull();
    expect(photoTarget("ABB|Tango", null, "product" as never)).toBeNull();
  });

  it("načtení zahodí cizí cesty a neplatné položky, zápis je stabilní, stejný slot se nahradí", () => {
    const parsed = parsePhotoManifest({
      version: 1,
      photos: [photo(), photo({ file: "../../etc/passwd" }), photo({ file: "abb/zoni/abb-tango-b-switch.webp" }), photo({ part: "product" as never }), photo({ sourceUrl: "http://nesifrovane.cz" })],
    });
    expect(parsed).toHaveLength(2);
    expect(parsed[1].sourceUrl).toBeUndefined();
    const merged = upsertPhoto([photo(), photo({ color: "abb-tango-c", file: "abb/tango/abb-tango-c-switch.webp" })], photo({ source: "nová" }));
    expect(merged.filter((entry) => entry.color === "abb-tango-b")).toEqual([photo({ source: "nová" })]);
    expect(renderPhotoManifest(merged)).toBe(renderPhotoManifest([...merged].reverse()));
  });

  it("fotka má přednost před renderem, nahraná ve velínu před staženou", () => {
    expect(ALL_SERIES_PHOTOS.findIndex((entry) => !entry.photo)).toBeGreaterThanOrEqual(ALL_SERIES_PHOTOS.filter((entry) => entry.photo).length);
    const uploaded = { series: "ABB|Tango", color: "abb-tango-b", part: "switch" as const, src: "/api/catalog-images/file/abb/tango/abb-tango-b-switch.webp?v=1", source: "velín", license: "souhlas" };
    const merged = withUploadedPhotos([uploaded]);
    expect(seriesPhoto("ABB|Tango", "abb-tango-b", "switch", merged)).toMatchObject({ src: uploaded.src, photo: true });
    // Bez nahrané fotky render z public/catalog-images
    expect(seriesPhoto("ABB|Tango", "abb-tango-b", "switch", ALL_SERIES_PHOTOS)?.src).toMatch(/^\/catalog-images\/abb\/tango\//);
  });
});

describe("fáze 92 – úložiště nahraných fotek", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "eldock-fotky-"));
  });
  afterEach(async () => rm(root, { recursive: true, force: true }));

  it("obrázek ze schránky se uloží jako WebP do složky řady a do manifestu; nové nahrání slot nahradí", async () => {
    const first = await storeCatalogPhoto({ data: await png(2400, 1200), series: "ABB|Tango", color: "abb-tango-b", part: "switch", source: "ABB – web", license: "", now: new Date("2026-11-11T10:00:00Z") }, root);
    expect(first).toMatchObject({ file: "abb/tango/abb-tango-b-switch.webp", source: "ABB – web", retrievedAt: "2026-11-11T10:00:00.000Z" });
    const stored = await readCatalogPhotoFile(first.file, root);
    const meta = await sharp(stored!).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 1600, height: 800 });
    await storeCatalogPhoto({ data: await png(), series: "ABB|Tango", color: "abb-tango-b", part: "switch", source: "druhá", license: "", now: new Date("2026-11-11T11:00:00Z") }, root);
    await storeCatalogPhoto({ data: await png(), series: "ABB|Tango", color: null, part: "set", source: "", license: "", now: new Date("2026-11-11T12:00:00Z") }, root);
    expect((await readStoredPhotos(root)).map((entry) => [entry.file, entry.source])).toEqual([
      ["abb/tango/abb-tango-b-switch.webp", "druhá"],
      ["abb/tango/rada-set.webp", "Vloženo ve velínu Eldocku"],
    ]);
    const photos = await uploadedSeriesPhotos(root);
    expect(photos[0]).toMatchObject({ photo: true, src: "/api/catalog-images/file/abb/tango/abb-tango-b-switch.webp?v=2026-11-11T11%3A00%3A00.000Z" });
    expect(JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")).version).toBe(1);
  });

  it("jiný soubor než rastrový obrázek, neznámý slot a cesta mimo úložiště neprojdou", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>');
    await expect(storeCatalogPhoto({ data: svg, series: "ABB|Tango", color: null, part: "switch", source: "", license: "" }, root)).rejects.toThrow(/ne SVG/);
    await expect(storeCatalogPhoto({ data: Buffer.from("%PDF-1.7"), series: "ABB|Tango", color: null, part: "switch", source: "", license: "" }, root)).rejects.toThrow(/obrázek/);
    await expect(storeCatalogPhoto({ data: await png(), series: "ABB|Tango", color: "cizi-barva", part: "switch", source: "", license: "" }, root)).rejects.toThrow(/Neznámá designová řada/);
    expect(await readCatalogPhotoFile("../manifest.json", root)).toBeNull();
    expect(await readCatalogPhotoFile("abb/tango/../../x-switch.webp", root)).toBeNull();
    expect(await readCatalogPhotoFile("abb/tango/abb-tango-b-switch.webp", root)).toBeNull();
  });
});
