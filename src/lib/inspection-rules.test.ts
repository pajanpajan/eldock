import { describe, expect, it } from "vitest";

import {
  USAGE_GROUP_LABELS,
  effectiveIntervalMonths,
  evaluateMeasurements,
  inspectionRuleFor,
  intervalIssue,
  isLightCard,
  isPortable,
  legalDeadline,
  lpsRule,
  measurementLimits,
  nextValidUntil,
  parseInfluences,
  ruleInputFrom,
  vtzRule,
} from "./inspection-rules";

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

// Fáze 66: lhůty ověřené proti NV 190/2022 Sb., příloha č. 4 (zakonyprolidi.cz, 2026-11-08) a ČSN 33 1600 ed. 2, tab. 1.
describe("VTZ – NV 190/2022 Sb., příloha č. 4", () => {
  it("účel objektu: administrativa 5 let, výroba a ostatní objekty závodu 3 roky", () => {
    expect(vtzRule({ buildingType: "OFFICE" })).toMatchObject({ months: 60, maxMonths: 60, kind: "VTZ", binding: true, standard: "NV 190/2022 Sb." });
    for (const buildingType of ["PRODUCTION", "ASSEMBLY", "ENERGY", "WAREHOUSE", "OTHER"] as const) expect(vtzRule({ buildingType }).months).toBe(36);
    expect(vtzRule({}).basis).toContain("Účel objektu neurčen");
    // Prostory normální ve výrobě už nemají 5 let (starší tabulka Eldocku)
    expect(vtzRule({ buildingType: "PRODUCTION", externalInfluences: "AA5, AB5, AD1, AE1, BA4, BE1 – prostory normální" }).months).toBe(36);
  });

  it("objekt pro více než 200 osob 2 roky, staveniště 0,5 roku, pojízdné 1 rok", () => {
    expect(vtzRule({ buildingType: "OFFICE", crowdOver200: true }).months).toBe(24);
    expect(vtzRule({ buildingType: "PRODUCTION", installationKind: "CONSTRUCTION_SITE" }).months).toBe(6);
    expect(vtzRule({ buildingType: "PRODUCTION", installationKind: "MOBILE" }).months).toBe(12);
  });

  it("mokré a korozivní prostory 1 rok, nebezpečí požáru a výbuchu 3 roky", () => {
    expect(vtzRule({ buildingType: "PRODUCTION", externalInfluences: "AA5, AD4 – mycí linka" }).months).toBe(12);
    expect(vtzRule({ buildingType: "OFFICE", externalInfluences: "AF4 – galvanovna" }).months).toBe(12);
    expect(vtzRule({ buildingType: "PRODUCTION", externalInfluences: "AD2, AD3, AF3" }).months).toBe(36);
    expect(vtzRule({ buildingType: "PRODUCTION", externalInfluences: "AA5, BE3 – lakovna" })).toMatchObject({ months: 36 });
    expect(vtzRule({ buildingType: "OFFICE", externalInfluences: "BE2 – archiv" }).months).toBe(36);
  });

  it("platí nejkratší z více lhůt (pozn. a) a řád preventivní údržby dovolí až dvojnásobek (pozn. c)", () => {
    expect(vtzRule({ buildingType: "OFFICE", crowdOver200: true, externalInfluences: "BE3" }).months).toBe(24);
    expect(vtzRule({ buildingType: "OFFICE", crowdOver200: true, externalInfluences: "BE3" }).basis).toContain("Nejkratší z 3 lhůt");
    expect(vtzRule({ buildingType: "PRODUCTION", preventiveMaintenance: true })).toMatchObject({ months: 36, maxMonths: 72 });
  });

  it("rozváděče, transformátory, domovní přístroje i ostatní zařízení patří pod VTZ", () => {
    for (const type of ["SWITCHBOARD", "TRANSFORMER", "WIRING_DEVICE", "OTHER"] as const) {
      expect(inspectionRuleFor({ type, buildingType: "ENERGY" })).toMatchObject({ months: 36, kind: "VTZ" });
    }
  });
});

describe("LPS – příloha č. 4, doplňující informace k LPS", () => {
  it("ostatní objekty 4 roky, kritické systémy 2 roky, vizuální kontrola 1× ročně", () => {
    expect(lpsRule({ buildingType: "PRODUCTION" })).toMatchObject({ months: 48, kind: "LPS", binding: true });
    expect(lpsRule({ buildingType: "PRODUCTION" }).basis).toContain("vizuální kontrola nejméně 1× ročně");
    expect(lpsRule({ buildingType: "OFFICE" }).months).toBe(24);
    expect(lpsRule({ buildingType: "PRODUCTION", crowdOver200: true }).months).toBe(24);
    expect(lpsRule({ buildingType: "PRODUCTION", lpsCritical: true }).months).toBe(24);
    expect(lpsRule({ buildingType: "PRODUCTION", externalInfluences: "BE3" }).basis).toContain("VTZ I. třídy");
    expect(inspectionRuleFor({ type: "LIGHTNING_ROD" })).toMatchObject({ months: 48, standard: "NV 190/2022 Sb." });
  });
});

describe("stroje, svářečky, nouzové osvětlení", () => {
  it("stroje 12 měsíců dle NV 378/2001 Sb., § 4 odst. 2 (normová, ne závazná delší lhůta)", () => {
    expect(inspectionRuleFor({ type: "CNC_MACHINE" })).toMatchObject({ months: 12, standard: "NV 378/2001 Sb.", kind: "MACHINE", binding: false });
    expect(inspectionRuleFor({ type: "MACHINE" }).basis).toContain("§ 4 odst. 2");
  });

  it("svářečky 12 měsíců, nouzové osvětlení roční a měsíční zkouška", () => {
    expect(inspectionRuleFor({ type: "WELDER" })).toMatchObject({ months: 12, standard: "ČSN EN 60974-4" });
    expect(inspectionRuleFor({ type: "EMERGENCY_LIGHTING" })).toMatchObject({ months: 12, standard: "ČSN EN 50172" });
    expect(inspectionRuleFor({ type: "EMERGENCY_LIGHTING" }).basis).toContain("1× měsíčně");
  });
});

describe("spotřebiče a nářadí – ČSN 33 1600 ed. 2, tab. 1", () => {
  it("nářadí podle třídy ochrany: sk. C tř. I 6, tř. II / III 12; sk. B 3 / 6; sk. D a E 12", () => {
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "C", protectionClass: "I" })).toMatchObject({ months: 6, standard: "ČSN 33 1600 ed. 2", binding: false });
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "C", protectionClass: "II" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "C", protectionClass: "III" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "B", protectionClass: "I" }).months).toBe(3);
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "B", protectionClass: "II" }).months).toBe(6);
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "D", protectionClass: "I" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "E", protectionClass: "II" }).months).toBe(12);
  });

  it("prodlužovací přívody ve sloupci „držené v ruce“, ostatní spotřebiče 6 / 24 měsíců", () => {
    expect(inspectionRuleFor({ type: "EXTENSION_CORD", usageGroup: "C" }).months).toBe(6);
    expect(inspectionRuleFor({ type: "EXTENSION_CORD", usageGroup: "B" }).months).toBe(3);
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "E" }).months).toBe(24);
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "C" }).months).toBe(24);
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "B" }).months).toBe(6);
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "C", handHeld: true, protectionClass: "I" }).months).toBe(6);
  });

  it("skupina A před každým vydáním (mezi výpůjčkami jako B), bez skupiny průmysl (C)", () => {
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "A", protectionClass: "I" })).toMatchObject({ months: 3 });
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "A" }).basis).toContain("před každým vydáním");
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: null }).basis).toContain("skupina C");
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "x", protectionClass: "II" }).months).toBe(12);
    expect(USAGE_GROUP_LABELS.E).not.toContain("domácnost");
  });
});

describe("lhůta zařízení, zákonný termín a platnost", () => {
  const production = inspectionRuleFor({ type: "SWITCHBOARD", buildingType: "PRODUCTION" });

  it("závazná lhůta se ořízne na zákonnou, normová zůstane (jen varování)", () => {
    expect(effectiveIntervalMonths(60, production)).toBe(36);
    expect(effectiveIntervalMonths(24, production)).toBe(24);
    expect(effectiveIntervalMonths(null, production)).toBe(36);
    const kettle = inspectionRuleFor({ type: "APPLIANCE", usageGroup: "E" });
    expect(effectiveIntervalMonths(36, kettle)).toBe(36);
    expect(intervalIssue(60, production)).toMatchObject({ level: "error" });
    expect(intervalIssue(60, production)!.message).toContain("nejdelší zákonnou lhůtu 36 měsíců");
    expect(intervalIssue(36, kettle)).toMatchObject({ level: "warning" });
    expect(intervalIssue(24, kettle)).toBeNull();
  });

  it("nejzazší termín VTZ s lhůtou nad 1 rok je konec kalendářního roku (pozn. b)", () => {
    expect(legalDeadline(d("2024-03-15"), d("2027-03-15"), production)).toEqual(d("2027-12-31"));
    expect(legalDeadline(d("2026-03-15"), d("2027-03-15"), production)).toEqual(d("2027-03-15"));
    expect(legalDeadline(d("2024-03-15"), d("2028-03-15"), inspectionRuleFor({ type: "LIGHTNING_ROD" }))).toEqual(d("2028-03-15"));
    // Starší zpráva s lhůtou 5 let ve výrobě: termín se počítá ze zákonné lhůty 3 roky, ne z platnosti zprávy
    expect(legalDeadline(d("2022-12-29"), d("2027-12-29"), production)).toEqual(d("2025-12-31"));
    expect(legalDeadline(d("2024-03-15"), d("2029-03-15"), inspectionRuleFor({ type: "APPLIANCE", usageGroup: "E" }))).toEqual(d("2029-03-15"));
  });

  it("nextValidUntil: lhůta zařízení (u VTZ nejvýš zákonná), jinak doporučená", () => {
    expect(nextValidUntil(d("2026-10-28"), { type: "APPLIANCE", usageGroup: "E" })).toEqual(d("2028-10-28"));
    expect(nextValidUntil(d("2026-10-28"), { type: "APPLIANCE", usageGroup: "E", inspectionIntervalMonths: 6 })).toEqual(d("2027-04-28"));
    expect(nextValidUntil(d("2026-10-28"), { type: "SWITCHBOARD", buildingType: "PRODUCTION", inspectionIntervalMonths: 60 })).toEqual(d("2029-10-28"));
  });

  it("vstup pravidla z budovy zařízení", () => {
    const input = ruleInputFrom({ type: "SWITCHBOARD" as const, inspectionIntervalMonths: 60 }, { type: "OFFICE", crowdOver200: true });
    expect(input).toMatchObject({ buildingType: "OFFICE", crowdOver200: true, inspectionIntervalMonths: 60 });
    expect(inspectionRuleFor(input).months).toBe(24);
  });

  it("přečte kódy vlivů z volného textu", () => {
    expect([...parseInfluences("aa5, AD2 a BE3 – text 12")]).toEqual(["AA5", "AD2", "BE3"]);
  });
});

describe("lehká karta a přenosná zařízení", () => {
  it("rozliší pevnou infrastrukturu a spotřebiče", () => {
    expect(isLightCard("APPLIANCE")).toBe(true);
    expect(isLightCard("LIGHTNING_ROD")).toBe(true);
    expect(isLightCard("SWITCHBOARD")).toBe(false);
    expect(isPortable("WELDER")).toBe(true);
    expect(isPortable("EMERGENCY_LIGHTING")).toBe(false);
  });
});

describe("meze měření", () => {
  it("třída I měří R_PE, třída II jen izolační odpor", () => {
    expect(measurementLimits("I")).toMatchObject({ rpeMax: 0.3, risoMin: 1 });
    expect(measurementLimits("II")).toMatchObject({ rpeMax: null, risoMin: 2 });
    expect(measurementLimits(null).rpeMax).toBe(0.3);
  });

  it("vyhodnotí vyhovující a nevyhovující měření", () => {
    expect(evaluateMeasurements("I", { rpe: 0.12, riso: 250 })).toEqual({ ok: true, failures: [] });
    expect(evaluateMeasurements("I", { rpe: 0.45, riso: 0.6 }).failures).toEqual([
      "Odpor ochranného vodiče R_PE 0,45 Ω > 0,3 Ω.",
      "Izolační odpor R_iso 0,6 MΩ < 1 MΩ.",
    ]);
    expect(evaluateMeasurements("II", { riso: 300 }).ok).toBe(true);
    expect(evaluateMeasurements("II", { riso: 1.5 }).ok).toBe(false);
    expect(evaluateMeasurements("I", { riso: 250 }).failures).toEqual(["Chybí měření odporu ochranného vodiče R_PE."]);
  });
});
