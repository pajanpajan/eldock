/** Tajemství podpisu přihlášení pro E2E server – `global-setup.ts` jím podepíše cookie `digitry-auth` do `storageState`. */
export const E2E_AUTH_SECRET = "e2e-eldock-secret";
export const E2E_AUTH_STATE = "e2e/.auth/state.json";

import { CONSENT_VERSION, serializeConsent } from "../src/lib/consent";

/**
 * Fáze 102: platná volba souhlasu s cookies (jen nezbytné) – lišta se v testech, které ji neověřují, neukáže a nezakryje
 * spodní část stránky. `PUBLIC_STATE` = nepřihlášený návštěvník s uloženou volbou (místo prázdného stavu).
 */
export const e2eConsentCookie = (domain = "localhost") => ({ name: "eldock_consent", value: serializeConsent({ version: CONSENT_VERSION, analytics: false, marketing: false, decidedAt: Math.floor(Date.now() / 1000), id: "e2econsent01" }), domain, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const });
/** Fáze 102: kontakt v okně dokumentace už zadaný – export za ukázkovou firmu Tester jde rovnou. */
export const e2eLeadCookie = (domain = "localhost") => ({ name: "eldock_lead", value: "1", domain, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const });
export const PUBLIC_STATE = { cookies: [e2eConsentCookie()], origins: [] };
