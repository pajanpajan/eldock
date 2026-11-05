// Fáze 56: úvodní stránka pro čtyři cílové skupiny – elektrikář, revizní technik, technický ředitel, údržbář.
// Obsah jen z toho, co platforma skutečně umí (Panel Builder, půdorys, revize, lhůtník, červenky, hlídač životnosti).

export type AudienceId = "elektrikar" | "revizni-technik" | "technicky-reditel" | "udrzba";

export interface AudienceCta {
  label: string;
  href: string;
  primary?: boolean;
}

export interface Audience {
  id: AudienceId;
  /** Kotva sekce na úvodní stránce. */
  anchor: string;
  role: string;
  /** Nadpisek sekce („Pro elektrikáře“). */
  eyebrow: string;
  /** Krátký slib pro rozcestník „Jsem…“. */
  promise: string;
  title: string;
  pain: string;
  features: string[];
  deliverables: string[];
  ctas: AudienceCta[];
}

export const AUDIENCES: Audience[] = [
  {
    id: "elektrikar",
    anchor: "elektrikar",
    role: "Elektrikář",
    eyebrow: "Pro elektrikáře",
    promise: "Rozváděč a domovní instalace i s dokumentací za pár minut.",
    title: "Návrh rozváděče a domovní elektroinstalace i s dokumentací – za minuty, ne za večer",
    pain: "Schéma, kusovník, výpočet oteplení a prohlášení o shodě se dnes po montáži dopisují ručně večer. Eldock je připraví z fotky osazeného rozváděče nebo z návrhu od nuly.",
    features: [
      "AI rozpozná přístroje z fotky rozváděče, navrhne zapojení a jednopólové schéma",
      "2D půdorys domu: zásuvky, vypínače, světla i chytrá domácnost se propíšou do rozváděče",
      "Výpočet oteplení dle IEC TR 60890, sběrnice PE / N a soustava přívodu 1f / 3f",
      "Kusovník s objednacími čísly pro velkoobchod",
    ],
    deliverables: ["6 listů výrobní dokumentace s vaší firmou v razítku", "Prohlášení o shodě a výrobní štítek", "Platba kreditem za rozváděč, bez paušálu"],
    ctas: [
      { label: "Založit první rozváděč", href: "/panel-builder/auth", primary: true },
      { label: "Prohlédnout ukázkový elaborát", href: "/ukazka-elaboratu" },
    ],
  },
  {
    id: "revizni-technik",
    anchor: "revizni-technik",
    role: "Revizní technik",
    eyebrow: "Pro revizní techniky",
    promise: "Měření a závady z místa rovnou do podkladů pro zprávu.",
    title: "Revize bez přepisování: lhůty, měření a závady z místa rovnou do podkladů",
    pain: "Termíny v Excelu, poznámky na papíře a přepisování do revizní zprávy. V Eldocku máte seznam zařízení s lhůtami a záznam z místa přímo v mobilu.",
    features: [
      "Lhůtník revizí VTZ, spotřebičů a nářadí s upozorněním na blížící se a propadlé termíny",
      "Záznam měření, závad, fotek a hlasových poznámek přímo u zařízení",
      "Zkoušky proudových chráničů a rychlá revize spotřebičů podle ČSN 33 1600 ed. 2",
      "Normy platné k datu zřízení instalace – posouzení stávajících zařízení podle tehdejších předpisů",
    ],
    deliverables: ["Podklady pro revizní zprávu", "Historie revizí a závad u každého zařízení", "Auditní stopa: kdo, kdy, co"],
    ctas: [
      { label: "Vyzkoušet demo", href: "/login", primary: true },
      { label: "Domluvit ukázku", href: "#kontakt" },
    ],
  },
  {
    id: "technicky-reditel",
    anchor: "prumysl",
    role: "Technický ředitel",
    eyebrow: "Pro technické ředitele",
    promise: "Platná dokumentace a auditní stopa napříč závody.",
    title: "Platná dokumentace, revize a rizika napříč závody – vždy připraveno na audit",
    pain: "Kdo změnil rozváděč, která verze schématu platí a kdy propadne revize? Odpověď dnes zná jen pár lidí. Eldock ji ukáže všem, kdo ji potřebují.",
    features: [
      "Přehled otevřených změn, propadlých revizí a závad za celý závod",
      "Hlídač životnosti součástek a zatížení kabelových tras při rozšiřování výroby",
      "Uzavřené změnové řízení: hala → projektant → schválení vedoucím údržby",
      "Nasazení na klíč: digitalizace archivu, překreslení schémat a QR štítky",
    ],
    deliverables: ["Auditní report jedním kliknutím", "Elektrodokumentace s historií verzí", "Méně prostojů při hledání schémat"],
    ctas: [
      { label: "Domluvit ukázku v závodě", href: "#kontakt", primary: true },
      { label: "Registrovat výrobní závod", href: "/register-plant" },
    ],
  },
  {
    id: "udrzba",
    anchor: "udrzba",
    role: "Údržbář",
    eyebrow: "Pro údržbu",
    promise: "Schéma u stroje za 3 vteřiny, změna nahlášená fotkou.",
    title: "Schéma u stroje za 3 vteřiny, změna nahlášená fotkou",
    pain: "Stroj stojí a hledá se platný výkres. Ruční „červenky“ zůstanou v rozváděči a do projekce se nedostanou.",
    features: [
      "QR štítek na rozváděči: platné schéma, kusovník a historie revizí v mobilu",
      "Změnu nahlásíte fotkou, zákresem prstem do schématu a hlasovou poznámkou",
      "Projektant změnu zakreslí, vedoucí údržby schválí – dokumentace zůstane platná",
      "Mapa areálu a půdorysy se zařízeními a stavem dokumentace",
    ],
    deliverables: ["Žádné hledání v šanonech", "Změny, které se neztratí", "Méně psaní, víc práce u stroje"],
    ctas: [
      { label: "Přihlásit se / demo závodu", href: "/login", primary: true },
      { label: "Jak to funguje", href: "#jak-to-funguje" },
    ],
  },
];

/** Normy a záruky, o které se platforma opírá (z normového registru a provozu). */
export const TRUST_POINTS = ["ČSN 33 2000", "ČSN EN IEC 61439", "IEC TR 60890", "ČSN 33 2130 ed. 4", "ČSN 33 1600 ed. 2", "NV 190/2022 Sb.", "Data v EU (Německo)", "GDPR"];
