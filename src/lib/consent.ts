// Fáze 56 / 102: souhlas s cookies (GDPR + § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích).
// Nezbytné cookies (přihlášení) souhlas nepotřebují. Volitelné kategorie (analytika, marketing) se zapnou jen
// po výslovném souhlasu; lišta se zobrazí, jakmile web používá aspoň jednu volitelnou službu (od fáze 102 vždy –
// vlastní produktová analytika s pseudonymním identifikátorem). Odmítnout jde stejně snadno jako přijmout. Souhlas
// platí 6 měsíců, změna verze (nové služby) se ptá znovu. Google Consent Mode v2: výchozí stav vše „denied“, po volbě
// `consentModeUpdate`. Čisté funkce bez I/O.

export const CONSENT_COOKIE = "eldock_consent";
/** Fáze 102: kopie volby s časovým razítkem v localStorage (zadání) – zdrojem pravdy zůstává cookie. */
export const CONSENT_STORAGE_KEY = "eldock_cookie_consent_v1";
/** Zvýšit při přidání nové volitelné služby – uživatel dostane lištu znovu (fáze 102: Clarity, Sklik, Ads, LinkedIn). */
export const CONSENT_VERSION = 2;
export const CONSENT_MAX_AGE_DAYS = 182;
export const CONSENT_OPEN_EVENT = "eldock:open-consent";
export const CONSENT_CHANGE_EVENT = "eldock:consent";

export type OptionalCategory = "analytics" | "marketing";

export interface ConsentState {
  version: number;
  analytics: boolean;
  marketing: boolean;
  /** Unixový čas rozhodnutí v sekundách. */
  decidedAt: number;
  /** Náhodný identifikátor pro dohledání záznamu souhlasu (bez vazby na osobu). */
  id: string;
}

export interface ConsentService {
  id: string;
  category: "necessary" | OptionalCategory;
  name: string;
  provider: string;
  purpose: string;
  cookies: string;
  retention: string;
}

export const CATEGORY_INFO: Record<"necessary" | OptionalCategory, { title: string; text: string }> = {
  necessary: { title: "Nezbytné technické a funkční cookies", text: "Přihlášení, zabezpečení, uložení rozpracovaných půdorysů a rozváděčů a vaší volby. Bez nich web nefunguje, souhlas nepotřebují – jsou vždy aktivní." },
  analytics: { title: "Analytické a výkonnostní cookies", text: "Statistika návštěvnosti a používání nástrojů (které stránky a funkce používáte, co zlepšit). Zapneme je jen s vaším souhlasem." },
  marketing: { title: "Marketingové a remarketingové cookies", text: "Měření kampaní a připomenutí nabídky ELDOCK na jiných webech a sociálních sítích. Zapneme je jen s vaším souhlasem." },
};

/** Fáze 102: ID služeb měření a marketingu z konfigurace serveru (prázdné = služba vypnutá). */
export interface ConsentConfig {
  ga4Id?: string | null;
  clarityId?: string | null;
  sklikId?: string | null;
  googleAdsId?: string | null;
  linkedinId?: string | null;
}

const NECESSARY: ConsentService[] = [
  { id: "session", category: "necessary", name: "Přihlášení", provider: "Eldock", purpose: "podepsaný token relace přihlášeného uživatele (správa závodů / AI Panel Builder / velín)", cookies: "digitry-auth, eldock-pb, eldock-superadmin", retention: "12 hodin / 14 dní / 8 hodin, odhlášením hned" },
  { id: "consent", category: "necessary", name: "Volba cookies", provider: "Eldock", purpose: "uložení vaší volby souhlasu", cookies: `${CONSENT_COOKIE}, localStorage ${CONSENT_STORAGE_KEY}`, retention: `${CONSENT_MAX_AGE_DAYS} dní` },
  { id: "lead", category: "necessary", name: "Zadaný kontakt", provider: "Eldock", purpose: "po zadání e-mailu v okně dokumentace se okno znovu neptá", cookies: "eldock_lead", retention: "30 dní" },
  { id: "storage", category: "necessary", name: "Místní úložiště", provider: "Eldock", purpose: "rozpracovaný nákres, rozváděč a nastavení zobrazení v prohlížeči", cookies: "localStorage (nejde o cookie)", retention: "do smazání v prohlížeči" },
  { id: "stats", category: "necessary", name: "Souhrnná statistika bez cookies", provider: "Eldock", purpose: "počet zobrazení stránek, zdroj návštěvy a použití nástrojů – bez identifikátoru, bez IP adresy a bez zápisu do prohlížeče (oprávněný zájem)", cookies: "žádné", retention: "14 měsíců" },
];

/** Fáze 102: vlastní produktová analytika – pseudonymní id prohlížeče jen se souhlasem (bez třetích stran). */
const PRODUCT_ANALYTICS: ConsentService = { id: "eldock-analytics", category: "analytics", name: "Produktová analytika ELDOCK", provider: "Eldock (vlastní server, bez třetích stran)", purpose: "které nástroje a trenažéry používáte a kde se zasekáváte (navazující návštěvy jednoho prohlížeče)", cookies: "localStorage eldock_vid", retention: "13 měsíců" };

/** Služby podle konfigurace serveru: Google Analytics 4, Microsoft Clarity, Seznam Sklik, Google Ads a LinkedIn jen s ID. */
export function consentServices(config: ConsentConfig): ConsentService[] {
  const services = [...NECESSARY, PRODUCT_ANALYTICS];
  if (config.ga4Id && isGa4Id(config.ga4Id)) {
    services.push({ id: "ga4", category: "analytics", name: "Google Analytics 4", provider: "Google Ireland Ltd.", purpose: "statistika návštěvnosti (Consent Mode v2)", cookies: "_ga, _ga_*", retention: "až 14 měsíců" });
  }
  if (config.clarityId && isClarityId(config.clarityId)) {
    services.push({ id: "clarity", category: "analytics", name: "Microsoft Clarity", provider: "Microsoft Ireland Operations Ltd.", purpose: "mapy kliknutí a záznam práce s webem bez zadaných textů", cookies: "_clck, _clsk, CLID", retention: "až 13 měsíců" });
  }
  if (config.sklikId && isSklikId(config.sklikId)) {
    services.push({ id: "sklik", category: "marketing", name: "Seznam Sklik (retargeting a konverze)", provider: "Seznam.cz, a.s.", purpose: "měření kampaní a připomenutí nabídky na webech Seznamu", cookies: "sid, KADUSERCOOKIE, retargeting", retention: "až 30 dní / 1 rok" });
  }
  if (config.googleAdsId && isGoogleAdsId(config.googleAdsId)) {
    services.push({ id: "google-ads", category: "marketing", name: "Google Ads", provider: "Google Ireland Ltd.", purpose: "měření konverzí a remarketing (Consent Mode v2)", cookies: "_gcl_au, IDE", retention: "až 13 měsíců" });
  }
  if (config.linkedinId && isLinkedinId(config.linkedinId)) {
    services.push({ id: "linkedin", category: "marketing", name: "LinkedIn Insight Tag", provider: "LinkedIn Ireland Unlimited Company", purpose: "měření kampaní a oslovení firem na LinkedInu", cookies: "li_sugr, bcookie, lidc, UserMatchHistory", retention: "až 6 měsíců" });
  }
  return services;
}

export const isGa4Id = (value: string) => /^G-[A-Z0-9]{4,12}$/.test(value.trim());
export const isClarityId = (value: string) => /^[a-z0-9]{6,16}$/.test(value.trim());
export const isSklikId = (value: string) => /^\d{1,12}$/.test(value.trim());
export const isGoogleAdsId = (value: string) => /^AW-\d{6,14}$/.test(value.trim());
export const isLinkedinId = (value: string) => /^\d{4,12}$/.test(value.trim());

/** Fáze 102: platná ID z proměnných prostředí serveru (`NEXT_PUBLIC_*` podle zadání, GA4 i dřívější `ELDOCK_GA4_ID`). */
export function consentConfigFromEnv(env: Partial<Record<string, string | undefined>>): Required<ConsentConfig> {
  const pick = (value: string | undefined, valid: (value: string) => boolean) => (value && valid(value) ? value.trim() : null);
  return {
    ga4Id: pick(env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || env.ELDOCK_GA4_ID?.trim() || env.DIGITRY_GA4_ID?.trim(), isGa4Id),
    clarityId: pick(env.NEXT_PUBLIC_CLARITY_ID, isClarityId),
    sklikId: pick(env.NEXT_PUBLIC_SKLIK_ID, isSklikId),
    googleAdsId: pick(env.NEXT_PUBLIC_GOOGLE_ADS_ID, isGoogleAdsId),
    linkedinId: pick(env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID, isLinkedinId),
  };
}

/** Fáze 102: Google Consent Mode v2 – signály podle volby (bez volby vše „denied“). */
export function consentModeState(state: Pick<ConsentState, "analytics" | "marketing"> | null): Record<"analytics_storage" | "ad_storage" | "ad_user_data" | "ad_personalization", "granted" | "denied"> {
  const analytics = state?.analytics ? "granted" : "denied";
  const marketing = state?.marketing ? "granted" : "denied";
  return { analytics_storage: analytics, ad_storage: marketing, ad_user_data: marketing, ad_personalization: marketing };
}

/** Fáze 102: zápis volby do localStorage (kopie cookie s časovým razítkem pro audit v prohlížeči). */
export const consentStorageValue = (state: ConsentState) => JSON.stringify({ necessary: true, analytics: state.analytics, marketing: state.marketing, version: state.version, decidedAt: new Date(state.decidedAt * 1000).toISOString(), id: state.id });

/**
 * Volitelné kategorie v liště: analytika vždy (vlastní produktová analytika), marketing podle zadání také vždy –
 * bez nastavené služby jen s poznámkou, že ji web zatím nepoužívá (nová služba zvýší verzi a zeptá se znovu).
 */
export const optionalCategories = (services: readonly ConsentService[]): OptionalCategory[] =>
  (["analytics", "marketing"] as const).filter((category) => category === "marketing" || services.some((service) => service.category === category));

/** Hodnota cookie: `v1.a1m0.<čas>.<id>` – krátká, bez osobních údajů. */
export function serializeConsent(state: ConsentState): string {
  return `v${state.version}.a${state.analytics ? 1 : 0}m${state.marketing ? 1 : 0}.${state.decidedAt}.${state.id}`;
}

/** Platný souhlas aktuální verze, jinak null (chybí, jiná verze, starší než 6 měsíců nebo poškozený). */
export function parseConsent(raw: string | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): ConsentState | null {
  const match = /^v(\d+)\.a([01])m([01])\.(\d{9,11})\.([A-Za-z0-9_-]{8,64})$/.exec(raw?.trim() ?? "");
  if (!match) return null;
  const state: ConsentState = { version: Number(match[1]), analytics: match[2] === "1", marketing: match[3] === "1", decidedAt: Number(match[4]), id: match[5] };
  if (state.version !== CONSENT_VERSION) return null;
  if (state.decidedAt > nowSeconds + 300 || nowSeconds - state.decidedAt > CONSENT_MAX_AGE_DAYS * 86_400) return null;
  return state;
}

/** Lištu ukázat, když web používá volitelnou službu a platná volba chybí. */
export const needsConsentPrompt = (state: ConsentState | null, categories: readonly OptionalCategory[]) => categories.length > 0 && state === null;

/** Hodnota cookie z `document.cookie`. */
export function readCookie(cookieHeader: string, name: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
