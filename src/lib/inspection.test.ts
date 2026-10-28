import { describe, expect, it } from "vitest";

import {
  addMonths,
  compareByUrgency,
  computeValidUntil,
  daysUntil,
  defaultValidityMonths,
  governingInspection,
  inspectionStateFor,
  latestOfType,
  summarizeInspections,
  type InspectionLike,
} from "./inspection";
import { inspectionBadgeLabel } from "./status";

const d = (iso: string, hour = 10) => new Date(`${iso}T${String(hour).padStart(2, "0")}:00:00.000Z`);
const NOW = d("2026-10-28");

const record = (type: InspectionLike["type"], date: string, validUntil: string): InspectionLike => ({
  type,
  inspectionDate: d(date),
  validUntil: d(validUntil),
  result: "CAPABLE",
});

describe("addMonths / computeValidUntil", () => {
  it("přičte lhůtu 36 měsíců", () => {
    expect(computeValidUntil(d("2023-11-15"), 36)).toEqual(d("2026-11-15"));
  });

  it("zarovná přetečení na konec měsíce včetně přestupného roku", () => {
    expect(addMonths(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
    expect(addMonths(d("2027-01-31"), 13)).toEqual(d("2028-02-29"));
    expect(addMonths(d("2026-03-31"), -1)).toEqual(d("2026-02-28"));
  });

  it("přechod přes konec roku", () => {
    expect(addMonths(d("2026-11-30"), 3)).toEqual(d("2027-02-28"));
  });

  it("odmítne nekladnou nebo neceločíselnou lhůtu", () => {
    expect(() => computeValidUntil(NOW, 0)).toThrow(RangeError);
    expect(() => computeValidUntil(NOW, 1.5)).toThrow(RangeError);
  });
});

describe("daysUntil", () => {
  it("počítá kalendářní dny bez ohledu na hodinu", () => {
    expect(daysUntil(d("2026-11-15", 1), d("2026-10-28", 22))).toBe(18);
    expect(daysUntil(d("2026-10-14"), NOW)).toBe(-14);
    expect(daysUntil(NOW, NOW)).toBe(0);
  });

  it("řídí se pražským kalendářním dnem (23:30 UTC = další den v Praze)", () => {
    expect(daysUntil(new Date("2026-10-28T23:30:00Z"), new Date("2026-10-28T12:00:00Z"))).toBe(1);
  });

  it("nezkreslí výsledek přechodem na zimní čas", () => {
    expect(daysUntil(d("2026-10-26"), d("2026-10-24"))).toBe(2);
  });
});

describe("inspectionStateFor", () => {
  it("platná / končí do 30 dnů / propadlá / bez revize", () => {
    expect(inspectionStateFor(d("2027-12-28"), NOW)).toBe("VALID");
    expect(inspectionStateFor(d("2026-11-28"), NOW)).toBe("VALID"); // 31 dní
    expect(inspectionStateFor(d("2026-11-27"), NOW)).toBe("EXPIRING"); // 30 dní
    expect(inspectionStateFor(d("2026-10-28"), NOW)).toBe("EXPIRING"); // poslední den platnosti
    expect(inspectionStateFor(d("2026-10-27"), NOW)).toBe("EXPIRED");
    expect(inspectionStateFor(null, NOW)).toBe("MISSING");
  });

  it("respektuje vlastní hranici varování", () => {
    expect(inspectionStateFor(d("2026-11-15"), NOW, 7)).toBe("VALID");
  });
});

describe("governingInspection / summarizeInspections", () => {
  it("lhůtu určuje nejnovější výchozí nebo pravidelná revize, ne termovize ani mimořádná", () => {
    const records = [
      record("INITIAL", "2020-05-10", "2023-05-10"),
      record("PERIODIC", "2023-11-15", "2026-11-15"),
      record("THERMOVISION", "2026-09-01", "2027-09-01"),
      record("EXTRAORDINARY", "2026-06-01", "2029-06-01"),
    ];
    expect(governingInspection(records)?.type).toBe("PERIODIC");
    expect(summarizeInspections(records, NOW)).toEqual({
      state: "EXPIRING",
      validUntil: d("2026-11-15"),
      daysLeft: 18,
      result: "CAPABLE",
    });
  });

  it("propadlá revize vrací záporný počet dnů", () => {
    const summary = summarizeInspections([record("PERIODIC", "2023-10-14", "2026-10-14")], NOW);
    expect(summary.state).toBe("EXPIRED");
    expect(summary.daysLeft).toBe(-14);
  });

  it("bez výchozí ani pravidelné revize je stav MISSING", () => {
    expect(summarizeInspections([record("THERMOVISION", "2026-01-01", "2027-01-01")], NOW)).toEqual({
      state: "MISSING",
      validUntil: null,
      daysLeft: null,
      result: null,
    });
  });

  it("latestOfType najde poslední termovizi", () => {
    const records = [record("THERMOVISION", "2024-01-01", "2025-01-01"), record("THERMOVISION", "2025-12-01", "2027-12-01")];
    expect(latestOfType(records, "THERMOVISION")?.inspectionDate).toEqual(d("2025-12-01"));
    expect(latestOfType(records, "PERIODIC")).toBeNull();
  });
});

describe("compareByUrgency", () => {
  it("řadí propadlé, pak končící podle počtu dnů, pak platné a bez revize", () => {
    const list = [
      summarizeInspections([record("PERIODIC", "2025-01-01", "2028-01-01")], NOW),
      summarizeInspections([], NOW),
      summarizeInspections([record("PERIODIC", "2023-11-15", "2026-11-15")], NOW),
      summarizeInspections([record("PERIODIC", "2023-10-14", "2026-10-14")], NOW),
      summarizeInspections([record("PERIODIC", "2023-11-01", "2026-11-01")], NOW),
    ].sort(compareByUrgency);
    expect(list.map((s) => [s.state, s.daysLeft])).toEqual([
      ["EXPIRED", -14],
      ["EXPIRING", 4],
      ["EXPIRING", 18],
      ["VALID", 430],
      ["MISSING", null],
    ]);
  });
});

describe("defaultValidityMonths", () => {
  it("termovize 12 měsíců, ostatní podle lhůty zařízení", () => {
    expect(defaultValidityMonths("THERMOVISION", 36)).toBe(12);
    expect(defaultValidityMonths("PERIODIC", 24)).toBe(24);
  });
});

describe("inspectionBadgeLabel", () => {
  it("texty odznaku podle stavu včetně skloňování", () => {
    expect(inspectionBadgeLabel("VALID", d("2027-12-28"), 426)).toBe("Revize platná do 28.12.2027");
    expect(inspectionBadgeLabel("EXPIRING", d("2026-11-15"), 18)).toBe("Revize končí za 18 dní");
    expect(inspectionBadgeLabel("EXPIRING", d("2026-10-30"), 2)).toBe("Revize končí za 2 dny");
    expect(inspectionBadgeLabel("EXPIRING", d("2026-10-29"), 1)).toBe("Revize končí za 1 den");
    expect(inspectionBadgeLabel("EXPIRING", NOW, 0)).toBe("Revize končí dnes");
    expect(inspectionBadgeLabel("EXPIRED", d("2026-10-14"), -14)).toBe("REVIZE PROPADLÁ před 14 dny");
    expect(inspectionBadgeLabel("EXPIRED", d("2026-10-27"), -1)).toBe("REVIZE PROPADLÁ před 1 dnem");
    expect(inspectionBadgeLabel("MISSING", null, null)).toBe("Bez záznamu o revizi");
  });
});
