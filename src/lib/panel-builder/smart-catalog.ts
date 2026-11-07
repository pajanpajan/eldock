// Fáze 63: produktové rodiny chytré domácnosti v horní liště výrobců 2D půdorysu – ABB (domovní spínače a zásuvky /
// ABB-free@home / ABB i-bus KNX & ABB-flexTronics), Loxone a TapHome. Výrobek se vkládá do půdorysu jako sběrnicový
// prvek palety (tlačítko, detektor, termostat, panel) s popisem výrobku; bezdrátové prvky a samostatné systémy
// (videotelefon) nejdou na sběrnicovou linku. Akční členy na DIN lištu jsou jen informace – počítá je výpočet chytré
// domácnosti do rozváděče (`smart-home.ts`). Objednací čísla jen ověřená (z `smart-home.ts`), jinak bez čísla.

import { SMART_SYSTEMS, type SmartSystemId } from "./smart-home";

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
  /** Systém chytré domácnosti, který rodina nastaví (null = domovní spínače a zásuvky). */
  system: SmartSystemId | null;
  description: string;
  groups: CatalogGroup[];
  /** Barvy provedení výrobce (Loxone bílá / antracit) – obecné barvy nákresu. */
  colors?: { id: string; label: string; swatch: string }[];
}

/** Akční členy, zdroje a rozhraní systému na DIN lištu (ověřená data výpočtu chytré domácnosti). */
function dinGroup(system: SmartSystemId, label: string): CatalogGroup {
  const found = SMART_SYSTEMS.find((option) => option.id === system);
  return {
    id: `${system}-din`,
    label,
    din: true,
    products: (found?.modules ?? []).map((unit) => ({ id: `${system}-${unit.id}`, label: unit.label, typeCode: unit.typeCode, articleNumber: unit.articleNumber, note: unit.modules > 0 ? `${unit.modules} M na DIN liště` : "mimo lištu (nástěnný / kusovník)" })),
  };
}

export const PRODUCT_FAMILIES: ProductFamily[] = [
  {
    id: "abb-design",
    manufacturer: "ABB",
    label: "🎨 Domovní spínače a zásuvky",
    system: null,
    description: "Designové řady ABB podle Katalogu 2026 – řada a barva pro zásuvky, vypínače a rámečky v celém půdorysu.",
    groups: [],
  },
  {
    id: "abb-fah",
    manufacturer: "ABB",
    label: "🏠 ABB-free@home® (sběrnice 24 V DC & wireless)",
    system: "abb_freeathome",
    description: "Sběrnicové a bezdrátové ovládání free@home: senzory v designu řad, akční členy do krabičky, panely a systémový modul.",
    groups: [
      {
        id: "fah-sensors",
        label: "Senzory a tlačítka v designu řad (Zoni, Tango, Levit, Time, future linear)",
        products: [
          { id: "fah-sensor-1", label: "Senzor / tlačítko 1násobné free@home", item: "bus-1" },
          { id: "fah-sensor-2", label: "Senzor / tlačítko 2násobné free@home", item: "bus-2" },
          { id: "fah-sensor-4", label: "Senzor / tlačítko 4násobné free@home", item: "bus-4" },
          { id: "fah-blind", label: "Žaluziový senzor free@home", item: "bus-blind" },
          { id: "fah-rtc", label: "Prostorový termostat s displejem free@home", item: "bus-room" },
        ],
      },
      {
        id: "fah-wireless",
        label: "Bezdrátové prvky free@home® WL & Smart Switch",
        products: [
          { id: "fah-wl-act-1", label: "Akční člen do krabičky 1kanálový (free@home wireless)", item: "bus-1", noBus: true },
          { id: "fah-wl-act-2", label: "Akční člen do krabičky 2kanálový (free@home wireless)", item: "bus-2", noBus: true },
          { id: "fah-wl-blind", label: "Žaluziový akční člen do krabičky (free@home wireless)", item: "bus-blind", noBus: true },
          { id: "fah-wl-dim", label: "Stmívací akční člen do krabičky (free@home wireless)", item: "bus-1", noBus: true },
          { id: "fah-smart-switch", label: "Smart Switch bez baterie (free@home wireless)", item: "bus-1", noBus: true },
        ],
      },
      {
        id: "fah-central",
        label: "Centrální panely a komunikace",
        products: [
          { id: "fah-onetouch", label: "Dotykový panel ABB-free@home OneTouch 7\"", item: "bus-display" },
          { id: "fah-sysap", label: "System Access Point (SysAP) – v Katalogu 2026 SysAP 3.0", typeCode: "SAP.3", articleNumber: "2CKA006200A0871", note: "systémový modul se počítá automaticky do kusovníku" },
          { id: "fah-welcome-midi", label: "Videotelefon ABB-Welcome Midi (vlastní 2drátová sběrnice)", item: "bus-display", noBus: true, note: "kabel ABB-Welcome ověřte zvlášť – není na lince free@home" },
        ],
      },
      dinGroup("abb_freeathome", "Akční členy, zdroj a rozhraní na DIN lištu"),
    ],
  },
  {
    id: "abb-knx",
    manufacturer: "ABB",
    label: "🏢 ABB i-bus® KNX & ABB-flexTronics®",
    system: "abb_knx",
    description: "Otevřený standard KNX (ČSN EN 50090): tlačítkové snímače, detektory přítomnosti, prostorové termostaty, DALI brány a akční členy ABB i-bus.",
    groups: [
      {
        id: "knx-buttons",
        label: "KNX tlačítkové snímače (v designu řad)",
        products: [
          { id: "knx-button-1", label: "Tlačítkový snímač KNX 1násobný", item: "bus-1" },
          { id: "knx-button-2", label: "Tlačítkový snímač KNX 2násobný", item: "bus-2" },
          { id: "knx-button-4", label: "Tlačítkový snímač KNX 4násobný", item: "bus-4" },
          { id: "knx-button-6", label: "Tlačítkový snímač KNX 6násobný", item: "bus-6" },
        ],
      },
      {
        id: "knx-presence",
        label: "Detektory přítomnosti Busch-Watchdog 180",
        products: [
          { id: "knx-watchdog-basic", label: "Detektor přítomnosti Busch-Watchdog 180 Basic (KNX)", item: "bus-presence" },
          { id: "knx-watchdog-multi", label: "Detektor přítomnosti Busch-Watchdog 180 Multi (KNX)", item: "bus-presence" },
          { id: "knx-watchdog-sky", label: "Detektor přítomnosti Busch-Watchdog 180 Sky (KNX, strop)", item: "bus-presence" },
          { id: "knx-watchdog-corridor", label: "Detektor přítomnosti Busch-Watchdog 180 Corridor (KNX, chodba)", item: "bus-presence" },
        ],
      },
      {
        id: "knx-room",
        label: "Prostorové termostaty a čidla",
        products: [
          { id: "knx-rtc", label: "Prostorový termostat KNX s displejem", item: "bus-room" },
          { id: "knx-sensor", label: "Čidlo teploty a vlhkosti KNX", item: "bus-sensor" },
          { id: "knx-panel", label: "Dotykový panel / vizualizace KNX", item: "bus-display" },
        ],
      },
      {
        id: "knx-flextronics",
        label: "ABB-flexTronics®",
        products: [{ id: "knx-flextronics", label: "Elektronické vložky ABB-flexTronics® (stmívače, spínače a senzory pod rámečky řad)", note: "přístroj zvolte v kusovníku domovní instalace" }],
      },
      dinGroup("abb_knx", "Akční členy, DALI regulátory a zdroj na DIN lištu"),
    ],
  },
  {
    id: "loxone",
    manufacturer: "Loxone",
    label: "Loxone (Miniserver + Tree / Air)",
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
          { id: "lox-touch-pure", label: "Loxone Touch Pure (Tree)", item: "bus-4" },
          { id: "lox-touch-pure-flex", label: "Loxone Touch Pure Flex (Tree)", item: "bus-4" },
          { id: "lox-touch", label: "Loxone Touch – klasik (Tree)", item: "bus-4" },
          { id: "lox-touch-nightlight", label: "Loxone Touch Nightlight (Tree)", item: "bus-4" },
          { id: "lox-touch-air", label: "Loxone Touch Air (bezdrátový)", item: "bus-4", noBus: true },
        ],
      },
      {
        id: "lox-sensors",
        label: "Čidla",
        products: [{ id: "lox-presence", label: "Loxone stropní senzor přítomnosti (Tree)", item: "bus-presence" }],
      },
      dinGroup("loxone", "Miniserver / Tree / Air – na DIN lištu"),
    ],
  },
  {
    id: "taphome",
    manufacturer: "TapHome",
    label: "TapHome (Core + sběrnice)",
    system: "taphome",
    description: "Řídicí jednotka Core, tlačítka 2T / 4T / 6T a UI termostat; akční členy doplňte podle nabídky TapHome.",
    groups: [
      {
        id: "tap-buttons",
        label: "Tlačítka TapHome",
        products: [
          { id: "tap-2t", label: "TapHome tlačítko 2T", item: "bus-2" },
          { id: "tap-4t", label: "TapHome tlačítko 4T", item: "bus-4" },
          { id: "tap-6t", label: "TapHome tlačítko 6T", item: "bus-6" },
        ],
      },
      {
        id: "tap-room",
        label: "Termostat",
        products: [{ id: "tap-thermostat", label: "TapHome UI Termostat", item: "bus-room" }],
      },
      dinGroup("taphome", "Core jednotka"),
    ],
  },
];

const PRODUCTS = new Map(PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products.map((product) => [product.id, { ...product, family: family.id }] as const))));

/** Výrobek podle id (null = neznámý). */
export const productById = (id: string | null | undefined): (CatalogProduct & { family: string }) | null => (id ? (PRODUCTS.get(id) ?? null) : null);

export const familiesOf = (manufacturer: string) => PRODUCT_FAMILIES.filter((family) => family.manufacturer === manufacturer);

/** Výrobci chytré automatizace v liště (vedle výrobců domovních přístrojů). */
export const SMART_MANUFACTURERS = ["Loxone", "TapHome"] as const;
