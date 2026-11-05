// Fáze 55: designové řady domovních přístrojů ABB podle Katalogu ABB 2026 (zadání uživatele) – 14 řad pro zapuštěnou montáž
// + 3 nástěnné řady IP44 / IP54. Každá řada má písmeno řady v objednacím čísle, tvar pro 2D náhled a skutečné barvy
// s kódem barvy (kód se připojuje k objednacímu číslu krytu / rámečku, např. „3559T-A00651 500“). Čisté konstanty.
// Odstín `swatch` je jen orientační barva náhledu v aplikaci, ne katalogový údaj.

export type SeriesShape = "thin" | "rounded" | "layered" | "metal" | "wood" | "square" | "soft" | "classic" | "porcelain" | "flat" | "solo" | "thick" | "surface";

export interface SeriesColor {
  /** Jednoznačné id barvy v půdorysu („abb-zoni-500“). */
  id: string;
  label: string;
  /** Kód barvy z katalogu (přípona objednacího čísla), pokud ho katalog uvádí. */
  code: string | null;
  swatch: string;
  /** Skupina `wd_color_family` katalogu domovních přístrojů (výběr přístrojů z databáze). */
  family: string;
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
}

const color = (series: string, label: string, code: string | null, swatch: string, family: string): SeriesColor => ({
  id: `abb-${series}-${(code ?? label).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
  label: code ? `${label} (${code})` : label,
  code,
  swatch,
  family,
});

const W = "#f8fafc";
const IVORY = "#efe3c8";
const BLACK = "#27272a";
const GREY = "#9ca3af";

export const ABB_SERIES_2026: AbbSeries[] = [
  {
    name: "Zoni", letter: "T", shape: "thin", mount: "flush", dbSeries: ["Zoni"],
    colors: [
      color("zoni", "Bílá", "500", W, "white"), color("zoni", "Matná bílá", "240", "#f1f5f9", "white"), color("zoni", "Šedá / bílá", "241/141", "#a8a29e", "grey"),
      color("zoni", "Pudrová / bílá", "242/142", "#e7c9c0", "ivory"), color("zoni", "Olivová / bílá", "243/143", "#9ca37a", "grey"), color("zoni", "Greige / bílá", "244/144", "#c4b8a8", "ivory"),
      color("zoni", "Matná černá", "237", BLACK, "black"), color("zoni", "Matná černá / bílá", "137", "#3f3f46", "black"),
    ],
  },
  {
    name: "Tango", letter: "A", shape: "rounded", mount: "flush", dbSeries: ["Tango"],
    colors: [
      color("tango", "Bílá", "B", W, "white"), color("tango", "Slonová kost", "C", IVORY, "ivory"), color("tango", "Šedá", "S", GREY, "grey"), color("tango", "Béžová", "D", "#d6c3a1", "beige"),
      color("tango", "Hnědá", "H", "#7c4a2d", "brown"), color("tango", "Černá", "N", BLACK, "black"), color("tango", "Kouřová šedá", "S2", "#6b7280", "grey"), color("tango", "Vřesová červená", "R2", "#9f1239", "brown"),
    ],
  },
  {
    name: "Levit", letter: "H", shape: "layered", mount: "flush", dbSeries: ["Levit"],
    colors: [
      color("levit", "Bílá / ledová bílá", "01", W, "white"), color("levit", "Bílá / bílá", "03", "#ffffff", "white"), color("levit", "Šedá / bílá", "16", GREY, "grey"),
      color("levit", "Slonová kost / bílá", "17", IVORY, "ivory"), color("levit", "Macchiato / bílá", "18", "#b08968", "beige"), color("levit", "Bílá / kouřová černá", "62", "#e5e7eb", "black"),
      color("levit", "Žlutá / kouřová černá", "64", "#eab308", "black"), color("levit", "Červená / kouřová černá", "65", "#dc2626", "black"),
      color("levit", "Oranžová / kouřová černá", "66", "#f97316", "black"), color("levit", "Zelená / kouřová černá", "67", "#16a34a", "black"),
    ],
  },
  {
    name: "Levit M", letter: "H", shape: "layered", mount: "flush", dbSeries: ["Levit M", "Levit"],
    colors: [
      color("levit-m", "Onyx / kouřová černá", "63", "#18181b", "black"), color("levit-m", "Perleťová / ledová bílá", "68", "#f5f5f4", "white"),
      color("levit-m", "Ocelová / kouřová černá", "69", "#94a3b8", "steel"), color("levit-m", "Titanová / kouřová černá", "70", "#71717a", "titanium"),
    ],
  },
  {
    name: "Time", letter: "E/F", shape: "metal", mount: "flush", dbSeries: ["Time", "Element/Time"],
    colors: [
      color("time", "Bílá / ledová bílá", "01", W, "white"), color("time", "Bílá / bílá", "03", "#ffffff", "white"), color("time", "Titanová", "08", "#71717a", "titanium"),
      color("time", "Starostříbrná", "32", "#a8a29e", "silver"), color("time", "Šampaňská", "33", "#d6c7a1", "beige"), color("time", "Antracitová", "34", "#3f3f46", "anthracite"), color("time", "Ocelová", "36", "#94a3b8", "steel"),
    ],
  },
  {
    name: "Time Arbo", letter: "E/F", shape: "wood", mount: "flush", dbSeries: ["Time Arbo", "Time"],
    colors: [
      color("time-arbo", "Starostříbrná / přírodní javor", null, "#e7d3a8", "wood"), color("time-arbo", "Starostříbrná / olše", null, "#c98b5a", "wood"),
      color("time-arbo", "Starostříbrná / třešeň", null, "#a0522d", "wood"), color("time-arbo", "Titanová / třešeň", null, "#8b4513", "wood"),
      color("time-arbo", "Antracitová / mahagon", null, "#6b2f1a", "wood"), color("time-arbo", "Antracitová / wenge", null, "#3b2416", "wood"),
    ],
  },
  {
    name: "Element", letter: "E", shape: "square", mount: "flush", dbSeries: ["Element", "Element/Time"],
    colors: [
      color("element", "Bílá / ledová bílá", null, W, "white"), color("element", "Bílá / bílá", null, "#ffffff", "white"), color("element", "Agáve", null, "#84a98c", "grey"),
      color("element", "Karmínová", null, "#9b2226", "brown"), color("element", "Karamelová", null, "#bc6c25", "brown"), color("element", "Titanová", null, "#71717a", "titanium"), color("element", "Platinová", null, "#d4d4d8", "silver"),
    ],
  },
  {
    name: "Swing", letter: "G", shape: "soft", mount: "flush", dbSeries: ["Swing"],
    colors: [color("swing", "Jasně bílá", "B1", W, "white"), color("swing", "Krémová", "C1", IVORY, "ivory"), color("swing", "Béžová", "D1", "#d6c3a1", "beige"), color("swing", "Světle šedá", "S1", "#cbd5e1", "grey"), color("swing", "Hnědá", "H1", "#7c4a2d", "brown")],
  },
  {
    name: "Swing L", letter: "G/J", shape: "soft", mount: "flush", dbSeries: ["Swing L"],
    colors: [color("swing-l", "Jasně bílá", "B1", W, "white"), color("swing-l", "Krémová", "C1", IVORY, "ivory"), color("swing-l", "Mocca", "C3", "#7f5539", "brown"), color("swing-l", "Světle šedá", "S1", "#cbd5e1", "grey"), color("swing-l", "Cihlová", "R3", "#b45309", "brown")],
  },
  {
    name: "Classic", letter: "3553", shape: "classic", mount: "flush", dbSeries: ["Classic"],
    colors: [color("classic", "Jasně bílá", "B1", W, "white"), color("classic", "Béžová", "D2", "#d6c3a1", "beige"), color("classic", "Hnědá", "H3", "#7c4a2d", "brown")],
  },
  {
    name: "Decento", letter: "K", shape: "porcelain", mount: "flush", dbSeries: ["Decento"],
    colors: [
      color("decento", "Porcelán bílá", null, W, "white"), color("decento", "Porcelán černá", null, BLACK, "black"), color("decento", "Porcelán bílá / dřevo buk", null, "#d4a373", "wood"),
      color("decento", "Porcelán bílá / dřevo třešeň", null, "#a0522d", "wood"), color("decento", "Porcelán černá / dřevo wenge", null, "#3b2416", "wood"),
    ],
  },
  {
    name: "future linear", letter: null, shape: "flat", mount: "flush", dbSeries: ["Future Linear", "future linear"],
    colors: [
      color("future", "Alpská bílá", "84", W, "white"), color("future", "Matná alpská bílá", "884", "#f1f5f9", "white"), color("future", "Slonová kost", "82", IVORY, "ivory"),
      color("future", "Antracitová", "81", "#3f3f46", "anthracite"), color("future", "Matná černá", "885", BLACK, "black"), color("future", "Hliníková", "83", "#cbd5e1", "aluminium"),
    ],
  },
  {
    name: "solo / solo carat", letter: null, shape: "solo", mount: "flush", dbSeries: ["Solo", "solo", "solo carat"],
    colors: [
      color("solo", "Studio bílá", null, W, "white"), color("solo", "Slonová kost", null, IVORY, "ivory"), color("solo", "Šedá metalíza", null, GREY, "grey"),
      color("solo", "Chrom", null, "#e2e8f0", "silver"), color("solo", "Zlato", null, "#d4af37", "bronze"), color("solo", "Bronz", null, "#8c6239", "bronze"), color("solo", "Břidlice", null, "#475569", "anthracite"),
    ],
  },
  {
    name: "Busch-axcent", letter: null, shape: "thick", mount: "flush", dbSeries: ["Busch-axcent"],
    colors: [
      color("axcent", "Studio bílá", null, W, "white"), color("axcent", "Černá", null, BLACK, "black"), color("axcent", "Červená", null, "#dc2626", "brown"),
      color("axcent", "Modrá", null, "#2563eb", "grey"), color("axcent", "Zelená", null, "#16a34a", "grey"), color("axcent", "Žlutá", null, "#eab308", "beige"),
      color("axcent", "Beton", null, "#a8a29e", "grey"), color("axcent", "Břidlice", null, "#475569", "anthracite"), color("axcent", "Dřevo", null, "#a16207", "wood"),
    ],
  },
  ...(["Garant (IP44)", "Variant+ (IP54)", "Praktik (IP44)"] as const).map((name): AbbSeries => {
    const slug = name.split(" ")[0].toLowerCase().replace("+", "-plus");
    return {
      name,
      letter: null,
      shape: "surface",
      mount: "surface",
      ip: name.includes("IP54") ? "IP54" : "IP44",
      dbSeries: [name.split(" ")[0]],
      colors: [color(slug, "Bílá", null, W, "white"), color(slug, "Šedá", null, GREY, "grey"), color(slug, "Béžová", null, "#d6c3a1", "beige"), color(slug, "Hnědá", null, "#7c4a2d", "brown")],
    };
  }),
];
