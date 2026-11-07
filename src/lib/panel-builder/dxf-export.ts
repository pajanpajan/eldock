// Fáze 63: export výkresu půdorysu elektroinstalace do DXF (formát AutoCAD R12 / AC1009 – otevře AutoCAD, BricsCAD,
// GstarCAD i progeCAD; DWG z něj uloží CAD program). Skutečné milimetry 1 : 1, osa Y nahoru (souřadnice y výkresu se
// zrcadlí), hladiny STAVBA_MISTNOSTI, ZARIZOVACI_PREDMETY, ZASUVKY_230V_400V, SVETLA_VYPINACE, SBERNICE_SMART_HOME,
// KABELY_SILOVE, KABELY_SLABOPROUD a POPISY_A_KOTY. Značky stejné jako na plátně (`symbol-parts.ts`), trasy stejné jako
// na výkresu (`route-display.ts`) s ryskami počtu žil a štítky okruhů. Text s diakritikou jako \U+XXXX. Čisté funkce.

import { coresOf, labelPlacement, longestStretch, stretchSlot, tickMarks } from "./cad-notation";
import { applianceSpecFor } from "./appliances";
import { basinBand, fixtureGeometry, toWorld, zone2Path } from "./fixtures";
import { SYMBOL_MM, paletteItem, symbolSizeOf, type EditorElement, type FloorplanDraft, type PaletteItem, type analyzeDraft } from "./floorplan-editor";
import { polygonArea, roomPolygon } from "./room-geometry";
import { displayRoutes } from "./route-display";
import { productById } from "./smart-catalog";
import { symbolParts } from "./symbol-parts";

export const DXF_LAYERS = [
  { name: "STAVBA_MISTNOSTI", color: 8, label: "Místnosti, stěny a zakreslené změny" },
  { name: "ZARIZOVACI_PREDMETY", color: 4, label: "Vany, sprchy, umyvadla a jejich zóny" },
  { name: "ZASUVKY_230V_400V", color: 1, label: "Zásuvky, spotřebiče a rozváděč" },
  { name: "SVETLA_VYPINACE", color: 2, label: "Svítidla a vypínače 230 V" },
  { name: "SBERNICE_SMART_HOME", color: 3, label: "Sběrnicové a bezdrátové prvky" },
  { name: "KABELY_SILOVE", color: 6, label: "Silové trasy okruhů a svody k vypínačům" },
  { name: "KABELY_SLABOPROUD", color: 5, label: "Sběrnice 24 V DC a slaboproud" },
  { name: "POPISY_A_KOTY", color: 7, label: "Popisy, štítky okruhů a kóty" },
] as const;

export type DxfLayer = (typeof DXF_LAYERS)[number]["name"];

interface P {
  x: number;
  y: number;
}

type Analysis = ReturnType<typeof analyzeDraft>;

const num = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? "0" : String(rounded);
};

/** Text pro DXF: znaky mimo ASCII jako \U+XXXX (AutoCAD / BricsCAD / GstarCAD je zobrazí s diakritikou). */
export function dxfText(value: string): string {
  return [...value.replace(/[\r\n]+/g, " ")]
    .map((char) => {
      const code = char.codePointAt(0)!;
      return code >= 32 && code < 127 ? char : `\\U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    })
    .join("");
}

/** Zapisovač entit DXF (souřadnice výkresu v mm, y dolů → v DXF nahoru). */
export class DxfWriter {
  private readonly rows: string[] = [];
  private min = { x: Infinity, y: Infinity };
  private max = { x: -Infinity, y: -Infinity };

  private pair(code: number, value: string | number) {
    this.rows.push(String(code).padStart(3, " "), typeof value === "number" ? num(value) : value);
  }

  private track(point: P) {
    this.min = { x: Math.min(this.min.x, point.x), y: Math.min(this.min.y, -point.y) };
    this.max = { x: Math.max(this.max.x, point.x), y: Math.max(this.max.y, -point.y) };
  }

  line(layer: DxfLayer, a: P, b: P, dashed = false) {
    if (Math.hypot(b.x - a.x, b.y - a.y) < 0.01) return;
    this.track(a);
    this.track(b);
    this.pair(0, "LINE");
    this.pair(8, layer);
    if (dashed) this.pair(6, "DASHED");
    this.pair(10, a.x);
    this.pair(20, -a.y);
    this.pair(30, 0);
    this.pair(11, b.x);
    this.pair(21, -b.y);
    this.pair(31, 0);
  }

  polyline(layer: DxfLayer, points: readonly P[], closed = false, dashed = false) {
    for (let index = 1; index < points.length; index++) this.line(layer, points[index - 1], points[index], dashed);
    if (closed && points.length > 2) this.line(layer, points[points.length - 1], points[0], dashed);
  }

  circle(layer: DxfLayer, centre: P, radius: number) {
    if (radius <= 0) return;
    this.track({ x: centre.x - radius, y: centre.y - radius });
    this.track({ x: centre.x + radius, y: centre.y + radius });
    this.pair(0, "CIRCLE");
    this.pair(8, layer);
    this.pair(10, centre.x);
    this.pair(20, -centre.y);
    this.pair(30, 0);
    this.pair(40, radius);
  }

  /** Text; `angle` ve stupních výkresu (y dolů) – v DXF se úhel zrcadlí. */
  text(layer: DxfLayer, at: P, height: number, value: string, angle = 0, align: "left" | "center" = "left") {
    if (!value.trim()) return;
    this.track(at);
    this.pair(0, "TEXT");
    this.pair(8, layer);
    this.pair(10, at.x);
    this.pair(20, -at.y);
    this.pair(30, 0);
    this.pair(40, height);
    this.pair(1, dxfText(value));
    if (angle) this.pair(50, -angle);
    if (align === "center") {
      this.pair(72, 1);
      this.pair(11, at.x);
      this.pair(21, -at.y);
      this.pair(31, 0);
    }
  }

  /** Počet zapsaných entit. */
  get count() {
    return this.rows.filter((row, index) => index % 2 === 1 && this.rows[index - 1] === "  0").length;
  }

  toString(): string {
    const out: string[] = [];
    const pair = (code: number, value: string | number) => out.push(String(code).padStart(3, " "), typeof value === "number" ? num(value) : value);
    const min = Number.isFinite(this.min.x) ? this.min : { x: 0, y: 0 };
    const max = Number.isFinite(this.max.x) ? this.max : { x: 1000, y: 1000 };
    out.push("999", "ELDOCK - pudorys elektroinstalace, jednotky mm, meritko 1:1");
    pair(0, "SECTION");
    pair(2, "HEADER");
    pair(9, "$ACADVER");
    pair(1, "AC1009");
    pair(9, "$DWGCODEPAGE");
    pair(3, "ANSI_1250");
    pair(9, "$INSBASE");
    pair(10, 0);
    pair(20, 0);
    pair(30, 0);
    pair(9, "$EXTMIN");
    pair(10, min.x);
    pair(20, min.y);
    pair(30, 0);
    pair(9, "$EXTMAX");
    pair(10, max.x);
    pair(20, max.y);
    pair(30, 0);
    pair(9, "$LTSCALE");
    pair(40, 1);
    pair(0, "ENDSEC");
    pair(0, "SECTION");
    pair(2, "TABLES");
    // Typy čar: plná a čárkovaná (čárka 200 mm, mezera 100 mm – měřítko 1 : 1 v mm)
    pair(0, "TABLE");
    pair(2, "LTYPE");
    pair(70, 2);
    for (const [name, description, pattern] of [
      ["CONTINUOUS", "Solid line", [] as number[]],
      ["DASHED", "__ __ __", [200, -100]],
    ] as const) {
      pair(0, "LTYPE");
      pair(2, name);
      pair(70, 0);
      pair(3, description);
      pair(72, 65);
      pair(73, pattern.length);
      pair(40, pattern.reduce((sum, value) => sum + Math.abs(value), 0));
      for (const value of pattern) pair(49, value);
    }
    pair(0, "ENDTAB");
    pair(0, "TABLE");
    pair(2, "LAYER");
    pair(70, DXF_LAYERS.length + 1);
    for (const layer of [{ name: "0", color: 7 }, ...DXF_LAYERS]) {
      pair(0, "LAYER");
      pair(2, layer.name);
      pair(70, 0);
      pair(62, layer.color);
      pair(6, "CONTINUOUS");
    }
    pair(0, "ENDTAB");
    pair(0, "TABLE");
    pair(2, "STYLE");
    pair(70, 1);
    pair(0, "STYLE");
    pair(2, "STANDARD");
    pair(70, 0);
    pair(40, 0);
    pair(41, 1);
    pair(50, 0);
    pair(71, 0);
    pair(42, 2.5);
    pair(3, "txt");
    pair(4, "");
    pair(0, "ENDTAB");
    pair(0, "ENDSEC");
    pair(0, "SECTION");
    pair(2, "BLOCKS");
    pair(0, "ENDSEC");
    pair(0, "SECTION");
    pair(2, "ENTITIES");
    out.push(...this.rows);
    pair(0, "ENDSEC");
    pair(0, "EOF");
    return out.join("\r\n") + "\r\n";
  }
}

// ---------------------------------------------------------------------------
//  Cesty SVG značek → lomené čáry
// ---------------------------------------------------------------------------

/** Oblouk SVG (koncové body) → body lomené čáry (převod na střed dle SVG 1.1, příloha F.6). */
function arcPoints(from: P, rx: number, ry: number, angleDeg: number, large: boolean, sweep: boolean, to: P, steps = 12): P[] {
  if (!rx || !ry) return [to];
  const phi = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from.x - to.x) / 2;
  const dy = (from.y - to.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  let a = Math.abs(rx);
  let b = Math.abs(ry);
  const lambda = (x1 * x1) / (a * a) + (y1 * y1) / (b * b);
  if (lambda > 1) {
    a *= Math.sqrt(lambda);
    b *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const factor = sign * Math.sqrt(Math.max(0, (a * a * b * b - a * a * y1 * y1 - b * b * x1 * x1) / (a * a * y1 * y1 + b * b * x1 * x1)));
  const cx1 = (factor * a * y1) / b;
  const cy1 = (-factor * b * x1) / a;
  const centre = { x: cos * cx1 - sin * cy1 + (from.x + to.x) / 2, y: sin * cx1 + cos * cy1 + (from.y + to.y) / 2 };
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const value = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return value;
  };
  const start = angle(1, 0, (x1 - cx1) / a, (y1 - cy1) / b);
  let delta = angle((x1 - cx1) / a, (y1 - cy1) / b, (-x1 - cx1) / a, (-y1 - cy1) / b);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  return Array.from({ length: steps }, (_, index) => {
    const theta = start + (delta * (index + 1)) / steps;
    const px = a * Math.cos(theta);
    const py = b * Math.sin(theta);
    return { x: cos * px - sin * py + centre.x, y: sin * px + cos * py + centre.y };
  });
}

/** Cesta SVG (M L H V A Z a relativní varianty) → lomené čáry. */
export function pathToPolylines(d: string): P[][] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const lines: P[][] = [];
  let current: P[] = [];
  let at: P = { x: 0, y: 0 };
  let start: P = { x: 0, y: 0 };
  let command = "";
  let index = 0;
  const next = () => Number(tokens[index++]);
  const flush = () => {
    if (current.length >= 2) lines.push(current);
    current = [];
  };
  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) command = tokens[index++];
    const relative = command === command.toLowerCase();
    const base = relative ? at : { x: 0, y: 0 };
    switch (command.toUpperCase()) {
      case "M": {
        flush();
        at = { x: base.x + next(), y: base.y + next() };
        start = at;
        current = [at];
        command = relative ? "l" : "L";
        break;
      }
      case "L":
        at = { x: base.x + next(), y: base.y + next() };
        current.push(at);
        break;
      case "H":
        at = { x: (relative ? at.x : 0) + next(), y: at.y };
        current.push(at);
        break;
      case "V":
        at = { x: at.x, y: (relative ? at.y : 0) + next() };
        current.push(at);
        break;
      case "A": {
        const rx = next();
        const ry = next();
        const rotation = next();
        const large = next() === 1;
        const sweep = next() === 1;
        const to = { x: base.x + next(), y: base.y + next() };
        current.push(...arcPoints(at, rx, ry, rotation, large, sweep, to));
        at = to;
        break;
      }
      case "Z":
        current.push(start);
        at = start;
        flush();
        break;
      default:
        index++;
    }
  }
  flush();
  return lines;
}

const rotate = (point: P, degrees: number): P => {
  if (!degrees) return point;
  const rad = (degrees * Math.PI) / 180;
  return { x: point.x * Math.cos(rad) - point.y * Math.sin(rad), y: point.x * Math.sin(rad) + point.y * Math.cos(rad) };
};

/** Hladina prvku podle druhu (sběrnicový / chytrý výrobek → SBERNICE_SMART_HOME). */
export function layerOf(item: PaletteItem, element: Pick<EditorElement, "product">): DxfLayer {
  if (item.bus || item.wireless || element.product) return "SBERNICE_SMART_HOME";
  if (item.kind === "light" || item.kind === "switch") return "SVETLA_VYPINACE";
  if (item.kind === "fixture") return "ZARIZOVACI_PREDMETY";
  return "ZASUVKY_230V_400V";
}

/** Značka prvku do DXF (stejné tvary jako na plátně). */
function writeSymbol(writer: DxfWriter, draft: FloorplanDraft, element: EditorElement, item: PaletteItem) {
  const size = symbolSizeOf(draft, element);
  const at = { x: element.x, y: element.y };
  const layer = layerOf(item, element);
  const place = (point: P) => {
    const turned = rotate(point, element.rotation);
    return { x: at.x + turned.x, y: at.y + turned.y };
  };
  if (item.kind === "panel") {
    const w = size * 1.3 * 0.6;
    const h = size * 1.3 * 0.35;
    writer.polyline(layer, [place({ x: -w, y: -h }), place({ x: w, y: -h }), place({ x: w, y: h }), place({ x: -w, y: h })], true);
    writer.line(layer, place({ x: -w, y: h }), place({ x: w, y: -h }));
    writer.text("POPISY_A_KOTY", { x: at.x - w * 0.55, y: at.y - h * 0.2 }, size * 0.3, item.symbol, 0, "center");
    return;
  }
  const parts = symbolParts(item, size, {});
  for (const d of [...parts.paths, ...parts.fills]) for (const line of pathToPolylines(d)) writer.polyline(layer, line.map(place));
  for (const circle of parts.circles) writer.circle(layer, place({ x: circle.cx, y: circle.cy }), circle.r);
  for (const text of parts.texts) writer.text("POPISY_A_KOTY", place({ x: text.x, y: text.y + text.size * 0.35 }), text.size, text.value, 0, "center");
  if (parts.label) writer.text("POPISY_A_KOTY", { x: at.x + size * 0.62, y: at.y - size * 0.5 }, size * 0.3, parts.label);
}

/** Zařizovací předmět: obrys, vnitřní kresba, zóna 2 / pás u umyvadla čárkovaně. */
function writeFixture(writer: DxfWriter, element: EditorElement) {
  const geometry = fixtureGeometry(element);
  if (!geometry) return;
  const layer: DxfLayer = "ZARIZOVACI_PREDMETY";
  const local = (u: number, v: number) => toWorld(geometry, u, v);
  const w = geometry.w / 2;
  const d = geometry.d / 2;
  writer.polyline(layer, geometry.corners, true);
  if (geometry.type === "bath") writer.polyline(layer, [local(-w + 80, -d + 80), local(w - 80, -d + 80), local(w - 80, d - 80), local(-w + 80, d - 80)], true);
  if (geometry.type === "shower") {
    writer.line(layer, geometry.corners[0], geometry.corners[2]);
    writer.line(layer, geometry.corners[1], geometry.corners[3]);
  }
  if (geometry.type === "basin" || geometry.type === "double_basin") {
    const bowls = geometry.type === "double_basin" ? [-w / 2, w / 2] : [0];
    const rx = (geometry.type === "double_basin" ? w / 2 : w) * 0.7;
    const ry = d * 0.62;
    for (const cx of bowls) writer.polyline(layer, Array.from({ length: 24 }, (_, index) => local(cx + rx * Math.cos((index / 24) * 2 * Math.PI), d * 0.1 + ry * Math.sin((index / 24) * 2 * Math.PI))), true);
    const band = basinBand(geometry);
    writer.polyline(layer, [local(band.u1, band.v1), local(band.u2, band.v1), local(band.u2, band.v2), local(band.u1, band.v2)], true, true);
  } else {
    for (const line of pathToPolylines(zone2Path(geometry.w, geometry.d))) writer.polyline(layer, line.map((point) => local(point.x, point.y)), false, true);
  }
  const centre = { x: geometry.cx, y: geometry.cy + 60 };
  writer.text("POPISY_A_KOTY", centre, 120, `${{ bath: "vana", shower: "sprcha", basin: "umyvadlo", double_basin: "dvojumyvadlo" }[geometry.type]} ${geometry.w} × ${geometry.d}`, 0, "center");
}

export interface DxfOptions {
  title?: string;
  date?: Date;
}

/**
 * Výkres aktivního podlaží do DXF: místnosti a zakreslené změny, zařizovací předměty se zónami, značky prvků podle
 * hladin, trasy okruhů (ruční úpravy přesně, ostatní v odsazení podél stěn) s ryskami žil a štítky, svody k vypínačům
 * a sběrnicová linka čárkovaně, popisy místností a záhlaví.
 */
export function floorplanDxf(draft: FloorplanDraft, analysis: Analysis | null, options: DxfOptions = {}): string {
  const writer = new DxfWriter();
  const unit = SYMBOL_MM * draft.symbolScale;
  // Místnosti
  for (const room of draft.rooms) {
    const polygon = roomPolygon(room);
    writer.polyline("STAVBA_MISTNOSTI", polygon, true);
    const area = polygonArea(polygon) / 1e6;
    writer.text("POPISY_A_KOTY", { x: room.x + unit * 0.4, y: room.y + unit * 0.9 }, unit * 0.45, `${room.name} · ${area.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m²`);
  }
  // Zakreslené změny (nové příčky, bourání, oblasti, texty)
  for (const note of draft.annotations) {
    if (note.kind === "text") {
      writer.text("POPISY_A_KOTY", { x: note.x, y: note.y + note.fontMm }, note.fontMm, note.text);
      continue;
    }
    if (note.kind === "zone") {
      writer.polyline("STAVBA_MISTNOSTI", [{ x: note.x, y: note.y }, { x: note.x2, y: note.y }, { x: note.x2, y: note.y2 }, { x: note.x, y: note.y2 }], true, true);
      continue;
    }
    const length = Math.hypot(note.x2 - note.x, note.y2 - note.y) || 1;
    const offset = { x: (-(note.y2 - note.y) / length) * (note.thicknessMm / 2), y: ((note.x2 - note.x) / length) * (note.thicknessMm / 2) };
    const dashed = note.kind === "demolish";
    writer.polyline("STAVBA_MISTNOSTI", [{ x: note.x + offset.x, y: note.y + offset.y }, { x: note.x2 + offset.x, y: note.y2 + offset.y }, { x: note.x2 - offset.x, y: note.y2 - offset.y }, { x: note.x - offset.x, y: note.y - offset.y }], true, dashed);
  }
  // Prvky
  for (const element of draft.elements) {
    const base = paletteItem(element.item);
    if (!base) continue;
    if (base.kind === "fixture") {
      writeFixture(writer, element);
      continue;
    }
    const spec = base.kind === "appliance" ? applianceSpecFor(draft.appliances, element) : null;
    const product = productById(element.product);
    const item = spec ? { ...base, label: spec.label, symbol: spec.symbol } : product?.noBus ? { ...base, wireless: true } : base;
    writeSymbol(writer, draft, element, item);
  }
  // Svody vypínač → svítidlo (ovládací vodiče CYKY-O) čárkovaně
  for (const element of draft.elements) {
    for (const lightId of element.controls) {
      const light = draft.elements.find((candidate) => candidate.id === lightId);
      if (light) writer.line("KABELY_SILOVE", { x: element.x, y: element.y }, { x: light.x, y: light.y }, true);
    }
  }
  // Trasy okruhů a sběrnice
  if (analysis) {
    const routes = displayRoutes(draft, analysis);
    for (const [index, circuit] of [...routes.circuits, ...(routes.bus ? [routes.bus] : [])].entries()) {
      const layer: DxfLayer = circuit.lowVoltage ? "KABELY_SLABOPROUD" : "KABELY_SILOVE";
      for (const leg of circuit.legs) writer.polyline(layer, leg.points, false, circuit.lowVoltage);
      const stretch = longestStretch(circuit.legs.map((leg) => leg.points));
      if (!stretch) continue;
      for (const tick of tickMarks(stretch.a, stretch.b, coresOf(circuit.cable), unit * 0.45, unit * 0.2, stretchSlot(index))) writer.line(layer, { x: tick.x1, y: tick.y1 }, { x: tick.x2, y: tick.y2 });
      const label = labelPlacement(stretch.a, stretch.b, unit * 0.45, stretchSlot(index));
      writer.text("POPISY_A_KOTY", { x: label.x, y: label.y }, unit * 0.32, circuit.tag, label.angle, "center");
    }
  }
  const date = (options.date ?? new Date()).toLocaleDateString("cs-CZ");
  writer.text("POPISY_A_KOTY", { x: 0, y: draft.heightMm + unit * 2 }, unit * 0.6, `${options.title ?? "Půdorys elektroinstalace"} · ${draft.floorName} · ${date} · jednotky mm, měřítko 1 : 1 · ELDOCK`);
  return writer.toString();
}
