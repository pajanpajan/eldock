// Fáze 56: souhlas s cookies (GDPR + § 89 odst. 3 zákona č. 127/2005 Sb., o elektronických komunikacích).
// Nezbytné cookies (přihlášení) souhlas nepotřebují. Volitelné kategorie (analytika, marketing) se zapnou jen
// po výslovném souhlasu; lišta se zobrazí, jakmile je nastavená aspoň jedna volitelná služba. Odmítnout jde stejně
// snadno jako přijmout. Souhlas platí 6 měsíců, změna verze (nové služby) se ptá znovu. Čisté funkce bez I/O.

export const CONSENT_COOKIE = "eldock_consent";
/** Zvýšit při přidání nové volitelné služby – uživatel dostane lištu znovu. */
export const CONSENT_VERSION = 1;
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
  necessary: { title: "Nezbytné", text: "Přihlášení, zabezpečení a uložení vaší volby. Bez nich web nefunguje, souhlas nepotřebují." },
  analytics: { title: "Analytické", text: "Anonymní statistika návštěvnosti – které stránky čtete a co zlepšit. Zapneme je jen s vaším souhlasem." },
  marketing: { title: "Marketingové", text: "Měření kampaní a připomenutí nabídky na jiných webech. Zapneme je jen s vaším souhlasem." },
};

const NECESSARY: ConsentService[] = [
  { id: "session", category: "necessary", name: "Přihlášení", provider: "Eldock", purpose: "podepsaný token relace přihlášeného uživatele (správa závodů / AI Panel Builder / velín)", cookies: "digitry-auth, eldock-pb, eldock-superadmin", retention: "12 hodin / 14 dní / 8 hodin, odhlášením hned" },
  { id: "consent", category: "necessary", name: "Volba cookies", provider: "Eldock", purpose: "uložení vaší volby souhlasu", cookies: CONSENT_COOKIE, retention: `${CONSENT_MAX_AGE_DAYS} dní` },
  { id: "storage", category: "necessary", name: "Místní úložiště", provider: "Eldock", purpose: "rozpracovaný nákres a nastavení zobrazení v prohlížeči", cookies: "localStorage (nejde o cookie)", retention: "do smazání v prohlížeči" },
];

/** Služby podle konfigurace serveru. Google Analytics 4 jen při nastaveném ID měření (ELDOCK_GA4_ID). */
export function consentServices(config: { ga4Id?: string | null }): ConsentService[] {
  const services = [...NECESSARY];
  if (config.ga4Id && isGa4Id(config.ga4Id)) {
    services.push({ id: "ga4", category: "analytics", name: "Google Analytics 4", provider: "Google Ireland Ltd.", purpose: "statistika návštěvnosti bez reklamních funkcí", cookies: "_ga, _ga_*", retention: "až 14 měsíců" });
  }
  return services;
}

export const isGa4Id = (value: string) => /^G-[A-Z0-9]{4,12}$/.test(value.trim());

/** Volitelné kategorie, pro které existuje aspoň jedna služba (jen ty se v liště nabízejí). */
export const optionalCategories = (services: readonly ConsentService[]): OptionalCategory[] =>
  (["analytics", "marketing"] as const).filter((category) => services.some((service) => service.category === category));

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
