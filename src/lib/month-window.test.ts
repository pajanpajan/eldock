import { describe, expect, it } from "vitest";

import { addDaysIso, daysToMonthEnd, monthWindowOffsets } from "./month-window";

describe("posuny dat pro demo plánovače", () => {
  it("dny do konce měsíce a přičítání dnů přes hranici roku", () => {
    expect(daysToMonthEnd("2026-11-01")).toBe(29);
    expect(daysToMonthEnd("2026-11-30")).toBe(0);
    expect(daysToMonthEnd("2028-02-01")).toBe(28);
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("v každý den dvou let (i přestupného) leží kus „tento měsíc“ v aktuálním měsíci a „příští měsíc“ na 5. dni dalšího", () => {
    for (const year of [2026, 2028]) {
      for (let date = `${year}-01-01`; date.startsWith(String(year)); date = addDaysIso(date, 1)) {
        const { thisMonth, nextMonth } = monthWindowOffsets(date);
        const current = addDaysIso(date, thisMonth);
        const next = addDaysIso(date, nextMonth);
        expect(thisMonth).toBeGreaterThanOrEqual(0);
        expect(current.slice(0, 7)).toBe(date.slice(0, 7));
        expect(next.slice(8)).toBe("05");
        expect(next.slice(0, 7)).toBe(addDaysIso(date, daysToMonthEnd(date) + 1).slice(0, 7));
      }
    }
  });
});
