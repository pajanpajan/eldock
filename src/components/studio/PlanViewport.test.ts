import { describe, expect, it } from "vitest";

import { FIT_MARGIN_PX, fitPxPerMeter, nextMeasuredWidth } from "./PlanViewport";

describe("PlanViewport – měření bez kmitání", () => {
  it("mrtvé pásmo 4 px: posuvník (≈15 px) se projeví, subpixely a drobné změny ne", () => {
    expect(nextMeasuredWidth(960, 960.4)).toBe(960);
    expect(nextMeasuredWidth(960, 956)).toBe(960);
    expect(nextMeasuredWidth(960, 964)).toBe(960);
    expect(nextMeasuredWidth(960, 945)).toBe(945);
    expect(nextMeasuredWidth(960, 1200.6)).toBe(1201);
    // skrytý obal (0 px) neplatí
    expect(nextMeasuredWidth(960, 0)).toBe(960);
  });

  it("měřítko „Celé“ odečte rezervu a zaokrouhlí dolů na 3 desetinná místa", () => {
    const ratio = fitPxPerMeter(1000, 186);
    expect(ratio).toBe(Math.floor(((1000 - FIT_MARGIN_PX) / 186) * 1000) / 1000);
    expect(ratio * 186).toBeLessThanOrEqual(1000 - FIT_MARGIN_PX);
    // velmi úzký obal: minimum 240 px plátna
    expect(fitPxPerMeter(100, 24)).toBe(10);
  });
});
