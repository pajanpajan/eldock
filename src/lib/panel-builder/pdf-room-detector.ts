// Fáze 113: rozpoznání místností a vnitřních příček z nahraného PDF výkresu – tři stupně:
//   1) 🔍 automaticky: popisky místností z textové vrstvy PDF (čísla 1.01 / 2.09, názvy Obývací pokoj, Ložnice …,
//      výměry „32,5 m²“) + rastr podkladu: prahování tmavých čar stěn, morfologické uzavření mezer dveří do ~95 cm
//      a flood fill / souvislé oblasti kolem popisků (bez textové vrstvy všechny uzavřené oblasti ohraničené zdivem),
//   2) 🪄 klik do místnosti: flood fill z bodu kliknutí k okolním tlustým čarám zdiva,
//   3) 📐 dva protilehlé rohy (obdélník – editor, `rectFromCorners`).
// Čisté funkce nad maskou pixelů (testy bez prohlížeče); podklad do rastru vykreslí klient (`room-detection-client.ts`).
// Výsledek je v pixelech rastru – převod na mm půdorysu dělá klient podle měřítka podkladu.

export interface Pt {
  x: number;
  y: number;
}

/** Útržek textu z PDF – střed a výška písma v px vykresleného podkladu (před otočením). */
export interface PdfTextLabel {
  text: string;
  x: number;
  y: number;
  h: number;
}

/** Popisek místnosti složený z útržků (číslo, název, výměra) – poloha v px rastru. */
export interface RoomTag {
  number: string | null;
  name: string | null;
  areaM2: number | null;
  x: number;
  y: number;
  /** Výška písma [px]. */
  h: number;
  /** Obálka textu [px] (vymaže se z masky stěn). */
  box: { x0: number; y0: number; x1: number; y1: number };
}

/** Rastr podkladu: RGBA (4 kanály) nebo stupně šedi (1 kanál). */
export interface Raster {
  width: number;
  height: number;
  data: ArrayLike<number>;
  channels: 1 | 4;
}

export interface DetectOptions {
  /** Měřítko rastru [mm / px]. */
  mmPerPx: number;
  /** Nejširší mezera ve zdi, která se ještě uzavře jako dveře [mm] (výchozí 950). */
  doorGapMm?: number;
  minAreaM2?: number;
  maxAreaM2?: number;
  /** Práh jasu tmavých čar (0–255, výchozí 160). */
  threshold?: number;
}

export interface DetectedRoom {
  name: string | null;
  number: string | null;
  /** Výměra z popisku PDF [m²]. */
  labelAreaM2: number | null;
  /** Plocha rozpoznané oblasti [m²] podle měřítka rastru. */
  areaM2: number;
  /** Plocha oblasti [px²] (odhad měřítka z výměr). */
  areaPx: number;
  /** Rohy místnosti v px rastru (obdélník = 4 rohy po směru hodinových ručiček). */
  points: Pt[];
  rect: boolean;
  /** Bod uvnitř místnosti (popisek / klik). */
  seed: Pt;
  source: "label" | "region" | "click";
}

export interface DetectResult {
  rooms: DetectedRoom[];
  /** Měřítko [mm / px] odvozené z výměr v popiscích (aspoň 2 shodné místnosti), jinak null. */
  suggestedMmPerPx: number | null;
  /** Popisky, kolem kterých se uzavřená místnost nenašla. */
  unmatchedTags: number;
  tags: number;
}

export const DOOR_GAP_MM = 950;
export const MIN_ROOM_M2 = 1;
export const MAX_ROOM_M2 = 300;
/** Nejvíc rohů polygonální místnosti v editoru. */
export const MAX_ROOM_POINTS = 40;

// ---------------------------------------------------------------------------
//  Popisky místností z textové vrstvy PDF
// ---------------------------------------------------------------------------

/** Malá písmena bez diakritiky („Ložnice“ → „loznice“). */
export const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Názvy místností v českých výkresech (bez diakritiky, delší dřív než kratší se stejným začátkem). */
export const ROOM_NAMES: readonly string[] = [
  "technicka mistnost",
  "zasedaci mistnost",
  "denni mistnost",
  "obytna kuchyne",
  "obyvaci pokoj",
  "detsky pokoj",
  "pokoj pro hosty",
  "koupelna s wc",
  "koupelna",
  "loznice",
  "satna",
  "chodba",
  "kuchyne",
  "kuchynka",
  "kuchyn",
  "jidelna",
  "obyvak",
  "pokoj",
  "pracovna",
  "predsin",
  "zadveri",
  "zaveti",
  "hala",
  "spiz",
  "komora",
  "sklad",
  "sklep",
  "garaz",
  "pradelna",
  "kotelna",
  "technicka",
  "schodiste",
  "galerie",
  "terasa",
  "balkon",
  "lodzie",
  "kancelar",
  "recepce",
  "uklid",
  "umyvarna",
  "sprcha",
  "dilna",
  "atelier",
  "wc",
  "zachod",
  "vstup",
];

const ROOM_NUMBER = /^(?:[a-z]{1,3}[.\- ]?)?\d{1,2}\.\d{2}[a-z]?$/i;
const ROOM_NUMBER_ANYWHERE = /\b(?:[a-z]{1,3}[.\- ]?)?\d{1,2}\.\d{2}[a-z]?\b/gi;
const AREA = /(\d{1,3}(?:[  ]\d{3})*(?:[,.]\d{1,2})?)\s*m\s*(?:²|2)(?!\d)/i;
const NAME_PATTERNS = ROOM_NAMES.map((name) => ({ key: name, numbered: new RegExp(`^${name}\\s*(?:c\\.?\\s*)?\\d{1,2}$`) }));

/** Název místnosti v textu („Obývací pokoj“, „Pokoj 2“, „WC“) – původní zápis, jinak null. */
export function roomNameOf(text: string): string | null {
  const clean = text.replace(AREA, "").replace(ROOM_NUMBER_ANYWHERE, "").replace(/\s+/g, " ").trim();
  const folded = fold(clean);
  if (!folded || folded.length > 40) return null;
  for (const { key, numbered } of NAME_PATTERNS) {
    if (folded === key || folded.startsWith(`${key} `) || numbered.test(folded)) {
      if (key === "wc") return "WC";
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }
  return null;
}

/** Číslo místnosti („1.01“, „2.09“, „S1.02“), jinak null. */
export function roomNumberOf(text: string): string | null {
  const match = text.match(/(?:^|\s)((?:[a-z]{1,3}[.\- ]?)?\d{1,2}\.\d{2}[a-z]?)(?=\s|$)/i);
  return match && ROOM_NUMBER.test(match[1]) ? match[1] : null;
}

/** Výměra „32,5 m²“ / „7.85 m2“ [m²], jinak null. */
export function roomAreaOf(text: string): number | null {
  const match = AREA.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(/[  ]/g, "").replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 10_000 ? value : null;
}

/** Útržek textu, který může patřit k popisku místnosti (do podkladu se ukládají jen takové). */
export const isRoomText = (text: string) => Boolean(roomNumberOf(text) || roomAreaOf(text) || roomNameOf(text));

/** Útržky textu z PDF → popisky místností (útržky nad sebou do ~3,5 výšky písma tvoří jeden popisek). */
export function roomTags(labels: readonly PdfTextLabel[]): RoomTag[] {
  const parts = labels
    .map((label) => ({ ...label, number: roomNumberOf(label.text), name: roomNameOf(label.text), area: roomAreaOf(label.text) }))
    .filter((part) => part.number || part.name || part.area)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const tags: RoomTag[] = [];
  for (const part of parts) {
    const h = Math.max(1, part.h);
    const halfW = Math.max(h, part.text.length * h * 0.3);
    const box = { x0: part.x - halfW, y0: part.y - h * 0.65, x1: part.x + halfW, y1: part.y + h * 0.65 };
    const near = tags.find(
      (tag) =>
        Math.abs(tag.x - part.x) < Math.max(tag.h, h) * 6 &&
        Math.abs(tag.y - part.y) < Math.max(tag.h, h) * 3.5 &&
        !(part.number && tag.number) &&
        !(part.name && tag.name) &&
        !(part.area && tag.areaM2),
    );
    if (near) {
      near.number ??= part.number;
      near.name ??= part.name;
      near.areaM2 ??= part.area;
      near.box = { x0: Math.min(near.box.x0, box.x0), y0: Math.min(near.box.y0, box.y0), x1: Math.max(near.box.x1, box.x1), y1: Math.max(near.box.y1, box.y1) };
      near.x = (near.box.x0 + near.box.x1) / 2;
      near.y = (near.box.y0 + near.box.y1) / 2;
      near.h = Math.max(near.h, h);
    } else {
      tags.push({ number: part.number, name: part.name, areaM2: part.area, x: part.x, y: part.y, h, box });
    }
  }
  return tags;
}

/** Název místnosti z popisku („Obývací pokoj“, bez názvu „Místnost 1.01“). */
export const tagRoomName = (tag: Pick<RoomTag, "name" | "number">) => tag.name ?? (tag.number ? `Místnost ${tag.number}` : null);

// ---------------------------------------------------------------------------
//  Rastr: maska tmavých čar a morfologie (čtvercový strukturní prvek, klouzavé okno po řádcích a sloupcích)
// ---------------------------------------------------------------------------

/** Tmavé pixely (jas pod prahem) = 1; průhledné pixely jsou bílé. */
export function darkMask(raster: Raster, threshold = 160): Uint8Array {
  const { width, height, data, channels } = raster;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) {
    if (channels === 1) {
      out[i] = data[i] < threshold ? 1 : 0;
      continue;
    }
    const o = i * 4;
    const alpha = data[o + 3] / 255;
    const lum = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) * alpha + 255 * (1 - alpha);
    out[i] = lum < threshold ? 1 : 0;
  }
  return out;
}

function dilateRows(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let count = 0;
    for (let x = 0; x <= r && x < w; x++) count += src[row + x];
    for (let x = 0; x < w; x++) {
      out[row + x] = count > 0 ? 1 : 0;
      const add = x + r + 1;
      if (add < w) count += src[row + add];
      const remove = x - r;
      if (remove >= 0) count -= src[row + remove];
    }
  }
  return out;
}

function dilateCols(src: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const counts = new Int32Array(w);
  for (let y = 0; y <= r && y < h; y++) for (let x = 0; x < w; x++) counts[x] += src[y * w + x];
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) out[row + x] = counts[x] > 0 ? 1 : 0;
    const add = y + r + 1;
    if (add < h) for (let x = 0; x < w; x++) counts[x] += src[add * w + x];
    const remove = y - r;
    if (remove >= 0) for (let x = 0; x < w; x++) counts[x] -= src[remove * w + x];
  }
  return out;
}

/** Dilatace čtvercem (2r + 1) × (2r + 1). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return mask.slice();
  return dilateCols(dilateRows(mask, w, h, r), w, h, r);
}

const invert = (mask: Uint8Array) => {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] ? 0 : 1;
  return out;
};

/** Eroze čtvercem – okolí mimo obraz se bere jako plné (stěny u okraje se neztenčí). */
export const erode = (mask: Uint8Array, w: number, h: number, r: number) => (r <= 0 ? mask.slice() : invert(dilate(invert(mask), w, h, r)));
/** Uzavření: zacelí mezery užší než 2r + 1 (dveře, šrafy). */
export const close = (mask: Uint8Array, w: number, h: number, r: number) => erode(dilate(mask, w, h, r), w, h, r);
/** Otevření: odstraní čáry tenčí než 2r + 1 (text, kóty, nábytek) – zůstanou tlusté stěny. */
export const open = (mask: Uint8Array, w: number, h: number, r: number) => dilate(erode(mask, w, h, r), w, h, r);

// ---------------------------------------------------------------------------
//  Bariéry stěn a oblasti
// ---------------------------------------------------------------------------

/**
 * Vrstva bariér (fáze 114 – od nejvěrnějšího zdiva k tenkým čarám):
 * - `thick`: zdivo (šrafy po ~8 cm zacelené, čáry tenčí než ~6 cm pryč), dveře do 95 cm zacelené,
 * - `hatch`: husté šrafování zdiva a příček zacelené do plného pásu (mezery do ~16 cm), čáry do ~8 cm pryč,
 * - `hatchWide`: totéž s otvory do 1,6 m (dvoukřídlé dveře, průchody),
 * - `outline`: jen obrysové čáry od 3 px (tenké 1–2px kóty, vynášecí čáry, osy řezů, oblouky dveří, texty a nábytek pryč),
 * - `outlineStrong`: jen čáry od 5 px (silnější filtr tenkých čar – druhé kolo pro výkres s tučnými kótami),
 * - `hybrid`: zdivo + tenké čáry do 0,4 m od zdiva (okna, zárubně),
 * - `all`: všechny čáry (výkres kreslený jen tenkými obrysy bez výplně zdiva).
 */
export type BarrierLayer = "thick" | "hatch" | "hatchWide" | "outline" | "outlineStrong" | "hybrid" | "all";
export const BARRIER_LAYERS: readonly BarrierLayer[] = ["thick", "hatch", "hatchWide", "outline", "outlineStrong", "hybrid", "all"];
/** Fáze 114: dvě vrstvy zdiva (běžné a husté šrafy) – z nich se bere menší oblast. */
const WALL_LAYERS: readonly BarrierLayer[] = ["thick", "hatch"];
/** Fáze 114: vrstvy pro hledání všech místností bez popisků (okna musí zůstat zavřená). */
export const SCAN_LAYERS: readonly BarrierLayer[] = ["hybrid", "outline", "all"];
/** Fáze 114: menší oblast po kliku do místnosti = nejspíš ohraničená kótou / nábytkem → další kolo s jinou vrstvou. */
export const MIN_CLICK_ROOM_M2 = 3.5;

export interface Barrier {
  w: number;
  h: number;
  mmPerPx: number;
  /** Maska vrstvy (počítá se až při prvním použití a drží se v mezipaměti). */
  layer: (name: BarrierLayer) => Uint8Array;
  /** Zdivo bez uzavření dveří (podíl stěn kolem oblasti). */
  readonly walls: Uint8Array;
  minAreaPx: number;
  maxAreaPx: number;
  /** Fáze 114: plocha 3,5 m² v px (kratší oblast po kliku = další kolo). */
  clickMinPx: number;
  /** Sdílené razítko oblastí (kontrola, který popisek leží v oblasti). */
  stamp: Int32Array;
  stampId: number;
}

const px = (mm: number, mmPerPx: number) => Math.max(1, Math.round(mm / mmPerPx));

function clearBox(mask: Uint8Array, w: number, h: number, box: RoomTag["box"], margin: number) {
  const x0 = Math.max(0, Math.floor(box.x0 - margin));
  const y0 = Math.max(0, Math.floor(box.y0 - margin));
  const x1 = Math.min(w - 1, Math.ceil(box.x1 + margin));
  const y1 = Math.min(h - 1, Math.ceil(box.y1 + margin));
  if (x1 < x0) return;
  for (let y = y0; y <= y1; y++) mask.fill(0, y * w + x0, y * w + x1 + 1);
}

const union = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] | b[i];
  return out;
};

/** Fáze 114: otvory do 1,6 m (dvoukřídlé dveře, průchody) – vrstva `hatchWide`. */
export const WIDE_GAP_MM = 1600;

/**
 * Masky stěn pro hledání místností (popisky místností se z masky vymažou – nejsou to stěny). Fáze 114: morfologická
 * filtrace tloušťky čar před flood fill – tenké 1–2px čáry (kóty, vynášecí čáry, osy řezů, oblouky dveří, text,
 * nábytek) se odstraní, bariérou jsou tlusté obrysy zdiva a šrafované pásy stěn (husté šrafy zacelené do plného pásu).
 * Vrstvy (`BARRIER_LAYERS`) se počítají líně – klik do místnosti obvykle potřebuje jen první z nich.
 */
export function buildBarrier(raster: Raster, tags: readonly RoomTag[], options: DetectOptions): Barrier {
  const { width: w, height: h } = raster;
  const mmPerPx = options.mmPerPx > 0 ? options.mmPerPx : 10;
  const dark = darkMask(raster, options.threshold ?? 160);
  for (const tag of tags) clearBox(dark, w, h, tag.box, tag.h * 0.25);
  const gap = px((options.doorGapMm ?? DOOR_GAP_MM) / 2, mmPerPx);
  const wideGap = Math.max(gap, px(WIDE_GAP_MM / 2, mmPerPx));
  const cache = new Map<string, Uint8Array>();
  const memo = (key: string, make: () => Uint8Array) => {
    let value = cache.get(key);
    if (!value) cache.set(key, (value = make()));
    return value;
  };
  // Antialiasing nechává v čarách 1px mezery – utěsnit
  const sealed = () => memo("sealed", () => dilate(dark, w, h, 1));
  // Zdivo: šrafy po ~8 cm zacelit, pak odstranit čáry tenčí než ~6 cm
  const walls1 = () => memo("walls1", () => open(close(dark, w, h, px(40, mmPerPx)), w, h, px(30, mmPerPx)));
  // Fáze 114: husté šrafování zdiva a příček (rozteč šraf do ~16 cm) do plného pásu, silnější filtr tenkých čar (aspoň 2 px)
  const walls2 = () => memo("walls2", () => open(close(dark, w, h, Math.min(12, Math.max(3, px(80, mmPerPx)))), w, h, Math.max(2, px(40, mmPerPx))));
  const walls = () => memo("walls", () => union(walls1(), walls2()));
  const layers: Record<BarrierLayer, () => Uint8Array> = {
    thick: () => close(walls1(), w, h, gap),
    hatch: () => close(walls2(), w, h, gap),
    hatchWide: () => close(walls2(), w, h, wideGap),
    // Obrysy: čáry užší než 3 px (1–2px kóty, oblouky dveří, text, nábytek) pryč, zbytek utěsnit
    outline: () => close(dilate(open(dark, w, h, 1), w, h, 1), w, h, gap),
    outlineStrong: () => close(dilate(open(dark, w, h, 2), w, h, 1), w, h, gap),
    hybrid: () => {
      // Okna a zárubně = tenké čáry do 0,4 m od zdiva (kóta uprostřed místnosti ji nerozdělí)
      const near = dilate(walls(), w, h, px(400, mmPerPx));
      const lines = sealed();
      const nearLines = new Uint8Array(w * h);
      for (let i = 0; i < nearLines.length; i++) nearLines[i] = lines[i] & near[i];
      return close(union(walls(), nearLines), w, h, gap);
    },
    all: () => close(sealed(), w, h, gap),
  };
  const areaPx = (m2: number) => (m2 * 1_000_000) / (mmPerPx * mmPerPx);
  return {
    w,
    h,
    mmPerPx,
    layer: (name) => memo(`layer:${name}`, layers[name]),
    get walls() {
      return walls();
    },
    minAreaPx: areaPx(options.minAreaM2 ?? MIN_ROOM_M2),
    maxAreaPx: areaPx(options.maxAreaM2 ?? MAX_ROOM_M2),
    clickMinPx: areaPx(MIN_CLICK_ROOM_M2),
    stamp: new Int32Array(w * h),
    stampId: 0,
  };
}

export interface Region {
  pixels: Int32Array;
  count: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  touchesBorder: boolean;
}

/** Flood fill (4-okolí) volné plochy od bodu; `limit` = přerušit, když oblast přeroste (únik ven). */
export function floodRegion(barrier: Uint8Array, w: number, h: number, seed: Pt, limit = w * h, visited?: Int32Array, mark = 1): Region | null {
  const sx = Math.round(seed.x);
  const sy = Math.round(seed.y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null;
  const start = sy * w + sx;
  if (barrier[start]) return null;
  const seen = visited ?? new Int32Array(w * h);
  if (seen[start]) return null;
  const pixels = new Int32Array(Math.min(limit + 1, w * h));
  let count = 0;
  let x0 = sx;
  let y0 = sy;
  let x1 = sx;
  let y1 = sy;
  let touchesBorder = false;
  const stack = [start];
  seen[start] = mark;
  while (stack.length) {
    const index = stack.pop()!;
    if (count >= pixels.length) return { pixels, count, x0, y0, x1, y1, touchesBorder: true };
    pixels[count++] = index;
    const x = index % w;
    const y = (index - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesBorder = true;
    if (x > 0 && !barrier[index - 1] && !seen[index - 1]) {
      seen[index - 1] = mark;
      stack.push(index - 1);
    }
    if (x < w - 1 && !barrier[index + 1] && !seen[index + 1]) {
      seen[index + 1] = mark;
      stack.push(index + 1);
    }
    if (y > 0 && !barrier[index - w] && !seen[index - w]) {
      seen[index - w] = mark;
      stack.push(index - w);
    }
    if (y < h - 1 && !barrier[index + w] && !seen[index + w]) {
      seen[index + w] = mark;
      stack.push(index + w);
    }
  }
  return { pixels: pixels.subarray(0, count), count, x0, y0, x1, y1, touchesBorder };
}

/** Nejbližší volný pixel kolem bodu (popisek může ležet na zbytku čáry). */
function freeNear(mask: Uint8Array, w: number, h: number, point: Pt, radius: number): Pt | null {
  const cx = Math.round(point.x);
  const cy = Math.round(point.y);
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && y >= 0 && x < w && y < h && !mask[y * w + x]) return { x, y };
      }
    }
  }
  return null;
}

const plausible = (region: Region | null, barrier: Barrier): region is Region => Boolean(region) && !region!.touchesBorder && region!.count >= barrier.minAreaPx && region!.count <= barrier.maxAreaPx;

/** Razítko oblasti – `has(point)` = leží bod v oblasti. */
function stampRegion(barrier: Barrier, region: Region) {
  const id = ++barrier.stampId;
  for (let i = 0; i < region.count; i++) barrier.stamp[region.pixels[i]] = id;
  return (point: Pt) => {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    return x >= 0 && y >= 0 && x < barrier.w && y < barrier.h && barrier.stamp[y * barrier.w + x] === id;
  };
}

/**
 * Oblast kolem bodu – vrstvy od zdiva k tenkým čarám (`BARRIER_LAYERS`): tenké čáry uvnitř místnost nerozdělí, okno ji
 * neotevře. Oblast s cizím popiskem (široké dveře spojily dvě místnosti) se zkusí v další vrstvě. Fáze 114: oblast
 * menší než 3,5 m² (kóta, oblouk dveří nebo nábytek ji uzavřely) = další kolo se silnějším filtrem tenkých čar; když
 * žádná vrstva větší oblast nenajde, platí první nalezená (malá místnost – WC, spíž).
 */
function regionAt(barrier: Barrier, seed: Pt, radius: number, reject: (region: Region, layer: BarrierLayer) => boolean = () => false): Region | null {
  let first: Region | null = null;
  const at = (layer: BarrierLayer): Region | null => {
    const mask = barrier.layer(layer);
    const start = freeNear(mask, barrier.w, barrier.h, seed, radius);
    if (!start) return null;
    const region = floodRegion(mask, barrier.w, barrier.h, start, Math.ceil(barrier.maxAreaPx) + 1);
    return plausible(region, barrier) && !reject(region, layer) ? region : null;
  };
  // Zdivo dvakrát (šrafy po ~8 cm / husté šrafy do plného pásu): z obou platí menší oblast – větší nejspíš unikla přes
  // příčku, kterou první vrstva neudržela
  const walls = WALL_LAYERS.map(at)
    .filter((region): region is Region => region !== null)
    .sort((a, b) => a.count - b.count);
  const roomy = walls.find((region) => region.count >= barrier.clickMinPx);
  if (roomy) return roomy;
  // Malá místnost (WC, spíž): menší oblast ze zdiva, jinak první z dalších vrstev
  first = walls[0] ?? null;
  for (const layer of BARRIER_LAYERS) {
    if (WALL_LAYERS.includes(layer)) continue;
    const region = at(layer);
    if (!region) continue;
    if (region.count >= barrier.clickMinPx) return region;
    first ??= region;
  }
  return first;
}

/** Oblast obsahuje cizí popisek (v jemnější vrstvě než „všechny čáry“ = široké dveře spojily dvě místnosti). */
const containsOther = (barrier: Barrier, others: readonly Pt[]) => (region: Region, layer: BarrierLayer) => {
  if (layer === "all" || !others.length) return false;
  const has = stampRegion(barrier, region);
  return others.some(has);
};

// ---------------------------------------------------------------------------
//  Oblast → obdélník / polygon (hrubá mřížka, obrys po hranách buněk, zjednodušení)
// ---------------------------------------------------------------------------

/** Oblast s vyplněnými dírami (nábytek, text uvnitř místnosti) v obálce + plocha. */
function filledRegion(region: Region, w: number) {
  const bw = region.x1 - region.x0 + 3;
  const bh = region.y1 - region.y0 + 3;
  const inside = new Uint8Array(bw * bh);
  for (let i = 0; i < region.count; i++) {
    const index = region.pixels[i];
    const x = index % w;
    const y = (index - x) / w;
    inside[(y - region.y0 + 1) * bw + (x - region.x0 + 1)] = 1;
  }
  // Vnějšek = flood fill od rámečku obálky; vše ostatní (oblast + díry) je místnost
  const outside = floodRegion(inside, bw, bh, { x: 0, y: 0 });
  const filled = new Uint8Array(bw * bh).fill(1);
  if (outside) for (let i = 0; i < outside.count; i++) filled[outside.pixels[i]] = 0;
  let area = 0;
  for (let i = 0; i < filled.length; i++) area += filled[i];
  return { filled, bw, bh, ox: region.x0 - 1, oy: region.y0 - 1, area };
}

/** Uzavřené obrysy buněk mřížky (hrany po směru hodinových ručiček, na křížení se zatáčí doprava). */
export function traceLoops(grid: Uint8Array, gw: number, gh: number): Pt[][] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < gw && y < gh ? grid[y * gw + x] : 0);
  const edges = new Map<string, { to: Pt; dir: number }[]>();
  const add = (from: Pt, to: Pt, dir: number) => {
    const key = `${from.x},${from.y}`;
    const list = edges.get(key);
    if (list) list.push({ to, dir });
    else edges.set(key, [{ to, dir }]);
  };
  // směry: 0 = vpravo, 1 = dolů, 2 = vlevo, 3 = nahoru
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (!grid[y * gw + x]) continue;
      if (!at(x, y - 1)) add({ x, y }, { x: x + 1, y }, 0);
      if (!at(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 }, 1);
      if (!at(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 }, 2);
      if (!at(x - 1, y)) add({ x, y: y + 1 }, { x, y }, 3);
    }
  }
  const loops: Pt[][] = [];
  for (const [key, list] of edges) {
    while (list.length) {
      const [sx, sy] = key.split(",").map(Number);
      const loop: Pt[] = [{ x: sx, y: sy }];
      let edge = list.pop()!;
      for (let guard = 0; guard < 1_000_000; guard++) {
        loop.push(edge.to);
        if (edge.to.x === sx && edge.to.y === sy) break;
        const next = edges.get(`${edge.to.x},${edge.to.y}`);
        if (!next?.length) break;
        // Na křížení dvou buněk přes roh zatočit doprava (4-souvislost)
        const right = (edge.dir + 1) % 4;
        const index = next.findIndex((candidate) => candidate.dir === right);
        edge = next.splice(index >= 0 ? index : next.length - 1, 1)[0];
      }
      loop.pop();
      if (loop.length >= 4) loops.push(loop);
    }
  }
  return loops;
}

export function polygonArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** Vynechá rohy na přímce (souvislé hrany ve stejném směru). */
export function dropCollinear(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const cur = points[i];
    const next = points[(i + 1) % points.length];
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (Math.abs(cross) > 1e-9) out.push(cur);
  }
  return out;
}

function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

function rdp(points: readonly Pt[], eps: number): Pt[] {
  if (points.length < 3) return [...points];
  let index = -1;
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], points[0], points[points.length - 1]);
    if (d > max) {
      max = d;
      index = i;
    }
  }
  if (max <= eps) return [points[0], points[points.length - 1]];
  const left = rdp(points.slice(0, index + 1), eps);
  return [...left.slice(0, -1), ...rdp(points.slice(index), eps)];
}

/** Zjednodušení uzavřeného obrysu (Douglas–Peucker mezi dvěma nejvzdálenějšími body). */
export function simplifyLoop(points: readonly Pt[], eps: number): Pt[] {
  if (points.length <= 4) return [...points];
  const dist = (p: Pt) => Math.hypot(p.x - points[0].x, p.y - points[0].y);
  let far = 0;
  for (let i = 1; i < points.length; i++) if (dist(points[i]) > dist(points[far])) far = i;
  const first = rdp(points.slice(0, far + 1), eps);
  const second = rdp([...points.slice(far), points[0]], eps);
  return dropCollinear([...first.slice(0, -1), ...second.slice(0, -1)]);
}

const rectPoints = (x0: number, y0: number, x1: number, y1: number): Pt[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

/**
 * Obálka bez mělkých výstupků (okenní a dveřní niky v tloušťce zdi): krajní sloupec / řádek musí mít aspoň 30 %
 * nejplnějšího sloupce / řádku oblasti.
 */
function coreBox(filled: Uint8Array, bw: number, bh: number) {
  const cols = new Int32Array(bw);
  const rows = new Int32Array(bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      if (!filled[y * bw + x]) continue;
      cols[x]++;
      rows[y]++;
    }
  }
  const edge = (counts: Int32Array) => {
    const limit = Math.max(...counts) * 0.3;
    let from = 0;
    while (from < counts.length - 1 && counts[from] < limit) from++;
    let to = counts.length - 1;
    while (to > from && counts[to] < limit) to--;
    return [from, to + 1] as const;
  };
  const [x0, x1] = edge(cols);
  const [y0, y1] = edge(rows);
  let inside = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) inside += filled[y * bw + x];
  return { x0, y0, x1, y1, fill: inside / Math.max(1, (x1 - x0) * (y1 - y0)) };
}

/** Oblast → obdélník (vyplnění obálky ≥ 85 %) nebo polygon na mřížce ~5 cm (nejvýš 40 rohů). */
export function regionShape(region: Region, w: number, mmPerPx: number): { points: Pt[]; rect: boolean; areaPx: number } {
  const { filled, bw, bh, ox, oy, area } = filledRegion(region, w);
  const core = coreBox(filled, bw, bh);
  const box = rectPoints(ox + core.x0, oy + core.y0, ox + core.x1, oy + core.y1);
  if (core.fill >= 0.85) return { points: box, rect: true, areaPx: area };
  const cell = Math.max(1, Math.round(50 / mmPerPx));
  const gw = Math.ceil(bw / cell);
  const gh = Math.ceil(bh / cell);
  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let on = 0;
      let all = 0;
      for (let y = gy * cell; y < Math.min(bh, (gy + 1) * cell); y++) {
        for (let x = gx * cell; x < Math.min(bw, (gx + 1) * cell); x++) {
          on += filled[y * bw + x];
          all++;
        }
      }
      grid[gy * gw + gx] = all && on * 2 >= all ? 1 : 0;
    }
  }
  // Drobné zuby (zárubně, nábytek u stěny) a mělké niky do ~35 cm (okna, dveře v tloušťce zdi) zahladit
  const smooth = open(close(grid, gw, gh, 1), gw, gh, 3);
  const loops = traceLoops(smooth, gw, gh).sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)));
  const loop = loops[0] ? dropCollinear(loops[0]) : [];
  let eps = 1.5;
  let points = simplifyLoop(loop, eps);
  while (points.length > MAX_ROOM_POINTS && eps < 50) {
    eps *= 1.5;
    points = simplifyLoop(loop, eps);
  }
  if (points.length < 3) return { points: box, rect: true, areaPx: area };
  return { points: points.map((point) => ({ x: ox + point.x * cell, y: oy + point.y * cell })), rect: false, areaPx: area };
}

// ---------------------------------------------------------------------------
//  Stupeň 1 a 2: automatické rozpoznání a klik do místnosti
// ---------------------------------------------------------------------------

function toRoom(region: Region, barrier: Barrier, seed: Pt, source: DetectedRoom["source"], tags: readonly RoomTag[]): DetectedRoom {
  const shape = regionShape(region, barrier.w, barrier.mmPerPx);
  const names = [...new Set(tags.map(tagRoomName).filter((name): name is string => Boolean(name)))];
  const areas = tags.filter((tag) => tag.areaM2).map((tag) => tag.areaM2!);
  return {
    name: names.length ? names.join(" + ") : null,
    number: tags.find((tag) => tag.number)?.number ?? null,
    labelAreaM2: areas.length ? Math.round(areas.reduce((sum, area) => sum + area, 0) * 100) / 100 : null,
    areaM2: Math.round(((shape.areaPx * barrier.mmPerPx * barrier.mmPerPx) / 1_000_000) * 10) / 10,
    areaPx: shape.areaPx,
    points: shape.points,
    rect: shape.rect,
    seed,
    source,
  };
}

/** Podíl okraje oblasti u zdiva (místnost má stěny, vnitřek nábytku jen tenké čáry). */
function wallShare(region: Region, barrier: Barrier, mask: Uint8Array): number {
  const { w, h, walls } = barrier;
  const reach = 3;
  let edge = 0;
  let walled = 0;
  for (let i = 0; i < region.count; i += 2) {
    const index = region.pixels[i];
    const x = index % w;
    const y = (index - x) / w;
    if (!(x > 0 && x < w - 1 && y > 0 && y < h - 1)) continue;
    if (!(mask[index - 1] || mask[index + 1] || mask[index - w] || mask[index + w])) continue;
    edge++;
    let near = false;
    for (let dy = -reach; dy <= reach && !near; dy++) {
      for (let dx = -reach; dx <= reach && !near; dx++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        if (walls[yy * w + xx]) near = true;
      }
    }
    if (near) walled++;
  }
  return edge ? walled / edge : 0;
}

/** Měřítko z výměr v popiscích: průměr √(výměra / plocha v px²) přes místnosti, které se shodují do 12 % s mediánem. */
export function scaleFromAreas(rooms: readonly Pick<DetectedRoom, "labelAreaM2" | "areaPx">[]): number | null {
  const ratios = rooms
    .filter((room) => room.labelAreaM2 && room.areaPx > 0)
    .map((room) => Math.sqrt((room.labelAreaM2! * 1_000_000) / room.areaPx))
    .sort((a, b) => a - b);
  if (ratios.length < 2) return null;
  const median = ratios[Math.floor(ratios.length / 2)];
  const agree = ratios.filter((ratio) => Math.abs(ratio / median - 1) <= 0.12);
  return agree.length >= 2 && agree.length >= ratios.length * 0.6 ? agree.reduce((sum, ratio) => sum + ratio, 0) / agree.length : null;
}

/**
 * Stupeň 1 – automaticky: s popisky z PDF místnost kolem každého popisku (víc popisků v jedné oblasti = „Kuchyň +
 * Obývací pokoj“), bez textové vrstvy všechny uzavřené oblasti ohraničené zdivem v rozsahu 1–300 m².
 */
export function detectRooms(raster: Raster, tags: readonly RoomTag[], options: DetectOptions): DetectResult {
  return detectWithBarrier(buildBarrier(raster, tags, options), tags);
}

/** Totéž nad připravenými maskami stěn (klient je drží v mezipaměti pro 🪄 klik i 🔍 automaticky). */
export function detectWithBarrier(barrier: Barrier, tags: readonly RoomTag[]): DetectResult {
  const rooms: DetectedRoom[] = [];
  const { w, h } = barrier;
  const labelled = tags.filter((tag) => tag.name || tag.number);
  let unmatched = 0;
  if (labelled.length) {
    const groups: { region: Region; seed: Pt; tags: RoomTag[]; has: (point: Pt) => boolean }[] = [];
    for (const tag of labelled) {
      const hit = groups.find((group) => group.has(tag));
      if (hit) {
        hit.tags.push(tag);
        continue;
      }
      const others = labelled.filter((other) => other !== tag && !groups.some((group) => group.tags.includes(other)));
      const region = regionAt(barrier, tag, Math.ceil(tag.h * 2), containsOther(barrier, others));
      if (!region) {
        unmatched++;
        continue;
      }
      // Které popisky v oblasti leží (sdílené razítko další oblast přepíše – výsledek se uloží)
      const key = (point: Pt) => Math.round(point.y) * w + Math.round(point.x);
      const has = stampRegion(barrier, region);
      const member = new Set(tags.filter(has).map(key));
      groups.push({ region, seed: { x: tag.x, y: tag.y }, tags: [tag], has: (point) => member.has(key(point)) });
    }
    // Výměra bez názvu / čísla patří místnosti, ve které leží
    for (const tag of tags.filter((candidate) => !candidate.name && !candidate.number && candidate.areaM2)) {
      const hit = groups.find((group) => group.has(tag));
      if (hit && !hit.tags.some((existing) => existing.areaM2)) hit.tags.push(tag);
    }
    for (const group of groups) rooms.push(toRoom(group.region, barrier, group.seed, "label", group.tags));
  } else {
    // Bez popisků: souvislé oblasti zdiva s okny, obrysových čar (bez tenkých kót) nebo všech čar – fáze 114: platí
    // vrstva s největší celkovou plochou místností (šrafovaný CAD výkres s kótami se nerozpadne na útržky)
    let best: { rooms: DetectedRoom[]; area: number } | null = null;
    for (const layer of SCAN_LAYERS) {
      const mask = barrier.layer(layer);
      const used = new Int32Array(w * h);
      const found: DetectedRoom[] = [];
      let area = 0;
      let mark = 0;
      for (let y = 1; y < h - 1; y += 2) {
        for (let x = 1; x < w - 1; x += 2) {
          const index = y * w + x;
          if (mask[index] || used[index]) continue;
          const region = floodRegion(mask, w, h, { x, y }, w * h, used, ++mark);
          if (!plausible(region, barrier)) continue;
          if (wallShare(region, barrier, mask) < 0.45) continue;
          found.push(toRoom(region, barrier, { x: (region.x0 + region.x1) / 2, y: (region.y0 + region.y1) / 2 }, "region", []));
          area += region.count;
        }
      }
      if (found.length && (!best || area > best.area * 1.05)) best = { rooms: found, area };
    }
    rooms.push(...(best?.rooms ?? []));
  }
  return { rooms, suggestedMmPerPx: scaleFromAreas(rooms), unmatchedTags: unmatched, tags: labelled.length };
}

/** Stupeň 2 – 🪄 klik do místnosti: oblast kolem bodu, název z popisku uvnitř; neuzavřená oblast = chyba. */
export function roomAt(barrier: Barrier, point: Pt, tags: readonly RoomTag[]): DetectedRoom | { error: string } {
  // Fáze 114: oblast se 2 a více popisky místností (široké dveře spojily místnosti) se zkusí v další vrstvě
  const labelled = tags.filter((tag) => tag.name || tag.number);
  const region = regionAt(barrier, point, 6, (candidate, layer) => {
    if (layer === "all" || labelled.length < 2) return false;
    const has = stampRegion(barrier, candidate);
    return labelled.filter(has).length >= 2;
  });
  if (!region) return { error: "Kolem bodu se nenašla uzavřená místnost (stěny jsou přerušené nebo je to venku) – zkuste 📐 Rychlou místnost 2 kliky." };
  const has = stampRegion(barrier, region);
  return toRoom(region, barrier, point, "click", tags.filter((tag) => (tag.name || tag.number || tag.areaM2) && has(tag)));
}

/** Stupeň 3 – 📐 dva protilehlé rohy → obdélník (libovolné pořadí kliknutí). */
export function rectFromCorners(a: Pt, b: Pt): { x: number; y: number; w: number; h: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}
