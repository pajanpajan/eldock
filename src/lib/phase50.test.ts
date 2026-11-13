import { afterEach, describe, expect, it, vi } from "vitest";

import { isSuperadminToken, signAuthToken, signSuperadminToken, superadminPassword, verifyAuthToken } from "@/lib/auth";
import { CREDIT_PACKAGES, creditPackage, nextVariableSymbol, normalizeIban, spdPayload, spdText, vatOf, withVat } from "@/lib/credits";

describe("balíčky kreditů a DPH", () => {
  it("3 balíčky s cenou bez DPH a dopočtem 21 % DPH (fáze 111: nový ceník, starší balíčky jen pro zobrazení)", () => {
    expect(CREDIT_PACKAGES.map((pkg) => [pkg.code, pkg.credits, pkg.priceExclVat])).toEqual([
      ["START_30", 30, 750],
      ["MONTER_125", 125, 2490],
      ["FIRMA_300", 300, 4990],
    ]);
    expect(withVat(750)).toBe(908);
    expect(withVat(2490)).toBe(3013);
    expect(withVat(4990)).toBe(6038);
    expect(vatOf(750)).toBe(158);
    expect(creditPackage("NESMYSL")).toBeNull();
    expect(creditPackage("PROFI_30")).toMatchObject({ kind: "LEGACY", credits: 30 });
  });

  it("variabilní symbol RRRR + pořadí, nový rok začíná od 0001", () => {
    expect(nextVariableSymbol([], 2026)).toBe("20260001");
    expect(nextVariableSymbol(["20260001", "20260009", "20250077"], 2026)).toBe("20260010");
    expect(nextVariableSymbol(["20260412"], 2027)).toBe("20270001");
  });
});

describe("český QR kód platby (SPD 1.0)", () => {
  it("řetězec s IBAN, částkou, měnou, VS a zprávou bez diakritiky a hvězdiček", () => {
    expect(spdPayload({ iban: "CZ17 5500 0000 0009 1811 8002", amountCzk: 1198, variableSymbol: "20260001", message: "ELDOCK Kredity Elektro Tester s.r.o." })).toBe(
      "SPD*1.0*ACC:CZ1755000000000918118002*AM:1198.00*CC:CZK*X-VS:20260001*MSG:ELDOCK Kredity Elektro Tester s.r.o.",
    );
    expect(spdText("Žluťoučký*kůň\núpěl")).toBe("Zlutoucky kun upel");
    expect(spdText("x".repeat(80))).toHaveLength(60);
  });

  it("odmítne neplatný IBAN, částku i variabilní symbol", () => {
    expect(normalizeIban("cz17 5500 0000 0009 1811 8002")).toBe("CZ1755000000000918118002");
    expect(normalizeIban("123")).toBeNull();
    expect(() => spdPayload({ iban: "xx", amountCzk: 100, variableSymbol: "1", message: "" })).toThrow(/IBAN/);
    expect(() => spdPayload({ iban: "CZ1755000000000918118002", amountCzk: 0, variableSymbol: "1", message: "" })).toThrow(/částka/);
    expect(() => spdPayload({ iban: "CZ1755000000000918118002", amountCzk: 10, variableSymbol: "VS-1", message: "" })).toThrow(/Variabilní/);
  });
});

describe("oprávnění velínu /superadmin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("heslo velínu: vlastní ELDOCK_SUPERADMIN_PASSWORD; v produkci bez něj velín vypnutý, mimo produkci přístupové heslo", () => {
    vi.stubEnv("ELDOCK_SUPERADMIN_PASSWORD", "");
    vi.stubEnv("ELDOCK_ACCESS_PASSWORD", "pristup");
    expect(superadminPassword("production")).toBeNull();
    expect(superadminPassword("development")).toBe("pristup");
    vi.stubEnv("ELDOCK_SUPERADMIN_PASSWORD", "velin-heslo");
    expect(superadminPassword("production")).toBe("velin-heslo");
  });

  it("token velínu neplatí jako přihlášení do závodu a token závodu neotevře velín", async () => {
    const admin = await signSuperadminToken();
    expect(await isSuperadminToken(admin)).toBe(true);
    expect(await verifyAuthToken(admin)).toBeNull();
    const plant = await signAuthToken("superadmin");
    expect(await isSuperadminToken(plant)).toBe(false);
    expect(await isSuperadminToken(undefined)).toBe(false);
    const expired = await signSuperadminToken({ now: Date.now() - 9 * 3600 * 1000 });
    expect(await isSuperadminToken(expired)).toBe(false);
  });
});
