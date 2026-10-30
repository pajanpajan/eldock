import { describe, expect, it } from "vitest";

import { DIFF_COLORS, diffCanvasSize, diffPixels } from "./visual-diff";

/** Obrázek 4 × 1 px: bílá, nebo černá podle masky. */
const image = (mask: number[]) => new Uint8ClampedArray(mask.flatMap((black) => (black ? [0, 0, 0, 255] : [255, 255, 255, 255])));
const pixel = (data: Uint8ClampedArray, index: number) => Array.from(data.slice(index * 4, index * 4 + 3));

describe("barevný diff výkresů", () => {
  it("odebrané červeně, přidané zeleně, společné šedě, pozadí bíle", () => {
    const result = diffPixels(image([1, 1, 0, 0]), image([1, 0, 1, 0]));
    expect(pixel(result.data, 0)).toEqual([...DIFF_COLORS.same]);
    expect(pixel(result.data, 1)).toEqual([...DIFF_COLORS.removed]);
    expect(pixel(result.data, 2)).toEqual([...DIFF_COLORS.added]);
    expect(pixel(result.data, 3)).toEqual([255, 255, 255]);
    expect(result).toMatchObject({ removed: 1, added: 1 });
    expect(result.changeRatio).toBeCloseTo(2 / 3);
  });

  it("světle šedý antialiasing a průhlednost nejsou kresba", () => {
    const light = new Uint8ClampedArray([230, 230, 230, 255, 0, 0, 0, 0]);
    const blank = new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]);
    expect(diffPixels(light, blank)).toMatchObject({ removed: 0, added: 0, changeRatio: 0 });
  });

  it("různé rozměry odmítne a plátno spočítá z poměru stran", () => {
    expect(() => diffPixels(image([1]), image([1, 1]))).toThrow();
    expect(diffCanvasSize(1191 / 842, 1600)).toEqual({ width: 1600, height: 1131 });
  });
});
