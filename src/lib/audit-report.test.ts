import { describe, expect, it } from "vitest";

import { summarizeAudit } from "./audit-report";

describe("summarizeAudit", () => {
  it("% shody = platné + končící; propadlé, vyřazené a bez revize nejsou ve shodě", () => {
    const { overall, byLayer } = summarizeAudit([
      { type: "SWITCHBOARD", state: "VALID" },
      { type: "SWITCHBOARD", state: "EXPIRING" },
      { type: "SWITCHBOARD", state: "EXPIRED" },
      { type: "APPLIANCE", state: "FAILED" },
      { type: "APPLIANCE", state: "VALID" },
      { type: "POWER_TOOL", state: "MISSING" },
    ]);
    expect(overall).toEqual({ total: 6, valid: 2, expiring: 1, nonCompliant: 3, percent: 50 });
    expect(byLayer.map((entry) => [entry.key, entry.total, entry.percent])).toEqual([
      ["ENERGY", 3, 66.7],
      ["TOOLS", 1, 0],
      ["APPLIANCES", 2, 50],
    ]);
  });

  it("prázdný závod je 100 %", () => {
    expect(summarizeAudit([]).overall.percent).toBe(100);
  });
});
