// Designové řady domovních přístrojů ABB podle „Katalog: Domovní elektroinstalační materiál 2026“ (ABB s.r.o.,
// Elektro-Praga, únor 2026; fáze 55, ověřeno proti vydání 2026 ve fázi 61): 14 řad pro zapuštěnou montáž (Classic,
// Swing, Swing L, Zoni, Tango, Levit, Levit M, Time, Time Arbo, Decento, future linear, solo, solo carat, Busch-axcent)
// + 3 nástěnné řady IP44 / IP54. Řada Element ve vydání 2026 už není. Každá řada má písmeno řady v objednacím čísle,
// tvar a materiál pro 2D náhled a skutečné barvy s kódem barvy (přípona objednacího čísla krytu / rámečku, např.
// „3559T-A00651 500“); u řad Busch-Jaeger (future linear, solo, Busch-axcent) má každá barva vlastní objednací číslo
// rámečku. Odstíny `swatch` / `frame` / `insert` jsou jen orientační barvy náhledu v aplikaci, ne katalogový údaj.
// Fáze 90 (zadání uživatele podle katalogu 2026): Garant IP44 (str. 498, zaoblený) jen bílá a šedá / antracitová,
// Praktik IP44 (str. 502, hranatý) bílá a šedá, Variant+ IP54 (str. 506, průmyslový) šedá / tmavě šedá a bílá / šedá –
// nástěnné monobloky bez samostatného rámečku (`monoblock`); Decento (str. 142) kulaté porcelánové přístroje, každá
// barva je pevná dvojice porcelánového středu a porcelánového / dřevěného rámečku (`fixedPairs`).
// Fáze 91 (audit proti katalogu 2026): kryty řad future linear, solo, solo carat a Busch-axcent jsou ze společné kapitoly
// (str. 170 – studio bílá 84, mechová bílá 884, antracitová 81, mechová černá 885, hliníková stříbrná 83, ušlechtilá ocel
// 866); Busch-axcent a solo carat mají rámeček zvlášť (`frames`): Busch-axcent 8 materiálů 1R–5R (str. 166), solo carat
// bílé sklo / ušlechtilá ocel / černé sklo jen 1R–4R (str. 161). future linear mechová černá i 5R (str. 152). Decento má jen
// bílou, bílou / přírodní buk (50), bílou / třešeň (52) a černou (N) – kompletní přístroje s kulatým rámečkem bez
// vícenásobných rámečků (str. 145–147, 548; „černý dub“ z fáze 90 katalog nevede).

export type SeriesShape = "thin" | "rounded" | "layered" | "metal" | "wood" | "square" | "soft" | "classic" | "porcelain" | "flat" | "solo" | "thick" | "surface";

/** Povrch pro náhled (lesk, kov, dřevo, sklo, kámen, porcelán, papír, softtouch). */
export type SeriesMaterial = "matte" | "gloss" | "metal" | "wood" | "glass" | "stone" | "porcelain" | "paper" | "softtouch";

/** Fáze 91: textura náhledu skutečného materiálu rámečku (beton, břidlice, lisovaný papír). */
export type SeriesTexture = "concrete" | "slate" | "paper";

export interface SeriesColor {
  /** Jednoznačné id barvy v půdorysu („abb-zoni-500“). */
  id: string;
  label: string;
  /** Kód barvy z katalogu (přípona objednacího čísla), pokud ho katalog uvádí. */
  code: string | null;
  swatch: string;
  /** Skupina `wd_color_family` katalogu domovních přístrojů (výběr přístrojů z databáze). */
  family: string;
  /** Fáze 61: dvoubarevné provedení – barva rámečku a krytu / klapky pro náhled (bez nich obojí `swatch`). */
  frame?: string;
  insert?: string;
  material?: SeriesMaterial;
  /** Objednací čísla rámečků 1R–5R (řady Busch-Jaeger mají číslo pro každou barvu); null = rámeček v té barvě neexistuje. */
  frameMpn?: (string | null)[];
  /** Fáze 91: textura materiálu rámečku pro náhled. */
  texture?: SeriesTexture;
}

export interface AbbSeries {
  name: string;
  /** Písmeno řady v objednacím čísle (T = Zoni, A = Tango, H = Levit …). */
  letter: string | null;
  shape: SeriesShape;
  mount: "flush" | "surface";
  ip?: string;
  dbSeries: string[];
  colors: SeriesColor[];
  /** Fáze 61: krátký popis řady z katalogu 2026 (podtitul kapitoly) a strana katalogu. */
  tagline?: string;
  page?: number;
  /** Fáze 90: nástěnný (krabicový) monoblokový přístroj – bez samostatného podomítkového rámečku a víceramečku. */
  monoblock?: boolean;
  /** Fáze 90: barvy jsou pevné dvojice středu a rámečku (Decento) – barva rámečku se nevolí zvlášť. */
  fixedPairs?: boolean;
  /**
   * Fáze 91: samostatná paleta rámečků (Busch-axcent, solo carat) – `colors` jsou pak jen kryty (klapka, zásuvka) a rámeček
   * se volí z `frames`; `framePairs` = výchozí rámeček ke krytu (kombinace vyfocené v katalogu).
   */
  frames?: SeriesColor[];
  framePairs?: Record<string, string>;
}

const slug = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** `idSlug` = stálé id barvy po přejmenování (uložené nákresy si barvu ponechají). */
const color = (series: string, label: string, code: string | null, swatch: string, family: string, { idSlug, ...look }: Pick<SeriesColor, "frame" | "insert" | "material" | "frameMpn"> & { idSlug?: string } = {}): SeriesColor => ({
  id: `abb-${series}-${idSlug ?? slug(code ?? label)}`,
  label: code ? `${label} (${code})` : label,
  code,
  swatch,
  family,
  ...look,
});

const W = "#f8fafc";
const IVORY = "#efe3c8";
const BLACK = "#27272a";
const GREY = "#9ca3af";
const SMOKE = "#1f1f23";
const STUDIO = "#f4f4f2";
const MOSS_W = "#ecebe6";
const MOSS_B = "#2a2a2c";
const ANTHRACITE = "#3f3f46";
/** Objednací čísla rámečků 1R–5R jdoucí po sobě (2CKA001754A4235 … A4239). */
const range = (from: number) => [0, 1, 2, 3, 4].map((offset) => `2CKA001754A${from + offset}`);

/**
 * Fáze 91: kryty společné kapitoly future linear / solo / solo carat / Busch-axcent (Katalog ABB 2026, str. 170) – kód barvy
 * je přípona objednacího čísla krytu (kryt jednoduchý 3559B-A00651 + 84 = studio bílá).
 */
const bjCovers = (series: string): SeriesColor[] => [
  color(series, "Studio bílá", "84", STUDIO, "white"),
  color(series, "Mechová bílá", "884", MOSS_W, "white", { material: "softtouch" }),
  color(series, "Antracitová", "81", ANTHRACITE, "anthracite"),
  color(series, "Mechová černá", "885", MOSS_B, "black", { material: "softtouch" }),
  color(series, "Hliníková stříbrná", "83", "#cbd5e1", "aluminium", { material: "metal" }),
  color(series, "Ušlechtilá ocel", "866", "#c7cbd1", "steel", { material: "metal" }),
];

/** Fáze 91: rámeček ze samostatné palety (Busch-Jaeger) – objednací čísla 1R–NR jdou po sobě, výš rámeček neexistuje. */
const bjFrame = (series: string, label: string, swatch: string, family: string, material: SeriesMaterial, from: number, gangs = 5, texture?: SeriesTexture): SeriesColor => ({
  id: `abb-${series}-ramecek-${slug(label)}`,
  label,
  code: null,
  swatch,
  family,
  frame: swatch,
  material,
  frameMpn: [0, 1, 2, 3, 4].map((offset) => (offset < gangs ? `2CKA001754A${from + offset}` : null)),
  ...(texture ? { texture } : {}),
});

export const ABB_SERIES_2026: AbbSeries[] = [
  {
    name: "Zoni", letter: "T", shape: "thin", mount: "flush", dbSeries: ["Zoni"], tagline: "Vypínač nové generace", page: 72,
    colors: [
      color("zoni", "Bílá", "500", W, "white", { material: "gloss" }), color("zoni", "Matná bílá", "240", "#f1f5f9", "white", { material: "matte" }), color("zoni", "Šedá / bílá", "241/141", "#a8a29e", "grey", { frame: "#a8a29e", insert: W, material: "matte" }),
      color("zoni", "Pudrová / bílá", "242/142", "#e7c9c0", "ivory", { frame: "#e7c9c0", insert: W, material: "matte" }), color("zoni", "Olivová / bílá", "243/143", "#9ca37a", "grey", { frame: "#9ca37a", insert: W, material: "matte" }), color("zoni", "Greige / bílá", "244/144", "#c4b8a8", "ivory", { frame: "#c4b8a8", insert: W, material: "matte" }),
      color("zoni", "Matná černá", "237", BLACK, "black", { material: "matte" }), color("zoni", "Matná černá / bílá", "137", "#3f3f46", "black", { frame: BLACK, insert: W, material: "matte" }),
    ],
  },
  {
    name: "Tango", letter: "A", shape: "rounded", mount: "flush", dbSeries: ["Tango"], tagline: "Baví celou rodinu", page: 84,
    colors: [
      color("tango", "Bílá", "B", W, "white"), color("tango", "Slonová kost", "C", IVORY, "ivory"), color("tango", "Šedá", "S", GREY, "grey"), color("tango", "Béžová", "D", "#d6c3a1", "beige"),
      color("tango", "Hnědá", "H", "#7c4a2d", "brown"), color("tango", "Černá", "N", BLACK, "black"), color("tango", "Kouřová šedá", "S2", "#6b7280", "grey"), color("tango", "Vřesová červená", "R2", "#9f1239", "brown"),
    ],
  },
  {
    name: "Levit", letter: "H", shape: "layered", mount: "flush", dbSeries: ["Levit"], tagline: "Pestrý design pro pestrý život", page: 100,
    colors: [
      color("levit", "Bílá / ledová bílá", "01", W, "white", { frame: W, insert: "#eef6fb" }), color("levit", "Bílá / bílá", "03", "#ffffff", "white"), color("levit", "Šedá / bílá", "16", GREY, "grey", { frame: GREY, insert: W }),
      color("levit", "Slonová kost / bílá", "17", IVORY, "ivory", { frame: IVORY, insert: W }), color("levit", "Macchiato / bílá", "18", "#b08968", "beige", { frame: "#b08968", insert: W }), color("levit", "Bílá / kouřová černá", "62", "#e5e7eb", "black", { frame: W, insert: SMOKE, material: "gloss" }),
      color("levit", "Žlutá / kouřová černá", "64", "#eab308", "black", { frame: "#eab308", insert: SMOKE, material: "gloss" }), color("levit", "Červená / kouřová černá", "65", "#dc2626", "black", { frame: "#dc2626", insert: SMOKE, material: "gloss" }),
      color("levit", "Oranžová / kouřová černá", "66", "#f97316", "black", { frame: "#f97316", insert: SMOKE, material: "gloss" }), color("levit", "Zelená / kouřová černá", "67", "#16a34a", "black", { frame: "#16a34a", insert: SMOKE, material: "gloss" }),
    ],
  },
  {
    name: "Levit M", letter: "H", shape: "layered", mount: "flush", dbSeries: ["Levit M", "Levit"], tagline: "Hravý, mocný, výjimečný", page: 102,
    colors: [
      color("levit-m", "Onyx / kouřová černá", "63", "#18181b", "black", { frame: "#111114", insert: SMOKE, material: "glass" }), color("levit-m", "Perleťová / ledová bílá", "68", "#f5f5f4", "white", { frame: "#f5f3ee", insert: "#eef6fb", material: "gloss" }),
      color("levit-m", "Ocelová / kouřová černá", "69", "#94a3b8", "steel", { frame: "#94a3b8", insert: SMOKE, material: "metal" }), color("levit-m", "Titanová / kouřová černá", "70", "#71717a", "titanium", { frame: "#71717a", insert: SMOKE, material: "metal" }),
    ],
  },
  {
    name: "Time", letter: "E/F", shape: "metal", mount: "flush", dbSeries: ["Time", "Element/Time"], tagline: "Metalický, tvarově přímý a spolehlivý", page: 124,
    colors: [
      color("time", "Bílá / ledová bílá", "01", W, "white", { frame: W, insert: "#eef6fb" }), color("time", "Bílá / bílá", "03", "#ffffff", "white"), color("time", "Titanová", "08", "#71717a", "titanium", { material: "metal" }),
      color("time", "Starostříbrná", "32", "#a8a29e", "silver", { material: "metal" }), color("time", "Šampaňská", "33", "#d6c7a1", "beige", { material: "metal" }), color("time", "Antracitová", "34", ANTHRACITE, "anthracite", { material: "metal" }), color("time", "Ocelová", "36", "#94a3b8", "steel", { material: "metal" }),
    ],
  },
  {
    name: "Time Arbo", letter: "E/F", shape: "wood", mount: "flush", dbSeries: ["Time Arbo", "Time"], tagline: "Kousek přírody doma", page: 126,
    colors: [
      color("time-arbo", "Starostříbrná / přírodní javor", null, "#e7d3a8", "wood", { frame: "#e7d3a8", insert: "#a8a29e", material: "wood" }), color("time-arbo", "Starostříbrná / olše", null, "#c98b5a", "wood", { frame: "#c98b5a", insert: "#a8a29e", material: "wood" }),
      color("time-arbo", "Starostříbrná / třešeň", null, "#a0522d", "wood", { frame: "#a0522d", insert: "#a8a29e", material: "wood" }), color("time-arbo", "Titanová / třešeň", null, "#8b4513", "wood", { frame: "#8b4513", insert: "#71717a", material: "wood" }),
      color("time-arbo", "Antracitová / mahagon", null, "#6b2f1a", "wood", { frame: "#6b2f1a", insert: ANTHRACITE, material: "wood" }), color("time-arbo", "Antracitová / wenge", null, "#3b2416", "wood", { frame: "#3b2416", insert: ANTHRACITE, material: "wood" }),
    ],
  },
  {
    name: "Swing", letter: "G", shape: "soft", mount: "flush", dbSeries: ["Swing"], tagline: "Když potřebujete rozsvítit a zhasnout", page: 58,
    colors: [color("swing", "Jasně bílá", "B1", W, "white"), color("swing", "Krémová", "C1", IVORY, "ivory"), color("swing", "Béžová", "D1", "#d6c3a1", "beige"), color("swing", "Světle šedá", "S1", "#cbd5e1", "grey"), color("swing", "Hnědá", "H1", "#7c4a2d", "brown")],
  },
  {
    name: "Swing L", letter: "G/J", shape: "soft", mount: "flush", dbSeries: ["Swing L"], tagline: "Ladný a praktický design", page: 60,
    colors: [
      color("swing-l", "Jasně bílá / jasně bílá", "B1", W, "white"), color("swing-l", "Jasně bílá / krémová", "C1", IVORY, "ivory", { frame: IVORY, insert: W }), color("swing-l", "Jasně bílá / mocca", "C3", "#7f5539", "brown", { frame: "#7f5539", insert: W }),
      color("swing-l", "Jasně bílá / světle šedá", "S1", "#cbd5e1", "grey", { frame: "#cbd5e1", insert: W }), color("swing-l", "Jasně bílá / cihlová", "R3", "#b45309", "brown", { frame: "#b45309", insert: W }),
    ],
  },
  {
    name: "Classic", letter: "3553", shape: "classic", mount: "flush", dbSeries: ["Classic"], tagline: "Na počátku byl Classic", page: 50,
    colors: [color("classic", "Jasně bílá", "B1", W, "white"), color("classic", "Béžová", "D2", "#d6c3a1", "beige"), color("classic", "Hnědá", "H3", "#7c4a2d", "brown")],
  },
  {
    name: "Decento", letter: "K", shape: "porcelain", mount: "flush", dbSeries: ["Decento"], tagline: "Porcelánový originál", page: 142, fixedPairs: true,
    colors: [
      color("decento", "Bílá (porcelán)", null, W, "white", { material: "porcelain" }), color("decento", "Bílá / přírodní buk", "50", "#d4a373", "wood", { frame: "#d4a373", insert: W, material: "wood" }),
      color("decento", "Bílá / třešeň", "52", "#a0522d", "wood", { frame: "#a0522d", insert: W, material: "wood" }), color("decento", "Černá (porcelán)", "N", BLACK, "black", { material: "porcelain" }),
    ],
  },
  {
    name: "future linear", letter: null, shape: "flat", mount: "flush", dbSeries: ["Future Linear", "future linear"], tagline: "Nadčasovost je budoucnost", page: 150,
    colors: [
      color("future", "Studio bílá", "84", STUDIO, "white", { frameMpn: range(4235), idSlug: "studio-bila" }), color("future", "Hliníková stříbrná", "83", "#cbd5e1", "aluminium", { idSlug: "hlinikova-stribrna", material: "metal", frameMpn: [4301, 4302, 4308, 4309, 4310].map((n) => `2CKA001754A${n}`) }),
      color("future", "Antracitová", "81", ANTHRACITE, "anthracite", { frameMpn: range(4240), idSlug: "antracitova" }), color("future", "Ušlechtilá ocel", "866", "#c7cbd1", "steel", { material: "metal", frameMpn: range(4317), idSlug: "uslechtila-ocel" }),
      color("future", "Mechová bílá", "884", MOSS_W, "white", { material: "softtouch", frameMpn: range(4414), idSlug: "mechova-bila" }), color("future", "Mechová černá", "885", MOSS_B, "black", { material: "softtouch", frameMpn: range(4419), idSlug: "mechova-cerna" }),
    ],
  },
  {
    name: "solo", letter: null, shape: "solo", mount: "flush", dbSeries: ["Solo", "solo"], tagline: "Dokonalá harmonie a styl", page: 156,
    colors: [
      color("solo", "Studio bílá / chromová", "84", STUDIO, "white", { idSlug: "studio-bila-chromova", frame: "#e2e8f0", insert: STUDIO, material: "metal", frameMpn: range(4104) }), color("solo", "Antracitová / chromová", "81", ANTHRACITE, "anthracite", { idSlug: "antracitova-chromova", frame: "#e2e8f0", insert: ANTHRACITE, material: "metal", frameMpn: range(4104) }),
      color("solo", "Studio bílá / studio bílá", "84", STUDIO, "white", { idSlug: "studio-bila-studio-bila", frameMpn: range(4109) }), color("solo", "Antracitová / chromová lesklá", "81", "#52525b", "anthracite", { idSlug: "antracitova-chromova-leskla", frame: "#f1f5f9", insert: ANTHRACITE, material: "gloss", frameMpn: range(4326) }),
    ],
  },
  {
    name: "solo carat", letter: null, shape: "solo", mount: "flush", dbSeries: ["solo carat"], tagline: "Ušlechtilý charakter", page: 158,
    // Fáze 91: kryty společné kapitoly (str. 170), rámeček zvlášť – bílé sklo, ušlechtilá ocel, černé sklo jen 1R–4R (str. 161)
    colors: bjCovers("solo-carat"),
    frames: [
      bjFrame("solo-carat", "Bílé sklo", "#f8fafc", "white", "glass", 4442, 4),
      bjFrame("solo-carat", "Ušlechtilá ocel", "#c7cbd1", "steel", "metal", 4254, 4),
      bjFrame("solo-carat", "Černé sklo", "#111114", "black", "glass", 4322, 4),
    ],
    framePairs: {
      "abb-solo-carat-84": "abb-solo-carat-ramecek-bile-sklo", "abb-solo-carat-884": "abb-solo-carat-ramecek-bile-sklo",
      "abb-solo-carat-81": "abb-solo-carat-ramecek-cerne-sklo", "abb-solo-carat-885": "abb-solo-carat-ramecek-cerne-sklo",
      "abb-solo-carat-83": "abb-solo-carat-ramecek-uslechtila-ocel", "abb-solo-carat-866": "abb-solo-carat-ramecek-uslechtila-ocel",
    },
  },
  {
    name: "Busch-axcent", letter: null, shape: "thick", mount: "flush", dbSeries: ["Busch-axcent"], tagline: "Důraz na jedinečnost", page: 164,
    // Fáze 91: kryt (klapka, zásuvka) ze společné kapitoly (str. 170) zůstává při změně rámečku stejný; rámeček zvlášť z 8
    // skutečných materiálů, každý 1R–5R pro vodorovnou i svislou montáž (str. 166)
    colors: bjCovers("axcent"),
    frames: [
      bjFrame("axcent", "Bílé sklo", "#f8fafc", "white", "glass", 4437),
      bjFrame("axcent", "Černé sklo", "#111114", "black", "glass", 4800),
      bjFrame("axcent", "Titanová", "#71717a", "titanium", "metal", 4693),
      bjFrame("axcent", "Platinová", "#d4d4d8", "silver", "metal", 4683),
      bjFrame("axcent", "Matná černá", "#18181b", "black", "matte", 4703),
      bjFrame("axcent", "Beton", "#a8a29e", "grey", "stone", 4795, 5, "concrete"),
      bjFrame("axcent", "Hnědý papír", "#8b6b4a", "brown", "paper", 4790, 5, "paper"),
      bjFrame("axcent", "Břidlice", "#475569", "anthracite", "stone", 4805, 5, "slate"),
    ],
    // Kombinace vyfocené v katalogu (str. 165) – výchozí rámeček ke krytu
    framePairs: {
      "abb-axcent-84": "abb-axcent-ramecek-bile-sklo", "abb-axcent-884": "abb-axcent-ramecek-cerne-sklo",
      "abb-axcent-81": "abb-axcent-ramecek-platinova", "abb-axcent-885": "abb-axcent-ramecek-matna-cerna",
      "abb-axcent-83": "abb-axcent-ramecek-titanova", "abb-axcent-866": "abb-axcent-ramecek-platinova",
    },
  },
  // Fáze 90: nástěnné monoblokové přístroje do vlhka a průmyslu – kompletní přístroj v jedné barvě nebo dvoubarevné
  // kombinaci, bez samostatného rámečku, zásuvka s odklápěcím víčkem; Garant zaoblený, Praktik hranatý, Variant+ robustní
  {
    name: "Garant (IP44)", letter: null, shape: "surface", mount: "surface", ip: "IP44", dbSeries: ["Garant"], tagline: "Do vlhka a venku", page: 498, monoblock: true,
    colors: [color("garant", "Bílá", null, W, "white"), color("garant", "Šedá / antracitová", null, "#6b7280", "grey", { frame: "#9ca3af", insert: ANTHRACITE, idSlug: "seda" })],
  },
  {
    name: "Variant+ (IP54)", letter: null, shape: "surface", mount: "surface", ip: "IP54", dbSeries: ["Variant+"], tagline: "Variabilní, odolný, moderní", page: 506, monoblock: true,
    colors: [
      color("variant-plus", "Šedá / tmavě šedá (2-barevná IP54)", null, "#6b7280", "grey", { frame: "#9ca3af", insert: "#4b5563", idSlug: "seda" }),
      color("variant-plus", "Bílá / šedá (IP54)", null, W, "white", { frame: W, insert: GREY, idSlug: "bila" }),
    ],
  },
  {
    name: "Praktik (IP44)", letter: null, shape: "surface", mount: "surface", ip: "IP44", dbSeries: ["Praktik"], tagline: "Velmi rozšířená řada pro vrchní montáž", page: 502, monoblock: true,
    colors: [color("praktik", "Bílá", null, W, "white"), color("praktik", "Šedá", null, GREY, "grey")],
  },
];

/** Starší klíče řad (nákresy uložené před aktualizací na katalog 2026). */
export const SERIES_ALIASES: Record<string, string[]> = {
  solo: ["solo / solo carat", "Solo"],
  "future linear": ["Future Linear"],
  Swing: ["Swing / Swing L"],
  // Řada Element ve vydání 2026 skončila – uložené nákresy přejdou na nejbližší kovovou řadu Time (stejné písmeno E/F)
  Time: ["Element"],
};

/**
 * Fáze 91: barvy Busch-axcent a solo carat uložené před fází 91 (dvojice kryt / rámeček v jednom id) → kryt a rámeček
 * ze samostatných palet; Decento „bílá / černý dub“ → nejbližší dřevěný rámeček z katalogu (přírodní buk).
 */
export const LEGACY_SERIES_COLORS: Record<string, { color: string; frame?: string }> = {
  "abb-axcent-studio-bila-bile-sklo": { color: "abb-axcent-84", frame: "abb-axcent-ramecek-bile-sklo" },
  "abb-axcent-mechova-bila-cerne-sklo": { color: "abb-axcent-884", frame: "abb-axcent-ramecek-cerne-sklo" },
  "abb-axcent-mechova-bila-titanova": { color: "abb-axcent-884", frame: "abb-axcent-ramecek-titanova" },
  "abb-axcent-antracitova-platinova": { color: "abb-axcent-81", frame: "abb-axcent-ramecek-platinova" },
  "abb-axcent-mechova-cerna-beton": { color: "abb-axcent-885", frame: "abb-axcent-ramecek-beton" },
  "abb-axcent-mechova-cerna-hnedy-papir": { color: "abb-axcent-885", frame: "abb-axcent-ramecek-hnedy-papir" },
  "abb-axcent-mechova-cerna-bridlice": { color: "abb-axcent-885", frame: "abb-axcent-ramecek-bridlice" },
  "abb-axcent-mechova-cerna-matna-cerna": { color: "abb-axcent-885", frame: "abb-axcent-ramecek-matna-cerna" },
  "abb-solo-carat-bile-sklo": { color: "abb-solo-carat-84", frame: "abb-solo-carat-ramecek-bile-sklo" },
  "abb-solo-carat-uslechtila-ocel": { color: "abb-solo-carat-866", frame: "abb-solo-carat-ramecek-uslechtila-ocel" },
  "abb-solo-carat-cerne-sklo": { color: "abb-solo-carat-81", frame: "abb-solo-carat-ramecek-cerne-sklo" },
  "abb-decento-bila-cerny-dub": { color: "abb-decento-50" },
};
