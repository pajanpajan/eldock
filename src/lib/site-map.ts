// Fáze 58: mapa webu na jednom místě – hlavní navigace, dvě části webu (domovní elektroinstalace / průmysl),
// sloupce patičky, sitemap.xml a drobečková navigace (JSON-LD). Čistá data a funkce.

import { SITE_URL } from "./seo";

export interface SiteLink {
  href: string;
  label: string;
}

export type SegmentId = "domov" | "prumysl";

export interface Segment {
  id: SegmentId;
  path: string;
  /** Název části webu (navigace, rozcestník). */
  title: string;
  /** Pro koho část je. */
  who: string;
  /** Jedna věta do rozcestníku. */
  promise: string;
  points: string[];
  cta: string;
  /** SEO titulek a popis stránky části. */
  seoTitle: string;
  seoDescription: string;
}

export const SEGMENTS: Record<SegmentId, Segment> = {
  domov: {
    id: "domov",
    path: "/domovni-elektroinstalace",
    title: "Domovní elektroinstalace",
    who: "Pro elektrikáře, montážní firmy a projektanty rodinných domů, bytů a menších objektů",
    promise: "Rozváděč a domovní instalace i s kompletní dokumentací – z fotky osazeného rozváděče nebo z 2D půdorysu.",
    points: ["AI Panel Builder: rozváděč z fotky, od nuly nebo ze soupisu místností", "2D půdorys: zásuvky, světla, ovládání a výkaz kabeláže", "6 listů dokumentace, výpočet oteplení, prohlášení o shodě a štítek CE"],
    cta: "Pokračovat – domovní elektroinstalace",
    seoTitle: "Domovní elektroinstalace – návrh rozváděče, 2D půdorys a dokumentace | ELDOCK",
    seoDescription: "Návrh domovního rozváděče z fotky nebo od nuly, 2D půdorys se značkami dle ČSN EN 60617-11 a výkazem kabeláže, výpočet oteplení dle IEC TR 60890 a 6listová dokumentace s prohlášením o shodě.",
  },
  prumysl: {
    id: "prumysl",
    path: "/prumysl",
    title: "Průmysl",
    who: "Pro technické ředitele, vedoucí údržby, údržbáře a revizní techniky výrobních závodů",
    promise: "Živá elektrodokumentace celého závodu, revize a lhůty, změny z haly a auditní stopa na jednom místě.",
    points: ["Mapa závodu, budovy a půdorysy se zařízeními a QR štítky", "Lhůtník revizí VTZ, spotřebičů a nářadí, záznam měření a závad", "Červenky z haly do CAE a schválení změn vedoucím údržby"],
    cta: "Pokračovat – průmysl",
    seoTitle: "Průmysl – elektrodokumentace, revize a údržba výrobního závodu | ELDOCK",
    seoDescription: "Elektrodokumentace výrobního závodu s historií verzí, QR štítky na rozváděčích, lhůtník revizí VTZ a spotřebičů, změnové řízení z haly do CAE a auditní stopa.",
  },
};

export const SEGMENT_IDS: readonly SegmentId[] = ["domov", "prumysl"];

/** Hlavní navigace veřejného webu (ukázka dokumentace jen když existuje vzorový elaborát). */
export function siteNav(options: { showcase: boolean }): SiteLink[] {
  return [
    { href: SEGMENTS.domov.path, label: SEGMENTS.domov.title },
    { href: SEGMENTS.prumysl.path, label: SEGMENTS.prumysl.title },
    ...(options.showcase ? [{ href: "/ukazka-elaboratu", label: "Ukázka dokumentace" }] : []),
    { href: "/#novinky", label: "Novinky" },
    // Fáze 107: samostatná stránka kontaktu, schůzek a spolupráce (formulář se 7 kategoriemi)
    { href: "/kontakt", label: "Kontakt & Spolupráce" },
  ];
}

/** Sloupce mapy webu v patičce. */
export function footerSections(options: { showcase: boolean }): { title: string; links: SiteLink[] }[] {
  return [
    {
      title: SEGMENTS.domov.title,
      links: [
        { href: SEGMENTS.domov.path, label: "Přehled pro elektrikáře" },
        { href: `${SEGMENTS.domov.path}#panel-builder`, label: "AI Panel Builder" },
        { href: `${SEGMENTS.domov.path}#pudorys`, label: "2D půdorys a kabeláž" },
        // Fáze 87
        { href: "/navody", label: "Video-návody" },
        ...(options.showcase ? [{ href: "/ukazka-elaboratu", label: "Ukázka dokumentace rozváděče" }] : []),
        { href: "/panel-builder/auth", label: "Registrace / přihlášení firmy" },
      ],
    },
    {
      title: SEGMENTS.prumysl.title,
      links: [
        { href: SEGMENTS.prumysl.path, label: "Přehled pro závody" },
        { href: `${SEGMENTS.prumysl.path}#technicky-reditel`, label: "Technický ředitel" },
        { href: `${SEGMENTS.prumysl.path}#udrzba`, label: "Údržba" },
        { href: `${SEGMENTS.prumysl.path}#revizni-technik`, label: "Revizní technik" },
        { href: "/register-plant", label: "Registrace výrobního závodu" },
      ],
    },
    // Fáze 96: nástroje a návody – přímé odkazy na SEO vstupní stránky, veřejný katalog a video-návody
    {
      title: "Nástroje a návody",
      links: [
        { href: "/ai-panel-builder", label: "Návrh rozváděče online" },
        { href: "/2d-pudorys-elektroinstalace", label: "Elektroinstalace v půdorysu" },
        { href: "/vypocet-otepleni-rozvadece", label: "Výpočet oteplení rozváděče" },
        { href: "/kusova-zkouska-rozvadece", label: "Kusová zkouška a prohlášení o shodě" },
        { href: "/prumyslova-udrzba-a-revize", label: "Průmyslová údržba a revize" },
        { href: "/panel-builder/catalog", label: "Katalog přístrojů" },
        { href: "/navody", label: "Video-návody" },
      ],
    },
    {
      title: "Eldock",
      links: [
        { href: "/#proc-eldock", label: "Proč Eldock vznikl" },
        { href: "/#novinky", label: "Novinky (newsletter)" },
        { href: "/kontakt", label: "Kontakt & Spolupráce" },
        { href: "/obchodni-podminky", label: "Obchodní podmínky" },
        { href: "/ochrana-osobnich-udaju", label: "Ochrana osobních údajů" },
      ],
    },
  ];
}

/** Drobečková navigace pro vyhledávače (schema.org BreadcrumbList). */
export function breadcrumbJsonLd(items: readonly SiteLink[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.label, item: item.href === "/" ? SITE_URL : `${SITE_URL}${item.href}` })),
  };
}
