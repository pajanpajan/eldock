// Fáze 87: video-návody pro testery (elektrikáře). Jediný zdroj kapitol a komentáře – z něj generátor
// `scripts/generate-tutorials.mjs` namluví hlasový komentář a vypíše titulky a stejné kapitoly ukazuje veřejná
// stránka `/navody` i přehrávače „🎬 Video-návod“ v editoru půdorysu a v AI Panel Builderu.
// Soubor nesmí nic importovat a smí mít jen typy, které Node umí odstranit (generátor ho načítá přímo v Node).

export type TutorialId = "pudorys" | "panel-builder";

/** Jeden titulek = přesný přepis toho, co hlas právě říká. */
export interface TutorialCue {
  text: string;
  /** Výslovnost pro hlasovou syntézu, když se liší od titulku (zkratky, čísla norem, cizí názvy). */
  say?: string;
}

export interface TutorialChapter {
  id: string;
  /** Název kapitoly – odznak „KROK 2 / 5 · …“ ve videu a seznam kapitol pod přehrávačem. */
  title: string;
  cues: readonly TutorialCue[];
  /** Interactive Tour v editoru: prvky obrazovky, o kterých kapitola mluví (CSS selektory, první se posune do zorného pole). */
  targets?: readonly string[];
}

export interface Tutorial {
  id: TutorialId;
  title: string;
  /** Nadpis videa na stránce /navody („Video 1: …“). */
  heading: string;
  /** Krátký popis pod nadpisem přehrávače. */
  description: string;
  /** Soubor v `public/` (H.264 + AAC, faststart). */
  file: string;
  tryHref: string;
  tryLabel: string;
  chapters: readonly TutorialChapter[];
}

export const TUTORIALS: readonly Tutorial[] = [
  {
    id: "pudorys",
    title: "2D Půdorys & Kabeláž",
    heading: "2D Půdorys & Kabeláž",
    description: "Od prázdné plochy nebo výkresu od stavaře k zásuvkám, světlům, trasám kabelů, kusovníku a rozváděči na jedno kliknutí.",
    file: "/tutorials/eldock-2d-pudorys-navod.mp4",
    tryHref: "/panel-builder/floorplan",
    tryLabel: "🚀 Vyzkoušet 2D Půdorys",
    chapters: [
      {
        id: "uvod",
        title: "Úvod, plocha a měřítko",
        cues: [
          { text: "Vítejte v Eldocku." },
          { text: "Ukážeme si, jak z půdorysu za pár minut vytvoříte návrh elektroinstalace, výkaz kabelů a hotový rozváděč." },
          { text: "Můžete nahrát PDF či DXF výkres od stavaře, zkalibrovat měřítko na jednu známou stěnu,", say: "Můžete nahrát pé dé ef či dé iks ef výkres od stavaře, zkalibrovat měřítko na jednu známou stěnu," },
          { text: "nebo kreslit místnosti od nuly na volitelnou plochu až sto krát sto metrů." },
        ],
        targets: ['[data-tour="floorplan-upload"]', '[data-tour="floorplan-calibrate"]', '[data-testid="plane-preset"]', '[data-testid="install-methodology"]'],
      },
      {
        id: "vyrobci",
        title: "Výrobci, designové řady a barvy",
        cues: [
          { text: "Nahoře si zvolíte výrobce, designovou řadu a barvu přístrojů –" },
          { text: "například ABB Zoni, Levit M nebo prvky chytré domácnosti ABB free@home, Loxone a TapHome.", say: "například á bé bé zoni, levit em nebo prvky chytré domácnosti á bé bé frí et houm, loxon a tep houm." },
          { text: "Kdykoliv změníte barvu nebo řadu, program automaticky přepočítá všechna objednací čísla strojků, krytů i vícerámečků." },
        ],
        targets: ['[data-testid="device-appearance"]'],
      },
      {
        id: "osazeni",
        title: "Rozváděč, zásuvky, světla a koupelna",
        cues: [
          { text: "Do půdorysu nejprve umístíte rozváděč" },
          { text: "a poté z levého menu vkládáte zásuvky, vypínače, žaluzie, čidla a samostatné spotřebiče." },
          { text: "Často používané prvky a sestavy vícerámečků si můžete připnout hvězdičkou." },
          { text: "U světel jednoduše zaškrtnete stmívání nebo změnu barvy" },
          { text: "a v koupelně program automaticky pohlídá ochranné zóny." },
        ],
        targets: ['aside[aria-label="Paleta elektroinstalačních značek"]', '[data-testid="floorplan-canvas"]'],
      },
      {
        id: "trasy",
        title: "Trasy kabelů po stěnách a úprava myší",
        cues: [
          { text: "Kabely se automaticky trasují po obvodu stěn v instalačních zónách," },
          { text: "takže nikdy nekřižují střed místnosti." },
          { text: "Kteroukoliv trasu můžete chytit myší a posunout v ose X nebo Y,", say: "Kteroukoliv trasu můžete chytit myší a posunout v ose iks nebo ypsilon," },
          { text: "přepínat vedení v podlaze či podhledu" },
          { text: "a ikonkou oka si filtrovat viditelnost jednotlivých okruhů." },
        ],
        targets: ['[data-testid="floorplan-canvas"]', '[data-testid="cable-totals"]', '[data-testid="circuit-list"]'],
      },
      {
        id: "vystupy",
        title: "Kusovník, export PDF / DXF a rozváděč na 1 klik",
        cues: [
          { text: "Na závěr si zobrazíte kompletní kusovník s přesnými objednacími čísly a metráží kabelů," },
          { text: "vyexportujete výkres do PDF nebo AutoCADu", say: "vyexportujete výkres do pé dé ef nebo autokadu" },
          { text: "a jedním klikem vygenerujete z půdorysu kompletně osazený rozváděč." },
        ],
        targets: ['[data-testid="wiring-bom-open"]', '[data-testid="export-pdf"]', '[data-testid="generate-from-floorplan"]'],
      },
    ],
  },
  {
    id: "panel-builder",
    title: "AI Panel Builder – Rozváděč za 3 minuty",
    heading: "AI Panel Builder (Rozváděč z fotky / od nuly)",
    description: "Rozváděč z fotky, z půdorysu nebo od nuly: osazení DIN lišt, Elektro-linter, strom zapojení, oteplení a kompletní elaborát.",
    file: "/tutorials/eldock-ai-panel-builder-navod.mp4",
    tryHref: "/panel-builder",
    tryLabel: "⚡ Vyzkoušet AI Panel Builder",
    chapters: [
      {
        id: "zalozeni",
        title: "Založení projektu, soustava a rozvodnice",
        cues: [
          { text: "V AI Panel Builderu vytvoříte výrobní dokumentaci rozváděče za tři minuty.", say: "V Ej Áj Panel Bildru vytvoříte výrobní dokumentaci rozváděče za tři minuty." },
          { text: "Projekt založíte vyfocením už osazeného rozváděče na stavbě, přenosem z půdorysu, nebo od nuly." },
          { text: "Zvolíte jednofázovou či třífázovou soustavu a volitelně vyberete přesný typ rozvodnice." },
        ],
      },
      {
        id: "osazeni",
        title: "1. Návrh a osazení – DIN lišty a Elektro-linter",
        cues: [
          { text: "Na interaktivním plátně skládáte přístroje na DIN lišty z katalogu hlavních výrobců", say: "Na interaktivním plátně skládáte přístroje na dinové lišty z katalogu hlavních výrobců" },
          { text: "včetně akčních členů chytré domácnosti." },
          { text: "Vestavěný Elektro-linter vše ihned kontroluje podle normy ČSN 33 2130 edice 4 –", say: "Vestavěný elektro linter vše ihned kontroluje podle normy čé es en třicet tři dvacet jedna třicet, edice čtyři." },
          { text: "pohlídá oddělené chrániče pro světla, zakáže starý typ AC a případné chyby opraví jedním klikem.", say: "Pohlídá oddělené chrániče pro světla, zakáže starý typ á cé a případné chyby opraví jedním klikem." },
        ],
      },
      {
        id: "zapojeni",
        title: "2. Zapojení – strom, fáze L1–L3 a sběrnice PE / N",
        cues: [
          { text: "Ve druhém kroku program sám sestaví strom zapojení" },
          { text: "a rovnoměrně rozloží zátěž mezi fáze L1, L2 a L3.", say: "a rovnoměrně rozloží zátěž mezi fáze el jedna, el dva a el tři." },
          { text: "Zároveň spočítá a vykreslí hlavní ochrannou sběrnici PE, bod rozdělení PEN", say: "Zároveň spočítá a vykreslí hlavní ochrannou sběrnici pé é, bod rozdělení pé é en" },
          { text: "a samostatné nulové můstky pro každý proudový chránič." },
        ],
      },
      {
        id: "otepleni",
        title: "3. Skříň a 4. výpočet oteplení",
        cues: [
          { text: "Ve třetím kroku potvrdíte skříň rozváděče" },
          { text: "a ve čtvrtém proběhne normativní výpočet oteplení podle ČSN EN IEC 61439 a metodiky IEC TR 60890.", say: "a ve čtvrtém proběhne normativní výpočet oteplení podle čé es en é en í é cé šedesát jedna čtyři sta třicet devět a metodiky í é cé té er šedesát osm set devadesát." },
          { text: "Okamžitě vidíte součet ztrátových výkonů všech přístrojů, teplotu v horní části skříně" },
          { text: "a verdikt, zda rozvodnice tepelně vyhovuje." },
        ],
      },
      {
        id: "dokumentace",
        title: "5. Elaborát PDF, štítek CE a popisky 1:1",
        cues: [
          { text: "V posledním kroku si jedním klikem vytisknete kompletní šestilistový PDF elaborát s vaším razítkem:", say: "V posledním kroku si jedním klikem vytisknete kompletní šestilistový pé dé ef elaborát s vaším razítkem:" },
          { text: "výkres osazení, jednopólové schéma, kusovník, protokol o kusové zkoušce, protokol vnějších vlivů," },
          { text: "prohlášení o shodě, výrobní štítek CE i barevné samolepicí popisky na jističe v měřítku jedna ku jedné.", say: "prohlášení o shodě, výrobní štítek cé é i barevné samolepicí popisky na jističe v měřítku jedna ku jedné." },
        ],
      },
    ],
  },
];

export const tutorialById = (id: TutorialId): Tutorial => TUTORIALS.find((tutorial) => tutorial.id === id) ?? TUTORIALS[0];

/** Celý komentář kapitoly (titulky za sebou). */
export const chapterText = (chapter: TutorialChapter): string => chapter.cues.map((cue) => cue.text).join(" ");

/** „1:05“ – čas kapitoly pod přehrávačem. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Pozvánka pro kolegu elektrikáře (tlačítko na /navody) s odkazem na stránku návodů. */
export const inviteMessage = (url: string): string =>
  `Ahoj, zkus Eldock – z půdorysu za pár minut navrhne elektroinstalaci, výkaz kabelů a hotový rozváděč i s dokumentací (oteplení, štítek CE, prohlášení o shodě). Tady jsou dva krátké video-návody s českým komentářem: ${url}`;

/** Náhledový obrázek přehrávače – stejný název jako MP4, jen `.jpg` (vytváří generátor). */
export const posterOf = (file: string): string => file.replace(/\.mp4$/, ".jpg");

/** „7,4 MB“ – velikost videa u tlačítka ke stažení. */
export const formatMegabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

/** Odznak kapitoly ve videu: „KROK 2 / 5 · Výrobci, designové řady a barvy“. */
export const chapterBadge = (tutorial: Tutorial, index: number): string => `KROK ${index + 1} / ${tutorial.chapters.length} · ${tutorial.chapters[index].title}`;
