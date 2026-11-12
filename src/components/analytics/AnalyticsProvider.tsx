"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { consentModeState } from "@/lib/consent";
import { track } from "@/lib/telemetry-client";

import { useConsentConfig, useConsentState } from "./consent-store";

/**
 * Fáze 102: Google Consent Mode v2 (výchozí „denied“ nastaví skript `CONSENT_MODE_DEFAULT` v kořenovém layoutu ještě
 * před čímkoli dalším) a služby třetích stran až po souhlasu: Google Analytics 4 a Microsoft Clarity s analytikou,
 * Google Ads, Seznam Sklik a LinkedIn Insight s marketingem – jen s ID nastaveným na serveru (`/api/consent`).
 * Vlastní telemetrie `page_view` jde při každém přechodu stránky (bez souhlasu bez identifikátoru).
 */
export function AnalyticsProvider() {
  const config = useConsentConfig();
  const state = useConsentState();
  const pathname = usePathname();
  const firstView = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    // Vstup na web = první stránka tohoto načtení, na kterou se přišlo z jiného webu nebo přímo (ne obnovení po přechodu)
    let external = true;
    try {
      external = !document.referrer || new URL(document.referrer).origin !== location.origin;
    } catch {
      external = true;
    }
    const landing = firstView.current && external;
    firstView.current = false;
    track("page_view", undefined, { landing });
  }, [pathname]);

  const analytics = Boolean(state?.analytics);
  const marketing = Boolean(state?.marketing);
  const ga4Id = analytics ? (config?.ga4Id ?? null) : null;
  const adsId = marketing ? (config?.googleAdsId ?? null) : null;
  const gtagId = ga4Id ?? adsId;
  const mode = JSON.stringify(consentModeState(state ?? null));

  return (
    <>
      {gtagId ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments);};gtag('consent','update',${mode});gtag('js',new Date());${ga4Id ? `gtag('config','${ga4Id}',{anonymize_ip:true,allow_google_signals:${marketing},allow_ad_personalization_signals:${marketing}});` : ""}${adsId ? `gtag('config','${adsId}');` : ""}`}
          </Script>
        </>
      ) : null}
      {analytics && config?.clarityId ? (
        <Script id="clarity-init" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${config.clarityId}");window.clarity("consentv2",{ad_Storage:"${marketing ? "granted" : "denied"}",analytics_Storage:"granted"});`}
        </Script>
      ) : null}
      {marketing && config?.sklikId ? (
        <Script
          id="sklik-rc"
          src="https://c.seznam.cz/js/rc.js"
          strategy="afterInteractive"
          onLoad={() => {
            const rc = (window as unknown as { rc?: { retargetingHit?: (conf: { rtgId: number; consent: number }) => void } }).rc;
            rc?.retargetingHit?.({ rtgId: Number(config.sklikId), consent: 1 });
          }}
        />
      ) : null}
      {marketing && config?.linkedinId ? (
        <>
          <Script id="linkedin-init" strategy="afterInteractive">
            {`window._linkedin_partner_id="${config.linkedinId}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(window._linkedin_partner_id);`}
          </Script>
          <Script id="linkedin-insight" src="https://snap.licdn.com/li.lms-analytics/insight.min.js" strategy="afterInteractive" />
        </>
      ) : null}
    </>
  );
}
