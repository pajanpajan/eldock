import { describe, expect, it } from "vitest";

import { formatZip, isValidIco, mapAresSubject, normalizeIco } from "./ares";

// Ukázková odpověď ARES (ekonomicke-subjekty/{ico}) – zkrácená na pole, která formulář používá.
const ARES_SAMPLE = {
  ico: "27074358",
  obchodniJmeno: "Asseco Central Europe, a.s.",
  dic: "CZ27074358",
  sidlo: { kodStatu: "CZ", nazevObce: "Praha", nazevCastiObce: "Michle", nazevUlice: "Budějovická", cisloDomovni: 778, cisloOrientacni: 3, cisloOrientacniPismeno: "a", psc: 14000, textovaAdresa: "Budějovická 778/3a, Michle, 14000 Praha 4" },
};

describe("registr ARES", () => {
  it("IČO: kontrolní číslice, doplnění nul a mezery", () => {
    expect(isValidIco("27074358")).toBe(true);
    expect(isValidIco("27074359")).toBe(false);
    expect(isValidIco("12345679")).toBe(true);
    expect(isValidIco("1234")).toBe(false);
    expect(normalizeIco(" 25596641 ")).toBe("25596641");
    expect(normalizeIco("5596641")).toBe("05596641");
    expect(isValidIco("abc")).toBe(false);
  });

  it("odpověď ARES → název, DIČ a sídlo (ulice s č. p. / č. o., město, PSČ)", () => {
    expect(mapAresSubject(ARES_SAMPLE)).toEqual({ companyName: "Asseco Central Europe, a.s.", ico: "27074358", dic: "CZ27074358", street: "Budějovická 778/3a", city: "Praha", zip: "140 00" });
    // obec bez ulic: část obce + č. p.; bez DIČ
    expect(mapAresSubject({ ico: "12345679", obchodniJmeno: "Elektro Lhota", sidlo: { nazevObce: "Lhota", cisloDomovni: 12, psc: "46601" } })).toMatchObject({ street: "Lhota 12", dic: null, zip: "466 01" });
    expect(mapAresSubject({ chyba: "nenalezeno" })).toBeNull();
    expect(mapAresSubject(null)).toBeNull();
    expect(formatZip(46601)).toBe("466 01");
  });
});
