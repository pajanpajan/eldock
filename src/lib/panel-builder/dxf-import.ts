// Fáze 79: import výkresu DXF (ASCII) do 2D půdorysu – čistý parser bez knihoven. Entity LINE, LWPOLYLINE, POLYLINE
// (+ VERTEX / SEQEND), CIRCLE, ARC, TEXT, MTEXT a INSERT (bloky rekurzivně, nejvýš 8 úrovní) se převedou na úsečky
// (oblouky po 10°) a texty podle CAD hladin (kód 8) s barvou ACI. Jednotky z `$INSUNITS`, jinak odhad z rozměru výkresu;
// výsledek je v mm s osou Y dolů (jako půdorys) – měřítko 1 : 1 bez ruční kalibrace. Binární DXF ani DWG nečte.

export type DxfUnits = "mm" | "cm" | "m" | "in" | "ft";
export const UNIT_MM: Record<DxfUnits, number> = { mm: 1, cm: 10, m: 1000, in: 25.4, ft: 304.8 };
/** `$INSUNITS` → jednotka (0 = bez jednotek → odhad z rozměru). */
const INSUNITS: Record<number, DxfUnits> = { 1: "in", 2: "ft", 4: "mm", 5: "cm", 6: "m" };

export interface CadText {
  x: number;
  y: number;
  /** Výška písma [mm]. */
  size: number;
  /** Otočení ve stupních po směru hodin (osa Y dolů). */
  rotation: number;
  value: string;
}

export interface CadLayer {
  name: string;
  /** Barva hladiny (#rrggbb z ACI). */
  color: string;
  /** Úsečky hladiny [x1, y1, x2, y2, …] v mm půdorysu. */
  segments: number[];
  texts: CadText[];
  /** Počet entit výkresu na hladině (po rozbalení bloků). */
  entities: number;
  /** Hladina vypnutá nebo zmrazená už v DXF. */
  off: boolean;
}

export interface DxfDrawing {
  units: DxfUnits;
  /** Jak se jednotka určila. */
  unitsSource: "header" | "extent";
  /** Rozměr výkresu [mm]. */
  widthMm: number;
  heightMm: number;
  layers: CadLayer[];
  /** Přeskočené druhy entit (HATCH, SPLINE, DIMENSION …) s počtem. */
  skipped: Record<string, number>;
}

export class DxfError extends Error {}

/** DWG je uzavřený binární formát AutoCADu bez veřejné specifikace – návod na uložení jako DXF. */
export const DWG_MESSAGE = "Soubor DWG – uzavřený formát AutoCADu. Uložte výkres v CAD programu jako DXF (Uložit jako → DXF ve formátu ASCII) a nahrajte ho znovu.";

// ACI 1–9 přesně, ostatní odstíny z kruhu barev AutoCADu (10–249) a šedé 250–255
const ACI_BASE: Record<number, string> = { 1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff", 5: "#0000ff", 6: "#ff00ff", 7: "#ffffff", 8: "#808080", 9: "#c0c0c0" };
export function aciColor(index: number): string {
  const aci = Math.abs(Math.round(index));
  if (ACI_BASE[aci]) return ACI_BASE[aci];
  if (aci >= 250 && aci <= 255) {
    const value = Math.round(51 + ((aci - 250) / 5) * 204);
    return `#${value.toString(16).padStart(2, "0").repeat(3)}`;
  }
  if (aci < 10 || aci > 249) return "#ffffff";
  // 10–249: odstín po 15°, sudé plné / liché pastelové, 5 úrovní jasu
  const hue = Math.floor((aci - 10) / 10) * 15;
  const step = (aci - 10) % 10;
  const value = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][step];
  const saturation = step % 2 === 0 ? 1 : 0.5;
  const c = value * saturation;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = value - c;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

type Pair = { code: number; value: string };

function pairs(text: string): Pair[] {
  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  const out: Pair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index].trim(), 10);
    if (!Number.isFinite(code)) throw new DxfError("Soubor není textový DXF (ASCII) – uložte výkres jako DXF ve formátu ASCII.");
    out.push({ code, value: lines[index + 1] });
  }
  return out;
}

interface RawEntity {
  type: string;
  layer: string;
  color: number | null;
  codes: Pair[];
}

/** Entity ze sekce (ENTITIES nebo jeden blok) – POLYLINE spojí s VERTEX až do SEQEND. */
function entitiesOf(list: Pair[]): RawEntity[] {
  const out: RawEntity[] = [];
  let current: RawEntity | null = null;
  for (const pair of list) {
    if (pair.code === 0) {
      const type = pair.value.trim().toUpperCase();
      if (current && current.type === "POLYLINE" && (type === "VERTEX" || type === "SEQEND")) {
        if (type === "VERTEX") current.codes.push({ code: -1, value: "VERTEX" });
        else {
          out.push(current);
          current = null;
        }
        continue;
      }
      if (current) out.push(current);
      current = { type, layer: "0", color: null, codes: [] };
      continue;
    }
    if (!current) continue;
    if (pair.code === 8 && !current.codes.some((entry) => entry.code === -1)) current.layer = pair.value.trim() || "0";
    else if (pair.code === 62 && current.color === null) current.color = Number.parseInt(pair.value, 10);
    current.codes.push(pair);
  }
  if (current) out.push(current);
  return out;
}

const num = (codes: Pair[], code: number, fallback = 0) => {
  const found = codes.find((pair) => pair.code === code);
  const value = found ? Number.parseFloat(found.value) : Number.NaN;
  return Number.isFinite(value) ? value : fallback;
};
const str = (codes: Pair[], code: number) => codes.find((pair) => pair.code === code)?.value ?? "";

/** Afinní transformace bloku (2D). */
interface Matrix {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}
const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const apply = (m: Matrix, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
const multiply = (m: Matrix, n: Matrix): Matrix => ({ a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b, c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d, e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f });

/** Znaky zapsané jako \U+XXXX (AutoCAD, export Eldocku) a řídicí kódy %%d (°), %%p (±), %%c (⌀), %%% (%). */
export function decodeDxfText(raw: string): string {
  return raw
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/%%[dD]/g, "°")
    .replace(/%%[pP]/g, "±")
    .replace(/%%[cC]/g, "⌀")
    .replace(/%%%/g, "%")
    .replace(/%%[uUoOkK]/g, "");
}

/** Text MTEXT bez formátovacích kódů (\P = nový řádek, {\f…;} písmo, \H výška …). */
export function mtextPlain(raw: string): string {
  return raw
    .replace(/\\P/g, "\n")
    .replace(/\\[ACcFfHhQTtWw][^;]*;/g, "")
    .replace(/\\[LlOoKk]/g, "")
    .replace(/\\S([^;]*);/g, (_, fraction: string) => fraction.replace(/[#^]/g, "/"))
    .replace(/[{}]/g, "")
    .replace(/\\\\/g, "\\")
    .trim();
}

const ARC_STEP_DEG = 10;

/** Body oblouku (úhly ve stupních proti směru hodin, osa Y nahoru). */
function arcPoints(cx: number, cy: number, r: number, start: number, end: number): { x: number; y: number }[] {
  let sweep = end - start;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(2, Math.ceil(sweep / ARC_STEP_DEG));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = ((start + (sweep * index) / steps) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

/** Úsek polyčáry s vydutím (bulge = tg(úhel/4)) → body oblouku. */
function bulgePoints(p: { x: number; y: number }, q: { x: number; y: number }, bulge: number) {
  if (Math.abs(bulge) < 1e-9) return [q];
  const chord = Math.hypot(q.x - p.x, q.y - p.y);
  if (chord < 1e-9) return [q];
  const theta = 4 * Math.atan(bulge);
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const h = Math.sqrt(Math.max(0, r * r - (chord / 2) ** 2));
  const dir = { x: (q.x - p.x) / chord, y: (q.y - p.y) / chord };
  const side = (bulge > 0 ? 1 : -1) * (Math.abs(theta) > Math.PI ? -1 : 1);
  const center = { x: mid.x - dir.y * h * side, y: mid.y + dir.x * h * side };
  const a0 = (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI;
  const a1 = (Math.atan2(q.y - center.y, q.x - center.x) * 180) / Math.PI;
  const points = bulge > 0 ? arcPoints(center.x, center.y, r, a0, a1) : arcPoints(center.x, center.y, r, a1, a0).reverse();
  return points.slice(1);
}

interface Collected {
  layer: string;
  color: number | null;
  /** Lomené čáry ve výkresových jednotkách (Y nahoru). */
  lines: { x: number; y: number }[][];
  texts: { x: number; y: number; size: number; rotation: number; value: string }[];
}

const MAX_DEPTH = 8;
/** Pojistka proti obřím výkresům (úseček celkem). */
export const MAX_SEGMENTS = 250_000;

export function parseDxf(text: string): DxfDrawing {
  if (/^AC10\d\d/.test(text.slice(0, 6))) throw new DxfError(DWG_MESSAGE);
  if (text.startsWith("AutoCAD Binary DXF")) throw new DxfError("Binární DXF – uložte výkres jako DXF ve formátu ASCII.");
  const all = pairs(text);
  // Sekce
  const sections = new Map<string, Pair[]>();
  for (let index = 0; index < all.length; index++) {
    if (all[index].code === 0 && all[index].value.trim() === "SECTION" && all[index + 1]?.code === 2) {
      const name = all[index + 1].value.trim().toUpperCase();
      const start = index + 2;
      let end = start;
      while (end < all.length && !(all[end].code === 0 && all[end].value.trim() === "ENDSEC")) end++;
      sections.set(name, all.slice(start, end));
      index = end;
    }
  }
  const entities = sections.get("ENTITIES");
  if (!entities) throw new DxfError("Ve výkresu DXF chybí sekce ENTITIES – soubor je poškozený nebo prázdný.");

  // Hlavička: $INSUNITS
  const header = sections.get("HEADER") ?? [];
  const unitsAt = header.findIndex((pair) => pair.code === 9 && pair.value.trim() === "$INSUNITS");
  const insunits = unitsAt >= 0 ? Number.parseInt(header[unitsAt + 1]?.value ?? "0", 10) : 0;

  // Hladiny: barva (62, záporná = vypnutá), příznaky (70: 1 = zmrazená)
  const layerInfo = new Map<string, { color: number; off: boolean }>();
  const tables = sections.get("TABLES") ?? [];
  for (let index = 0; index < tables.length; index++) {
    if (tables[index].code === 0 && tables[index].value.trim() === "LAYER") {
      const codes: Pair[] = [];
      let cursor = index + 1;
      while (cursor < tables.length && tables[cursor].code !== 0) codes.push(tables[cursor++]);
      const name = str(codes, 2).trim();
      if (name) {
        const color = num(codes, 62, 7);
        layerInfo.set(name, { color: Math.abs(color) || 7, off: color < 0 || (num(codes, 70) & 1) === 1 });
      }
      index = cursor - 1;
    }
  }

  // Bloky
  const blocks = new Map<string, { base: { x: number; y: number }; entities: RawEntity[] }>();
  const blockSection = sections.get("BLOCKS") ?? [];
  for (let index = 0; index < blockSection.length; index++) {
    if (blockSection[index].code === 0 && blockSection[index].value.trim() === "BLOCK") {
      let cursor = index + 1;
      const head: Pair[] = [];
      while (cursor < blockSection.length && blockSection[cursor].code !== 0) head.push(blockSection[cursor++]);
      const start = cursor;
      while (cursor < blockSection.length && !(blockSection[cursor].code === 0 && blockSection[cursor].value.trim() === "ENDBLK")) cursor++;
      const name = str(head, 2).trim();
      const base = { x: num(head, 10), y: num(head, 20) };
      if (name) blocks.set(name, { base, entities: entitiesOf(blockSection.slice(start, cursor)) });
      index = cursor;
    }
  }

  const collected: Collected[] = [];
  const skipped: Record<string, number> = {};
  let segmentCount = 0;
  const emit = (layer: string, color: number | null, line: { x: number; y: number }[]) => {
    if (line.length < 2) return;
    segmentCount += line.length - 1;
    if (segmentCount > MAX_SEGMENTS) throw new DxfError(`Výkres má přes ${MAX_SEGMENTS.toLocaleString("cs-CZ")} úseček – vyčistěte ho v CAD programu (zmrazte šrafy, nábytek) a nahrajte znovu.`);
    collected.push({ layer, color, lines: [line], texts: [] });
  };

  const walk = (list: RawEntity[], matrix: Matrix, parentLayer: string | null, depth: number) => {
    for (const entity of list) {
      // Entita bloku na hladině 0 přebírá hladinu vložení (pravidlo AutoCADu)
      const layer = parentLayer && entity.layer === "0" ? parentLayer : entity.layer;
      const color = entity.color === 0 || entity.color === 256 ? null : entity.color;
      const at = (x: number, y: number) => apply(matrix, x, y);
      const c = entity.codes;
      const polyline = (vertices: { x: number; y: number; bulge: number }[], closed: boolean) => {
        if (vertices.length < 2) return;
        const points: { x: number; y: number }[] = [{ x: vertices[0].x, y: vertices[0].y }];
        const ring = closed ? [...vertices, vertices[0]] : vertices;
        for (let index = 1; index < ring.length; index++) points.push(...bulgePoints(ring[index - 1], ring[index], ring[index - 1].bulge));
        emit(layer, color, points.map((point) => at(point.x, point.y)));
      };
      switch (entity.type) {
        case "LINE":
          emit(layer, color, [at(num(c, 10), num(c, 20)), at(num(c, 11), num(c, 21))]);
          break;
        case "LWPOLYLINE": {
          const vertices: { x: number; y: number; bulge: number }[] = [];
          for (const pair of c) {
            if (pair.code === 10) vertices.push({ x: Number.parseFloat(pair.value), y: 0, bulge: 0 });
            else if (pair.code === 20 && vertices.length) vertices[vertices.length - 1].y = Number.parseFloat(pair.value);
            else if (pair.code === 42 && vertices.length) vertices[vertices.length - 1].bulge = Number.parseFloat(pair.value) || 0;
          }
          polyline(vertices, (num(c, 70) & 1) === 1);
          break;
        }
        case "POLYLINE": {
          const vertices: { x: number; y: number; bulge: number }[] = [];
          let inVertex = false;
          for (const pair of c) {
            if (pair.code === -1) {
              inVertex = true;
              vertices.push({ x: 0, y: 0, bulge: 0 });
            } else if (inVertex && pair.code === 10) vertices[vertices.length - 1].x = Number.parseFloat(pair.value);
            else if (inVertex && pair.code === 20) vertices[vertices.length - 1].y = Number.parseFloat(pair.value);
            else if (inVertex && pair.code === 42) vertices[vertices.length - 1].bulge = Number.parseFloat(pair.value) || 0;
          }
          polyline(vertices, (num(c, 70) & 1) === 1);
          break;
        }
        case "CIRCLE":
          emit(layer, color, arcPoints(num(c, 10), num(c, 20), num(c, 40), 0, 360).map((point) => at(point.x, point.y)));
          break;
        case "ARC":
          emit(layer, color, arcPoints(num(c, 10), num(c, 20), num(c, 40), num(c, 50), num(c, 51)).map((point) => at(point.x, point.y)));
          break;
        case "TEXT":
        case "MTEXT": {
          const value = decodeDxfText(entity.type === "MTEXT" ? mtextPlain(c.filter((pair) => pair.code === 3).map((pair) => pair.value).join("") + str(c, 1)) : str(c, 1).trim());
          if (!value) break;
          const aligned = entity.type === "TEXT" && (num(c, 72) !== 0 || num(c, 73) !== 0) && c.some((pair) => pair.code === 11);
          const point = aligned ? at(num(c, 11), num(c, 21)) : at(num(c, 10), num(c, 20));
          const scale = Math.hypot(matrix.a, matrix.b);
          const rotation = entity.type === "MTEXT" && c.some((pair) => pair.code === 11) ? (Math.atan2(num(c, 21), num(c, 11)) * 180) / Math.PI : num(c, 50);
          const blockAngle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI;
          collected.push({ layer, color, lines: [], texts: [{ x: point.x, y: point.y, size: Math.max(1e-6, num(c, 40, 2.5) * scale), rotation: rotation + blockAngle, value: value.slice(0, 200) }] });
          break;
        }
        case "INSERT": {
          const block = blocks.get(str(c, 2).trim());
          if (!block || depth >= MAX_DEPTH) break;
          const sx = num(c, 41, 1) || 1;
          const sy = num(c, 42, 1) || 1;
          const angle = (num(c, 50) * Math.PI) / 180;
          const local: Matrix = { a: Math.cos(angle) * sx, b: Math.sin(angle) * sx, c: -Math.sin(angle) * sy, d: Math.cos(angle) * sy, e: num(c, 10), f: num(c, 20) };
          const toBase: Matrix = { ...IDENTITY, e: -block.base.x, f: -block.base.y };
          walk(block.entities, multiply(matrix, multiply(local, toBase)), layer, depth + 1);
          break;
        }
        default:
          skipped[entity.type] = (skipped[entity.type] ?? 0) + 1;
      }

    }
  };
  walk(entitiesOf(entities), IDENTITY, null, 0);

  // Rozměr a jednotky
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const grow = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  for (const item of collected) {
    for (const line of item.lines) for (const point of line) grow(point.x, point.y);
    for (const label of item.texts) grow(label.x, label.y);
  }
  if (!Number.isFinite(minX)) throw new DxfError("Výkres DXF neobsahuje žádné čáry ani texty, které by šly zobrazit.");
  const extent = Math.max(maxX - minX, maxY - minY);
  const headerUnits = INSUNITS[insunits];
  const units: DxfUnits = headerUnits ?? guessUnits(extent);
  const k = UNIT_MM[units];

  // Do mm půdorysu: počátek vlevo nahoře, osa Y dolů
  const byLayer = new Map<string, CadLayer>();
  const layerOf = (name: string) => {
    if (!byLayer.has(name)) {
      const info = layerInfo.get(name);
      byLayer.set(name, { name, color: aciColor(info?.color ?? 7), segments: [], texts: [], entities: 0, off: info?.off ?? false });
    }
    return byLayer.get(name)!;
  };
  const round = (value: number) => Math.round(value * 10) / 10;
  for (const item of collected) {
    const layer = layerOf(item.layer);
    layer.entities += 1;
    for (const line of item.lines) {
      for (let index = 1; index < line.length; index++) {
        layer.segments.push(round((line[index - 1].x - minX) * k), round((maxY - line[index - 1].y) * k), round((line[index].x - minX) * k), round((maxY - line[index].y) * k));
      }
    }
    for (const label of item.texts) layer.texts.push({ x: round((label.x - minX) * k), y: round((maxY - label.y) * k), size: round(label.size * k), rotation: round(-label.rotation), value: label.value });
  }
  return {
    units,
    unitsSource: headerUnits ? "header" : "extent",
    widthMm: Math.max(1, Math.round((maxX - minX) * k)),
    heightMm: Math.max(1, Math.round((maxY - minY) * k)),
    layers: [...byLayer.values()].sort((a, b) => a.name.localeCompare(b.name, "cs")),
    skipped,
  };
}

/**
 * Jednotky bez `$INSUNITS` podle rozměru výkresu: půdorys domu / haly má 5–300 m – v mm tedy 5 000–300 000 jednotek,
 * v cm 500–30 000, v m 5–300.
 */
export function guessUnits(extent: number): DxfUnits {
  if (extent >= 3000) return "mm";
  if (extent >= 300) return "cm";
  return "m";
}

/** Hladiny „architektonického balastu“ – kóty, šrafy, texty, nábytek, osy (bez diakritiky, bez ohledu na velikost). */
const BALLAST = ["DIM", "KOT", "HATCH", "SRAF", "TEXT", "FURN", "NABYT", "OSA", "AXIS"];
export function isBallastLayer(name: string): boolean {
  const plain = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  return BALLAST.some((token) => plain.includes(token));
}
