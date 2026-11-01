import { esc, n } from "./svg";

// Generátor půdorysu patra v tmavém „blueprint“ stylu. Výstup je inline SVG
// (viewBox = rozměry patra), piny zařízení se vrství nad něj v aplikaci.

export type RoomKind = "room" | "zone" | "electrical" | "stairs";

export interface FloorplanRoom {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: RoomKind;
  /** Vlastní styl (zóny Studia): výplň rgba, obrys, čárkování, šrafa. */
  style?: RoomStyle;
  /** Druhý řádek pod názvem, např. rozměr „18 m × 12 m (216 m²)“. */
  subLabel?: string;
}

export interface RoomStyle {
  fill: string;
  stroke: string;
  dash?: string;
  hatch?: boolean;
}

export interface FloorplanGate {
  x: number;
  y: number;
  length: number;
  orient: "h" | "v";
  label?: string;
}

export interface FloorplanInput {
  floor: { name: string; viewBoxW: number; viewBoxH: number };
  /** Obvodové zdi; výchozí je celé patro s okrajem pro popisy os. */
  outline?: { x: number; y: number; w: number; h: number };
  /** Počet os číslovaných 1…N (svisle vedených) a písmenných os A…(vodorovně vedených). */
  columns?: number;
  rows?: number;
  rooms: FloorplanRoom[];
  gates?: FloorplanGate[];
  /** Měřítko výkresu a ryska 10 m (Studio); výchozí M 1:200 a 100 px. */
  scale?: { label: string; pxPer10m: number; dimensions?: string };
  /** Jemný pod-rastr uvnitř obvodu (krok v px ve viewBoxu), např. po 1 m ve Studiu. */
  fineGrid?: { stepX: number; stepY: number };
}

const WALL = "#94a3b8";
const GRID = "#1e3a5f";
const TEXT = "#cbd5e1";
const MUTED = "#64748b";

const ROOM_STYLE: Record<RoomKind, RoomStyle> = {
  room: { fill: "rgba(148,163,184,0.06)", stroke: "#475569" },
  zone: { fill: "rgba(234,179,8,0.07)", stroke: "#a16207", dash: "8 5" },
  electrical: { fill: "rgba(168,85,247,0.10)", stroke: "#7e22ce" },
  stairs: { fill: "rgba(148,163,184,0.04)", stroke: "#475569" },
};

function stairs(room: FloorplanRoom): string {
  const steps = Math.max(4, Math.floor(room.h / 14));
  const parts: string[] = [];
  for (let i = 1; i < steps; i++) {
    const y = room.y + (room.h / steps) * i;
    parts.push(`<line x1="${n(room.x)}" y1="${n(y)}" x2="${n(room.x + room.w)}" y2="${n(y)}" stroke="#475569" stroke-width="1"/>`);
  }
  parts.push(
    `<path d="M${n(room.x + room.w / 2)} ${n(room.y + room.h - 8)} L${n(room.x + room.w / 2)} ${n(room.y + 12)} M${n(room.x + room.w / 2 - 6)} ${n(room.y + 20)} L${n(room.x + room.w / 2)} ${n(room.y + 10)} L${n(room.x + room.w / 2 + 6)} ${n(room.y + 20)}" fill="none" stroke="${MUTED}" stroke-width="1.2"/>`,
  );
  return parts.join("");
}

export const GATE_COLOR = "#06b6d4";

/** Vrata na obvodové zdi: výplň průjezdu, dvě křídla (oblouky) dovnitř, šipka a štítek „🚪 …“. */
function gateSvg(g: FloorplanGate, o: { x: number; y: number; w: number; h: number }): string {
  const horizontal = g.orient === "h";
  // Směr dovnitř budovy (+1 = dolů / doprava)
  const inward = horizontal ? (g.y < o.y + o.h / 2 ? 1 : -1) : g.x < o.x + o.w / 2 ? 1 : -1;
  const L = g.length;
  const leaf = L / 2;
  const parts: string[] = [];
  const wall = 14;
  if (horizontal) {
    parts.push(
      `<rect x="${n(g.x)}" y="${n(g.y - wall / 2)}" width="${n(L)}" height="${wall}" fill="${GATE_COLOR}" fill-opacity="0.55" stroke="${GATE_COLOR}" stroke-width="2.5"/>`,
      // křídla: závěsy v krajích, oblouky do středu
      `<path d="M${n(g.x)} ${n(g.y)} L${n(g.x)} ${n(g.y + inward * leaf)} A${n(leaf)} ${n(leaf)} 0 0 ${inward > 0 ? 0 : 1} ${n(g.x + leaf)} ${n(g.y)}" fill="${GATE_COLOR}" fill-opacity="0.12" stroke="${GATE_COLOR}" stroke-width="1.6"/>`,
      `<path d="M${n(g.x + L)} ${n(g.y)} L${n(g.x + L)} ${n(g.y + inward * leaf)} A${n(leaf)} ${n(leaf)} 0 0 ${inward > 0 ? 1 : 0} ${n(g.x + leaf)} ${n(g.y)}" fill="${GATE_COLOR}" fill-opacity="0.12" stroke="${GATE_COLOR}" stroke-width="1.6"/>`,
      // šipka vjezdu zvenku dovnitř
      `<path d="M${n(g.x + leaf)} ${n(g.y - inward * 26)} L${n(g.x + leaf)} ${n(g.y - inward * 10)} M${n(g.x + leaf - 6)} ${n(g.y - inward * 17)} L${n(g.x + leaf)} ${n(g.y - inward * 9)} L${n(g.x + leaf + 6)} ${n(g.y - inward * 17)}" fill="none" stroke="${GATE_COLOR}" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  } else {
    parts.push(
      `<rect x="${n(g.x - wall / 2)}" y="${n(g.y)}" width="${wall}" height="${n(L)}" fill="${GATE_COLOR}" fill-opacity="0.55" stroke="${GATE_COLOR}" stroke-width="2.5"/>`,
      `<path d="M${n(g.x)} ${n(g.y)} L${n(g.x + inward * leaf)} ${n(g.y)} A${n(leaf)} ${n(leaf)} 0 0 ${inward > 0 ? 1 : 0} ${n(g.x)} ${n(g.y + leaf)}" fill="${GATE_COLOR}" fill-opacity="0.12" stroke="${GATE_COLOR}" stroke-width="1.6"/>`,
      `<path d="M${n(g.x)} ${n(g.y + L)} L${n(g.x + inward * leaf)} ${n(g.y + L)} A${n(leaf)} ${n(leaf)} 0 0 ${inward > 0 ? 0 : 1} ${n(g.x)} ${n(g.y + leaf)}" fill="${GATE_COLOR}" fill-opacity="0.12" stroke="${GATE_COLOR}" stroke-width="1.6"/>`,
      `<path d="M${n(g.x - inward * 26)} ${n(g.y + leaf)} L${n(g.x - inward * 10)} ${n(g.y + leaf)} M${n(g.x - inward * 17)} ${n(g.y + leaf - 6)} L${n(g.x - inward * 9)} ${n(g.y + leaf)} L${n(g.x - inward * 17)} ${n(g.y + leaf + 6)}" fill="none" stroke="${GATE_COLOR}" stroke-width="2.5" stroke-linecap="round"/>`,
    );
  }
  const text = `🚪 ${g.label?.trim() || "Vrata"}`;
  const tw = 16 + [...text].length * 6.6;
  const th = 18;
  // Štítek uvnitř budovy za křídly (vně jsou popisy os)
  const cx = horizontal ? g.x + leaf : g.x + inward * (leaf + 12 + tw / 2);
  const cy = horizontal ? g.y + inward * (leaf + 12 + th / 2) : g.y + leaf;
  parts.push(
    `<g data-gate="${esc(g.label ?? "")}"><rect x="${n(cx - tw / 2)}" y="${n(cy - th / 2)}" width="${n(tw)}" height="${th}" rx="4" fill="#082f49" stroke="${GATE_COLOR}" stroke-width="1.5"/>` +
      `<text x="${n(cx)}" y="${n(cy + 4)}" font-size="11" font-weight="700" fill="#cffafe" text-anchor="middle">${esc(text)}</text></g>`,
  );
  return parts.join("");
}

export function renderFloorplanSvg(input: FloorplanInput): string {
  const { floor, rooms, gates = [] } = input;
  const W = floor.viewBoxW;
  const H = floor.viewBoxH;
  const o = input.outline ?? { x: 70, y: 70, w: W - 150, h: H - 110 };
  const cols = input.columns ?? 12;
  const rows = input.rows ?? 8;
  const scale = input.scale ?? { label: "M 1:200", pxPer10m: 100 };
  const bar = scale.pxPer10m;
  const out: string[] = [];

  out.push(`<rect width="${W}" height="${H}" fill="#0b1220"/>`);
  // Jemná rastrová mřížka podkladu
  const fine = input.fineGrid;
  out.push(
    `<defs><pattern id="fp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#111c30" stroke-width="1"/></pattern>` +
      `<pattern id="fp-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="10" stroke="#94a3b8" stroke-width="1.2" opacity="0.35"/></pattern>` +
      (fine
        ? `<pattern id="fp-fine" x="${n(o.x)}" y="${n(o.y)}" width="${fine.stepX}" height="${fine.stepY}" patternUnits="userSpaceOnUse"><path d="M${fine.stepX} 0H0V${fine.stepY}" fill="none" stroke="#1a2c48" stroke-width="0.7"/></pattern>`
        : "") +
      `</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#fp-grid)"/>`,
  );
  if (fine) out.push(`<rect fill="url(#fp-fine)" x="${n(o.x)}" y="${n(o.y)}" width="${n(o.w)}" height="${n(o.h)}"/>`);

  // Místnosti a zóny (šrafa jako druhý obdélník s `fill` na začátku – `extractFloorplanRooms` ho přeskočí)
  for (const room of rooms) {
    const style = room.style ?? ROOM_STYLE[room.kind ?? "room"];
    out.push(
      `<rect x="${n(room.x)}" y="${n(room.y)}" width="${n(room.w)}" height="${n(room.h)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${room.kind === "zone" && !room.style ? 1.5 : 2}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""}/>`,
    );
    if (style.hatch) out.push(`<rect fill="url(#fp-hatch)" x="${n(room.x)}" y="${n(room.y)}" width="${n(room.w)}" height="${n(room.h)}"/>`);
    if (room.kind === "stairs") out.push(stairs(room));
    const small = room.w < 140 || room.h < 60;
    out.push(
      `<text x="${n(room.x + 10)}" y="${n(room.y + 20)}" font-size="${small ? 11 : 13}" fill="${TEXT}" font-weight="600">${esc(room.label)}</text>`,
    );
    if (room.subLabel && room.h >= 40) {
      out.push(`<text x="${n(room.x + 10)}" y="${n(room.y + (small ? 34 : 37))}" font-size="${small ? 9.5 : 11}" fill="${MUTED}">${esc(room.subLabel)}</text>`);
    }
  }

  // Osy sloupů
  const xs = Array.from({ length: cols }, (_, i) => o.x + (o.w / (cols - 1)) * i);
  const ys = Array.from({ length: rows }, (_, j) => o.y + (o.h / (rows - 1)) * j);
  xs.forEach((x, i) => {
    out.push(
      `<line x1="${n(x)}" y1="${o.y - 12}" x2="${n(x)}" y2="${o.y + o.h + 12}" stroke="${GRID}" stroke-width="1" stroke-dasharray="14 4 2 4"/>`,
      `<circle cx="${n(x)}" cy="${o.y - 28}" r="13" fill="#0b1220" stroke="${MUTED}"/>`,
      `<text x="${n(x)}" y="${o.y - 24}" font-size="12" fill="${TEXT}" text-anchor="middle">${i + 1}</text>`,
    );
  });
  ys.forEach((y, j) => {
    out.push(
      `<line x1="${o.x - 12}" y1="${n(y)}" x2="${o.x + o.w + 12}" y2="${n(y)}" stroke="${GRID}" stroke-width="1" stroke-dasharray="14 4 2 4"/>`,
      `<circle cx="${o.x - 28}" cy="${n(y)}" r="13" fill="#0b1220" stroke="${MUTED}"/>`,
      `<text x="${o.x - 28}" y="${n(y + 4)}" font-size="12" fill="${TEXT}" text-anchor="middle">${String.fromCharCode(65 + j)}</text>`,
    );
  });
  for (const x of xs) for (const y of ys) {
    out.push(`<rect x="${n(x - 5)}" y="${n(y - 5)}" width="10" height="10" fill="${WALL}" opacity="0.55"/>`);
  }

  // Obvodové zdi
  out.push(`<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="none" stroke="${WALL}" stroke-width="6"/>`);

  // Vrata: kontrastní azurový průjezd, křídla otevíraná dovnitř, šipka vjezdu a štítek
  for (const g of gates) out.push(gateSvg(g, o));

  // Popisek a měřítko
  out.push(
    `<text x="${o.x}" y="${H - 18}" font-size="14" fill="${TEXT}" font-weight="700">${esc(floor.name)}</text>`,
    `<text x="${o.x + 300}" y="${H - 18}" font-size="11" fill="${MUTED}">Půdorys · ${esc(scale.label)} · ${esc(scale.dimensions ?? "rozměry v mm neuvedeny")}</text>`,
    `<g transform="translate(${n(o.x + o.w - 50 - bar)} ${H - 12})"><line x1="0" y1="0" x2="${n(bar)}" y2="0" stroke="${TEXT}" stroke-width="2"/><line x1="0" y1="-5" x2="0" y2="5" stroke="${TEXT}" stroke-width="2"/><line x1="${n(bar / 2)}" y1="-4" x2="${n(bar / 2)}" y2="4" stroke="${TEXT}"/><line x1="${n(bar)}" y1="-5" x2="${n(bar)}" y2="5" stroke="${TEXT}" stroke-width="2"/><text x="0" y="-9" font-size="10" fill="${MUTED}">0</text><text x="${n(bar)}" y="-9" font-size="10" fill="${MUTED}" text-anchor="end">10 m</text></g>`,
  );

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" font-family="ui-monospace, Consolas, monospace">` +
    `<title>${esc(`Půdorys – ${floor.name}`)}</title>` +
    out.join("") +
    `</svg>`
  );
}

/**
 * Zpětně vytáhne místnosti z vygenerovaného půdorysu (obdélníky s výplní, bez sloupů),
 * aby šla dispozice naznačit i v izometrii. Souřadnice zůstávají ve viewBoxu patra.
 */
export function extractFloorplanRooms(svg: string): Pick<FloorplanRoom, "x" | "y" | "w" | "h">[] {
  const rooms: Pick<FloorplanRoom, "x" | "y" | "w" | "h">[] = [];
  for (const match of svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="(rgba[^"]+)"/g)) {
    const [x, y, w, h] = match.slice(1, 5).map(Number);
    if (w >= 40 && h >= 40) rooms.push({ x, y, w, h });
  }
  return rooms;
}

const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/**
 * Místnosti i s názvem (první `<text>` za obdélníkem místnosti) – Studio přiřazuje spotřebiče
 * a nářadí k místnostem i na stávajících patrech, jejichž dispozice existuje jen jako SVG.
 */
export function extractFloorplanRoomsWithLabels(svg: string): (Pick<FloorplanRoom, "x" | "y" | "w" | "h"> & { label: string })[] {
  const rooms: (Pick<FloorplanRoom, "x" | "y" | "w" | "h"> & { label: string })[] = [];
  const pattern = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="rgba[^"]+"[^>]*\/>((?:(?!<rect x=)[\s\S])*?)<text[^>]*>([^<]*)<\/text>/g;
  for (const match of svg.matchAll(pattern)) {
    const [x, y, w, h] = match.slice(1, 5).map(Number);
    if (w >= 40 && h >= 40) rooms.push({ x, y, w, h, label: unescape(match[6]).trim() || "Místnost" });
  }
  return rooms;
}
