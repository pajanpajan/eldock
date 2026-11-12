import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CATALOG_IMAGES } from "@/lib/panel-builder/catalog-images.generated";
import { DEVICE_PHOTOS } from "@/lib/panel-builder/device-photos.generated";

// Fáze 99: žádný rozbitý obrázek na prezentaci – každá cesta katalogu (fotky řad, krabic, rozvodnic, chytré domácnosti,
// DIN přístrojů) i záznam manifestu ukazuje na existující, nepoškozený soubor WebP v public/.
const ROOT = path.join(__dirname, "..", "..", "..");
const PUBLIC = path.join(ROOT, "public");

function problem(publicPath: string): string | null {
  const file = path.join(PUBLIC, ...publicPath.replace(/^\//, "").split("/"));
  if (!existsSync(file)) return "soubor chybí";
  const size = statSync(file).size;
  // WebP 400 × 400 jednoduché bílé rozvodnice má i jen ~1 kB – pod 300 B by šlo o prázdný / uříznutý soubor
  if (size < 300) return `podezřele malý soubor (${size} B)`;
  if (publicPath.endsWith(".webp")) {
    const head = Buffer.alloc(12);
    const handle = openSync(file, "r");
    readSync(handle, head, 0, 12, 0);
    closeSync(handle);
    if (head.toString("latin1", 0, 4) !== "RIFF" || head.toString("latin1", 8, 12) !== "WEBP") return "není platný WebP";
  }
  return null;
}

describe("fáze 99 – obrázky katalogu existují a jsou platné", () => {
  it("všechny cesty CATALOG_IMAGES (řady, krabice, rozvodnice, chytrá domácnost)", () => {
    const bad = CATALOG_IMAGES.filter((image) => image.src.startsWith("/")).flatMap((image) => {
      const issue = problem(image.src);
      return issue ? [`${image.src}: ${issue}`] : [];
    });
    expect(bad).toEqual([]);
    expect(CATALOG_IMAGES.length).toBeGreaterThan(500);
  });

  it("všechny fotky DIN přístrojů (DEVICE_PHOTOS)", () => {
    const bad = Object.values(DEVICE_PHOTOS).flatMap(([src]) => {
      const issue = problem(src);
      return issue ? [`${src}: ${issue}`] : [];
    });
    expect(bad).toEqual([]);
  });

  it("manifest.json: fotky řad i výrobků", () => {
    const manifest = JSON.parse(readFileSync(path.join(PUBLIC, "catalog-images", "manifest.json"), "utf8")) as { photos?: { file: string }[]; products?: { file: string }[] };
    const files = [...(manifest.photos ?? []), ...(manifest.products ?? [])].map((entry) => `/catalog-images/${entry.file}`);
    expect(files.length).toBeGreaterThan(100);
    const bad = files.flatMap((src) => {
      const issue = problem(src);
      return issue ? [`${src}: ${issue}`] : [];
    });
    expect(bad).toEqual([]);
  });
});
