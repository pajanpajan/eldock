// Fáze 63: produktové rodiny chytré domácnosti v horní liště výrobců 2D půdorysu – ABB (domovní spínače a zásuvky /
// ABB-free@home / ABB i-bus KNX & ABB-flexTronics), Loxone a TapHome. Výrobek se vkládá do půdorysu jako sběrnicový
// prvek palety (tlačítko, detektor, termostat, panel) s popisem výrobku; bezdrátové prvky a samostatné systémy
// (videotelefon) nejdou na sběrnicovou linku. Akční členy na DIN lištu počítá výpočet chytré domácnosti do rozváděče
// (`smart-home.ts`), projektant je může ručně navýšit. Objednací čísla jen ověřená (z `smart-home.ts`), jinak bez čísla.
//
// Fáze 65: obrázkový katalog – každý výrobek má záložku (ovladače / do krabičky a bezdrátové / panely a čidla / DIN
// lišta), druh náhledu (`kind`), počet kolébek / kanálů, popis funkce, druh schématu zapojení (`wiring`) a odkaz na
// ověřený záznam v katalogu výrobců (`catalog` → `smart-device-specs.generated.ts`) pro technický list.

import { SMART_SYSTEMS, type SmartModule, type SmartSystemId } from "./smart-home";

/** Záložky obrázkového katalogu. */
export type DeviceTab = "controls" | "inbox" | "panels" | "din";
/** Druh vektorového náhledu přístroje. */
export type DeviceKind = "button" | "touch" | "thermostat" | "panel" | "inbox" | "presence" | "sensor" | "intercom" | "controller" | "din";
/** Druh schématu zapojení svorek v technickém listu. */
export type WiringKind =
  | "bus-fah"
  | "bus-knx"
  | "tree"
  | "bus-taphome"
  | "inbox-switch"
  | "inbox-blind"
  | "inbox-dim"
  | "wireless"
  | "flextronics"
  | "intercom"
  | "din-switch"
  | "din-dim"
  | "din-dali"
  | "din-blind"
  | "din-heating"
  | "din-psu"
  | "din-interface"
  | "controller"
  | "miniserver"
  | "tree-extension";

export const DEVICE_TABS: { id: DeviceTab; label: string; hint: string }[] = [
  { id: "controls", label: "🎛️ Ovladače, tlačítka a termostaty", hint: "do půdorysu" },
  { id: "inbox", label: "📡 Prvky do krabičky a bezdrátové", hint: "do půdorysu" },
  { id: "panels", label: "🖥️ Panely, čidla a komunikace", hint: "do půdorysu / centrálně" },
  { id: "din", label: "⚡ Akční členy a zdroje na DIN lištu", hint: "do rozváděče" },
];

export interface CatalogProduct {
  id: string;
  label: string;
  /** Položka palety, která se vloží do půdorysu (bez = jen informace, např. akční člen na DIN lištu). */
  item?: string;
  /** Bezdrátový prvek / samostatný systém – bez sběrnicového kabelu. */
  noBus?: boolean;
  note?: string;
  typeCode?: string;
  articleNumber?: string | null;
  /** Objednací číslo ověřené ve zdroji (`smart-home.ts`). */
  verified?: boolean;
  /** Fáze 65: záložka katalogu, druh náhledu, kolébky / kanály, symbol na klapce, popis funkce a schéma zapojení. */
  tab: DeviceTab;
  kind: DeviceKind;
  gangs?: number;
  channels?: number;
  symbol?: "light" | "blind" | "heat" | "scene";
  description: string;
  wiring: WiringKind;
  /** Záznam v katalogu výrobců (`prisma/external-catalog`) s ověřenými technickými údaji. */
  catalog?: { manufacturer: string; mpn: string };
  /** Modul výpočtu chytré domácnosti (`smart-home.ts`) – počet v rozváděči a ruční navýšení. */
  moduleId?: string;
}

export interface CatalogGroup {
  id: string;
  label: string;
  /** Akční členy a zdroje na DIN lištu – do rozváděče je dopočítá výpočet chytré domácnosti. */
  din?: boolean;
  products: CatalogProduct[];
}

export interface ProductFamily {
  id: string;
  manufacturer: string;
  label: string;
  /** Podtitulek v segmentovém přepínači rodin (fáze 65). */
  subtitle: string;
  /** Systém chytré domácnosti, který rodina nastaví (null = domovní spínače a zásuvky). */
  system: SmartSystemId | null;
  description: string;
  groups: CatalogGroup[];
  /** Barvy provedení výrobce (Loxone bílá / antracit) – obecné barvy nákresu. */
  colors?: { id: string; label: string; swatch: string }[];
}

/** Výrobce v katalogu výrobců podle systému (Loxone tam je velkými písmeny). */
const CATALOG_MAKER: Record<SmartSystemId, string | null> = { abb_freeathome: "ABB", abb_knx: "ABB", loxone: "LOXONE", taphome: null };

function moduleDescription(system: SmartSystemId, unit: SmartModule): string {
  const bus = system === "abb_knx" ? "KNX" : system === "abb_freeathome" ? "free@home" : system === "loxone" ? "Loxone" : "TapHome";
  switch (unit.role) {
    case "system":
      if (system === "abb_freeathome") return "Systémový modul SysAP 3.0 řídí celou instalaci free@home (až 150 prvků): aplikace, hlasové ovládání a brána pro bezdrátové prvky. Nástěnná montáž, na DIN lištu s adaptérem.";
      if (system === "loxone") return "Centrální řídicí jednotka Loxone na DIN lištu: logika celé instalace, 8 reléových výstupů a vstupy, rozhraní Tree a Link pro rozšíření.";
      return "Řídicí jednotka TapHome Core – logika instalace a sběrnice pro tlačítka a moduly. Akční členy doplňte podle nabídky TapHome.";
    case "psu":
      return system === "loxone" ? "Napájecí zdroj 24 V DC pro Miniserver, rozšíření a prvky Tree." : `Napájecí zdroj sběrnice ${bus} s tlumivkou – napájí sběrnicové prvky linie; počet zdrojů podle odběru a počtu prvků.`;
    case "switch":
      return `Spínací akční člen na DIN lištu – každý z ${unit.channels} kanálů spíná jedno světlo nebo zásuvku${unit.ratedA ? ` (relé ${unit.ratedA} A)` : ""}, řízení po sběrnici ${bus}.`;
    case "dim":
      return `Stmívací akční člen na DIN lištu – ${unit.channels} kanálů pro stmívaná LED a žárovková svítidla${unit.maxW ? ` (do ${unit.maxW} W na kanál)` : ""}.`;
    case "dali":
      return `Rozhraní DALI – digitálně řídí až ${unit.channels} stmívatelných předřadníků svítidel po sběrnici DALI.`;
    case "blind":
      return `Žaluziový akční člen na DIN lištu – ${unit.channels} motorů žaluzií, rolet nebo markýz (nahoru / dolů).`;
    case "heating":
      return `Akční člen topení – ${unit.channels} výstupů pro termoelektrické hlavice podlahového topení nebo radiátorů podle prostorových termostatů.`;
    case "interface":
      return system === "loxone" ? "Rozšíření Tree – další větve sběrnice Tree pro tlačítka, čidla a svítidla Loxone (50 prvků na větev)." : "IP rozhraní KNX – programování instalace v ETS a připojení vizualizace / aplikace přes LAN.";
    // Fáze 77: LED 24 V PWM, binární vstupy čidel a zdroj LED
    case "pwm":
      return `Řadič LED 24 V DC – ${unit.channels} kanály PWM (stmívání 1, CCT 2, RGB 3, RGBW 4 kanály na svítidlo / pásek).`;
    case "input":
      return `Binární vstupy – ${unit.channels} bezpotenciálových vstupů pro okenní / dveřní kontakty a čidla úniku vody.`;
    case "psu_led":
      return "Napájecí zdroj 24 V DC na DIN lištu pro LED pásky – výkon podle součtu pásků + 20 % rezerva.";
  }
}

function moduleWiring(system: SmartSystemId, unit: SmartModule): WiringKind {
  const byRole: Record<SmartModule["role"], WiringKind> = { switch: "din-switch", dim: "din-dim", dali: "din-dali", blind: "din-blind", heating: "din-heating", pwm: "din-dim", input: "din-switch", psu: "din-psu", psu_led: "din-psu", interface: system === "loxone" ? "tree-extension" : "din-interface", system: system === "loxone" ? "miniserver" : "controller" };
  return byRole[unit.role];
}

/** Akční členy, zdroje a rozhraní systému na DIN lištu (ověřená data výpočtu chytré domácnosti). */
function dinGroup(system: SmartSystemId, label: string): CatalogGroup {
  const found = SMART_SYSTEMS.find((option) => option.id === system);
  const maker = CATALOG_MAKER[system];
  return {
    id: `${system}-din`,
    label,
    din: true,
    // Fáze 77: obecné moduly výpočtu (LED 24 V PWM, binární vstupy) bez ověřeného schématu zapojení do katalogu výrobků nepatří
    products: (found?.modules ?? []).filter((unit) => !(unit.source.startsWith("obecný modul") || unit.role === "psu_led")).map((unit) => ({
      id: `${system}-${unit.id}`,
      label: unit.label,
      typeCode: unit.typeCode,
      articleNumber: unit.articleNumber,
      verified: unit.verified,
      note: unit.modules > 0 ? `${unit.modules} M na DIN liště` : "mimo lištu (nástěnná montáž / adaptér)",
      tab: "din" as const,
      kind: unit.role === "system" && system !== "loxone" ? ("controller" as const) : ("din" as const),
      channels: unit.channels,
      description: moduleDescription(system, unit),
      wiring: moduleWiring(system, unit),
      ...(maker && unit.articleNumber ? { catalog: { manufacturer: maker, mpn: unit.articleNumber } } : {}),
      moduleId: unit.id,
    })),
  };
}

const button = (gangs: number, wiring: WiringKind, symbol: CatalogProduct["symbol"] = "light") => ({ tab: "controls" as const, kind: "button" as const, gangs, symbol, wiring });

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    id: "abb-design",
    manufacturer: "ABB",
    label: "Domovní spínače a zásuvky",
    subtitle: "designových řad",
    system: null,
    description: "Designové řady ABB podle Katalogu 2026 – řada a barva pro zásuvky, vypínače a rámečky v celém půdorysu.",
    groups: [],
  },
  {
    id: "abb-fah",
    manufacturer: "ABB",
    label: "ABB-free@home®",
    subtitle: "Chytrá elektroinstalace – 24 V sběrnice & Wireless",
    system: "abb_freeathome",
    description: "Sběrnicové a bezdrátové ovládání free@home: senzory v designu řad, akční členy do krabičky, panely a systémový modul.",
    groups: [
      {
        id: "fah-sensors",
        label: "Senzory a tlačítka v designu řad (Zoni, Tango, Levit, Time, future linear)",
        products: [
          { id: "fah-sensor-1", label: "Senzor / tlačítko 1násobné free@home", item: "bus-1", ...button(1, "bus-fah"), description: "Sběrnicové tlačítko free@home pod rámeček zvolené řady. Jedna kolébka ovládá světlo, scénu nebo skupinu přes akční člen v rozváděči." },
          { id: "fah-sensor-2", label: "Senzor / tlačítko 2násobné free@home", item: "bus-2", ...button(2, "bus-fah"), description: "Dvě kolébky pro dvě světla nebo světlo a scénu; stavová LED ukazuje sepnutí. Montáž do přístrojové krabice." },
          { id: "fah-sensor-4", label: "Senzor / tlačítko 4násobné free@home", item: "bus-4", ...button(4, "bus-fah"), description: "Čtyři ovládací místa v jednom rámečku – světla, scény i žaluzie; vhodné u vstupu do místnosti." },
          { id: "fah-blind", label: "Žaluziový senzor free@home", item: "bus-blind", ...button(2, "bus-fah", "blind"), description: "Kolébka nahoru / dolů pro žaluzie, rolety nebo markýzy přes žaluziový akční člen v rozváděči." },
          { id: "fah-rtc", label: "Prostorový termostat s displejem free@home", item: "bus-room", tab: "controls", kind: "thermostat", wiring: "bus-fah", catalog: { manufacturer: "ABB", mpn: "2CKA006220A0122" }, description: "Termostat s displejem na sběrnici free@home: měří teplotu místnosti a řídí topnou zónu přes akční člen topení." },
        ],
      },
      {
        id: "fah-wireless",
        label: "Bezdrátové prvky free@home® WL & Smart Switch",
        products: [
          { id: "fah-wl-act-1", label: "Akční člen do krabičky 1kanálový (free@home wireless)", item: "bus-1", noBus: true, tab: "inbox", kind: "inbox", channels: 1, wiring: "inbox-switch", catalog: { manufacturer: "ABB", mpn: "2CKA006710A0034" }, description: "Bezdrátový spínací akční člen do přístrojové krabice za tlačítko – spíná světlo bez sběrnicového kabelu, napájení z 230 V." },
          { id: "fah-wl-act-2", label: "Akční člen do krabičky 2kanálový (free@home wireless)", item: "bus-2", noBus: true, tab: "inbox", kind: "inbox", channels: 2, wiring: "inbox-switch", catalog: { manufacturer: "ABB", mpn: "2CKA006710A0057" }, description: "Dva bezdrátově řízené spínací kanály v jedné krabici – například dvě světla u jednoho dvojitého tlačítka." },
          { id: "fah-wl-blind", label: "Žaluziový akční člen do krabičky (free@home wireless)", item: "bus-blind", noBus: true, tab: "inbox", kind: "inbox", channels: 1, symbol: "blind", wiring: "inbox-blind", catalog: { manufacturer: "ABB", mpn: "2CKA006710A0041" }, description: "Bezdrátový akční člen pro jeden motor žaluzie nebo rolety (nahoru / dolů) do krabice u tlačítka." },
          { id: "fah-wl-dim", label: "Stmívací akční člen do krabičky (free@home wireless)", item: "bus-1", noBus: true, tab: "inbox", kind: "inbox", channels: 1, wiring: "inbox-dim", catalog: { manufacturer: "ABB", mpn: "2CKA006710A0038" }, description: "Bezdrátový stmívač do přístrojové krabice pro stmívatelná LED svítidla – bez sběrnicového kabelu." },
          { id: "fah-smart-switch", label: "Smart Switch bez baterie (free@home wireless)", item: "bus-1", noBus: true, tab: "inbox", kind: "button", gangs: 2, symbol: "light", wiring: "wireless", catalog: { manufacturer: "ABB", mpn: "2CKA006710A0048" }, description: "Bezdrátové tlačítko bez baterie a bez vodičů – energii vyrobí stisk; přilepí se na zeď i sklo." },
        ],
      },
      {
        id: "fah-central",
        label: "Centrální panely a komunikace",
        products: [
          { id: "fah-onetouch", label: "Dotykový panel ABB-free@home OneTouch 7\"", item: "bus-display", tab: "panels", kind: "panel", wiring: "bus-fah", catalog: { manufacturer: "ABB", mpn: "2TMA210050B0006" }, description: "Dotykový panel 7\" s displejem: ovládání světel, žaluzií, topení a scén celého domu z jednoho místa." },
          {
            id: "fah-welcome-midi",
            label: "Videotelefon ABB-Welcome Midi (vlastní 2drátová sběrnice)",
            item: "bus-display",
            noBus: true,
            note: "kabel ABB-Welcome ověřte zvlášť – není na lince free@home",
            tab: "panels",
            kind: "intercom",
            wiring: "intercom",
            description: "Domovní videotelefon ABB-Welcome na vlastní dvoudrátové sběrnici – ke dveřní stanici, ne na linku free@home.",
          },
        ],
      },
      dinGroup("abb_freeathome", "Akční členy, zdroj a rozhraní na DIN lištu"),
    ],
  },
  {
    id: "abb-knx",
    manufacturer: "ABB",
    label: "ABB i-bus® KNX & flexTronics®",
    subtitle: "Systémová automatizace budov",
    system: "abb_knx",
    description: "Otevřený standard KNX (ČSN EN 50090): tlačítkové snímače, detektory přítomnosti, prostorové termostaty, DALI brány a akční členy ABB i-bus.",
    groups: [
      {
        id: "knx-buttons",
        label: "KNX tlačítkové snímače (v designu řad)",
        products: [
          { id: "knx-button-1", label: "Tlačítkový snímač KNX 1násobný", item: "bus-1", ...button(1, "bus-knx"), description: "Tlačítkový snímač KNX pod rámeček řady – funkci kolébky (světlo, scéna, stmívání) nastaví program ETS." },
          { id: "knx-button-2", label: "Tlačítkový snímač KNX 2násobný", item: "bus-2", ...button(2, "bus-knx"), description: "Dvě kolébky s LED stavu pro dvě funkce KNX; připojení jen na sběrnici KNX." },
          { id: "knx-button-4", label: "Tlačítkový snímač KNX 4násobný", item: "bus-4", ...button(4, "bus-knx"), description: "Čtyři kolébky pro světla, scény a žaluzie – centrální ovládání místnosti." },
          { id: "knx-button-6", label: "Tlačítkový snímač KNX 6násobný", item: "bus-6", ...button(6, "bus-knx"), description: "Šest ovládacích ploch v jednom rámečku – vstup do domu nebo velké místnosti." },
          { id: "knx-rtc", label: "Prostorový termostat KNX s displejem", item: "bus-room", tab: "controls", kind: "thermostat", wiring: "bus-knx", catalog: { manufacturer: "ABB", mpn: "2CKA006134A0319" }, description: "Prostorový termostat s displejem na sběrnici KNX – regulace topné zóny a zobrazení teploty." },
        ],
      },
      {
        id: "knx-presence",
        label: "Detektory přítomnosti Busch-Watchdog 180",
        products: [
          { id: "knx-watchdog-basic", label: "Detektor přítomnosti Busch-Watchdog 180 Basic (KNX)", item: "bus-presence", tab: "panels", kind: "presence", wiring: "bus-knx", description: "Detektor pohybu a přítomnosti KNX – rozsvítí podle obsazenosti a denního světla." },
          { id: "knx-watchdog-multi", label: "Detektor přítomnosti Busch-Watchdog 180 Multi (KNX)", item: "bus-presence", tab: "panels", kind: "presence", wiring: "bus-knx", description: "Detektor s více funkcemi (světlo, HVAC, poplach) pro chodby, schodiště a místnosti." },
          { id: "knx-watchdog-sky", label: "Detektor přítomnosti Busch-Watchdog 180 Sky (KNX, strop)", item: "bus-presence", tab: "panels", kind: "presence", wiring: "bus-knx", description: "Stropní detektor přítomnosti se záběrem celé místnosti – kanceláře, koupelny, šatny." },
          { id: "knx-watchdog-corridor", label: "Detektor přítomnosti Busch-Watchdog 180 Corridor (KNX, chodba)", item: "bus-presence", tab: "panels", kind: "presence", wiring: "bus-knx", description: "Detektor s protáhlým záběrem pro chodby a průchody." },
        ],
      },
      {
        id: "knx-room",
        label: "Prostorové termostaty a čidla",
        products: [
          { id: "knx-sensor", label: "Čidlo teploty a vlhkosti KNX", item: "bus-sensor", tab: "panels", kind: "sensor", wiring: "bus-knx", description: "Čidlo teploty a vlhkosti vzduchu na sběrnici KNX – podklad pro regulaci topení a větrání." },
          { id: "knx-panel", label: "Dotykový panel / vizualizace KNX", item: "bus-display", tab: "panels", kind: "panel", wiring: "bus-knx", description: "Dotykový panel pro vizualizaci a ovládání instalace KNX (světla, scény, topení, žaluzie)." },
        ],
      },
      {
        id: "knx-flextronics",
        label: "ABB-flexTronics®",
        products: [
          {
            id: "knx-flextronics",
            label: "Elektronické vložky ABB-flexTronics® (stmívače, spínače a senzory pod rámečky řad)",
            note: "přístroj zvolte v kusovníku domovní instalace",
            tab: "inbox",
            kind: "inbox",
            wiring: "flextronics",
            description: "Elektronické vložky pod rámeček řady (stmívače, spínače, senzory) – klasická instalace 230 V bez sběrnice; konkrétní přístroj v kusovníku.",
          },
        ],
      },
      dinGroup("abb_knx", "Akční členy, DALI regulátory a zdroj na DIN lištu"),
    ],
  },
  {
    id: "loxone",
    manufacturer: "Loxone",
    label: "Loxone (Miniserver + Tree / Air)",
    subtitle: "Miniserver, Tree & Air",
    system: "loxone",
    description: "Miniserver s rozšířeními na DIN liště, ovládání Touch a čidla na sběrnici Tree, bezdrátové prvky Air.",
    colors: [
      { id: "white", label: "Bílá", swatch: "#f8fafc" },
      { id: "black", label: "Antracit", swatch: "#3f3f46" },
    ],
    groups: [
      {
        id: "lox-touch",
        label: "Ovládání Touch",
        products: [
          { id: "lox-touch-pure", label: "Loxone Touch Pure (Tree)", item: "bus-4", tab: "controls", kind: "touch", gangs: 5, wiring: "tree", catalog: { manufacturer: "LOXONE", mpn: "100792" }, description: "Bezrámečkový dotykový ovladač s pěti dotykovými body (světlo, žaluzie, hudba) na sběrnici Tree." },
          { id: "lox-touch-pure-flex", label: "Loxone Touch Pure Flex (Tree)", item: "bus-4", tab: "controls", kind: "touch", gangs: 5, wiring: "tree", catalog: { manufacturer: "LOXONE", mpn: "100608" }, description: "Dotykový ovladač Touch Pure Flex na Tree s nastavitelnými piktogramy; provedení IP44 i do vlhčích prostor." },
          { id: "lox-touch", label: "Loxone Touch – klasik (Tree)", item: "bus-4", tab: "controls", kind: "touch", gangs: 5, wiring: "tree", description: "Klasický dotykový ovladač Loxone Touch pod rámeček – pět dotykových bodů na sběrnici Tree." },
          { id: "lox-touch-nightlight", label: "Loxone Touch Nightlight (Tree)", item: "bus-4", tab: "controls", kind: "touch", gangs: 5, wiring: "tree", description: "Dotykový ovladač s nočním orientačním světlem do ložnic a chodeb, sběrnice Tree." },
        ],
      },
      {
        id: "lox-air",
        label: "Bezdrátové prvky Air",
        products: [{ id: "lox-touch-air", label: "Loxone Touch Air (bezdrátový)", item: "bus-4", noBus: true, tab: "inbox", kind: "touch", gangs: 5, wiring: "wireless", description: "Bezdrátový dotykový ovladač Loxone Air na baterie – bez kabelu, i na dodatečnou instalaci." }],
      },
      {
        id: "lox-sensors",
        label: "Čidla",
        products: [{ id: "lox-presence", label: "Loxone stropní senzor přítomnosti (Tree)", item: "bus-presence", tab: "panels", kind: "presence", wiring: "tree", catalog: { manufacturer: "LOXONE", mpn: "100422" }, description: "Stropní senzor přítomnosti na sběrnici Tree – světlo podle obsazenosti, podklad pro regulaci a zabezpečení." }],
      },
      dinGroup("loxone", "Miniserver / Tree / Air – na DIN lištu"),
    ],
  },
  {
    id: "taphome",
    manufacturer: "TapHome",
    label: "TapHome (Core + sběrnice)",
    subtitle: "Core & sběrnicové prvky",
    system: "taphome",
    description: "Řídicí jednotka Core, tlačítka 2T / 4T / 6T a UI termostat; akční členy doplňte podle nabídky TapHome.",
    groups: [
      {
        id: "tap-buttons",
        label: "Tlačítka TapHome",
        products: [
          { id: "tap-2t", label: "TapHome tlačítko 2T", item: "bus-2", tab: "controls", kind: "touch", gangs: 2, wiring: "bus-taphome", description: "Sběrnicové tlačítko TapHome se dvěma ovládacími plochami (světla, scény)." },
          { id: "tap-4t", label: "TapHome tlačítko 4T", item: "bus-4", tab: "controls", kind: "touch", gangs: 4, wiring: "bus-taphome", description: "Sběrnicové tlačítko TapHome se čtyřmi plochami pro světla, žaluzie a scény." },
          { id: "tap-6t", label: "TapHome tlačítko 6T", item: "bus-6", tab: "controls", kind: "touch", gangs: 6, wiring: "bus-taphome", description: "Sběrnicové tlačítko TapHome se šesti plochami – centrální ovládání místnosti." },
        ],
      },
      {
        id: "tap-room",
        label: "Termostat",
        products: [{ id: "tap-thermostat", label: "TapHome UI Termostat", item: "bus-room", tab: "controls", kind: "thermostat", wiring: "bus-taphome", description: "Prostorový termostat TapHome s displejem na sběrnici – regulace topné zóny." }],
      },
      dinGroup("taphome", "Core jednotka"),
    ],
  },
];

const PRODUCTS = new Map(PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products.map((product) => [product.id, { ...product, family: family.id }] as const))));

/** Výrobek podle id (null = neznámý). */
export const productById = (id: string | null | undefined): (CatalogProduct & { family: string }) | null => (id ? (PRODUCTS.get(id) ?? null) : null);

export const familiesOf = (manufacturer: string) => PRODUCT_FAMILIES.filter((family) => family.manufacturer === manufacturer);

/** Rodina podle systému chytré domácnosti. */
export const familyOfSystem = (system: SmartSystemId) => PRODUCT_FAMILIES.find((family) => family.system === system) ?? null;

/** Výrobky rodiny po záložkách katalogu. */
export const productsOfTab = (family: ProductFamily, tab: DeviceTab) => family.groups.flatMap((group) => group.products).filter((product) => product.tab === tab);

/** Výrobek modulu výpočtu chytré domácnosti (DIN lišta) – technický list z pravého přehledu akčních členů. */
export const productOfModule = (system: SmartSystemId, moduleId: string) => productById(`${system}-${moduleId}`);

/** Výrobek zvoleného systému pro položku palety (technický list z levé palety); bezdrátové až jako poslední volba. */
export function productForItem(system: SmartSystemId, item: string): (CatalogProduct & { family: string }) | null {
  const family = familyOfSystem(system);
  if (!family) return null;
  const candidates = family.groups.flatMap((group) => group.products).filter((product) => product.item === item);
  const pick = candidates.find((product) => !product.noBus) ?? candidates[0];
  return pick ? productById(pick.id) : null;
}

/** Výrobci chytré automatizace v liště (vedle výrobců domovních přístrojů). */
export const SMART_MANUFACTURERS = ["Loxone", "TapHome"] as const;
