import { describe, expect, it } from "vitest";

import { classifyNace, mapAresSubject } from "./ares";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION, consentConfigFromEnv, consentModeState, consentServices, consentStorageValue, optionalCategories, parseConsent, serializeConsent } from "./consent";
import { LEAD_BONUS_CREDITS, leadSchema, leadsCsv } from "./leads";
import { PRIVACY_SECTIONS, PRIVACY_VERSION } from "./legal";
import { isBotAgent, referrerHost, telemetrySchema, trafficSource } from "./telemetry";

/** Zkrácená odpověď ARES (ekonomicke-subjekty/{ico}) – struktura podle veřejného REST API MF ČR. */
const ARES_FIXTURE = {
  ico: "27082440",
  obchodniJmeno: "Elektro Novák s.r.o.",
  dic: "CZ27082440",
  sidlo: { nazevObce: "Kolín", nazevCastiObce: "Kolín II", nazevUlice: "Havlíčkova", cisloDomovni: 12, cisloOrientacni: 3, psc: 28002 },
  czNace: ["43210", "4322", "71120", "47"],
};

describe("fáze 102 – souhlas s cookies verze 2 a Google Consent Mode v2", () => {
  it("vždy analytika (vlastní produktová analytika) i marketing; služby třetích stran jen s platným ID", () => {
    expect(CONSENT_VERSION).toBe(2);
    expect(optionalCategories(consentServices({}))).toEqual(["analytics", "marketing"]);
    const all = consentServices({ ga4Id: "G-ABC123XYZ", clarityId: "k2l3m4n5o6", sklikId: "123456", googleAdsId: "AW-123456789", linkedinId: "7654321" });
    expect(all.filter((service) => service.category === "analytics").map((service) => service.id)).toEqual(["eldock-analytics", "ga4", "clarity"]);
    expect(all.filter((service) => service.category === "marketing").map((service) => service.id)).toEqual(["sklik", "google-ads", "linkedin"]);
    expect(consentServices({ clarityId: "<script>", sklikId: "abc", googleAdsId: "G-1", linkedinId: "x" }).filter((service) => service.category !== "necessary").map((service) => service.id)).toEqual(["eldock-analytics"]);
  });

  it("ID služeb z proměnných prostředí serveru (NEXT_PUBLIC_* i dřívější ELDOCK_GA4_ID), neplatná se zahodí", () => {
    expect(consentConfigFromEnv({ NEXT_PUBLIC_GA_MEASUREMENT_ID: " G-NEW12345 ", ELDOCK_GA4_ID: "G-OLD12345", NEXT_PUBLIC_CLARITY_ID: "abcdef1234", NEXT_PUBLIC_SKLIK_ID: "99" })).toEqual({ ga4Id: "G-NEW12345", clarityId: "abcdef1234", sklikId: "99", googleAdsId: null, linkedinId: null });
    expect(consentConfigFromEnv({ ELDOCK_GA4_ID: "G-OLD12345", NEXT_PUBLIC_SKLIK_ID: "nesmysl" })).toMatchObject({ ga4Id: "G-OLD12345", sklikId: null });
  });

  it("Consent Mode v2: bez volby vše denied, analytika a marketing zvlášť", () => {
    expect(consentModeState(null)).toEqual({ analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    expect(consentModeState({ analytics: true, marketing: false })).toEqual({ analytics_storage: "granted", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    expect(consentModeState({ analytics: true, marketing: true })).toEqual({ analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  });

  it("„Rozumím a přijímám“ / „Odmítnout vše“: cookie verze 2 a kopie s časovým razítkem v localStorage", () => {
    const now = 1_793_000_000;
    const accepted = { version: CONSENT_VERSION, analytics: true, marketing: true, decidedAt: now, id: "abcdEFGH1234" };
    expect(serializeConsent(accepted)).toBe(`v2.a1m1.${now}.abcdEFGH1234`);
    expect(parseConsent(serializeConsent(accepted), now)).toEqual(accepted);
    // Starší volba verze 1 (bez Clarity, Sklik …) neplatí – lišta se zeptá znovu
    expect(parseConsent(`v1.a1m1.${now}.abcdEFGH1234`, now)).toBeNull();
    expect(CONSENT_STORAGE_KEY).toBe("eldock_cookie_consent_v1");
    expect(JSON.parse(consentStorageValue({ ...accepted, analytics: false, marketing: false }))).toEqual({ necessary: true, analytics: false, marketing: false, version: 2, decidedAt: new Date(now * 1000).toISOString(), id: "abcdEFGH1234" });
  });
});

describe("fáze 102 – telemetrie prvních stran", () => {
  it("platná událost projde, cesta s dotazem, cizí typ, moc vlastností nebo neplatné id ne", () => {
    expect(telemetrySchema.safeParse({ type: "page_view", path: "/panel-builder/floorplan", referrer: "https://www.google.com", utm: { source: "seznam", medium: "cpc", campaign: "jaro" }, landing: true }).success).toBe(true);
    expect(telemetrySchema.safeParse({ type: "sandbox_started", path: "/", props: { sandbox: "2D Půdorys 4+kk" }, visitorId: "abcd1234efgh" }).success).toBe(true);
    expect(telemetrySchema.safeParse({ type: "page_view", path: "/?token=tajne" }).success).toBe(false);
    expect(telemetrySchema.safeParse({ type: "hack", path: "/" }).success).toBe(false);
    expect(telemetrySchema.safeParse({ type: "page_view", path: "/", props: Object.fromEntries(Array.from({ length: 21 }, (_, index) => [`k${index}`, 1])) }).success).toBe(false);
    expect(telemetrySchema.safeParse({ type: "page_view", path: "/", visitorId: "x" }).success).toBe(false);
  });

  it("zdroj návštěvy: UTM má přednost, pak doména odkazu; vlastní web je interní, bez odkazu přímý vstup", () => {
    expect(trafficSource({ referrerHost: "www.google.cz" })).toBe("google");
    expect(trafficSource({ referrerHost: "search.seznam.cz" })).toBe("seznam");
    expect(trafficSource({ referrerHost: "l.facebook.com" })).toBe("facebook");
    expect(trafficSource({ referrerHost: "www.linkedin.com" })).toBe("linkedin");
    expect(trafficSource({ referrerHost: null })).toBe("direct");
    expect(trafficSource({ referrerHost: "eldock.cz" })).toBe("internal");
    expect(trafficSource({ referrerHost: "www.tzb-info.cz" })).toBe("other");
    expect(trafficSource({ referrerHost: "www.google.com", utmSource: "linkedin" })).toBe("linkedin");
    expect(trafficSource({ referrerHost: null, utmSource: "newsletter" })).toBe("other");
    expect(referrerHost("https://www.seznam.cz/hledani?q=rozvadec")).toBe("www.seznam.cz");
    expect(referrerHost("javascript:alert(1)")).toBeNull();
    expect([isBotAgent("Googlebot/2.1"), isBotAgent("facebookexternalhit/1.1"), isBotAgent("Mozilla/5.0 (Windows NT 10.0) Edg/140")]).toEqual([true, true, false]);
  });
});

describe("fáze 102 – ARES s obory CZ-NACE a kontakty z trenažéru", () => {
  it("ARES: název, sídlo, DIČ a obory CZ-NACE → zaměření elektromontážní firma", () => {
    expect(mapAresSubject(ARES_FIXTURE)).toEqual({ companyName: "Elektro Novák s.r.o.", ico: "27082440", dic: "CZ27082440", street: "Havlíčkova 12/3", city: "Kolín", zip: "280 02", nace: ["43210", "4322", "71120", "47"], segment: "electro" });
    expect([classifyNace(["7112"]), classifyNace(["86210"]), classifyNace(["25620", "4799"]), classifyNace(["68320"]), classifyNace(["47910"]), classifyNace([])]).toEqual(["design", "healthcare", "manufacturing", "facility", "other", "other"]);
    expect(mapAresSubject({ ...ARES_FIXTURE, czNace: ["<b>", 5, "4321"] })?.nace).toEqual(["4321"]);
  });

  it("kontakt: e-mail malými písmeny, IČO s kontrolní číslicí, souhlas s novinkami povinně ano / ne", () => {
    const context = { kind: "floorplan", trigger: "xlsx", summary: "2D půdorys RD 4+kk: 17 okruhů" } as const;
    const parsed = leadSchema.parse({ email: " Jan.Novak@Firma.CZ ", ico: "27 082 440".replace(/\s/g, ""), role: "installer", marketing: false, context });
    expect(parsed).toMatchObject({ email: "jan.novak@firma.cz", ico: "27082440", marketing: false });
    expect(leadSchema.safeParse({ email: "jan@firma.cz", ico: "12345678", role: "installer", marketing: false, context }).success).toBe(false);
    expect(leadSchema.safeParse({ email: "spatne", role: "installer", marketing: false, context }).success).toBe(false);
    expect(leadSchema.safeParse({ email: "jan@firma.cz", role: "hacker", marketing: false, context }).success).toBe(false);
    expect(LEAD_BONUS_CREDITS).toBe(45);
  });

  it("export kontaktů: CSV s BOM, středníkem a sloupcem souhlasu s obchodními sděleními", () => {
    const csv = leadsCsv([{ email: "jan@firma.cz", ico: "27082440", companyName: 'Elektro "Novák"; s.r.o.', segmentLabel: "Elektromontážní firma (CZ-NACE 43.21)", nace: ["43210"], role: "installer", summary: "2D půdorys", trigger: "xlsx", circuits: 17, boards: 1, source: "google", marketingConsent: true, registered: false, createdAt: new Date("2026-11-12T10:00:00Z") }]);
    expect(csv.startsWith("﻿email;ico;firma_ares;zamereni_nace")).toBe(true);
    expect(csv).toContain('"Elektro ""Novák""; s.r.o."');
    expect(csv).toContain(";ano;ne;2026-11-12T10:00:00.000Z");
  });

  it("zásady ochrany osobních údajů popisují telemetrii, kontakty z trenažéru a ARES", () => {
    // Fáze 107: verze 1.5 doplnila kontaktní formulář a hlášení chyb (7c)
    expect(PRIVACY_VERSION).toMatch(/^1\.[4-9]/);
    const text = PRIVACY_SECTIONS.map((section) => [...section.paragraphs, ...(section.list ?? [])].join(" ")).join(" ");
    for (const phrase of ["bez IP adresy", "ARES", "Microsoft Clarity", "Seznam Sklik", "Consent Mode v2", "§ 7 zákona č. 480/2004 Sb."]) expect(text).toContain(phrase);
    expect(PRIVACY_SECTIONS.some((section) => section.id === "kontakty")).toBe(true);
  });
});
