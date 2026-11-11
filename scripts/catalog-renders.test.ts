import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CATALOG_IMAGES } from "../src/lib/panel-builder/catalog-images.generated";
import { RENDER_SERIES, renderPlan, renderSeriesSvg } from "../src/lib/panel-builder/series-render";
import { seriesPhoto } from "../src/lib/panel-builder/series-photos";
import { designSeriesOf } from "../src/lib/panel-builder/wiring-designs";
import { CATALOG_IMAGES_DIR } from "./catalog-images";
import { MAKER_DIRS } from "./catalog-renders";

const normalize = (text: string) => text.replace(/\r\n/g, "\n");

describe("fáze 80 – produktové náhledy řad ABB (public/catalog-images)", () => {
  it("rendery na disku odpovídají kódu (jinak spusťte npm run catalog:renders) a manifest je obsahuje", () => {
    const plan = renderPlan();
    expect(plan.filter((file) => file.path.endsWith(".svg")).length).toBeGreaterThanOrEqual(6 * 4 * 3);
    for (const file of plan) {
      const target = path.join(CATALOG_IMAGES_DIR, file.path);
      expect(existsSync(target), file.path).toBe(true);
      expect(normalize(readFileSync(target, "utf8")), file.path).toBe(file.content);
    }
    for (const maker of MAKER_DIRS) expect(existsSync(path.join(CATALOG_IMAGES_DIR, maker)), maker).toBe(true);
    // Každá barva šesti klíčových řad má v manifestu spínač, zásuvku i víceramček 3R
    for (const key of RENDER_SERIES) {
      for (const color of designSeriesOf(key)!.series.colors ?? []) {
        for (const part of ["switch", "socket", "set"] as const) expect(seriesPhoto(key, color.id, part)?.src, `${key} ${color.id} ${part}`).toMatch(/^\/catalog-images\/abb\//);
      }
    }
    // Fáze 94: vedle vlastních renderů Eldocku i fotky výrobce z dat ABB ETIM 9.0 (manifest a fotky rozvodnic)
    expect(CATALOG_IMAGES.every((image) => image.source.startsWith("Eldock") || image.photo || image.series === "smart" || image.series === "enclosure" || !image.src.includes("/abb/"))).toBe(true);
    expect(CATALOG_IMAGES.filter((image) => image.src.includes("/abb/") && !image.source.startsWith("Eldock")).every((image) => image.source.startsWith("ABB – oficiální data ETIM 9.0"))).toBe(true);
  });

  it("render nese typické prvky řady: Levit podložka, Tango vypouklý rámeček, Time kovové lišty, Zoni prolis; zásuvka s ochranným kolíkem, bez skriptů", () => {
    const color = (key: string, index = 0) => designSeriesOf(key)!.series.colors![index];
    const levit = renderSeriesSvg("ABB|Levit", color("ABB|Levit"), "switch");
    expect(levit).toContain('data-part="base"');
    expect(renderSeriesSvg("ABB|Tango", color("ABB|Tango"), "switch")).toContain('fill="url(#convex)"');
    // Fáze 91: Time – kovové vodorovné lišty nad a pod klapkou, Zoni – plochý prolis kolem klapky
    expect(renderSeriesSvg("ABB|Time", color("ABB|Time"), "switch").match(/data-part="strip"/g)).toHaveLength(2);
    expect(renderSeriesSvg("ABB|Zoni", color("ABB|Zoni"), "switch")).toContain('data-part="recess"');
    const set = renderSeriesSvg("ABB|Zoni", color("ABB|Zoni"), "set");
    expect(set.match(/data-part="socket"/g)).toHaveLength(2);
    expect(set.match(/data-part="switch"/g)).toHaveLength(1);
    expect(set).toContain('fill="url(#pin)"');
    expect(set).toMatch(/viewBox="0 0 728 328"/);
    for (const svg of [levit, set]) {
      expect(svg).not.toMatch(/<script|on\w+=|href=/i);
      expect(svg.length).toBeLessThan(20_000);
    }
  });
});
