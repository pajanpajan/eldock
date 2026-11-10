// Fáze 81: dotykové panely a displejové ovladače chytré domácnosti – ABB-free@home (IP TOUCH 7" / 10", SmartTouch 10",
// OneTouch 7", Touch 7" DP7-S, RoomTouch 4", Trevion 2,4"), Loxone (Wall Display 10", Touch Pure Display) a TapHome
// (Ovladač s displejem – multizónový, jednozónový, termostat). Barevné varianty nesou objednací číslo z katalogu výrobců
// (`prisma/external-catalog/catalog.json`); varianta bez záznamu má číslo null = ověřte u výrobce (nic se nevymýšlí).
// Montážní krabice a mezirámečky jdou do kusovníku domovní instalace (`panelBomRows`). Ověření čísel ze zadání proti
// katalogu: `docs/archiv/ZADANI-faze-81.md`. Čisté funkce.

import type { CatalogProduct } from "./smart-catalog";

/** Druh věrného vektorového náhledu panelu. */
export type PanelStyle = "ip-touch" | "smart-touch" | "one-touch" | "room-touch" | "trevion" | "wall-display" | "pure-display" | "tap-display";

export interface ProductVariant {
  id: string;
  label: string;
  /** Barva rámu / klapky v náhledu. */
  swatch: string;
  /** Objednací číslo varianty z katalogu výrobců; null = v katalogu není (ověřte u výrobce). */
  mpn: string | null;
  typeCode?: string;
  /** Trevion: provedení pro rámečkový systém 63 × 63 mm (řady Busch-Jaeger future linear, solo, solo carat, Busch-axcent). */
  mpn63?: string | null;
  typeCode63?: string;
}

export interface ProductBox {
  id: "flush" | "surface";
  label: string;
  /** Objednací číslo krabice podle varianty panelu (`*` = pro všechny barvy); chybí = ověřte u výrobce. */
  mpn: Readonly<Record<string, string>>;
  typeCode?: string;
}

/** Mezirámeček / adaptér do kusovníku podle zvolené designové řady (Trevion v řadě Zoni). */
export interface SeriesAdapter {
  series: string;
  label: string;
  mpn: Readonly<Record<string, string>>;
}

/** Řady s rámečkovým systémem 63 × 63 mm (Busch-Jaeger) – Trevion v provedení 63 × 63. */
export const SERIES_63 = new Set(["future linear", "solo", "solo carat", "Busch-axcent"]);

const BLACK = "#18181b";
const WHITE = "#f8fafc";
const ANTHRACITE = "#3f3f46";

type PanelProduct = CatalogProduct & { panel: PanelStyle };

/** ABB-free@home: velké panely do záložky „Panely, čidla a komunikace“. */
export const FAH_PANELS: PanelProduct[] = [
  {
    id: "fah-ip-touch-10",
    label: 'Dotykový panel ABB IP TOUCH 10"',
    item: "bus-display",
    noBus: true,
    note: "LAN / Wi-Fi – není na lince free@home",
    tab: "panels",
    kind: "panel",
    panel: "ip-touch",
    size: 10,
    wiring: "lan-ip",
    catalog: { manufacturer: "ABB", mpn: "2TMA130050W0054" },
    description: '10" kapacitní dotykový displej: domovní videotelefon ABB-Welcome IP a ovládání free@home (světla, žaluzie, scény, topení) z jednoho místa. Připojení LAN nebo Wi-Fi, montáž do zapuštěné instalační krabice.',
    variants: [
      { id: "white", label: "Bílá", swatch: WHITE, mpn: "2TMA130050W0054", typeCode: "H8237-4W" },
      { id: "black", label: "Černá", swatch: BLACK, mpn: "2TMA130050B0054", typeCode: "H8237-4B" },
      { id: "silver", label: "Stříbrná", swatch: "#cbd5e1", mpn: null },
      { id: "gold", label: "Zlatá", swatch: "#d4b16a", mpn: null },
    ],
    boxes: [
      { id: "flush", label: 'Instalační krabice, zapuštěná, pro IP TOUCH 7" a 10"', typeCode: "42361F", mpn: { "*": "2TMA130160B0132" } },
      { id: "surface", label: 'Instalační krabice, povrchová, pro 10" IP TOUCH', mpn: { white: "2TMA130161W0001", black: "2TMA130161B0001" } },
    ],
  },
  {
    id: "fah-ip-touch-7",
    label: 'Dotykový panel ABB IP TOUCH 7"',
    item: "bus-display",
    noBus: true,
    note: "LAN / Wi-Fi – není na lince free@home",
    tab: "panels",
    kind: "panel",
    panel: "ip-touch",
    size: 7,
    wiring: "lan-ip",
    catalog: { manufacturer: "ABB", mpn: "2TMA130050W0065" },
    description: '7" kapacitní dotykový displej: videotelefon ABB-Welcome IP s ovládáním free@home – dveře, světla, žaluzie a scény. Připojení LAN nebo Wi-Fi, zapuštěná instalační krabice pro 7" a 10" panely.',
    variants: [
      { id: "white", label: "Bílá", swatch: WHITE, mpn: "2TMA130050W0065", typeCode: "H8236-4W" },
      { id: "black", label: "Černá", swatch: BLACK, mpn: "2TMA130050B0065", typeCode: "H8236-4B" },
      { id: "silver", label: "Stříbrná", swatch: "#cbd5e1", mpn: null },
      { id: "gold", label: "Zlatá", swatch: "#d4b16a", mpn: null },
    ],
    boxes: [
      { id: "flush", label: 'Instalační krabice, zapuštěná, pro IP TOUCH 7" a 10"', typeCode: "42361F", mpn: { "*": "2TMA130160B0132" } },
      { id: "surface", label: 'Instalační krabice, povrchová, pro 7" IP TOUCH', mpn: { white: "2TMA130160W0017", black: "2TMA130160B0080" } },
    ],
  },
  {
    id: "fah-smarttouch-10",
    label: 'Dotykový panel ABB SmartTouch 10"',
    item: "bus-display",
    tab: "panels",
    kind: "panel",
    panel: "smart-touch",
    size: 10,
    wiring: "bus-fah",
    catalog: { manufacturer: "ABB", mpn: "2TMA310051W0001" },
    description: 'Prémiový 10" dotykový panel na sběrnici free@home: vizualizace celého domu, světla, žaluzie, scény, topení a časové programy. Krabice zapuštěná (SmartTouch 7" a 10") nebo povrchová.',
    variants: [
      { id: "white", label: "Bílá", swatch: WHITE, mpn: "2TMA310051W0001", typeCode: "ST/U10.1.1-811" },
      { id: "black", label: "Černá", swatch: BLACK, mpn: "2TMA310051B0001", typeCode: "ST/U10.1.1-825" },
    ],
    boxes: [
      { id: "flush", label: 'Zapuštěná krabice pro SmartTouch 7" a 10"', typeCode: "6136/07 UP-500", mpn: { "*": "2CKA006136A0212" } },
      { id: "surface", label: 'Povrchová krabice pro SmartTouch 10"', mpn: { white: "2TMA310161W0001", black: "2TMA310161B0001" } },
    ],
  },
  {
    id: "fah-onetouch-7",
    label: 'Dotykový panel ABB OneTouch 7"',
    item: "bus-display",
    noBus: true,
    note: "Wi-Fi (LAN přes adaptér 5249C) – není na lince free@home",
    tab: "panels",
    kind: "panel",
    panel: "one-touch",
    size: 7,
    wiring: "lan-ip",
    catalog: { manufacturer: "ABB", mpn: "2TMA320051W0001" },
    description: '7" dotykový panel free@home: domovní centrum se scénami, světly, žaluziemi, topením a hudbou. Wi-Fi, LAN přes adaptér 5249C (2TMA320161W0002); krabice zapuštěná nebo povrchová.',
    variants: [
      { id: "white", label: "Bílá", swatch: WHITE, mpn: "2TMA320051W0001", typeCode: "M2249-2W" },
      { id: "black", label: "Černá", swatch: BLACK, mpn: "2TMA320051B0001", typeCode: "M2249-2B" },
    ],
    boxes: [
      { id: "flush", label: 'Zapuštěná krabice pro OneTouch 7"', mpn: {} },
      { id: "surface", label: 'Povrchová krabice pro OneTouch 7"', mpn: {} },
    ],
  },
];

/** ABB-free@home: ovládání místnosti do záložky „Ovladače, tlačítka a termostaty“. */
export const FAH_ROOM_PANELS: PanelProduct[] = [
  {
    id: "fah-roomtouch-4",
    label: 'Dotykový panel ABB RoomTouch® 4"',
    item: "bus-display",
    tab: "controls",
    kind: "panel",
    panel: "room-touch",
    size: 4,
    wiring: "bus-fah",
    catalog: { manufacturer: "ABB", mpn: "2TMA310011W0001" },
    description: 'Kompaktní 4" HD dotykový panel pro ovládání místnosti – osvětlení, žaluzie, scény a vytápění. Montáž na šířku i na výšku, zapuštěně na sběrnici free@home.',
    variants: [
      { id: "black", label: "Černá / antracit", swatch: BLACK, mpn: "2TMA310011B0003", typeCode: "RT/U12.86.1-825" },
      { id: "white", label: "Bílá", swatch: WHITE, mpn: "2TMA310011W0001", typeCode: "RT/U12.86.1-811" },
    ],
  },
  {
    id: "fah-trevion",
    label: 'Dotykový panel ABB Trevion® 2,4"',
    item: "bus-room",
    tab: "controls",
    kind: "panel",
    panel: "trevion",
    size: 2.4,
    frame: "series",
    wiring: "bus-fah",
    catalog: { manufacturer: "ABB", mpn: "2TMA310011B0001" },
    description: '2,4" barevný kapacitní displej 55 × 55 mm s akustickou odezvou a teplotním čidlem pod rámeček řady Zoni, Levit, Time, solo či future linear (63 × 63 mm). V řadě Zoni se do kusovníku přidá mezirámeček.',
    variants: [
      { id: "black", label: "Černá", swatch: BLACK, mpn: "2TMA310011B0001", typeCode: "SD/U12.55.1-825", mpn63: "2TMA310011B0002", typeCode63: "SD/U12.63.1-825" },
      { id: "white", label: "Bílá", swatch: WHITE, mpn: null, mpn63: null },
    ],
    adapters: [{ series: "Zoni", label: "Mezirámeček pro Zoni® (55 × 55 mm)", mpn: { white: "2CHT010011B4500", black: "2CHT010011B4509" } }],
  },
];

/** Loxone: Wall Display 10" (panely) a Touch Pure Display (ovládání). */
export const LOXONE_PANELS: PanelProduct[] = [
  {
    id: "lox-wall-display-10",
    label: 'Loxone Wall Display 10"',
    item: "bus-display",
    noBus: true,
    note: "LAN a napájení 24 V DC zvlášť – ne na větev Tree",
    tab: "panels",
    kind: "panel",
    panel: "wall-display",
    size: 10,
    wiring: "lan-ip",
    catalog: { manufacturer: "LOXONE", mpn: "100891" },
    description: '10" nástěnný dotykový displej s Ambientním režimem (Config & App 17.2): vizualizace domu, interkom, audio a správa místností. Napájení 24 V DC, připojení LAN.',
    variants: [
      { id: "anthracite", label: "Antracit", swatch: "#27272a", mpn: "100891", typeCode: 'Wall Display 10"' },
      { id: "white", label: "Bílá", swatch: WHITE, mpn: null },
    ],
  },
  {
    id: "lox-touch-pure-display",
    label: "Loxone Touch Pure Display",
    item: "bus-room",
    tab: "controls",
    kind: "panel",
    panel: "pure-display",
    wiring: "tree",
    description: "Kompaktní nástěnný ovladač s displejem hodin, horní lištou stavu světla, teploty, audia a žaluzií, dotykovou plochou a čidlem teploty a vlhkosti. Sběrnice Loxone Tree (provedení Air bezdrátově).",
    variants: [
      { id: "anthracite", label: "Antracit", swatch: "#27272a", mpn: null },
      { id: "white", label: "Bílá", swatch: WHITE, mpn: null },
    ],
  },
];

const TAP_COLORS: ProductVariant[] = [
  { id: "white", label: "Bílá", swatch: WHITE, mpn: null },
  { id: "anthracite", label: "Antracit", swatch: ANTHRACITE, mpn: null },
  { id: "black", label: "Černá", swatch: BLACK, mpn: null },
  { id: "beige", label: "Béžová", swatch: "#d6c7ad", mpn: null },
];

const tapDisplay = (id: string, label: string, item: string, keys: string[], description: string, favorite = false): PanelProduct => ({
  id,
  label: `TapHome Ovladač s displejem – ${label}`,
  item,
  tab: "controls",
  kind: "panel",
  panel: "tap-display",
  keys,
  ...(favorite ? { favorite: true } : {}),
  wiring: "bus-taphome",
  description,
  variants: TAP_COLORS,
});

/** TapHome: Ovladač s displejem ve třech funkčních variantách, každá ve 4 barvách (tmavý displej, barevný pruh tlačítek). */
export const TAPHOME_PANELS: PanelProduct[] = [
  tapDisplay("tap-display-multi", "Multizónový ovladač", "bus-display", ["∧", "≡", "∨"], "Až 10 zón nebo funkcí v jednom displeji – střední tlačítko ≡ přepíná teplotu, světla a žaluzie, ∧ / ∨ mění hodnotu. Snímač teploty, vlhkosti a přiblížení s automatickým jasem, stmívatelné noční světlo z boků.", true),
  tapDisplay("tap-display-single", "Jednozónový ovladač", "bus-2", ["∧", "∨"], "Jedna funkce podle výběru – ideální pro žaluzie nebo světlo (∧ / ∨). Displej s teplotou, vlhkostí a časem, snímač přiblížení s automatickým jasem a stmívatelné noční světlo z boků."),
  tapDisplay("tap-display-thermo", "Termostat", "bus-room", ["+", "−"], "Prostorový termostat s displejem – žádaná teplota tlačítky + / −, měření teploty a vlhkosti, snímač přiblížení s automatickým jasem a stmívatelné noční světlo z boků."),
];

/** Varianta výrobku (bez volby = první). */
export function variantOf(product: Pick<CatalogProduct, "variants">, id: string | null | undefined): ProductVariant | null {
  const variants = product.variants ?? [];
  return variants.find((variant) => variant.id === id) ?? variants[0] ?? null;
}

/** Krabice výrobku (bez volby = první, tj. zapuštěná). */
export function boxOf(product: Pick<CatalogProduct, "boxes">, id: string | null | undefined) {
  const boxes = product.boxes ?? [];
  return boxes.find((box) => box.id === id) ?? boxes[0] ?? null;
}

const uses63 = (seriesName: string | null | undefined) => Boolean(seriesName && SERIES_63.has(seriesName));

/**
 * Výrobek ve zvolené variantě (technický list, karta): objednací číslo a typ varianty; varianta bez čísla nemá
 * odkaz na technické údaje (údaje jiné barvy se nepřebírají).
 */
export function withVariant<T extends CatalogProduct>(product: T, variantId: string | null | undefined, seriesName?: string | null): T {
  const variant = variantOf(product, variantId);
  if (!variant) return product;
  const mpn = uses63(seriesName) && variant.mpn63 !== undefined ? variant.mpn63 : variant.mpn;
  const typeCode = uses63(seriesName) && variant.typeCode63 ? variant.typeCode63 : variant.typeCode;
  const maker = product.catalog?.manufacturer;
  return {
    ...product,
    selectedVariant: variant.id,
    articleNumber: mpn,
    verified: Boolean(mpn),
    ...(typeCode ? { typeCode } : {}),
    catalog: mpn && maker ? { manufacturer: maker, mpn } : undefined,
  };
}

export interface PanelBomRow {
  part: "device" | "box" | "adapter";
  mpn: string | null;
  verified: boolean;
  name: string;
}

/** Kusovník panelu: přístroj ve zvolené barvě, montážní krabice (zapuštěná / povrchová) a mezirámeček podle řady. */
export function panelBomRows(product: CatalogProduct, choice: { variant?: string | null; box?: string | null; seriesName?: string | null } = {}): PanelBomRow[] {
  const variant = variantOf(product, choice.variant);
  const chosen = withVariant(product, variant?.id, choice.seriesName);
  const rows: PanelBomRow[] = [
    { part: "device", mpn: chosen.articleNumber ?? null, verified: Boolean(chosen.articleNumber), name: `${product.label}${variant ? ` – ${variant.label}` : ""}${chosen.typeCode ? ` (${chosen.typeCode})` : ""}` },
  ];
  const box = boxOf(product, choice.box);
  if (box) {
    const mpn = (variant && box.mpn[variant.id]) ?? box.mpn["*"] ?? null;
    rows.push({ part: "box", mpn, verified: Boolean(mpn), name: `${box.label}${box.typeCode ? ` (${box.typeCode})` : ""}` });
  }
  for (const adapter of product.adapters ?? []) {
    if (adapter.series !== choice.seriesName) continue;
    const mpn = (variant && adapter.mpn[variant.id]) ?? null;
    rows.push({ part: "adapter", mpn, verified: Boolean(mpn), name: `${adapter.label}${variant ? ` – ${variant.label.toLowerCase()}` : ""}` });
  }
  return rows;
}

/** Odkazy variant na katalog výrobců (výtah technických údajů `npm run catalog:smart-specs`). */
export const variantCatalogLinks = (product: Pick<CatalogProduct, "catalog" | "variants">) =>
  product.catalog
    ? (product.variants ?? []).flatMap((variant) => [variant.mpn, variant.mpn63].filter((mpn): mpn is string => Boolean(mpn)).map((mpn) => ({ manufacturer: product.catalog!.manufacturer, mpn })))
    : [];
