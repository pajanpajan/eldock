"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  CONSENT_CHANGE_EVENT,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  consentModeState,
  consentServices,
  consentStorageValue,
  optionalCategories,
  parseConsent,
  readCookie,
  serializeConsent,
  type ConsentConfig,
  type ConsentState,
  type OptionalCategory,
} from "@/lib/consent";
import { forgetVisitor } from "@/lib/telemetry-client";

// Fáze 102: sdílený stav souhlasu pro lištu (CookieConsentBanner) a měření (AnalyticsProvider) – cookie volby jako
// externí úložiště (na serveru „nenačteno“), konfigurace služeb z `/api/consent` jednou za načtení stránky.

const subscribe = (notify: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, notify);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, notify);
};
const cookieSnapshot = () => readCookie(document.cookie, CONSENT_COOKIE);
const serverSnapshot = () => undefined;

/** Uložená volba (undefined = ještě nenačteno v prohlížeči, null = bez platné volby). */
export function useConsentState(): ConsentState | null | undefined {
  const raw = useSyncExternalStore(subscribe, cookieSnapshot, serverSnapshot);
  return useMemo(() => (raw === undefined ? undefined : parseConsent(raw)), [raw]);
}

let configPromise: Promise<ConsentConfig> | null = null;
const loadConfig = () =>
  (configPromise ??= fetch("/api/consent")
    .then((response) => (response.ok ? (response.json() as Promise<ConsentConfig>) : {}))
    .catch(() => ({})));

/** Konfigurace volitelných služeb za běhu serveru (null = ještě se načítá). */
export function useConsentConfig(): ConsentConfig | null {
  const [config, setConfig] = useState<ConsentConfig | null>(null);
  useEffect(() => {
    let alive = true;
    void loadConfig().then((value) => alive && setConfig(value));
    return () => {
      alive = false;
    };
  }, []);
  return config;
}

export const servicesOf = (config: ConsentConfig | null) => consentServices(config ?? {});
export const categoriesOf = (config: ConsentConfig | null): OptionalCategory[] => optionalCategories(servicesOf(config));

const randomId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");

type Gtag = (...args: unknown[]) => void;

/** Smazání cookies služby po odvolání souhlasu (i na nadřazené doméně). */
function dropCookies(match: (name: string) => boolean) {
  const domain = location.hostname.replace(/^www\./, "");
  for (const name of document.cookie.split(";").map((part) => part.trim().split("=")[0]).filter(match)) {
    document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${domain}`;
    document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

/**
 * Uložení volby: cookie (zdroj pravdy, 6 měsíců), kopie s časovým razítkem v localStorage `eldock_cookie_consent_v1`,
 * Google Consent Mode v2 `update`, záznam pro prokázání souhlasu (čl. 7 odst. 1 GDPR, bez IP adresy) a při odvolání
 * smazání cookies a pseudonymního id.
 */
export function saveConsent(choice: { analytics: boolean; marketing: boolean }, source: "banner" | "settings", previous: ConsentState | null, categories: readonly OptionalCategory[]): ConsentState {
  const next: ConsentState = {
    version: CONSENT_VERSION,
    analytics: categories.includes("analytics") && choice.analytics,
    marketing: categories.includes("marketing") && choice.marketing,
    decidedAt: Math.floor(Date.now() / 1000),
    id: previous?.id ?? randomId(),
  };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(next))}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, consentStorageValue(next));
  } catch {
    // soukromý režim – zdrojem pravdy je cookie
  }
  (window as unknown as { gtag?: Gtag }).gtag?.("consent", "update", consentModeState(next));
  if (!next.analytics) {
    dropCookies((name) => name === "_ga" || name.startsWith("_ga_") || name === "_clck" || name === "_clsk");
    forgetVisitor();
  }
  if (!next.marketing) dropCookies((name) => name === "_gcl_au" || name === "li_sugr");
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: next }));
  void fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: next.id, version: next.version, analytics: next.analytics, marketing: next.marketing, source }), keepalive: true }).catch(() => undefined);
  return next;
}
