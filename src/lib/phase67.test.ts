import { describe, expect, it } from "vitest";

import { SecurityEventKind } from "@/generated/prisma/enums";
import { parseSubject, sessionSubject, signTwoFactorToken, verifyAuthToken, verifyTwoFactorToken } from "@/lib/auth";
import { PASSWORD_MIN_LENGTH, passwordIssues } from "@/lib/password-policy";
import { SECURITY_EVENT_LABELS } from "@/lib/security-events";
import { base32Decode, base32Encode, decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, totpCode, totpUri, verifyTotp } from "@/server/totp";

// Fáze 67: pravidla hesla, TOTP (RFC 6238), šifrování tajemství, záložní kódy a předmět tokenu relace.

describe("pravidla hesla", () => {
  it("délka, běžná hesla, řady znaků, e-mail a jméno", () => {
    expect(passwordIssues("Kratke1!")[0]).toContain(`${PASSWORD_MIN_LENGTH} znaků`);
    expect(passwordIssues("heslo12345!")).toContain("Heslo je příliš běžné – zvolte delší větu nebo kombinaci slov.");
    expect(passwordIssues("Password2026")).toContain("Heslo je příliš běžné – zvolte delší větu nebo kombinaci slov.");
    expect(passwordIssues("1234567890")).toContain("Heslo nesmí být řada stejných nebo po sobě jdoucích znaků.");
    expect(passwordIssues("aaaaaaaaaaaa")).toContain("Heslo nesmí být řada stejných nebo po sobě jdoucích znaků.");
    expect(passwordIssues("novak.petr-2026", { email: "novak@firma.cz" })).toContain("Heslo nesmí obsahovat e-mail.");
    expect(passwordIssues("Strojník-modrý-2026", { name: "Ing. Karel Strojník" })).toContain("Heslo nesmí obsahovat vaše jméno.");
    expect(passwordIssues("modry-kocour-pije-mleko", { email: "karel@firma.cz", name: "Karel Novák" })).toEqual([]);
    expect(passwordIssues("x".repeat(201)).some((issue) => issue.includes("nejvýš"))).toBe(true);
  });
});

describe("TOTP (RFC 6238, SHA-1)", () => {
  // Testovací vektory RFC 6238, příloha B: tajemství „12345678901234567890“, 8 číslic → posledních 6
  const secret = base32Encode(Buffer.from("12345678901234567890"));

  it("base32 tam a zpět", () => {
    expect(secret).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(secret).toString()).toBe("12345678901234567890");
    expect(base32Decode(generateTotpSecret())).toHaveLength(20);
  });

  it("kódy podle RFC 6238 a tolerance ±1 krok", () => {
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(totpCode(secret, 1_111_111_109_000)).toBe("081804");
    expect(totpCode(secret, 1_234_567_890_000)).toBe("005924");
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, "12a456", now)).toBe(false);
  });

  it("odkaz pro aplikaci, šifrované tajemství a záložní kódy", () => {
    expect(totpUri({ secret, account: "karel@firma.cz" })).toBe(`otpauth://totp/Eldock%3Akarel%40firma.cz?secret=${secret}&issuer=Eldock&algorithm=SHA1&digits=6&period=30`);
    const stored = encryptTotpSecret(secret);
    expect(stored.startsWith("v1.")).toBe(true);
    expect(stored).not.toContain(secret);
    expect(decryptTotpSecret(stored)).toBe(secret);
    expect(decryptTotpSecret(`${stored.slice(0, -2)}xx`)).toBeNull();
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(8);
    expect(codes[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(hashRecoveryCode(codes[0].toLowerCase().replace("-", " "))).toBe(hashRecoveryCode(codes[0]));
  });
});

describe("token přihlášení s relací a čekající druhý krok", () => {
  it("předmět `<uživatel>~<relace>` a samostatný podpis kroku 2", async () => {
    expect(parseSubject(sessionSubject("user-1", "session-9"))).toEqual({ userId: "user-1", sessionId: "session-9" });
    expect(parseSubject("acc-dvorak")).toEqual({ userId: "acc-dvorak", sessionId: null });
    const pending = await signTwoFactorToken("user-1");
    expect(await verifyTwoFactorToken(pending)).toBe("user-1");
    // Token kroku 2 neplatí jako přihlášení (jiný odvozený podpis)
    expect(await verifyAuthToken(pending)).toBeNull();
    expect(await verifyTwoFactorToken(pending, { now: Date.now() + 6 * 60 * 1000 })).toBeNull();
  });

  it("popisky bezpečnostního deníku", () => {
    expect(SECURITY_EVENT_LABELS.LOGIN_LOCKED.tone).toBe("bad");
    // Každý druh události (i nové z fáze 69) má popisek
    expect(Object.keys(SECURITY_EVENT_LABELS).sort()).toEqual(Object.values(SecurityEventKind).sort());
  });
});
