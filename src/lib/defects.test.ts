import { describe, expect, it } from "vitest";

import { compareDefects, defectDeadline, defectState, severityForResult, splitDefects, thermalLevel } from "./defects";
import { formatTempModNumber, nextTempModSequence, tempModCountdown, tempModExpiry } from "./temporary-mod";

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);
const NOW = d("2026-10-28");

describe("revizní závady", () => {
  it("lhůta podle závažnosti: kritická ihned, závažná 30, drobná 90 dnů", () => {
    expect(defectDeadline(d("2026-10-01"), "CRITICAL")).toEqual(d("2026-10-01"));
    expect(defectDeadline(d("2026-10-01"), "MAJOR")).toEqual(d("2026-10-31"));
    expect(defectDeadline(d("2026-10-01"), "MINOR")).toEqual(d("2026-12-30"));
    expect(severityForResult("INCAPABLE")).toBe("CRITICAL");
    expect(severityForResult("CAPABLE_WITH_DEFECTS")).toBe("MAJOR");
  });

  it("stav: otevřená / po lhůtě / odstraněná", () => {
    expect(defectState({ status: "OPEN", deadline: d("2026-11-07") }, NOW)).toEqual({ state: "OPEN", daysLeft: 10 });
    expect(defectState({ status: "OPEN", deadline: d("2026-10-20") }, NOW)).toEqual({ state: "OVERDUE", daysLeft: -8 });
    expect(defectState({ status: "RESOLVED", deadline: d("2026-10-20") }, NOW).state).toBe("RESOLVED");
  });

  it("řazení: otevřené podle lhůty, odstraněné na konec", () => {
    const list = [
      { id: "c", status: "RESOLVED" as const, deadline: d("2026-01-01") },
      { id: "b", status: "OPEN" as const, deadline: d("2026-12-01") },
      { id: "a", status: "OPEN" as const, deadline: d("2026-10-01") },
    ].sort(compareDefects);
    expect(list.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("rozdělí soupis závad na položky", () => {
    expect(splitDefects("Chybí krytí IP2X u K2; chybí štítek F3.")).toEqual(["Chybí krytí IP2X u K2", "chybí štítek F3"]);
    expect(splitDefects("Uvolněná svorka PE. Chybí výstražná tabulka.")).toEqual(["Uvolněná svorka PE", "Chybí výstražná tabulka"]);
    expect(splitDefects(null)).toEqual([]);
  });
});

describe("termovize ΔT", () => {
  it("třídy ΔT vůči okolí", () => {
    expect([5, 10, 15, 20, 30, 40, 41].map(thermalLevel)).toEqual(["OK", "OK", "WATCH", "WATCH", "PLAN", "PLAN", "CRITICAL"]);
  });
});

describe("provizoria", () => {
  it("číslování PROV-RRRR-NNNN po letech", () => {
    expect(formatTempModNumber(2026, 7)).toBe("PROV-2026-0007");
    expect(nextTempModSequence(["PROV-2026-0004", "PROV-2025-0009", "PROV-2026-0007", "ZM-2026-0099"], 2026)).toBe(8);
    expect(nextTempModSequence([], 2027)).toBe(1);
  });

  it("lhůta a odpočet do odstranění", () => {
    expect(tempModExpiry(d("2026-10-28"), 7)).toEqual(d("2026-11-04"));
    expect(tempModCountdown(d("2026-11-03"), NOW)).toEqual({ daysLeft: 6, overdue: false });
    expect(tempModCountdown(d("2026-10-26"), NOW)).toEqual({ daysLeft: -2, overdue: true });
  });
});
