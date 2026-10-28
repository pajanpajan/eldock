import { describe, expect, it } from "vitest";

import {
  evaluateMeasurements,
  fixedInstallationRule,
  inspectionRuleFor,
  isLightCard,
  isPortable,
  measurementLimits,
  nextValidUntil,
  parseInfluences,
} from "./inspection-rules";

const d = (iso: string) => new Date(`${iso}T10:00:00.000Z`);

describe("fixedInstallationRule (ČSN 33 1500)", () => {
  it("lhůta 12–60 měsíců podle vnějších vlivů", () => {
    expect(fixedInstallationRule("AA5, AB5, AD1, AE1, BA4, BE1 – prostory normální").months).toBe(60);
    expect(fixedInstallationRule("AA5, AB5, AD2, AE2, AF2 – chladicí emulze").months).toBe(36);
    expect(fixedInstallationRule("AA5, AB5, BE2 – nabíjení akumulátorů").months).toBe(24);
    expect(fixedInstallationRule("AA5, BE3 – nebezpečí výbuchu").months).toBe(12);
    expect(fixedInstallationRule(null).months).toBe(36);
  });

  it("přečte kódy vlivů z volného textu", () => {
    expect([...parseInfluences("aa5, AD2 a BE3 – text 12")]).toEqual(["AA5", "AD2", "BE3"]);
  });
});

describe("inspectionRuleFor", () => {
  it("stroje 12 měsíců dle NV 378/2001 Sb.", () => {
    expect(inspectionRuleFor({ type: "CNC_MACHINE" })).toMatchObject({ months: 12, standard: "NV 378/2001 Sb." });
    expect(inspectionRuleFor({ type: "MACHINE" }).months).toBe(12);
  });

  it("ruční nářadí sk. C 12 měsíců pro všechny třídy ochrany", () => {
    for (const protectionClass of ["I", "II", "III"]) {
      expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "C", protectionClass })).toMatchObject({ months: 12, standard: "ČSN 33 1600 ed. 2" });
    }
  });

  it("spotřebiče sk. C/E 24, prodlužovací přívody sk. C 12, svářečky 12", () => {
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "E" }).months).toBe(24);
    expect(inspectionRuleFor({ type: "APPLIANCE", usageGroup: "C" }).months).toBe(24);
    expect(inspectionRuleFor({ type: "EXTENSION_CORD", usageGroup: "C" }).months).toBe(12);
    expect(inspectionRuleFor({ type: "EXTENSION_CORD", usageGroup: "B" }).months).toBe(3);
    expect(inspectionRuleFor({ type: "WELDER" })).toMatchObject({ months: 12, standard: "ČSN EN 60974-4" });
  });

  it("bez skupiny užívání předpokládá průmysl (C)", () => {
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: null }).basis).toContain("skupina C");
    expect(inspectionRuleFor({ type: "POWER_TOOL", usageGroup: "x" }).months).toBe(12);
  });

  it("hromosvody a nouzové osvětlení", () => {
    expect(inspectionRuleFor({ type: "LIGHTNING_ROD" })).toMatchObject({ months: 48, standard: "ČSN EN 62305-3" });
    expect(inspectionRuleFor({ type: "EMERGENCY_LIGHTING" })).toMatchObject({ months: 12, standard: "ČSN EN 50172" });
  });
});

describe("nextValidUntil", () => {
  it("použije lhůtu zařízení, jinak doporučenou lhůtu", () => {
    expect(nextValidUntil(d("2026-10-28"), { type: "APPLIANCE", usageGroup: "E" })).toEqual(d("2028-10-28"));
    expect(nextValidUntil(d("2026-10-28"), { type: "APPLIANCE", usageGroup: "E", inspectionIntervalMonths: 6 })).toEqual(d("2027-04-28"));
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
