// Fáze 63: zařizovací předměty ve skutečných rozměrech – vana, sprchový kout, umyvadlo a dvojumyvadlo (šířka X ×
// hloubka Y, natočení po 45°). Zóny koupelny dle ČSN 33 2000-7-701 ed. 2: zóna 0 = vnitřek vany / vaničky, zóna 1 =
// svislý průmět předmětu, zóna 2 = 0,6 m od hrany zóny 1. U umyvadla svislý pás nad a pod umyvadlem (ČSN 33 2130 ed. 4)
// – v šíři umyvadla s přesahem 0,2 m na každou stranu, od zadní hrany ke stěně. Změna rozměru tažením za strany a roh.
// Fáze 90: stejný mechanismus (rozměr X × Y, žlutý roh, posuvné hrany, natočení) mají okna, dveře a nábytek – orientační
// architektonické prvky bez okruhů (zóna „none“), kresba v `architecture.ts`, vrstva DXF ARCHITEKTURA_NABYTEK.
// Čisté funkce.

export interface FixturePoint {
  x: number;
  y: number;
}

/** Fáze 90: okna, dveře a nábytek (orientační architektonické prvky – kresba `archDrawing` v `architecture.ts`). */
export type ArchType =
  | "window_1"
  | "window_2"
  | "window_hs"
  | "door_1"
  | "door_2"
  | "door_sliding"
  | "bed_double"
  | "bed_single"
  | "sofa_l"
  | "sofa"
  | "table_dining"
  | "desk"
  | "kitchen"
  | "island"
  | "wardrobe"
  | "tv"
  | "wc"
  | "exam_bed";

export type FixtureType = "bath" | "shower" | "basin" | "double_basin" | ArchType;

/** „bath“ = zóny 0–2 koupelny, „basin“ = pás nad a pod umyvadlem, „none“ = bez zón (okna, dveře, nábytek, WC). */
export type FixtureZone = "bath" | "basin" | "none";

export interface FixtureSpec {
  type: FixtureType;
  /** Výchozí šířka X a hloubka Y [mm]. */
  w: number;
  d: number;
  label: string;
  zone: FixtureZone;
  /** Fáze 90: kód prvku v paletě a DXF (OKN_1, DVE_1, POST_2 …). */
  code?: string;
  /** Fáze 90: stavební otvor (přichytí se ke stěně místnosti) nebo nábytek / vybavení. */
  arch?: "opening" | "furniture";
  /** Fáze 90: otvor sedí na stěně středem (okno, posuvné dveře) nebo zadní hranou s křídlem do místnosti (dveře). */
  wall?: "center" | "inside";
  /** Fáze 90: „swing“ = levé / pravé otevírání dveří (posuvné: směr posuvu), „mirror“ = zrcadlení nábytku. */
  flip?: "swing" | "mirror";
  /** Fáze 90: meze rozměru [mm] (bez nich 0,3–4 m jako u vany a umyvadla). */
  min?: number;
  max?: number;
}

/** Fáze 90: meze rozměru oken, dveří a nábytku [mm] (okno 0,1 m hluboké, linka až 8 m). */
const ARCH_MIN_MM = 100;
const ARCH_MAX_MM = 8000;
const opening = (type: ArchType, code: string, label: string, w: number, d: number, wall: "center" | "inside", flip?: "swing" | "mirror"): FixtureSpec => ({ type, code, label, w, d, zone: "none", arch: "opening", wall, ...(flip ? { flip } : {}), min: ARCH_MIN_MM, max: ARCH_MAX_MM });
const furniture = (type: ArchType, code: string, label: string, w: number, d: number, flip?: "mirror"): FixtureSpec => ({ type, code, label, w, d, zone: "none", arch: "furniture", ...(flip ? { flip } : {}), min: ARCH_MIN_MM, max: ARCH_MAX_MM });

/** Zařizovací předměty podle id položky palety (fáze 90 i okna, dveře a nábytek). */
export const FIXTURES: Record<string, FixtureSpec> = {
  bath: { type: "bath", w: 1700, d: 750, label: "Vana", zone: "bath" },
  shower: { type: "shower", w: 900, d: 900, label: "Sprchový kout", zone: "bath" },
  basin: { type: "basin", w: 600, d: 450, label: "Umyvadlo", zone: "basin" },
  "double-basin": { type: "double_basin", w: 1200, d: 450, label: "Dvojumyvadlo", zone: "basin" },
  // Fáze 90: stavební otvory – okna sedí středem na stěně, dveře zadní hranou s křídlem do místnosti
  "arch-window-1": opening("window_1", "OKN_1", "Okno jednokřídlé", 1000, 250, "center"),
  "arch-window-2": opening("window_2", "OKN_2", "Okno dvoukřídlé", 1600, 250, "center"),
  "arch-window-hs": opening("window_hs", "OKN_HS", "Francouzské okno / HS portál", 2600, 300, "center", "mirror"),
  "arch-door-1": opening("door_1", "DVE_1", "Dveře jednokřídlé", 800, 800, "inside", "swing"),
  "arch-door-2": opening("door_2", "DVE_2", "Dveře dvoukřídlé", 1450, 800, "inside"),
  "arch-door-sliding": opening("door_sliding", "DVE_POS", "Dveře posuvné", 900, 200, "center", "swing"),
  // Fáze 90: nábytek a vybavení interiéru (orientace při osazování zásuvek, vypínačů a světel)
  "arch-bed-double": furniture("bed_double", "POST_2", "Manželská postel (dvoulůžko)", 1800, 2000),
  "arch-bed-single": furniture("bed_single", "POST_1", "Jednolůžko / dětská postel", 900, 2000),
  "arch-sofa-l": furniture("sofa_l", "GAUC_L", "Rohová sedací souprava (L-gauč)", 2600, 1800, "mirror"),
  "arch-sofa": furniture("sofa", "GAUC_R", "Pohovka / gauč rovný", 2200, 950),
  "arch-table-dining": furniture("table_dining", "STUL_J", "Jídelní stůl se židlemi", 1800, 900),
  "arch-desk": furniture("desk", "STUL_PC", "Pracovní stůl se židlí", 1400, 700),
  "arch-kitchen": furniture("kitchen", "LINKA", "Kuchyňská linka (dřez a varná zóna)", 2600, 600, "mirror"),
  "arch-island": furniture("island", "OSTR", "Kuchyňský ostrůvek", 1800, 900),
  "arch-wardrobe": furniture("wardrobe", "SKRIN", "Šatní / vestavěná skříň", 2000, 600),
  "arch-tv": furniture("tv", "TV_ST", "TV stolek / obývací stěna", 1800, 450),
  "arch-wc": furniture("wc", "WC_M", "WC mísa / závěsné WC", 400, 650),
  // Fáze 93: zdravotnický prostor Skupiny 1 – vyšetřovací lehátko / nemocniční lůžko / stomatologické křeslo podél stěny
  "arch-exam-bed": furniture("exam_bed", "LEH_Z", "Vyšetřovací lehátko / nemocniční lůžko / stomatologické křeslo", 2000, 900, "mirror"),
};

/** Fáze 90: okno, dveře nebo nábytek (orientační prvek bez zón a okruhů). */
export const isArchitecture = (item: string) => Boolean(FIXTURES[item]?.arch);

/** Zóna 2 koupelny sahá 0,6 m od hrany vany / sprchového koutu (ČSN 33 2000-7-701 ed. 2). */
export const ZONE2_MM = 600;
/**
 * Fáze 74: umývací prostor umyvadla (ČSN 33 2130, převzato z ed. 3 čl. 7.8 – v ed. 4 ověřit v plném znění): svislý
 * průmět umyvadla ke stěně do výšky 2,25 m nad podlahou. Zásuvky a spínače jen vně; ve výšce od 1,2 m smí být těsně
 * u hranice, níž nejméně 0,2 m od hranice (`BASIN_MARGIN_MM`). Zóny 0–2 ČSN 33 2000-7-701 umyvadlo nemá.
 */
export const WASH_AREA_TOP_MM = 2250;
export const WASH_HIGH_MM = 1200;
/** Fáze 74: volitelná přísnější projekční zásada – kolem umyvadla 0,6 m jako zóna 2 u vany a sprchy. */
export const BASIN_STRICT_MM = 600;
export type BasinZone = "norm" | "strict";
export const isBasinZone = (value: unknown): value is BasinZone => value === "norm" || value === "strict";
/** Přesah pásu u umývacího prostoru na každou stranu [mm] (prvek níž než 1,2 m). */
export const BASIN_MARGIN_MM = 200;
/** Fáze 90: doporučený boční lem umyvadlového prostoru pro spínače a zásuvky níž než 1,2 m [mm] (kreslí se tečkovaně). */
export const BASIN_RECOMMENDED_MM = 400;
/** Pás u umyvadla sahá za zadní hranu až ke stěně (zásuvka / spínač na stěně za umyvadlem) [mm]. */
export const BASIN_WALL_MM = 250;
/** Nejmenší a největší rozměr předmětu [mm]. */
export const FIXTURE_MIN_MM = 300;
export const FIXTURE_MAX_MM = 4000;

export const fixtureSpecOf = (item: string) => FIXTURES[item] ?? null;

/** Zaokrouhlení rozměru na 10 mm v mezích (fáze 90: meze podle předmětu – okna, dveře a nábytek 0,1–8 m). */
export const clampFixture = (value: number, spec?: Pick<FixtureSpec, "min" | "max"> | null) => Math.min(spec?.max ?? FIXTURE_MAX_MM, Math.max(spec?.min ?? FIXTURE_MIN_MM, Math.round(value / 10) * 10));

interface FixtureElement {
  item: string;
  x: number;
  y: number;
  rotation: number;
  sizeMm?: { w: number; d: number } | null;
  /** Fáze 90: levé / pravé otevírání dveří, zrcadlení nábytku. */
  flip?: boolean;
}

/** Skutečný rozměr předmětu (vlastní nebo výchozí). */
export function fixtureSize(element: Pick<FixtureElement, "item" | "sizeMm">): { w: number; d: number } | null {
  const spec = fixtureSpecOf(element.item);
  if (!spec) return null;
  return { w: element.sizeMm?.w ?? spec.w, d: element.sizeMm?.d ?? spec.d };
}

export interface FixtureGeometry {
  type: FixtureType;
  zone: FixtureZone;
  cx: number;
  cy: number;
  w: number;
  d: number;
  rotation: number;
  /** Obrys předmětu (zóna 1) v mm půdorysu – 4 rohy. */
  corners: FixturePoint[];
  /** Fáze 90: zrcadlená kresba (pravé otevírání dveří, zrcadlený nábytek). */
  flip: boolean;
}

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** Místní souřadnice (u = osa šířky, v = osa hloubky, zadní hrana u stěny = −v) → půdorys. */
export function toWorld(geometry: Pick<FixtureGeometry, "cx" | "cy" | "rotation">, u: number, v: number): FixturePoint {
  const cos = Math.cos(rad(geometry.rotation));
  const sin = Math.sin(rad(geometry.rotation));
  return { x: geometry.cx + u * cos - v * sin, y: geometry.cy + u * sin + v * cos };
}

/** Půdorys → místní souřadnice předmětu. */
export function toLocal(geometry: Pick<FixtureGeometry, "cx" | "cy" | "rotation">, x: number, y: number): { u: number; v: number } {
  const cos = Math.cos(rad(geometry.rotation));
  const sin = Math.sin(rad(geometry.rotation));
  const dx = x - geometry.cx;
  const dy = y - geometry.cy;
  return { u: dx * cos + dy * sin, v: -dx * sin + dy * cos };
}

/** Geometrie předmětu z prvku nákresu (null = není zařizovací předmět). */
export function fixtureGeometry(element: FixtureElement): FixtureGeometry | null {
  const spec = fixtureSpecOf(element.item);
  const size = fixtureSize(element);
  if (!spec || !size) return null;
  const base = { cx: element.x, cy: element.y, rotation: element.rotation };
  const corners = [
    toWorld(base, -size.w / 2, -size.d / 2),
    toWorld(base, size.w / 2, -size.d / 2),
    toWorld(base, size.w / 2, size.d / 2),
    toWorld(base, -size.w / 2, size.d / 2),
  ];
  return { type: spec.type, zone: spec.zone, ...base, w: size.w, d: size.d, corners, flip: Boolean(spec.flip && element.flip) };
}

/** Vodorovná vzdálenost bodu od hrany předmětu (0 = nad předmětem / uvnitř zóny 1). */
export function distanceToFixture(geometry: FixtureGeometry, x: number, y: number): number {
  const local = toLocal(geometry, x, y);
  return Math.hypot(Math.max(Math.abs(local.u) - geometry.w / 2, 0), Math.max(Math.abs(local.v) - geometry.d / 2, 0));
}

/** Bod v zóně 0–2 vany / sprchy (blíž než 0,6 m od hrany). */
export const inBathZones = (geometry: FixtureGeometry, x: number, y: number) => geometry.zone === "bath" && distanceToFixture(geometry, x, y) < ZONE2_MM;

/** Místní obdélník pásu nad a pod umyvadlem (od přední hrany přes zadní hranu ke stěně). */
export function basinBand(geometry: Pick<FixtureGeometry, "w" | "d">) {
  return { u1: -geometry.w / 2 - BASIN_MARGIN_MM, u2: geometry.w / 2 + BASIN_MARGIN_MM, v1: -geometry.d / 2 - BASIN_WALL_MM, v2: geometry.d / 2 };
}

/** Bod ve svislém pásu nad / pod umyvadlem. */
export function inBasinBand(geometry: FixtureGeometry, x: number, y: number): boolean {
  if (geometry.zone !== "basin") return false;
  const local = toLocal(geometry, x, y);
  const band = basinBand(geometry);
  return local.u >= band.u1 && local.u <= band.u2 && local.v >= band.v1 && local.v <= band.v2;
}

/** Fáze 74: místní obdélník umývacího prostoru – svislý průmět umyvadla od přední hrany ke stěně (bez přesahu). */
export function washArea(geometry: Pick<FixtureGeometry, "w" | "d">) {
  return { u1: -geometry.w / 2, u2: geometry.w / 2, v1: -geometry.d / 2 - BASIN_WALL_MM, v2: geometry.d / 2 };
}

/** Fáze 74: bod v umývacím prostoru umyvadla (prvek níž než 2,25 m). */
export function inWashArea(geometry: FixtureGeometry, x: number, y: number, heightMm = 0): boolean {
  if (geometry.zone !== "basin" || heightMm >= WASH_AREA_TOP_MM) return false;
  const local = toLocal(geometry, x, y);
  const area = washArea(geometry);
  return local.u >= area.u1 && local.u <= area.u2 && local.v >= area.v1 && local.v <= area.v2;
}

/**
 * Fáze 74: umístění zásuvky / spínače u umyvadla podle výšky krabice – „area“ v umývacím prostoru (vždy chyba),
 * „band“ níž než 1,2 m blíž než 0,2 m od hranice (chyba), „strict“ jen při přísnější zásadě 0,6 m, jinak null.
 */
export function basinPlacement(geometry: FixtureGeometry, x: number, y: number, heightMm: number, zone: BasinZone = "norm"): "area" | "band" | "strict" | null {
  if (geometry.zone !== "basin" || heightMm >= WASH_AREA_TOP_MM) return null;
  if (inWashArea(geometry, x, y, heightMm)) return "area";
  if (heightMm < WASH_HIGH_MM && inBasinBand(geometry, x, y)) return "band";
  if (zone === "strict" && distanceToFixture(geometry, x, y) < BASIN_STRICT_MM) return "strict";
  return null;
}

/** Obrys zóny 2 (obdélník předmětu zvětšený o 0,6 m se zaoblenými rohy) v místních souřadnicích jako cesta SVG. */
export function zone2Path(w: number, d: number, offset = ZONE2_MM): string {
  const x = w / 2;
  const y = d / 2;
  const r = offset;
  const f = (value: number) => Math.round(value * 10) / 10;
  return `M${f(-x)} ${f(-y - r)} H${f(x)} A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(-y)} V${f(y)} A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + r)} H${f(-x)} A${f(r)} ${f(r)} 0 0 1 ${f(-x - r)} ${f(y)} V${f(-y)} A${f(r)} ${f(r)} 0 0 1 ${f(-x)} ${f(-y - r)} Z`;
}

export type FixtureHandle = "e" | "w" | "n" | "s" | "se";

/**
 * Změna rozměru tažením za stranu / žlutý roh (bod v mm půdorysu): protilehlá strana zůstává na místě, střed se posune
 * o polovinu změny v místní ose předmětu. Rozměry po 10 mm v mezích 0,3–4 m.
 */
export function resizeFixture(element: FixtureElement, handle: FixtureHandle, point: FixturePoint): { x: number; y: number; sizeMm: { w: number; d: number } } | null {
  const geometry = fixtureGeometry(element);
  const spec = fixtureSpecOf(element.item);
  if (!geometry) return null;
  const clamp = (value: number) => clampFixture(value, spec);
  const local = toLocal(geometry, point.x, point.y);
  let w = geometry.w;
  let d = geometry.d;
  let du = 0;
  let dv = 0;
  if (handle === "e" || handle === "se") {
    w = clamp(local.u + geometry.w / 2);
    du = (w - geometry.w) / 2;
  }
  if (handle === "w") {
    w = clamp(geometry.w / 2 - local.u);
    du = -(w - geometry.w) / 2;
  }
  if (handle === "s" || handle === "se") {
    d = clamp(local.v + geometry.d / 2);
    dv = (d - geometry.d) / 2;
  }
  if (handle === "n") {
    d = clamp(geometry.d / 2 - local.v);
    dv = -(d - geometry.d) / 2;
  }
  const centre = toWorld(geometry, du, dv);
  return { x: Math.round(centre.x), y: Math.round(centre.y), sizeMm: { w, d } };
}

/** Živá kóta „X: 1,70 m × Y: 0,75 m“. */
export const fixtureDims = (w: number, d: number) => {
  const m = (mm: number) => (mm / 1000).toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `X: ${m(w)} m × Y: ${m(d)} m`;
};

/** Natočení o krok (90° nebo 45°) v rozsahu 0–360. */
export const turnBy = (rotation: number, step: number) => (((Math.round((rotation + step) * 10) / 10) % 360) + 360) % 360;

/** Fáze 90: pevná natočení v detailu předmětu (okna, dveře, nábytek i vana). */
export const FIXTURE_ROTATIONS = [0, 45, 90, 180, 270] as const;
