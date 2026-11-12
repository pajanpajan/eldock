// Technické SEO a veřejná viditelnost (fáze 48): veřejné stránky, zakázané interní trasy, klíčová
// slova a strukturovaná data JSON-LD pro úvodní stránku. Jediný zdroj pro robots.ts, sitemap.ts a metadata.

import { BRAND } from "./brand";
import { COMPANY_INFO } from "./company";

export const SITE_URL = `https://${BRAND.domain}`;

export const SEO_TITLE = "ELDOCK – návrh rozváděčů, revize a elektrodokumentace od domu po závod";
export const SEO_DESCRIPTION =
  "Návrh rozváděčů a domovní elektroinstalace s výrobní dokumentací dle ČSN EN IEC 61439 z fotky nebo od nuly: výpočet oteplení IEC TR 60890, štítek rozváděče CE a prohlášení o shodě. Lhůtník a podklady revizí pro revizní techniky, živá elektrodokumentace pro údržbu a technické vedení závodů.";

export const SEO_KEYWORDS = [
  "návrh rozváděčů",
  "výrobní dokumentace rozváděče ČSN EN IEC 61439",
  "výpočet oteplení rozváděče IEC 60890",
  "štítek rozváděče CE",
  "prohlášení o shodě rozváděče",
  "pasportizace rozváděče z fotky",
  "správa elektrorevizí ČSN 33 1500",
  "revize VTZ",
  "elektrodokumentace výrobního závodu",
  "AI Panel Builder",
  "návrh domovní elektroinstalace",
  "chytrá domácnost rozváděč",
  "software pro revizní techniky",
  "dokumentace údržby elektro",
];

/** Veřejné vstupní stránky do sitemap.xml (cesta, priorita, četnost změn). */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  // Fáze 96: veřejná vstupní stránka a katalog AI Panel Builderu, 5 SEO vstupních stránek, ukázka a návody
  { path: "/panel-builder", priority: 0.95, changeFrequency: "weekly" },
  { path: "/ai-panel-builder", priority: 0.95, changeFrequency: "monthly" },
  { path: "/2d-pudorys-elektroinstalace", priority: 0.95, changeFrequency: "monthly" },
  { path: "/vypocet-otepleni-rozvadece", priority: 0.95, changeFrequency: "monthly" },
  { path: "/kusova-zkouska-rozvadece", priority: 0.95, changeFrequency: "monthly" },
  { path: "/prumyslova-udrzba-a-revize", priority: 0.95, changeFrequency: "monthly" },
  { path: "/ukazka-elaboratu", priority: 0.95, changeFrequency: "monthly" },
  { path: "/panel-builder/catalog", priority: 0.95, changeFrequency: "weekly" },
  // Fáze 87: video-návody s českým komentářem (odkaz pro testery a kolegy elektrikáře)
  { path: "/navody", priority: 0.95, changeFrequency: "monthly" },
  // Fáze 58: dvě části webu – domovní elektroinstalace a průmysl
  { path: "/domovni-elektroinstalace", priority: 0.9, changeFrequency: "monthly" },
  { path: "/prumysl", priority: 0.9, changeFrequency: "monthly" },
  // Fáze 107: kontakt, schůzka / ukázka, spolupráce a B2B poptávka
  { path: "/kontakt", priority: 0.8, changeFrequency: "monthly" },
  { path: "/panel-builder/auth", priority: 0.8, changeFrequency: "monthly" },
  { path: "/register-plant", priority: 0.6, changeFrequency: "monthly" },
  // Fáze 54: právní stránky
  { path: "/obchodni-podminky", priority: 0.3, changeFrequency: "yearly" },
  { path: "/ochrana-osobnich-udaju", priority: 0.3, changeFrequency: "yearly" },
] as const;

/**
 * Fáze 96: robotům zakázané jen interní API a velín – aplikační stránky za přihlášením vrátí přesměrování na
 * přihlášení samy, veřejný katalog a vstupní stránka AI Panel Builderu se indexují.
 */
export const PRIVATE_PATHS = ["/api/", "/superadmin"];

/** Fáze 96: roboti vyhledávačů (vč. AI vyhledávačů) s výslovným povolením indexace v robots.txt. */
export const SEARCH_BOTS = ["*", "Googlebot", "SeznamBot", "bingbot", "OAI-SearchBot", "GPTBot", "PerplexityBot", "ClaudeBot"] as const;

export const absoluteUrl = (pathname: string) => (pathname === "/" ? SITE_URL : `${SITE_URL}${pathname}`);

/**
 * JSON-LD celého webu (fáze 96 – v hlavním layoutu): provozovatel (Organization), web (WebSite) a aplikace
 * (SoftwareApplication: BusinessApplication / CADSoftware, Web, cs-CZ, vyzkoušení zdarma).
 */
export function siteJsonLd() {
  const organization = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: BRAND.mark,
    legalName: COMPANY_INFO.name,
    url: SITE_URL,
    logo: `${SITE_URL}/icon/512`,
    email: COMPANY_INFO.email,
    address: { "@type": "PostalAddress", addressLocality: "Jablonec nad Nisou", addressCountry: "CZ" },
  };
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND.mark,
    url: SITE_URL,
    inLanguage: "cs-CZ",
    description: SEO_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  const application = {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: BRAND.mark,
    alternateName: "ELDOCK AI Panel Builder",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "CADSoftware",
    operatingSystem: "Web",
    inLanguage: "cs-CZ",
    url: `${SITE_URL}/panel-builder`,
    description: SEO_DESCRIPTION,
    keywords: SEO_KEYWORDS.join(", "),
    featureList: [
      "Pasportizace rozváděče z fotky (AI Vision)",
      "Návrh rozváděče od nuly a ze soupisu místností dle ČSN 33 2130 ed. 4",
      "Výpočet oteplení rozváděče dle IEC TR 60890 a ČSN EN IEC 61439",
      "Výrobní dokumentace: 6 listů A4, 1P schéma, kusovník, štítek rozváděče CE a EU prohlášení o shodě",
      "Správa elektrorevizí a lhůtník dle ČSN 33 1500",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK", description: "Vyzkoušení zdarma – testovací kredity po registraci firmy" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  return { "@context": "https://schema.org", "@graph": [organization, website, application] };
}

/** Fáze 96: časté dotazy vstupní stránky jako FAQPage (schema.org). */
export function faqJsonLd(faq: readonly { question: string; answer: string }[], url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    inLanguage: "cs-CZ",
    mainEntity: faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
  };
}

/** Bezpečné vložení JSON-LD do <script> (žádné ukončení tagu z dat). */
export const jsonLdScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Náhled odkazu (`app/opengraph-image.tsx`) – stránky s vlastním `openGraph` ho musí uvést znovu, jinak se přepíše. */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SEO_TITLE };
