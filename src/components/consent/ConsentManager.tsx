"use client";

import Link from "next/link";
import Script from "next/script";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Cookie, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CATEGORY_INFO,
  CONSENT_CHANGE_EVENT,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_DAYS,
  CONSENT_OPEN_EVENT,
  CONSENT_VERSION,
  consentServices,
  needsConsentPrompt,
  optionalCategories,
  parseConsent,
  readCookie,
  serializeConsent,
  type ConsentState,
} from "@/lib/consent";

// Cookie souhlasu jako externí úložiště: na serveru „nenačteno“ (undefined), v prohlížeči hodnota cookie;
// změnu oznamuje událost CONSENT_CHANGE_EVENT (zápis níže v `decide`).
const subscribe = (notify: () => void) => {
  window.addEventListener(CONSENT_CHANGE_EVENT, notify);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, notify);
};
const cookieSnapshot = () => readCookie(document.cookie, CONSENT_COOKIE);
const serverSnapshot = () => undefined;

const randomId = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`).replace(/[^A-Za-z0-9_-]/g, "");

/**
 * Fáze 56: lišta a nastavení souhlasu s cookies + načtení volitelných služeb až po souhlasu.
 * „Odmítnout vše“ má stejnou váhu jako „Přijmout vše“; volbu lze kdykoli změnit odkazem „Nastavení cookies“.
 */
export function ConsentManager() {
  // Konfigurace volitelných služeb za běhu serveru; do jejího načtení se lišta nezobrazí
  const [ga4Id, setGa4Id] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/consent")
      .then((response) => (response.ok ? (response.json() as Promise<{ ga4Id: string | null }>) : null))
      .then((config) => alive && setGa4Id(config?.ga4Id ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const services = useMemo(() => consentServices({ ga4Id }), [ga4Id]);
  const categories = useMemo(() => optionalCategories(services), [services]);
  const raw = useSyncExternalStore(subscribe, cookieSnapshot, serverSnapshot);
  const loaded = raw !== undefined;
  const state = useMemo(() => (loaded ? parseConsent(raw) : null), [loaded, raw]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  // Otevření nastavení (odkaz v patičce) – rozpracovaná volba začíná od uložené
  const openSettings = useCallback(() => {
    setDraft({ analytics: state?.analytics ?? false, marketing: state?.marketing ?? false });
    setSettingsOpen(true);
  }, [state]);

  useEffect(() => {
    window.addEventListener(CONSENT_OPEN_EVENT, openSettings);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, openSettings);
  }, [openSettings]);

  const decide = useCallback(
    (choice: { analytics: boolean; marketing: boolean }, source: "banner" | "settings") => {
      const next: ConsentState = {
        version: CONSENT_VERSION,
        analytics: categories.includes("analytics") && choice.analytics,
        marketing: categories.includes("marketing") && choice.marketing,
        decidedAt: Math.floor(Date.now() / 1000),
        id: state?.id ?? randomId(),
      };
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(serializeConsent(next))}; Max-Age=${CONSENT_MAX_AGE_DAYS * 86_400}; Path=/; SameSite=Lax${secure}`;
      // Odvolaný souhlas: smazat cookies analytiky (skript už načtený se po obnovení stránky nespustí)
      if (state?.analytics && !next.analytics) {
        for (const name of document.cookie.split(";").map((part) => part.trim().split("=")[0]).filter((name) => name === "_ga" || name.startsWith("_ga_"))) {
          document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${location.hostname.replace(/^www\./, "")}`;
          document.cookie = `${name}=; Max-Age=0; Path=/`;
        }
        (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag?.("consent", "update", { analytics_storage: "denied" });
      }
      setSettingsOpen(false);
      window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: next }));
      // Záznam souhlasu pro prokázání (čl. 7 odst. 1 GDPR) – bez IP adresy; chyba sítě volbu neruší
      void fetch("/api/consent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: next.id, version: next.version, analytics: next.analytics, marketing: next.marketing, source }), keepalive: true }).catch(() => undefined);
    },
    [categories, state],
  );

  const showBanner = loaded && needsConsentPrompt(state, categories) && !settingsOpen;
  const analyticsGranted = Boolean(ga4Id && state?.analytics);

  return (
    <>
      {analyticsGranted ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config','${ga4Id}',{anonymize_ip:true,allow_google_signals:false,allow_ad_personalization_signals:false});`}
          </Script>
        </>
      ) : null}

      {showBanner ? (
        <section role="region" aria-label="Souhlas s cookies" data-testid="consent-banner" className="fixed inset-x-0 bottom-0 z-[60] border-t border-primary/40 bg-background/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-md sm:rounded-2xl sm:border">
          <div className="flex items-start gap-3">
            <Cookie className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="flex flex-col gap-3 text-sm">
              <p className="font-semibold">Cookies na webu Eldock</p>
              <p className="text-muted-foreground">
                Nezbytné cookies používáme pro přihlášení. {categories.includes("analytics") ? "S vaším souhlasem zapneme i anonymní statistiku návštěvnosti, abychom věděli, co na webu zlepšit." : null}{" "}
                Volbu můžete kdykoli změnit v patičce („Nastavení cookies“).{" "}
                <Link href="/ochrana-osobnich-udaju#cookies" className="text-primary underline-offset-2 hover:underline">
                  Podrobnosti
                </Link>
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className="touch-target" onClick={() => decide({ analytics: true, marketing: true }, "banner")}>
                  Přijmout vše
                </Button>
                <Button type="button" className="touch-target" onClick={() => decide({ analytics: false, marketing: false }, "banner")}>
                  Odmítnout vše
                </Button>
                <Button type="button" variant="ghost" className="col-span-2 h-9 text-sm" onClick={openSettings}>
                  Nastavit podle kategorií
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg" data-testid="consent-settings">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden /> Nastavení cookies
            </DialogTitle>
            <DialogDescription>Vyberte, co smíme ve vašem prohlížeči používat. Souhlas platí {Math.round(CONSENT_MAX_AGE_DAYS / 30)} měsíců a můžete ho kdykoli odvolat.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {(["necessary", ...categories] as const).map((category) => {
              const optional = category !== "necessary";
              const checked = optional ? draft[category] : true;
              return (
                <fieldset key={category} className="rounded-xl border border-border p-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-medium">{CATEGORY_INFO[category].title}</span>
                    <input
                      type="checkbox"
                      className="size-5 accent-primary"
                      checked={checked}
                      disabled={!optional}
                      aria-label={`${CATEGORY_INFO[category].title} cookies`}
                      onChange={(event) => optional && setDraft((current) => ({ ...current, [category]: event.target.checked }))}
                    />
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">{CATEGORY_INFO[category].text}</p>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    {services
                      .filter((service) => service.category === category)
                      .map((service) => (
                        <li key={service.id}>
                          <span className="text-foreground">{service.name}</span> ({service.provider}) – {service.purpose}; {service.cookies}; {service.retention}
                        </li>
                      ))}
                  </ul>
                </fieldset>
              );
            })}
            {!categories.length ? <p className="text-sm text-muted-foreground">Volitelné cookies (analytické ani marketingové) web teď nepoužívá – souhlas proto nepotřebujeme.</p> : null}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {categories.length ? (
              <>
                <Button type="button" onClick={() => decide({ analytics: false, marketing: false }, "settings")}>
                  Odmítnout vše
                </Button>
                <Button type="button" variant="outline" onClick={() => decide(draft, "settings")}>
                  Uložit volbu
                </Button>
                <Button type="button" onClick={() => decide({ analytics: true, marketing: true }, "settings")}>
                  Přijmout vše
                </Button>
              </>
            ) : (
              <Button type="button" onClick={() => setSettingsOpen(false)}>
                Zavřít
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Odkaz „Nastavení cookies“ do patičky – otevře nastavení souhlasu. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))} data-testid="consent-settings-link">
      Nastavení cookies
    </button>
  );
}
