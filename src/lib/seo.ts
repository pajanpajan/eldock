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
  // Fáze 58: dvě části webu – domovní elektroinstalace a průmysl
  { path: "/domovni-elektroinstalace", priority: 0.9, changeFrequency: "monthly" },
  { path: "/prumysl", priority: 0.9, changeFrequency: "monthly" },
  { path: "/ukazka-elaboratu", priority: 0.8, changeFrequency: "monthly" },
  { path: "/panel-builder/auth", priority: 0.8, changeFrequency: "monthly" },
  { path: "/register-plant", priority: 0.6, changeFrequency: "monthly" },
  // Fáze 54: právní stránky
  { path: "/obchodni-podminky", priority: 0.3, changeFrequency: "yearly" },
  { path: "/ochrana-osobnich-udaju", priority: 0.3, changeFrequency: "yearly" },
] as const;

/** Interní aplikační trasy – vyhledávače je neindexují (za přihlášením stejně nejsou vidět). */
export const PRIVATE_PATHS = ["/plant/", "/equipment/", "/cae/", "/inspections/", "/admin/", "/api/", "/studio", "/app$", "/app/", "/panel-builder/", "/login", "/superadmin"];

export const absoluteUrl = (pathname: string) => (pathname === "/" ? SITE_URL : `${SITE_URL}${pathname}`);

/** JSON-LD pro úvodní stránku: aplikace (SoftwareApplication) a provozovatel (Organization). */
export function landingJsonLd() {
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
  const application = {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: "ELDOCK AI Panel Builder",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Návrh a dokumentace rozváděčů nízkého napětí",
    operatingSystem: "Web, PWA (Windows, macOS, Android, iOS)",
    inLanguage: "cs",
    url: `${SITE_URL}/panel-builder/auth`,
    description: SEO_DESCRIPTION,
    keywords: SEO_KEYWORDS.join(", "),
    featureList: [
      "Pasportizace rozváděče z fotky (AI Vision)",
      "Návrh rozváděče od nuly a ze soupisu místností dle ČSN 33 2130 ed. 4",
      "Výpočet oteplení rozváděče dle IEC TR 60890 a ČSN EN IEC 61439",
      "Výrobní dokumentace: 6 listů A4, 1P schéma, kusovník, štítek rozváděče CE a EU prohlášení o shodě",
      "Správa elektrorevizí a lhůtník dle ČSN 33 1500",
    ],
    offers: { "@type": "Offer", price: "0", priceCurrency: "CZK", description: "Testovací kredity po registraci firmy" },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  return { "@context": "https://schema.org", "@graph": [organization, application] };
}

/** Bezpečné vložení JSON-LD do <script> (žádné ukončení tagu z dat). */
export const jsonLdScript = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

/** Náhled odkazu (`app/opengraph-image.tsx`) – stránky s vlastním `openGraph` ho musí uvést znovu, jinak se přepíše. */
export const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: SEO_TITLE };
