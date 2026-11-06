// Designové řady domovních přístrojů ABB podle „Katalog: Domovní elektroinstalační materiál 2026“ (ABB s.r.o.,
// Elektro-Praga, únor 2026; fáze 55, ověřeno proti vydání 2026 ve fázi 61): 14 řad pro zapuštěnou montáž (Classic,
// Swing, Swing L, Zoni, Tango, Levit, Levit M, Time, Time Arbo, Decento, future linear, solo, solo carat, Busch-axcent)
// + 3 nástěnné řady IP44 / IP54. Řada Element ve vydání 2026 už není. Každá řada má písmeno řady v objednacím čísle,
// tvar a materiál pro 2D náhled a skutečné barvy s kódem barvy (přípona objednacího čísla krytu / rámečku, např.
// „3559T-A00651 500“); u řad Busch-Jaeger (future linear, solo, Busch-axcent) má každá barva vlastní objednací číslo
// rámečku. Odstíny `swatch` / `frame` / `insert` jsou jen orientační barvy náhledu v aplikaci, ne katalogový údaj.

export type SeriesShape = "thin" | "rounded" | "layered" | "metal" | "wood" | "square" | "soft" | "classic" | "porcelain" | "flat" | "solo" | "thick" | "surface";

/** Povrch pro náhled (lesk, kov, dřevo, sklo, kámen, porcelán, papír, softtouch). */
export type SeriesMaterial = "matte" | "gloss" | "metal" | "wood" | "glass" | "stone" | "porcelain" | "paper" | "softtouch";

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
  /** Objednací čísla rámečků 1R–5R (řady Busch-Jaeger mají číslo pro každou barvu). */
  frameMpn?: (string | null)[];
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
}

const slug = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const color = (series: string, label: string, code: string | null, swatch: string, family: string, look: Pick<SeriesColor, "frame" | "insert" | "material" | "frameMpn"> = {}): SeriesColor => ({
  id: `abb-${series}-${slug(code ?? label)}`,
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
    name: "Decento", letter: "K", shape: "porcelain", mount: "flush", dbSeries: ["Decento"], tagline: "Porcelánový originál", page: 142,
    colors: [
      color("decento", "Bílá (porcelán)", null, W, "white", { material: "porcelain" }), color("decento", "Bílá / přírodní buk", "50", "#d4a373", "wood", { frame: "#d4a373", insert: W, material: "wood" }),
      color("decento", "Bílá / třešeň", "52", "#a0522d", "wood", { frame: "#a0522d", insert: W, material: "wood" }), color("decento", "Černá (porcelán)", "N", BLACK, "black", { material: "porcelain" }),
    ],
  },
  {
    name: "future linear", letter: null, shape: "flat", mount: "flush", dbSeries: ["Future Linear", "future linear"], tagline: "Nadčasovost je budoucnost", page: 150,
    colors: [
      color("future", "Studio bílá", null, STUDIO, "white", { frameMpn: range(4235) }), color("future", "Hliníková stříbrná", null, "#cbd5e1", "aluminium", { material: "metal", frameMpn: [4301, 4302, 4308, 4309, 4310].map((n) => `2CKA001754A${n}`) }),
      color("future", "Antracitová", null, ANTHRACITE, "anthracite", { frameMpn: range(4240) }), color("future", "Ušlechtilá ocel", null, "#c7cbd1", "steel", { material: "metal", frameMpn: range(4317) }),
      color("future", "Mechová bílá", null, MOSS_W, "white", { material: "softtouch", frameMpn: range(4414) }), color("future", "Mechová černá", null, MOSS_B, "black", { material: "softtouch", frameMpn: [4419, 4420, 4421, 4422, null].map((n) => (n ? `2CKA001754A${n}` : null)) }),
    ],
  },
  {
    name: "solo", letter: null, shape: "solo", mount: "flush", dbSeries: ["Solo", "solo"], tagline: "Dokonalá harmonie a styl", page: 156,
    colors: [
      color("solo", "Studio bílá / chromová", null, STUDIO, "white", { frame: "#e2e8f0", insert: STUDIO, material: "metal", frameMpn: range(4104) }), color("solo", "Antracitová / chromová", null, ANTHRACITE, "anthracite", { frame: "#e2e8f0", insert: ANTHRACITE, material: "metal", frameMpn: range(4104) }),
      color("solo", "Studio bílá / studio bílá", null, STUDIO, "white", { frameMpn: range(4109) }), color("solo", "Antracitová / chromová lesklá", null, "#52525b", "anthracite", { frame: "#f1f5f9", insert: ANTHRACITE, material: "gloss", frameMpn: range(4326) }),
    ],
  },
  {
    name: "solo carat", letter: null, shape: "solo", mount: "flush", dbSeries: ["solo carat"], tagline: "Ušlechtilý charakter", page: 158,
    colors: [
      color("solo-carat", "Bílé sklo", null, "#f8fafc", "white", { material: "glass", frameMpn: [4442, 4443, 4444, 4445, null].map((n) => (n ? `2CKA001754A${n}` : null)) }),
      color("solo-carat", "Ušlechtilá ocel", null, "#c7cbd1", "steel", { material: "metal", frameMpn: [4254, 4255, 4256, 4257, null].map((n) => (n ? `2CKA001754A${n}` : null)) }),
      color("solo-carat", "Černé sklo", null, "#111114", "black", { material: "glass", frameMpn: [4322, 4323, 4324, 4325, null].map((n) => (n ? `2CKA001754A${n}` : null)) }),
    ],
  },
  {
    name: "Busch-axcent", letter: null, shape: "thick", mount: "flush", dbSeries: ["Busch-axcent"], tagline: "Důraz na jedinečnost", page: 164,
    colors: [
      color("axcent", "Studio bílá / bílé sklo", null, STUDIO, "white", { frame: "#f8fafc", insert: STUDIO, material: "glass", frameMpn: ["2CKA001754A4437", "2CKA001754A4438", null, null, null] }),
      color("axcent", "Mechová bílá / černé sklo", null, "#111114", "black", { frame: "#111114", insert: MOSS_W, material: "glass", frameMpn: ["2CKA001754A4800", "2CKA001754A4801", null, null, null] }),
      color("axcent", "Mechová bílá / titanová", null, "#71717a", "titanium", { frame: "#71717a", insert: MOSS_W, material: "metal", frameMpn: ["2CKA001754A4693", "2CKA001754A4694", null, null, null] }),
      color("axcent", "Antracitová / platinová", null, "#d4d4d8", "silver", { frame: "#d4d4d8", insert: ANTHRACITE, material: "metal", frameMpn: ["2CKA001754A4683", "2CKA001754A4684", "2CKA001754A4685", null, null] }),
      color("axcent", "Mechová černá / beton", null, "#a8a29e", "grey", { frame: "#a8a29e", insert: MOSS_B, material: "stone", frameMpn: ["2CKA001754A4795", "2CKA001754A4796", "2CKA001754A4797", null, null] }),
      color("axcent", "Mechová černá / hnědý papír", null, "#8b6b4a", "brown", { frame: "#8b6b4a", insert: MOSS_B, material: "paper", frameMpn: ["2CKA001754A4790", "2CKA001754A4791", "2CKA001754A4792", null, null] }),
      color("axcent", "Mechová černá / břidlice", null, "#475569", "anthracite", { frame: "#475569", insert: MOSS_B, material: "stone", frameMpn: ["2CKA001754A4805", "2CKA001754A4806", "2CKA001754A4807", null, null] }),
      color("axcent", "Mechová černá / matná černá", null, "#18181b", "black", { frame: "#18181b", insert: MOSS_B, material: "matte", frameMpn: ["2CKA001754A4703", "2CKA001754A4704", "2CKA001754A4705", null, null] }),
    ],
  },
  ...(["Garant (IP44)", "Variant+ (IP54)", "Praktik (IP44)"] as const).map((name): AbbSeries => {
    const key = name.split(" ")[0].toLowerCase().replace("+", "-plus");
    return {
      name,
      letter: null,
      shape: "surface",
      mount: "surface",
      ip: name.includes("IP54") ? "IP54" : "IP44",
      dbSeries: [name.split(" ")[0]],
      tagline: name.startsWith("Variant") ? "Variabilní, odolný, moderní" : name.startsWith("Praktik") ? "Velmi rozšířená řada pro vrchní montáž" : "Do vlhka a venku",
      page: 498,
      colors: [color(key, "Bílá", null, W, "white"), color(key, "Šedá", null, GREY, "grey"), color(key, "Béžová", null, "#d6c3a1", "beige"), color(key, "Hnědá", null, "#7c4a2d", "brown")],
    };
  }),
];

/** Starší klíče řad (nákresy uložené před aktualizací na katalog 2026). */
export const SERIES_ALIASES: Record<string, string[]> = {
  solo: ["solo / solo carat", "Solo"],
  "future linear": ["Future Linear"],
  Swing: ["Swing / Swing L"],
  // Řada Element ve vydání 2026 skončila – uložené nákresy přejdou na nejbližší kovovou řadu Time (stejné písmeno E/F)
  Time: ["Element"],
};
