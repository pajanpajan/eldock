// Vektorové výkresy dokumentace rozváděče (SVG řetězce, čisté funkce): výkres osazení skříně
// s DIN lištami a propojkami a jednopólové (liniové) schéma vykreslené ze stromu zapojení.

import type { ComponentCategory } from "@/generated/prisma/enums";
import { esc } from "@/lib/mock-graphics/svg";

import { drawSymbol, symbolKindOf, type SymbolKind } from "./iec-symbols";
import { DEVICE_HEIGHT_MM, MODULE_MM, railFraction, slotOffsets, type EnclosureDims } from "./layout";
import type { BusbarPlan } from "./pe-n-busbars";
import { phasesOf, readingOrder } from "./tree";
import type { DoorKind } from "./enclosure-choice";

export interface DrawingItem {
  id: string;
  designation: string;
  typeCode: string;
  /** Výrobce z katalogu (rozváděč může kombinovat více značek). */
  manufacturer?: string | null;
  category: ComponentCategory | null;
  poles: string | null;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  parentItemId: string | null;
  fedFromIncomer: boolean;
  phaseAssignment: string | null;
  circuitLabel: string;
  /** Fáze 58: značka dle ČSN EN 60617 (z kategorie a podtypu katalogového prvku). */
  symbol?: SymbolKind;
}

/**
 * Fáze 75: klikací oblast přístroje ve výkresu (chytré PDF) – obdélník v souřadnicích viewBoxu SVG; `size` = šířka a
 * výška viewBoxu (oblast se nad obrázkem umístí v procentech).
 */
export interface DrawingHotspot {
  id: string;
  designation: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface HotspotSink {
  hotspots: DrawingHotspot[];
  width: number;
  height: number;
}

const INK = "#111";
const BLUE = "#1d4ed8";
const FONT = "Arial, Helvetica, sans-serif";

// ---------------------------------------------------------------------------
//  Výkres osazení (1 jednotka = 1 mm)
// ---------------------------------------------------------------------------

/** Fáze 55: lišta svorkovnic PE / N0 / N-FIx uvnitř skříně (nahoře u přívodu shora, jinak dole), šroubky a obsazenost. */
function busbarStripSvg(plan: BusbarPlan, x: number, y: number, width: number): string {
  const bars = [plan.pe, plan.n0, ...plan.groups];
  const gap = 4;
  const bridge = plan.penBridge ? 14 : 0;
  const unit = Math.min(2.6, (width - gap * (bars.length - 1) - bridge) / bars.reduce((sum, bar) => sum + bar.size + 6, 0));
  const out: string[] = [];
  let cursor = x;
  bars.forEach((bar, index) => {
    if (index === 1 && plan.penBridge) {
      out.push(`<line x1="${cursor - gap + 1}" y1="${y + 5}" x2="${cursor + bridge - 1}" y2="${y + 5}" stroke="${INK}" stroke-width="1.2"/><text x="${cursor + bridge / 2 - 1}" y="${y - 1.5}" font-size="3.6" text-anchor="middle">PEN</text>`);
      cursor += bridge;
    }
    const w = (bar.size + 6) * unit;
    const fill = bar.kind === "PE" ? "url(#pe-stripes)" : "#2563eb";
    out.push(`<rect x="${cursor}" y="${y}" width="${w}" height="10" rx="1" fill="${fill}" stroke="${INK}" stroke-width="0.4"/>`);
    const screws = Math.min(bar.size, Math.floor((w - 4) / 2.2));
    for (let i = 0; i < screws; i++) out.push(`<circle cx="${cursor + 2 + (i + 0.5) * ((w - 4) / screws)}" cy="${y + 3}" r="0.7" fill="${i < Math.round((bar.used / bar.size) * screws) ? INK : "#fff"}"/>`);
    out.push(`<text x="${cursor + w / 2}" y="${y + 8.6}" font-size="3.6" font-weight="700" text-anchor="middle" fill="${bar.kind === "PE" ? INK : "#fff"}">${esc(bar.kind === "PE" ? "PE" : bar.id)} ${bar.used}/${bar.size}</text>`);
    cursor += w + gap;
  });
  return `<defs><pattern id="pe-stripes" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" fill="#16a34a"/><rect x="2" width="2" height="4" fill="#facc15"/></pattern></defs>${out.join("")}`;
}

/** Fáze 85: dvířka skříně v náhledu – kouřová průhledná (přístroje prosvítají) nebo plná; závěsy vlevo, klika vpravo. */
function doorSvg(x: number, y: number, w: number, h: number, kind: DoorKind): string {
  const panel =
    kind === "transparent"
      ? `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="3" fill="#1e293b" fill-opacity="0.42" stroke="#334155" stroke-width="2"/>`
      : `<rect x="${x + 3}" y="${y + 3}" width="${w - 6}" height="${h - 6}" rx="3" fill="#e4e4e7" stroke="#71717a" stroke-width="2"/><text x="${x + w / 2}" y="${y + h / 2}" font-size="7" text-anchor="middle" fill="#52525b">dvířka (plná)</text>`;
  const hinges = [0.18, 0.82].map((f) => `<rect x="${x - 2.5}" y="${y + h * f - 9}" width="5" height="18" rx="1.5" fill="#a1a1aa" stroke="${INK}" stroke-width="0.4"/>`).join("");
  return `<g data-door="${kind}">${panel}${hinges}<rect x="${x + w - 16}" y="${y + h / 2 - 22}" width="7" height="44" rx="3.5" fill="#71717a" stroke="${INK}" stroke-width="0.5"/></g>`;
}

export function renderPanelDrawingSvg(
  dims: EnclosureDims & { depthMm?: number },
  items: readonly DrawingItem[],
  enclosureLabel = "",
  busbars?: { plan: BusbarPlan; position: "TOP" | "BOTTOM" },
  sink?: HotspotSink,
  /** Fáze 85: náhled zavřené skříně (dvířka přes lišty a přístroje). */
  options: { door?: DoorKind } = {},
): string {
  const margin = 34;
  const W = dims.widthMm;
  const H = dims.heightMm;
  const deviceH = Math.min(DEVICE_HEIGHT_MM, (H / (dims.dinRailsCount + 0.5)) * 0.8);
  const railLength = Math.min(dims.modulesPerRail * MODULE_MM, W - 20);
  const x0 = margin + (W - railLength) / 2;
  const railY = (rail: number) => margin + H * railFraction(rail, dims.dinRailsCount);
  const offsets = slotOffsets(items);
  const rect = new Map(
    items.map((item) => {
      const x = x0 + (offsets.get(item) ?? 0) * MODULE_MM;
      const y = railY(item.dinRailIndex) - deviceH / 2;
      return [item.id, { x, y, w: Math.max(item.modulesWidth, 0.5) * MODULE_MM, h: deviceH }];
    }),
  );

  const rails = Array.from({ length: dims.dinRailsCount }, (_, i) => {
    const y = railY(i + 1);
    return `<rect x="${x0 - 6}" y="${y - 3.5}" width="${railLength + 12}" height="7" fill="#e5e7eb" stroke="${INK}" stroke-width="0.4"/>`;
  }).join("");

  const devices = items
    .map((item) => {
      const r = rect.get(item.id)!;
      const narrow = r.w < 30;
      const label = narrow
        ? `<text transform="translate(${r.x + r.w / 2 + 1.6} ${r.y + r.h / 2}) rotate(-90)" font-size="4" text-anchor="middle" font-family="${FONT}">${esc(item.typeCode)}</text>`
        : `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 1.5}" font-size="4.2" text-anchor="middle" font-family="${FONT}">${esc(item.typeCode)}</text>`;
      return `<g><rect x="${r.x + 0.4}" y="${r.y}" width="${r.w - 0.8}" height="${r.h}" fill="#fff" stroke="${INK}" stroke-width="0.6"/>
<text x="${r.x + r.w / 2}" y="${r.y + 7}" font-size="5" font-weight="700" text-anchor="middle" font-family="${FONT}">${esc(item.designation)}</text>
<rect x="${r.x + r.w / 2 - 2}" y="${r.y + r.h * 0.2}" width="4" height="8" fill="none" stroke="${INK}" stroke-width="0.4"/>${label}</g>`;
    })
    .join("\n");

  // Modré propojky: od nadřazeného přístroje hřebenem k potomkům na každé liště.
  const links: string[] = [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const groups = new Map<string, DrawingItem[]>();
  for (const item of items) {
    if (!item.parentItemId || !byId.has(item.parentItemId)) continue;
    const key = `${item.parentItemId}|${item.dinRailIndex}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, children] of groups) {
    const parent = rect.get(key.split("|")[0])!;
    const centers = children.map((child) => rect.get(child.id)!).map((r) => r.x + r.w / 2);
    const top = rect.get(children[0].id)!.y;
    const comb = top - 6;
    const px = parent.x + parent.w / 2;
    const sameRail = Math.abs(parent.y - top) < 1;
    const from = sameRail ? parent.y : parent.y + parent.h;
    links.push(`<polyline points="${px},${from} ${px},${sameRail ? comb : from + 4} ${sameRail ? px : x0 - 10},${sameRail ? comb : from + 4} ${sameRail ? px : x0 - 10},${comb}" fill="none" stroke="${BLUE}" stroke-width="0.9"/>`);
    const left = Math.min(sameRail ? px : x0 - 10, ...centers);
    const right = Math.max(sameRail ? px : x0 - 10, ...centers);
    links.push(`<line x1="${left}" y1="${comb}" x2="${right}" y2="${comb}" stroke="${BLUE}" stroke-width="0.9"/>`);
    for (const cx of centers) links.push(`<line x1="${cx}" y1="${comb}" x2="${cx}" y2="${top}" stroke="${BLUE}" stroke-width="0.6"/>`);
  }

  const total = { w: W + margin * 2, h: H + margin * 2 };
  // Fáze 75: polohy přístrojů pro klikací oblasti chytrého PDF
  if (sink) {
    sink.width = total.w;
    sink.height = total.h;
    for (const item of items) {
      const r = rect.get(item.id)!;
      sink.hotspots.push({ id: item.id, designation: item.designation, x: r.x, y: r.y, w: r.w, h: r.h });
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total.w} ${total.h}" font-family="${FONT}">
<rect x="${margin}" y="${margin}" width="${W}" height="${H}" rx="4" fill="#f9fafb" stroke="${INK}" stroke-width="1.2"/>
<rect x="${margin + 8}" y="${margin + 8}" width="${W - 16}" height="${H - 16}" rx="2" fill="none" stroke="${INK}" stroke-width="0.3" stroke-dasharray="2 2"/>
${rails}
${links.join("\n")}
${devices}
${busbars ? busbarStripSvg(busbars.plan, margin + 10, busbars.position === "TOP" ? margin + 10 : margin + H - 20, W - 20) : ""}
<line x1="${margin}" y1="${margin + H + 14}" x2="${margin + W}" y2="${margin + H + 14}" stroke="${INK}" stroke-width="0.4"/>
<text x="${margin + W / 2}" y="${margin + H + 24}" font-size="6" text-anchor="middle">${W} mm</text>
<line x1="${margin + W + 14}" y1="${margin}" x2="${margin + W + 14}" y2="${margin + H}" stroke="${INK}" stroke-width="0.4"/>
<text transform="translate(${margin + W + 24} ${margin + H / 2}) rotate(-90)" font-size="6" text-anchor="middle">${H} mm</text>
${enclosureLabel ? `<text x="${margin}" y="${margin - 8}" font-size="6" font-weight="700">-A1 ${esc(enclosureLabel)}</text>` : ""}
${options.door ? doorSvg(margin, margin, W, H, options.door) : ""}
</svg>`;
}

// ---------------------------------------------------------------------------
//  Jednopólové schéma (Single Line Diagram) ze stromu zapojení
// ---------------------------------------------------------------------------

const SLOT = 74;
const WIDE_SYMBOLS = new Set<SymbolKind>(["RCD", "RCBO", "CONTACTOR", "RELAY", "RELAY_IMPULSE", "RELAY_TIMER", "RELAY_STAIRCASE", "RELAY_MONITORING", "RELAY_LEVEL", "RELAY_THERMOSTAT"]);
const LEVEL = 116;

/** Fáze 58: druh značky prvku (z katalogu), jinak podle kategorie; neznámý prvek = obecná značka. */
export const drawingSymbolOf = (item: Pick<DrawingItem, "category" | "symbol">): SymbolKind => item.symbol ?? symbolKindOf({ category: item.category });

/** Popis vodiče: fáze a počet pólů (čárka s číslem) u vícefázového vedení. */
function conductorLabel(item: DrawingItem, cx: number, y: number): string {
  const phases = item.phaseAssignment ?? phasesOf(item).join(",");
  const count = phases.split(",").filter(Boolean).length;
  const ticks = count > 1 ? `<line x1="${cx - 4}" y1="${y + 6}" x2="${cx + 4}" y2="${y + 1}" stroke="${INK}" stroke-width="1"/><text x="${cx - 6}" y="${y + 3}" font-size="7" text-anchor="end">${count}</text>` : "";
  return `${ticks}<text x="${cx + 4}" y="${y + 9}" font-size="6.5" fill="#374151">${esc(phases)}</text>`;
}

export function renderSingleLineDiagramSvg(items: readonly DrawingItem[], options: { incomer: string; network: string }, sink?: HotspotSink): string {
  // Fáze 58: cívky a spouště leží vlevo od osy – s nimi širší rozteč, aby nezasahovaly do popisu souseda
  const slot = items.some((item) => WIDE_SYMBOLS.has(drawingSymbolOf(item))) ? 92 : SLOT;
  const byParent = new Map<string | null, DrawingItem[]>();
  const ids = new Set(items.map((item) => item.id));
  for (const item of readingOrder(items)) {
    const parent = item.parentItemId && ids.has(item.parentItemId) ? item.parentItemId : null;
    byParent.set(parent, [...(byParent.get(parent) ?? []), item]);
  }
  const roots = (byParent.get(null) ?? []).filter((item) => item.fedFromIncomer);
  const loose = (byParent.get(null) ?? []).filter((item) => !item.fedFromIncomer);
  const leaves = new Map<string, number>();
  const leafCount = (item: DrawingItem, seen = new Set<string>()): number => {
    if (seen.has(item.id)) return 1;
    seen.add(item.id);
    const kids = byParent.get(item.id) ?? [];
    const count = kids.length ? kids.reduce((sum, kid) => sum + leafCount(kid, seen), 0) : 1;
    leaves.set(item.id, count);
    return count;
  };
  const totalLeaves = Math.max(1, roots.reduce((sum, root) => sum + leafCount(root), 0));
  const depthOf = (item: DrawingItem, depth = 1, seen = new Set<string>()): number => {
    if (seen.has(item.id)) return depth;
    seen.add(item.id);
    return Math.max(depth, ...(byParent.get(item.id) ?? []).map((kid) => depthOf(kid, depth + 1, seen)));
  };
  const maxDepth = Math.max(1, ...roots.map((root) => depthOf(root)));
  const left = 40;
  const top = 62;
  const bottomY = top + maxDepth * LEVEL + 10;
  const width = left * 2 + totalLeaves * slot;
  const height = bottomY + 150;
  const out: string[] = [];

  const draw = (item: DrawingItem, x0: number, y: number, seen: Set<string>) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const span = (leaves.get(item.id) ?? 1) * slot;
    const kids = byParent.get(item.id) ?? [];
    const cx = kids.length ? x0 + span / 2 : x0 + slot / 2;
    out.push(conductorLabel(item, cx, y));
    out.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 14}" stroke="${INK}" stroke-width="1.4"/>`);
    out.push(drawSymbol(drawingSymbolOf(item), cx, y + 14));
    out.push(`<text x="${cx + 9}" y="${y + 34}" font-size="9" font-weight="700">${esc(item.designation)}</text>`);
    // Fáze 75: značka a popis přístroje = klikací oblast
    sink?.hotspots.push({ id: item.id, designation: item.designation, x: cx - 14, y, w: Math.min(slot - 4, 70), h: 58 });
    out.push(`<text x="${cx + 9}" y="${y + 44}" font-size="6.5" fill="#374151">${esc(item.typeCode.length > 16 ? `${item.typeCode.slice(0, 15)}…` : item.typeCode)}</text>`);
    if (item.manufacturer) out.push(`<text x="${cx + 9}" y="${y + 52}" font-size="6" fill="#6b7280">${esc(item.manufacturer)}</text>`);
    const outY = y + 58;
    if (kids.length) {
      const busY = y + LEVEL - 8;
      let cursor = x0;
      const centers: number[] = [];
      for (const kid of kids) {
        const kidSpan = (leaves.get(kid.id) ?? 1) * slot;
        centers.push((byParent.get(kid.id) ?? []).length ? cursor + kidSpan / 2 : cursor + slot / 2);
        cursor += kidSpan;
      }
      out.push(`<line x1="${cx}" y1="${outY}" x2="${cx}" y2="${busY}" stroke="${INK}" stroke-width="1.4"/>`);
      out.push(`<line x1="${Math.min(cx, ...centers)}" y1="${busY}" x2="${Math.max(cx, ...centers)}" y2="${busY}" stroke="${INK}" stroke-width="2.4"/>`);
      cursor = x0;
      kids.forEach((kid, index) => {
        out.push(`<line x1="${centers[index]}" y1="${busY}" x2="${centers[index]}" y2="${busY + 8}" stroke="${INK}" stroke-width="1.4"/>`);
        draw(kid, cursor, busY + 8, seen);
        cursor += (leaves.get(kid.id) ?? 1) * slot;
      });
    } else if (item.category !== "SPD") {
      // Koncový vývod: kabel k bodu odběru a svislý popis obvodu
      out.push(`<line x1="${cx}" y1="${outY}" x2="${cx}" y2="${bottomY}" stroke="${INK}" stroke-width="1.4"/>`);
      out.push(`<path d="M${cx - 4} ${bottomY - 6}L${cx} ${bottomY}L${cx + 4} ${bottomY - 6}" fill="none" stroke="${INK}" stroke-width="1.2"/>`);
      out.push(`<text transform="translate(${cx + 3} ${bottomY + 8}) rotate(90)" font-size="8">${esc(item.circuitLabel || item.designation)}</text>`);
    }
  };

  // Přívod
  const rootCenters: number[] = [];
  let cursor = left;
  for (const root of roots) {
    const span = (leaves.get(root.id) ?? 1) * slot;
    rootCenters.push((byParent.get(root.id) ?? []).length ? cursor + span / 2 : cursor + slot / 2);
    cursor += span;
  }
  const feedX = rootCenters.length ? (Math.min(...rootCenters) + Math.max(...rootCenters)) / 2 : width / 2;
  out.push(`<text x="${feedX + 8}" y="16" font-size="10" font-weight="700">${esc(options.incomer)}</text>`);
  out.push(`<text x="${feedX + 8}" y="28" font-size="7.5" fill="#374151">${esc(options.network)}</text>`);
  out.push(`<line x1="${feedX}" y1="8" x2="${feedX}" y2="${top - 10}" stroke="${INK}" stroke-width="1.4"/>`);
  out.push(`<line x1="${feedX - 4}" y1="20" x2="${feedX + 4}" y2="14" stroke="${INK}" stroke-width="1"/><text x="${feedX - 6}" y="18" font-size="7" text-anchor="end">4</text>`);
  if (rootCenters.length > 1) out.push(`<line x1="${Math.min(...rootCenters)}" y1="${top - 10}" x2="${Math.max(...rootCenters)}" y2="${top - 10}" stroke="${INK}" stroke-width="2.4"/>`);
  cursor = left;
  const seen = new Set<string>();
  roots.forEach((root, index) => {
    out.push(`<line x1="${rootCenters[index]}" y1="${top - 10}" x2="${rootCenters[index]}" y2="${top}" stroke="${INK}" stroke-width="1.4"/>`);
    draw(root, cursor, top, seen);
    cursor += (leaves.get(root.id) ?? 1) * slot;
  });
  if (loose.length) out.push(`<text x="${left}" y="${height - 8}" font-size="8" fill="#b91c1c">Nezapojeno ve stromu: ${esc(loose.map((item) => item.designation).join(", "))}</text>`);
  if (sink) {
    sink.width = width;
    sink.height = height;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="${FONT}" fill="${INK}">${out.join("\n")}</svg>`;
}
