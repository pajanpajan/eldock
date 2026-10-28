import { describe, expect, it } from "vitest";

import { buildInterfaceRows, parseAmps, separationForm, shortCircuitRating } from "./switchboard-interface";

const RM1 = {
  tag: "RM1",
  type: "SWITCHBOARD",
  manufacturer: "Siemens",
  model: "SIVACON S8",
  yearInstalled: 2019,
  ratedVoltage: "400 V AC / 50 Hz",
  ratedCurrent: "1600 A",
  ipRating: "IP31",
  externalInfluences: "AA5, AB5, BA4",
  fedFrom: { tag: "TR1" },
  fedFromCircuit: "Vývod nn / Q0",
};

describe("parseAmps", () => {
  it("přečte proud i s mezerami a desetinnou čárkou", () => {
    expect(parseAmps("1600 A")).toBe(1600);
    expect(parseAmps("1 600 A")).toBe(1600);
    expect(parseAmps("2,5 A")).toBe(2.5);
    expect(parseAmps("neuvedeno")).toBeNull();
    expect(parseAmps(null)).toBeNull();
  });
});

describe("zkratová odolnost a vnitřní rozdělení", () => {
  it("odvodí hodnoty podle velikosti rozváděče", () => {
    expect(shortCircuitRating(1600)).toEqual({ icw: "50 kA / 1 s", ipk: "105 kA" });
    expect(shortCircuitRating(250).icw).toBe("25 kA / 1 s");
    expect(shortCircuitRating(63).ipk).toBe("–");
    expect(separationForm(1600)).toBe("Forma 4b");
    expect(separationForm(160)).toBe("Forma 1");
  });
});

describe("buildInterfaceRows", () => {
  it("obsahuje štítkové údaje, vnější vlivy a napájení", () => {
    const rows = Object.fromEntries(buildInterfaceRows(RM1).map((row) => [row.label, row.value]));
    expect(rows["Jmenovitý proud rozváděče InA"]).toBe("1600 A");
    expect(rows["Stupeň krytí"]).toBe("IP31");
    expect(rows["Odolnost proti nárazu"]).toBe("IK08");
    expect(rows["Vnější vlivy"]).toBe("AA5, AB5, BA4");
    expect(rows["Napájeno z"]).toBe("TR1 (Vývod nn / Q0)");
  });

  it("upozorní na chybějící protokol vnějších vlivů", () => {
    const rows = buildInterfaceRows({ ...RM1, externalInfluences: null, fedFrom: null, ipRating: "IP54" });
    expect(rows.find((row) => row.label === "Vnější vlivy")?.value).toMatch(/chybí protokol/);
    expect(rows.find((row) => row.label === "Odolnost proti nárazu")?.value).toBe("IK10");
  });
});
