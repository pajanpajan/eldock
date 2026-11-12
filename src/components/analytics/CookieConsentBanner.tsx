"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_INFO, CONSENT_MAX_AGE_DAYS, CONSENT_OPEN_EVENT, needsConsentPrompt, type OptionalCategory } from "@/lib/consent";
import { cn } from "@/lib/utils";

import { categoriesOf, saveConsent, servicesOf, useConsentConfig, useConsentState } from "./consent-store";

const CATEGORY_LABEL: Record<"necessary" | OptionalCategory, string> = {
  necessary: "1. Nezbytné technické a funkční cookies",
  analytics: "2. Analytické a výkonnostní cookies",
  marketing: "3. Marketingové a remarketingové cookies",
};
const CATEGORY_HINT: Record<"necessary" | OptionalCategory, string> = { necessary: "Vždy aktivní", analytics: "ELDOCK, GA4, Clarity", marketing: "Seznam Sklik, Google Ads, LinkedIn" };

/**
 * Fáze 102: lišta „🍪 Nastavení soukromí a souborů cookies“ (po vzoru Alza.cz, § 89 odst. 3 ZEK, Google Consent Mode v2)
 * – „Rozumím a přijímám“ a „Odmítnout vše“ stejně velké na první vrstvě (požadavek ÚOOÚ), „Podrobné nastavení“ s přepínači
 * kategorií a „Uložit vybrané“. Volbu jde kdykoli změnit odkazem „Nastavení cookies“ v patičce (`CONSENT_OPEN_EVENT`).
 */
export function CookieConsentBanner() {
  const config = useConsentConfig();
  const state = useConsentState();
  const services = servicesOf(config);
  const categories = categoriesOf(config);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });

  // Otevření nastavení (tlačítko lišty i odkaz v patičce) – rozpracovaná volba začíná od uložené
  const openSettings = () => {
    setDraft({ analytics: state?.analytics ?? false, marketing: state?.marketing ?? false });
    setSettingsOpen(true);
  };

  useEffect(() => {
    const open = () => {
      setDraft({ analytics: state?.analytics ?? false, marketing: state?.marketing ?? false });
      setSettingsOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, [state]);

  const decide = (choice: { analytics: boolean; marketing: boolean }, source: "banner" | "settings") => {
    saveConsent(choice, source, state ?? null, categories);
    setSettingsOpen(false);
  };

  // Do načtení konfigurace a cookie v prohlížeči se lišta nekreslí (server vykreslí stránku bez ní)
  const showBanner = config !== null && state !== undefined && needsConsentPrompt(state, categories) && !settingsOpen;

  return (
    <>
      {showBanner ? (
        <section role="region" aria-label="Nastavení soukromí a souborů cookies" data-testid="consent-banner" className="fixed inset-x-0 bottom-0 z-[60] border-t border-primary/40 bg-background/95 shadow-2xl shadow-black/60 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 md:flex-row md:items-start md:gap-6">
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
              <p className="text-base font-semibold">🍪 Nastavení soukromí a souborů cookies</p>
              <p className="text-muted-foreground">
                My, platforma ELDOCK.cz, používáme soubory cookies a další údaje k zajištění spolehlivého chodu inženýrských nástrojů (ukládání rozpracovaných půdorysů a rozváděčů) a s vaším souhlasem také k analýze návštěvnosti a personalizaci obsahu a reklamy. Kliknutím na „Rozumím a přijímám“ souhlasíte s využíváním všech cookies.
              </p>
              <button type="button" onClick={() => setMoreOpen((value) => !value)} aria-expanded={moreOpen} className="w-fit text-left text-sm font-medium text-primary underline-offset-2 hover:underline" data-testid="consent-more">
                {moreOpen ? "⌃ Méně informací" : "⌄ Více informací a přehled kategorií"}
              </button>
              {moreOpen ? (
                <ul className="flex flex-col gap-1.5 rounded-lg border border-border bg-card/60 p-3 text-xs" data-testid="consent-categories">
                  {(["necessary", ...categories] as const).map((category) => (
                    <li key={category}>
                      <span className="font-semibold text-foreground">{CATEGORY_LABEL[category]}</span> <span className="text-muted-foreground">({CATEGORY_HINT[category]})</span> – <span className="text-muted-foreground">{CATEGORY_INFO[category].text}</span>
                    </li>
                  ))}
                  <li className="text-muted-foreground">
                    Souhlas platí {Math.round(CONSENT_MAX_AGE_DAYS / 30)} měsíců a můžete ho kdykoli změnit odkazem „Nastavení cookies“ v patičce.{" "}
                    <Link href="/ochrana-osobnich-udaju#cookies" className="text-primary underline-offset-2 hover:underline">
                      Zásady ochrany osobních údajů
                    </Link>
                  </li>
                </ul>
              ) : null}
            </div>
            {/* Odmítnutí stejně dostupné jako souhlas – stejná velikost, první vrstva lišty */}
            <div className="grid shrink-0 gap-2 sm:grid-cols-3 md:w-[29rem]">
              <Button type="button" className="touch-target h-auto min-h-10 py-2 font-semibold whitespace-normal" onClick={() => decide({ analytics: true, marketing: true }, "banner")} data-testid="consent-accept">
                Rozumím a přijímám
              </Button>
              <Button type="button" variant="outline" className="touch-target h-auto min-h-10 py-2 whitespace-normal" onClick={openSettings} data-testid="consent-customize">
                Podrobné nastavení
              </Button>
              <Button type="button" variant="secondary" className="touch-target h-auto min-h-10 py-2 font-semibold whitespace-normal" onClick={() => decide({ analytics: false, marketing: false }, "banner")} data-testid="consent-reject">
                Odmítnout vše
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl" data-testid="consent-settings">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden /> Podrobné nastavení cookies
            </DialogTitle>
            <DialogDescription>Vyberte, co smíme ve vašem prohlížeči používat. Souhlas platí {Math.round(CONSENT_MAX_AGE_DAYS / 30)} měsíců a můžete ho kdykoli odvolat.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {(["necessary", ...categories] as const).map((category) => {
              const optional = category !== "necessary";
              const checked = optional ? draft[category] : true;
              const list = services.filter((service) => service.category === category);
              return (
                <fieldset key={category} className={cn("rounded-xl border p-3", checked ? "border-primary/40" : "border-border")} data-category={category}>
                  <label className="flex items-center justify-between gap-3">
                    <span className="font-medium">{CATEGORY_LABEL[category]}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {optional ? (checked ? "zapnuto" : "vypnuto") : "Vždy aktivní"}
                      <input
                        type="checkbox"
                        className="size-5 accent-primary"
                        checked={checked}
                        disabled={!optional}
                        aria-label={CATEGORY_INFO[category].title}
                        onChange={(event) => optional && setDraft((current) => ({ ...current, [category]: event.target.checked }))}
                        data-testid={`consent-toggle-${category}`}
                      />
                    </span>
                  </label>
                  <p className="mt-1 text-sm text-muted-foreground">{CATEGORY_INFO[category].text}</p>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                    {list.map((service) => (
                      <li key={service.id}>
                        <span className="text-foreground">{service.name}</span> ({service.provider}) – {service.purpose}; {service.cookies}; {service.retention}
                      </li>
                    ))}
                    {!list.length ? <li>Web teď žádnou službu této kategorie nepoužívá – nová služba se vás zeptá znovu.</li> : null}
                  </ul>
                </fieldset>
              );
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="secondary" onClick={() => decide({ analytics: false, marketing: false }, "settings")}>
              Odmítnout vše
            </Button>
            <Button type="button" variant="outline" onClick={() => decide(draft, "settings")} data-testid="consent-save">
              Uložit vybrané
            </Button>
            <Button type="button" onClick={() => decide({ analytics: true, marketing: true }, "settings")}>
              Přijmout vše
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Odkaz „Nastavení cookies“ do patičky – otevře podrobné nastavení souhlasu. */
export function ConsentSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))} data-testid="consent-settings-link">
      Nastavení cookies
    </button>
  );
}
