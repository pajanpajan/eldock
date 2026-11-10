import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderCatalogImages } from "../src/lib/panel-builder/catalog-images";
import { CATALOG_IMAGES_OUTPUT, scanCatalogImages } from "./catalog-images";

describe("fáze 78 – manifest náhledů výrobců (public/catalog-images)", () => {
  it("odpovídá souborům ve složce (jinak spusťte npm run catalog:images); bez zdroje a licence se fotka nepřevezme", async () => {
    const { images } = await scanCatalogImages();
    expect(readFileSync(CATALOG_IMAGES_OUTPUT, "utf8").replace(/\r\n/g, "\n")).toBe(renderCatalogImages(images));
    for (const image of images) {
      expect(image.source.length, image.src).toBeGreaterThan(3);
      expect(image.license.length, image.src).toBeGreaterThan(3);
    }
  });
});
