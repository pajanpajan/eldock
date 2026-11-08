import { describe, expect, it } from "vitest";

import { TERMS_CONSENT, companyManufacturer, panelRegistrationSchema, plantCodeFor, plantRegistrationSchema } from "./registered-company";

const valid = {
  ico: "12345679",
  dic: "cz 12345679",
  companyName: "Elektro Novák s.r.o.",
  street: "Nádražní 15",
  city: "Turnov",
  zip: "51101",
  contactName: "Jan Novák",
  phone: "+420 777 000 111",
  authorizationNumber: "",
  email: "Jan@Novak.CZ",
  password: "tajneheslo",
  termsAccepted: true,
};

describe("registrace firmy", () => {
  it("platná registrace: normalizace e-mailu, DIČ a PSČ", () => {
    const parsed = panelRegistrationSchema.parse(valid);
    expect(parsed).toMatchObject({ email: "jan@novak.cz", dic: "CZ12345679", zip: "511 01", ico: "12345679" });
  });

  it("bez souhlasu s přenesením odpovědnosti, se špatným IČO nebo krátkým heslem neprojde", () => {
    const issue = (input: object) => panelRegistrationSchema.safeParse({ ...valid, ...input }).error?.issues[0];
    expect(issue({ termsAccepted: false })?.path).toEqual(["termsAccepted"]);
    expect(issue({ ico: "12345678" })?.message).toMatch(/Neplatné IČO/);
    // Fáze 67: pravidla hesla jako u účtů zaměstnanců (aspoň 10 znaků, ne e-mail, jméno ani běžné heslo)
    expect(issue({ password: "kratke" })?.message).toMatch(/10 znaků/);
    expect(issue({ password: "heslo123456" })?.message).toMatch(/běžné/);
    expect(issue({ zip: "511" })?.message).toMatch(/PSČ/);
    expect(issue({ dic: "123" })?.message).toMatch(/DIČ/);
    expect(TERMS_CONSENT).toContain("nese výhradně uživatel (výrobce rozváděče / projektant)");
    expect(plantRegistrationSchema.safeParse({ ...valid, plantName: "" }).success).toBe(false);
  });

  it("údaje firmy = výrobce rozváděče v dokumentaci; kód závodu z názvu firmy", () => {
    const parsed = panelRegistrationSchema.parse(valid);
    expect(companyManufacturer({ ...parsed, dic: parsed.dic ?? null, authorizationNumber: "E-1/2024" })).toEqual({
      name: "Elektro Novák s.r.o.",
      address: "Nádražní 15",
      city: "511 01 Turnov",
      phone: "+420 777 000 111",
      ico: "12345679",
      dic: "CZ12345679",
      email: "jan@novak.cz",
      contactName: "Jan Novák",
      authorizationNumber: "E-1/2024",
    });
    expect(plantCodeFor("Elektro Novák s.r.o.", [])).toBe("EN");
    expect(plantCodeFor("Strojírny Turnov a.s.", ["ST"])).toBe("ST2");
    expect(plantCodeFor("Lisovna", [])).toBe("LIS");
  });
});
