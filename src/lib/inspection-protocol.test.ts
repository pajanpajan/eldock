import { describe, expect, it } from "vitest";

import { leakageLimitMa, protocolMeasurements, protocolVariant } from "./inspection-protocol";

const record = { type: "PERIODIC", result: "CAPABLE", protectiveConductorResistance: 0.12, insulationResistance: 250, leakageCurrent: 0.4, functionalTest: true } as const;

describe("revizní protokol", () => {
  it("rozliší VTZ a spotřebiče", () => {
    expect(protocolVariant("SWITCHBOARD")).toBe("VTZ");
    expect(protocolVariant("MACHINE")).toBe("VTZ");
    expect(protocolVariant("APPLIANCE")).toBe("APPLIANCE");
    expect(protocolVariant("EXTENSION_CORD")).toBe("APPLIANCE");
  });

  it("vyhodnotí měření spotřebiče třídy I dle ČSN 33 1600", () => {
    const rows = protocolMeasurements({ record, equipment: { type: "APPLIANCE", usageGroup: "E", protectionClass: "I" } });
    expect(rows.map((row) => row.ok)).toEqual([true, true, true, true]);
    expect(rows[0].limit).toBe("≤ 0,3 Ω");
    expect(rows[2].limit).toBe("≤ 3,5 mA");
  });

  it("u třídy II se R_PE neměří a limit unikajícího proudu je 0,5 mA", () => {
    const rows = protocolMeasurements({ record: { ...record, protectiveConductorResistance: null, leakageCurrent: 0.8 }, equipment: { type: "POWER_TOOL", usageGroup: "C", protectionClass: "II" } });
    expect(rows[0].ok).toBeNull();
    expect(rows[2].ok).toBe(false);
    expect(leakageLimitMa("II")).toBe(0.5);
  });

  it("chybějící měření a neprovedená funkční zkouška se nehodnotí", () => {
    const rows = protocolMeasurements({
      record: { ...record, protectiveConductorResistance: null, insulationResistance: null, leakageCurrent: null, functionalTest: null },
      equipment: { type: "SWITCHBOARD", usageGroup: null, protectionClass: null },
    });
    expect(rows.every((row) => row.ok === null)).toBe(true);
    expect(rows[3].value).toBe("neprováděla se");
  });
});
