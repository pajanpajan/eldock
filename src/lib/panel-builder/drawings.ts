// Vektorové výkresy dokumentace rozváděče (SVG řetězce, čisté funkce): výkres osazení skříně
// s DIN lištami a propojkami a jednopólové (liniové) schéma vykreslené ze stromu zapojení.

import type { ComponentCategory } from "@/generated/prisma/enums";
import { esc } from "@/lib/mock-graphics/svg";

import { DEVICE_HEIGHT_MM, MODULE_MM, railFraction, slotOffsets, type EnclosureDims } from "./layout";
import { phasesOf, readingOrder } from "./tree";

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
}

const INK = "#111";
const BLUE = "#1d4ed8";
const FONT = "Arial, Helvetica, sans-serif";

// ---------------------------------------------------------------------------
//  Výkres osazení (1 jednotka = 1 mm)
// ---------------------------------------------------------------------------

export function renderPanelDrawingSvg(dims: EnclosureDims & { depthMm?: number }, items: readonly DrawingItem[], enclosureLabel = ""): string {
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
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total.w} ${total.h}" font-family="${FONT}">
<rect x="${margin}" y="${margin}" width="${W}" height="${H}" rx="4" fill="#f9fafb" stroke="${INK}" stroke-width="1.2"/>
<rect x="${margin + 8}" y="${margin + 8}" width="${W - 16}" height="${H - 16}" rx="2" fill="none" stroke="${INK}" stroke-width="0.3" stroke-dasharray="2 2"/>
${rails}
${links.join("\n")}
${devices}
<line x1="${margin}" y1="${margin + H + 14}" x2="${margin + W}" y2="${margin + H + 14}" stroke="${INK}" stroke-width="0.4"/>
<text x="${margin + W / 2}" y="${margin + H + 24}" font-size="6" text-anchor="middle">${W} mm</text>
<line x1="${margin + W + 14}" y1="${margin}" x2="${margin + W + 14}" y2="${margin + H}" stroke="${INK}" stroke-width="0.4"/>
<text transform="translate(${margin + W + 24} ${margin + H / 2}) rotate(-90)" font-size="6" text-anchor="middle">${H} mm</text>
${enclosureLabel ? `<text x="${margin}" y="${margin - 8}" font-size="6" font-weight="700">-A1 ${esc(enclosureLabel)}</text>` : ""}
</svg>`;
}

// ---------------------------------------------------------------------------
//  Jednopólové schéma (Single Line Diagram) ze stromu zapojení
// ---------------------------------------------------------------------------

const SLOT = 74;
const LEVEL = 116;

function symbol(category: ComponentCategory | null, cx: number, top: number): string {
  const bottom = top + 44;
  const line = (y1: number, y2: number) => `<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" stroke="${INK}" stroke-width="1.4"/>`;
  const blade = `<line x1="${cx}" y1="${top + 30}" x2="${cx - 10}" y2="${top + 13}" stroke="${INK}" stroke-width="1.4"/>`;
  const cross = `<path d="M${cx - 4} ${top + 8}L${cx + 4} ${top + 16}M${cx + 4} ${top + 8}L${cx - 4} ${top + 16}" stroke="${INK}" stroke-width="1.2"/>`;
  const toroid = `<ellipse cx="${cx}" cy="${top + 37}" rx="7" ry="3" fill="none" stroke="${INK}" stroke-width="1"/><text x="${cx + 9}" y="${top + 40}" font-size="7">IΔ</text>`;
  switch (category) {
    case "MAIN_SWITCH":
      return `${line(top, top + 12)}<line x1="${cx - 5}" y1="${top + 12}" x2="${cx + 5}" y2="${top + 12}" stroke="${INK}" stroke-width="1.4"/>${blade}${line(top + 30, bottom)}`;
    case "SPD":
      return `${line(top, top + 8)}<rect x="${cx - 6}" y="${top + 8}" width="12" height="22" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M${cx - 4} ${top + 26}L${cx + 4} ${top + 12}M${cx + 4} ${top + 12}l-3 1M${cx + 4} ${top + 12}l0 3" stroke="${INK}" stroke-width="1"/>${line(top + 30, top + 38)}<path d="M${cx - 8} ${top + 38}H${cx + 8}M${cx - 5} ${top + 41}H${cx + 5}M${cx - 2} ${top + 44}H${cx + 2}" stroke="${INK}" stroke-width="1.2"/>`;
    case "RCD":
      return `${line(top, top + 12)}<circle cx="${cx}" cy="${top + 12}" r="1.6" fill="${INK}"/>${blade}${line(top + 30, bottom)}${toroid}<line x1="${cx - 5}" y1="${top + 21}" x2="${cx - 14}" y2="${top + 35}" stroke="${INK}" stroke-width="0.7" stroke-dasharray="2 2"/>`;
    case "RCBO":
      return `${line(top, top + 12)}${cross}${blade}${line(top + 30, bottom)}${toroid}`;
    case "CONTACTOR":
      return `${line(top, top + 12)}<path d="M${cx - 5} ${top + 12}a5 5 0 0 1 10 0" fill="none" stroke="${INK}" stroke-width="1.2"/>${blade}${line(top + 30, bottom)}`;
    case "MCB":
    case null:
      return `${line(top, top + 12)}${cross}${blade}${line(top + 30, bottom)}<rect x="${cx - 9}" y="${top + 19}" width="5" height="5" fill="none" stroke="${INK}" stroke-width="0.8"/>`;
    default:
      return `${line(top, top + 8)}<rect x="${cx - 8}" y="${top + 8}" width="16" height="26" fill="#fff" stroke="${INK}" stroke-width="1.2"/>${line(top + 34, bottom)}`;
  }
}

/** Popis vodiče: fáze a počet pólů (čárka s číslem) u vícefázového vedení. */
function conductorLabel(item: DrawingItem, cx: number, y: number): string {
  const phases = item.phaseAssignment ?? phasesOf(item).join(",");
  const count = phases.split(",").filter(Boolean).length;
  const ticks = count > 1 ? `<line x1="${cx - 4}" y1="${y + 6}" x2="${cx + 4}" y2="${y + 1}" stroke="${INK}" stroke-width="1"/><text x="${cx - 6}" y="${y + 3}" font-size="7" text-anchor="end">${count}</text>` : "";
  return `${ticks}<text x="${cx + 4}" y="${y + 9}" font-size="6.5" fill="#374151">${esc(phases)}</text>`;
}

export function renderSingleLineDiagramSvg(items: readonly DrawingItem[], options: { incomer: string; network: string }): string {
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
  const width = left * 2 + totalLeaves * SLOT;
  const height = bottomY + 150;
  const out: string[] = [];

  const draw = (item: DrawingItem, x0: number, y: number, seen: Set<string>) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    const span = (leaves.get(item.id) ?? 1) * SLOT;
    const kids = byParent.get(item.id) ?? [];
    const cx = kids.length ? x0 + span / 2 : x0 + SLOT / 2;
    out.push(conductorLabel(item, cx, y));
    out.push(`<line x1="${cx}" y1="${y}" x2="${cx}" y2="${y + 14}" stroke="${INK}" stroke-width="1.4"/>`);
    out.push(symbol(item.category, cx, y + 14));
    out.push(`<text x="${cx + 9}" y="${y + 34}" font-size="9" font-weight="700">${esc(item.designation)}</text>`);
    out.push(`<text x="${cx + 9}" y="${y + 44}" font-size="6.5" fill="#374151">${esc(item.typeCode.length > 16 ? `${item.typeCode.slice(0, 15)}…` : item.typeCode)}</text>`);
    if (item.manufacturer) out.push(`<text x="${cx + 9}" y="${y + 52}" font-size="6" fill="#6b7280">${esc(item.manufacturer)}</text>`);
    const outY = y + 58;
    if (kids.length) {
      const busY = y + LEVEL - 8;
      let cursor = x0;
      const centers: number[] = [];
      for (const kid of kids) {
        const kidSpan = (leaves.get(kid.id) ?? 1) * SLOT;
        centers.push((byParent.get(kid.id) ?? []).length ? cursor + kidSpan / 2 : cursor + SLOT / 2);
        cursor += kidSpan;
      }
      out.push(`<line x1="${cx}" y1="${outY}" x2="${cx}" y2="${busY}" stroke="${INK}" stroke-width="1.4"/>`);
      out.push(`<line x1="${Math.min(cx, ...centers)}" y1="${busY}" x2="${Math.max(cx, ...centers)}" y2="${busY}" stroke="${INK}" stroke-width="2.4"/>`);
      cursor = x0;
      kids.forEach((kid, index) => {
        out.push(`<line x1="${centers[index]}" y1="${busY}" x2="${centers[index]}" y2="${busY + 8}" stroke="${INK}" stroke-width="1.4"/>`);
        draw(kid, cursor, busY + 8, seen);
        cursor += (leaves.get(kid.id) ?? 1) * SLOT;
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
    const span = (leaves.get(root.id) ?? 1) * SLOT;
    rootCenters.push((byParent.get(root.id) ?? []).length ? cursor + span / 2 : cursor + SLOT / 2);
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
    cursor += (leaves.get(root.id) ?? 1) * SLOT;
  });
  if (loose.length) out.push(`<text x="${left}" y="${height - 8}" font-size="8" fill="#b91c1c">Nezapojeno ve stromu: ${esc(loose.map((item) => item.designation).join(", "))}</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="${FONT}" fill="${INK}">${out.join("\n")}</svg>`;
}
