import { describe, expect, it } from "vitest";

import type { EquipmentType } from "@/generated/prisma/enums";

import type { InspectionState } from "./inspection";
import { bucketBounds, bucketFor, compareRoute, groupForRoute, planInspections, type PlannerItem } from "./inspection-planner";
import { parsePlanQuery } from "./inspection-voice-parser";

const NOW = new Date("2026-10-28T10:00:00Z");

function item(tag: string, type: EquipmentType, daysLeft: number | null, place: Partial<PlannerItem> = {}, state?: InspectionState): PlannerItem {
  const resolved: InspectionState = state ?? (daysLeft === null ? "MISSING" : daysLeft < 0 ? "EXPIRED" : daysLeft <= 30 ? "EXPIRING" : "VALID");
  return {
    id: `id-${tag}`,
    tag,
    name: `${tag} - zařízení`,
    type,
    buildingName: "Hala A - Lisovna",
    buildingOrder: 0,
    floorCode: "1NP",
    floorLevel: 0,
    floorName: "1. NP - Hlavní výroba",
    zone: "Dílna údržby – Hala A",
    state: resolved,
    daysLeft,
    validUntil: null,
    ...place,
  };
}

const KITCHEN = { buildingName: "Energetika", buildingOrder: 2, floorName: "1. NP - Trafostanice", zone: "Kuchyňka – Energetika 1. NP" };
const ITEMS = [
  item("PP-0031", "EXTENSION_CORD", -21),
  item("NR-0112", "POWER_TOOL", 9),
  item("SV-0004", "WELDER", 38),
  item("NR-0087", "POWER_TOOL", 400),
  item("R-CNC-04", "SWITCHBOARD", 18, { zone: null }),
  item("SP-0201", "APPLIANCE", -5, KITCHEN),
  item("SP-0204", "APPLIANCE", 2, KITCHEN),
  item("SP-0203", "APPLIANCE", 9, KITCHEN),
  item("SP-0202", "APPLIANCE", 600, KITCHEN),
  item("SP-0310", "APPLIANCE", 120, { buildingName: "Administrativa", buildingOrder: 4, floorName: "1. NP", zone: "Kanceláře 1. NP" }),
  item("VYR", "EXTENSION_CORD", 300, KITCHEN, "FAILED"),
];

describe("měsíční horizont", () => {
  it("rozdělí dny na po termínu / tento / příští měsíc / 3–6 měsíců", () => {
    const bounds = bucketBounds(NOW);
    expect(bounds).toEqual({ thisMonthEnd: 3, nextMonthEnd: 33, horizon: 183 });
    expect([-1, 0, 3, 4, 33, 34, 183, 184].map((days) => bucketFor(days, bounds))).toEqual([
      "OVERDUE",
      "THIS_MONTH",
      "THIS_MONTH",
      "NEXT_MONTH",
      "NEXT_MONTH",
      "LATER",
      "LATER",
      null,
    ]);
  });
});

describe("planInspections", () => {
  it("nářadí a prodlužováky v Hale A do 30 dnů + tip na svářečku ve stejné dílně", () => {
    const plan = planInspections(ITEMS, parsePlanQuery("Nářadí a prodlužováky v Hale A do 30 dnů", NOW), NOW);
    expect(plan.selected.map((entry) => entry.tag)).toEqual(["NR-0112", "PP-0031"]);
    // Svářečka: stejná dílna, stejná měřicí skupina (přenosné), končí 8 dní po okně.
    expect(plan.suggestions.map((entry) => entry.tag)).toEqual(["SV-0004"]);
    expect(plan.summary).toEqual({ total: 2, fixed: 0, portable: 2 });
  });

  it("kuchyňka tento měsíc: tip na kus končící příští měsíc ve stejné místnosti", () => {
    const plan = planInspections(ITEMS, parsePlanQuery("kuchyňka tento měsíc", NOW), NOW);
    expect(plan.selected.map((entry) => entry.tag)).toEqual(["SP-0201", "SP-0204", "VYR"]);
    expect(plan.suggestions.map((entry) => entry.tag)).toEqual(["SP-0203"]);
    expect(plan.buckets).toEqual({ OVERDUE: 2, THIS_MONTH: 1, NEXT_MONTH: 1, LATER: 0 });
  });

  it("tip nepřibere jinou měřicí skupinu ani jiné místo", () => {
    const plan = planInspections(ITEMS, parsePlanQuery("propadlé v Hale A", NOW), NOW);
    expect(plan.selected.map((entry) => entry.tag)).toEqual(["PP-0031"]);
    // R-CNC-04 je pevné zařízení bez zóny → jiné místo i skupina; svářečka je za 45 dny.
    expect(plan.suggestions.map((entry) => entry.tag)).toEqual(["NR-0112", "SV-0004"]);
  });

  it("spotřebiče v kuchyňkách a administrativě = sjednocení lokací", () => {
    const plan = planInspections(ITEMS, parsePlanQuery("Spotřebiče v kuchyňkách a administrativě", NOW), NOW);
    expect(plan.selected.map((entry) => entry.tag)).toEqual(["SP-0201", "SP-0203", "SP-0204", "SP-0310"]);
  });

  it("souhrn rozliší pevná a přenosná zařízení", () => {
    const plan = planInspections(ITEMS, parsePlanQuery("Propadlé a tento měsíc v celém závodě", NOW), NOW);
    // Bruska (9 dní) končí až příští měsíc.
    expect(plan.selected.map((entry) => entry.tag)).toEqual(["PP-0031", "SP-0201", "SP-0204", "VYR"]);
    expect(plan.summary).toEqual({ total: 4, fixed: 0, portable: 4 });
    expect(planInspections(ITEMS, parsePlanQuery("do 30 dnů", NOW), NOW).summary.fixed).toBe(1);
  });
});

describe("pochůzka", () => {
  it("řadí budova → patro → zóna → přenosné před pevnými → tag", () => {
    const sorted = [...ITEMS].sort(compareRoute).map((entry) => entry.tag);
    expect(sorted.slice(0, 5)).toEqual(["R-CNC-04", "NR-0087", "NR-0112", "PP-0031", "SV-0004"]);
    expect(sorted.at(-1)).toBe("SP-0310");
  });

  it("pochůzkový list seskupí po budovách a místnostech", () => {
    const groups = groupForRoute(ITEMS.slice(0, 7));
    expect(groups.map((group) => group.building)).toEqual(["Hala A - Lisovna", "Energetika"]);
    expect(groups[0].places.map((place) => place.place)).toEqual(["1. NP - Hlavní výroba", "Dílna údržby – Hala A"]);
  });
});
