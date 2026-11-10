import { describe, expect, it } from "vitest";

import { COMPANY_INFO } from "@/lib/company";
import { czAccountFromIban, formatIban, isValidIban, normalizeBic, spdPayload } from "@/lib/credits";
import { bankAccount, SPD_SAMPLE_IBAN } from "@/server/services/credits";

describe("fáze 84 – bankovní účet Eldock pro QR platby (SPD) a zálohové faktury", () => {
  it("účet u Raiffeisenbank a.s.: číslo účtu, IBAN s platnou kontrolní číslicí a SWIFT / BIC", () => {
    expect(COMPANY_INFO.bank).toEqual({ name: "Raiffeisenbank a.s.", accountNumber: "918118002/5500", iban: "CZ1755000000000918118002", bic: "RZBCCZPP" });
    expect(isValidIban(COMPANY_INFO.bank.iban)).toBe(true);
    expect(formatIban(COMPANY_INFO.bank.iban)).toBe("CZ17 5500 0000 0009 1811 8002");
    // Tuzemské číslo účtu z IBAN odpovídá zadání
    expect(czAccountFromIban(COMPANY_INFO.bank.iban)).toBe(COMPANY_INFO.bank.accountNumber);
    expect(czAccountFromIban("CZ65 0800 0000 1920 0014 5399")).toBe("19-2000145399/0800");
    expect(czAccountFromIban("DE89370400440532013000")).toBeNull();
    expect(isValidIban("CZ1855000000000918118002")).toBe(false);
  });

  it("QR platba SPD 1.0: ACC:IBAN+BIC, částka, měna, VS a zpráva", () => {
    expect(spdPayload({ iban: "CZ17 5500 0000 0009 1811 8002", bic: "RZBCCZPP", amountCzk: 1198, variableSymbol: "20260001", message: "ELDOCK Kredity Elektro Tester s.r.o." })).toBe(
      "SPD*1.0*ACC:CZ1755000000000918118002+RZBCCZPP*AM:1198.00*CC:CZK*X-VS:20260001*MSG:ELDOCK Kredity Elektro Tester s.r.o.",
    );
    // Bez BIC (také podle ČBA SPD 1.0)
    expect(spdPayload({ iban: "CZ1755000000000918118002", amountCzk: 4990, variableSymbol: "20260002", message: "ELDOCK" })).toBe("SPD*1.0*ACC:CZ1755000000000918118002*AM:4990.00*CC:CZK*X-VS:20260002*MSG:ELDOCK");
    expect(() => spdPayload({ iban: "CZ1755000000000918118002", bic: "RZB", amountCzk: 10, variableSymbol: "1", message: "" })).toThrow(/BIC/);
    expect(normalizeBic("rzbc czpp")).toBe("RZBCCZPP");
    expect(normalizeBic("RZBCCZPPXXX")).toBe("RZBCCZPPXXX");
    expect(normalizeBic("RZBC")).toBeNull();
  });

  it("účet na objednávce a faktuře: výchozí Raiffeisenbank, jiný platný IBAN jen z env, vzorový IBAN SPD se ignoruje", () => {
    const own = { iban: "CZ1755000000000918118002", bic: "RZBCCZPP", accountNumber: "918118002/5500", bankName: "Raiffeisenbank a.s." };
    expect(bankAccount({})).toEqual(own);
    // Dřívější demo IBAN ze vzoru SPD (třeba zapomenutý v .env) ani neplatná kontrolní číslice účet nepřepíšou
    expect(bankAccount({ ELDOCK_BANK_IBAN: "CZ65 0800 0000 1920 0014 5399" })).toEqual(own);
    expect(SPD_SAMPLE_IBAN).toBe("CZ6508000000192000145399");
    expect(bankAccount({ ELDOCK_BANK_IBAN: "CZ1855000000000918118002" })).toEqual(own);
    expect(bankAccount({ ELDOCK_BANK_IBAN: "CZ17 5500 0000 0009 1811 8002", ELDOCK_BANK_BIC: "XXXXCZPP" })).toEqual(own);
    // Jiný platný účet z env: číslo účtu z IBAN, BIC a banka z env
    expect(bankAccount({ ELDOCK_BANK_IBAN: "CZ63 2010 0000 0029 0000 0001", ELDOCK_BANK_BIC: "fiobczpp", ELDOCK_BANK_NAME: " Fio banka, a.s. " })).toEqual({
      iban: "CZ6320100000002900000001",
      bic: "FIOBCZPP",
      accountNumber: "2900000001/2010",
      bankName: "Fio banka, a.s.",
    });
  });
});
