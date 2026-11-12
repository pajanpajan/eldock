"use client";

import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";

// Fáze 56 / 102: souhlas s cookies a měření – lišta „🍪 Nastavení soukromí a souborů cookies“ (CookieConsentBanner)
// a služby až po souhlasu s Google Consent Mode v2 (AnalyticsProvider). Odkaz „Nastavení cookies“ do patičky.
export { ConsentSettingsLink } from "@/components/analytics/CookieConsentBanner";

/** Výchozí stav Google Consent Mode v2 – v kořenovém layoutu jako první skript stránky (před jakoukoli službou). */
export const CONSENT_MODE_DEFAULT =
  "window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});";

export function ConsentManager() {
  return (
    <>
      <AnalyticsProvider />
      <CookieConsentBanner />
    </>
  );
}
