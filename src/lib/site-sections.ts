// Fáze 111: úvodní rozcestník https://eldock.cz/ (levá a pravá větev) a podsekce /sekce/elektroinstalace a
// /sekce/prumysl-a-revize – texty, moduly s tlačítky pro spuštění a podrobné stránky. Čistá data (stránky, testy).

export type GatewaySide = "elektroinstalace" | "prumysl-a-revize";

export interface GatewayPoint {
  title: string;
  text: string;
}

export interface SectionModule {
  id: string;
  icon: string;
  title: string;
  text: string;
  features: string[];
  /** Hlavní tlačítko spuštění modulu. */
  launch: { href: string; label: string };
  /** Další odkazy (podrobnosti, ukázka, návod). */
  links: { href: string; label: string }[];
}

export interface GatewaySection {
  side: GatewaySide;
  path: `/sekce/${GatewaySide}`;
  icon: string;
  title: string;
  who: string;
  points: [GatewayPoint, GatewayPoint, GatewayPoint];
  cta: string;
  seoTitle: string;
  seoDescription: string;
  /** Podrobný přehled (SEO stránka) pro tuto větev. */
  overview: { href: string; label: string };
  modules: SectionModule[];
}

export const GATEWAY: Record<GatewaySide, GatewaySection> = {
  elektroinstalace: {
    side: "elektroinstalace",
    path: "/sekce/elektroinstalace",
    icon: "🏠⚡",
    title: "Domovní a komerční elektroinstalace & Rozváděče",
    who: "Pro montážní elektrikáře, revizní techniky, projektanty a výrobce rozváděčů.",
    points: [
      { title: "2D Půdorys & Kabeláž", text: "5fázový návrh elektroinstalace, automatické trasy, krabičky KOPOS a 3D kontrola výšek." },
      { title: "AI Panel Builder", text: "návrh rozváděče z půdorysu nebo z fotky, oddělení silnoproudu a Smart Home, výpočet oteplení IEC TR 60890, CNC podklady a 6listový PDF elaborát." },
      { title: "Cenové nabídky & Kusovníky", text: "automatický výpočet z normohodin a ceníkových cen + 1-klikový export do velkoobchodů." },
    ],
    cta: "Vstoupit do sekce: Domovní instalace & Rozváděče →",
    seoTitle: "Domovní instalace & Rozváděče – 2D půdorys, AI Panel Builder a cenové nabídky | ELDOCK",
    seoDescription: "2D půdorys elektroinstalace s trasami a krabičkami KOPOS, rozváděč z půdorysu nebo z fotky s oddělením silnoproudu a Smart Home, výpočet oteplení, 6listový elaborát, cenové nabídky a kusovníky pro velkoobchod.",
    overview: { href: "/domovni-elektroinstalace", label: "Podrobný přehled pro elektrikáře a projektanty" },
    modules: [
      {
        id: "pudorys",
        icon: "📐",
        title: "2D Půdorys & Kabeláž",
        text: "Pět fází návrhu domovní elektroinstalace nad PDF od architekta nebo nad čistým půdorysem – od místností po rozváděč.",
        features: ["Zásuvky, světla, vypínače a Smart Home dle ČSN EN 60617-11", "Automatické trasy kabelů ve 3 režimech a výkaz kabeláže s úbytkem napětí", "Krabice KOPOS podle konstrukce stěny a 3D kontrola výšek i bez místností", "Kontrola norem ČSN 33 2130 ed. 4 a ČSN 33 2000-7-701"],
        launch: { href: "/panel-builder/floorplan/novy", label: "📐 Spustit 2D Půdorys" },
        links: [
          { href: "/2d-pudorys-elektroinstalace", label: "Jak funguje 2D půdorys" },
          { href: "/navody", label: "🎬 Video-návody" },
        ],
      },
      {
        id: "panel-builder",
        icon: "⚡",
        title: "AI Panel Builder",
        text: "Rozváděč z 2D půdorysu, z fotky osazené rozvodnice nebo od nuly – s uspořádáním skříně pro silnoproud a Smart Home.",
        features: ["📐 Uspořádání skříně: dvoupolová skříň, 24M / 18M lišty nebo dva rozváděče – vždy skutečné rozvodnice", "Strom zapojení, fáze L1–L3 a Elektro-linter", "Výpočet oteplení dle IEC TR 60890 a 6listový PDF elaborát s prohlášením o shodě", "CNC výrobní podklady (vrtací plán DXF, drátovací list)"],
        launch: { href: "/panel-builder", label: "⚡ Spustit AI Panel Builder" },
        links: [
          { href: "/ai-panel-builder", label: "Návrh rozváděče online" },
          { href: "/vypocet-otepleni-rozvadece", label: "Výpočet oteplení rozváděče" },
        ],
      },
      {
        id: "nabidky",
        icon: "💰",
        title: "Cenové nabídky & Kusovníky",
        text: "Cenová nabídka pro zákazníka z normohodin a ceníkových cen a kusovník s objednacími čísly pro velkoobchod.",
        features: ["Normohodiny montáže podle prvků půdorysu a rozváděče", "Ceníkové ceny velkoobchodu a vlastní přirážky", "1 klik: košík pro velkoobchod (CSV / XLSX) s EAN", "Nabídka v PDF s logem firmy"],
        launch: { href: "/panel-builder/floorplan", label: "💰 Otevřít zakázky a nabídky" },
        links: [{ href: "/kusova-zkouska-rozvadece", label: "Kusová zkouška a prohlášení o shodě" }],
      },
    ],
  },
  "prumysl-a-revize": {
    side: "prumysl-a-revize",
    path: "/sekce/prumysl-a-revize",
    icon: "🏭🛡️",
    title: "Průmysl, Administrativní budovy & Hlídač revizí",
    who: "Pro výrobní závody, administrativní a kancelářské budovy, obchodní centra, nemocnice a revizní techniky.",
    points: [
      { title: "Hlídač revizí spotřebičů, kanceláří a strojů", text: "evidence monitorů, prodlužovaček, spotřebičů (ČSN 33 1600 ed. 2) i rozváděčů, AI čtečka výrobních štítků z fotky a Chytrá revize." },
      { title: "Živá mapa závodu & 100% lokální BIM (.ifc)", text: "rozvodny, větve Síť / Dieselagregát / UPS a simulátor zátěže." },
      { title: "QR pasporty, Červenka & Ochrana TIČR", text: "uzamčená cloud dokumentace v1.0 → v1.1, zakreslování změn do schémat a měsíční kontrolní reporty revizním technikům." },
    ],
    cta: "Vstoupit do sekce: Průmysl, Budovy & Hlídač revizí →",
    seoTitle: "Průmysl, budovy & Hlídač revizí – spotřebiče, mapa závodu, BIM a QR pasporty | ELDOCK",
    seoDescription: "Hlídač revizí spotřebičů a strojů dle ČSN 33 1600 ed. 2 s AI čtečkou výrobních štítků, živá mapa závodu s BIM (.ifc), větve Síť / DA / UPS, QR pasporty rozváděčů, Červenka a měsíční report TIČR.",
    overview: { href: "/prumysl", label: "Podrobný přehled pro výrobní závody" },
    modules: [
      {
        id: "hlidac",
        icon: "🛡️",
        title: "Hlídač revizí & Správa spotřebičů a zařízení",
        text: "Kanceláře, školy, kliniky i výrobní haly: patra, místnosti a spotřebiče na 1 klik, lhůty podle ČSN 33 1600 ed. 2 a ČSN 33 1500.",
        features: ["Monitory, počítače, prodlužovačky, kuchyňky, nářadí, rozváděče a stroje", "📷 AI čtečka výrobního štítku: název, výrobce, model, S/N a třída ochrany", "Identifikační štítek s QR kódem EL-xxxxxx pro Zebra ZD421t", "Chytrá revize – trasa revizního technika a podpis revize"],
        launch: { href: "/hlidac-revizi", label: "🛡️ Otevřít Hlídač revizí" },
        links: [{ href: "/prumyslova-udrzba-a-revize", label: "Průmyslová údržba a revize" }],
      },
      {
        id: "mapa",
        icon: "🗺️",
        title: "Živá mapa závodu & BIM",
        text: "Areál, budovy a podlaží se zařízeními, import BIM (.ifc) zpracovaný přímo v prohlížeči a napájecí větve.",
        features: ["Rozvodny a hierarchie napájení", "Větve Síť / Dieselagregát / UPS a simulátor zátěže", "Lhůtník revizí VTZ podle NV 190/2022 Sb.", "Průvodce založením závodu a ukázková hala"],
        launch: { href: "/register-plant", label: "🏭 Založit závod / budovu" },
        links: [
          { href: "/prumysl", label: "Přehled pro výrobní závody" },
          { href: "/login", label: "Přihlášení do Správy závodů" },
        ],
      },
      {
        id: "pasporty",
        icon: "🔖",
        title: "QR pasporty, Červenka & Ochrana TIČR",
        text: "Dokumentace rozváděčů pod QR štítkem, změny z haly do schémat a podepsané revize s měsíčním reportem.",
        features: ["Uzamčené verze dokumentace v1.0 → v1.1", "Červenka: zakreslení změny do schématu a schválení", "Elektronický podpis revize s pečetí SHA-256", "Měsíční kontrolní report TIČR pro revizní techniky"],
        launch: { href: "/login", label: "🔖 Přihlásit se do Správy závodů" },
        links: [{ href: "/portal-projektantu", label: "Portál projektantů ELDOCK Pool" }],
      },
    ],
  },
};

export const GATEWAY_SIDES: readonly GatewaySide[] = ["elektroinstalace", "prumysl-a-revize"];
