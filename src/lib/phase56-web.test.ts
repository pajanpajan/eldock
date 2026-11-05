import { describe, expect, it } from "vitest";

import { CONSENT_MAX_AGE_DAYS, CONSENT_VERSION, consentServices, isGa4Id, needsConsentPrompt, optionalCategories, parseConsent, readCookie, serializeConsent } from "./consent";
import { AUDIENCES, TRUST_POINTS } from "./landing-audiences";
import { NEWSLETTER_CONSENT_TEXT, PRIVACY_SECTIONS } from "./legal";
import { confirmationEmail, isAudience, isValidEmail, issueEmail, normalizeEmail, textToHtml } from "./newsletter";

const now = 1_793_000_000;
const state = { version: CONSENT_VERSION, analytics: true, marketing: false, decidedAt: now - 100, id: "abc12345XYZ" };

describe("fáze 56 – souhlas s cookies", () => {
  it("hodnota cookie se zapíše a přečte zpět; jiná verze, starý nebo poškozený souhlas neplatí", () => {
    const raw = serializeConsent(state);
    expect(raw).toBe(`v${CONSENT_VERSION}.a1m0.${now - 100}.abc12345XYZ`);
    expect(parseConsent(raw, now)).toEqual(state);
    expect(parseConsent(serializeConsent({ ...state, version: CONSENT_VERSION + 1 }), now)).toBeNull();
    expect(parseConsent(serializeConsent({ ...state, decidedAt: now - (CONSENT_MAX_AGE_DAYS + 1) * 86_400 }), now)).toBeNull();
    expect(parseConsent("v1.a1m0.<script>.x", now)).toBeNull();
    expect(parseConsent(null, now)).toBeNull();
  });

  it("lišta jen když web používá volitelnou službu a volba chybí", () => {
    expect(optionalCategories(consentServices({}))).toEqual([]);
    expect(needsConsentPrompt(null, [])).toBe(false);
    const withGa = consentServices({ ga4Id: "G-ABC123XYZ" });
    expect(optionalCategories(withGa)).toEqual(["analytics"]);
    expect(needsConsentPrompt(null, ["analytics"])).toBe(true);
    expect(needsConsentPrompt(state, ["analytics"])).toBe(false);
    expect(optionalCategories(consentServices({ ga4Id: "nesmysl" }))).toEqual([]);
    expect(isGa4Id(" G-ABC123XYZ ")).toBe(true);
  });

  it("cookie z hlavičky", () => {
    expect(readCookie("a=1; eldock_consent=v1.a0m0.1793000000.abcdefgh; b=2", "eldock_consent")).toBe("v1.a0m0.1793000000.abcdefgh");
    expect(readCookie("a=1", "eldock_consent")).toBeNull();
  });

  it("zásady popisují cookies i newsletter (kotvy pro odkazy z lišty a formuláře)", () => {
    expect(PRIVACY_SECTIONS.find((section) => section.id === "cookies")?.paragraphs.join(" ")).toMatch(/Nastavení cookies/);
    expect(PRIVACY_SECTIONS.find((section) => section.id === "newsletter")?.paragraphs.join(" ")).toMatch(/dvojí potvrzení/);
  });
});

describe("fáze 56 – newsletter (čisté funkce)", () => {
  it("e-mail se normalizuje a kontroluje", () => {
    expect(normalizeEmail("  Jan.Novak@Firma.CZ ")).toBe("jan.novak@firma.cz");
    expect(isValidEmail("jan.novak@firma.cz")).toBe(true);
    for (const bad of ["jan", "jan@", "@firma.cz", "jan novak@firma.cz", "jan@firma", "<a>@firma.cz"]) expect(isValidEmail(bad)).toBe(false);
    expect(isAudience("revizni-technik")).toBe(true);
    expect(isAudience("hacker")).toBe(false);
  });

  it("text vydání se escapuje, odkazy jsou klikací a každý e-mail má odhlášení", () => {
    const html = textToHtml("Ahoj <b>všem</b>\n\nVíce na https://eldock.cz/#novinky");
    expect(html).toContain("&lt;b&gt;všem&lt;/b&gt;");
    expect(html).toContain('<a href="https://eldock.cz/#novinky"');
    const issue = issueEmail({ subject: "Novinky – listopad", body: "Text vydání", unsubscribeUrl: "https://eldock.cz/newsletter/odhlaseni?t=xyz" });
    expect(issue.text).toContain("Odhlášení odběru: https://eldock.cz/newsletter/odhlaseni?t=xyz");
    expect(issue.html).toContain("Odhlásit odběr");
    expect(confirmationEmail("https://eldock.cz/newsletter/potvrzeni?t=abc").html).toContain("Potvrdit odběr");
    expect(NEWSLETTER_CONSENT_TEXT).toMatch(/kdykoli odvolat/);
  });
});

describe("fáze 56 – úvodní stránka pro čtyři cílové skupiny", () => {
  it("elektrikář, revizní technik, technický ředitel a údržbář mají vlastní sekci, slib a tlačítka", () => {
    expect(AUDIENCES.map((audience) => audience.id)).toEqual(["elektrikar", "revizni-technik", "technicky-reditel", "udrzba"]);
    expect(new Set(AUDIENCES.map((audience) => audience.anchor)).size).toBe(4);
    for (const audience of AUDIENCES) {
      expect(audience.features.length).toBeGreaterThanOrEqual(3);
      expect(audience.ctas.some((cta) => cta.primary)).toBe(true);
      expect(audience.promise.length).toBeLessThan(80);
    }
    expect(TRUST_POINTS).toContain("ČSN EN IEC 61439");
  });
});
