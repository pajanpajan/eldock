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
}

const WALL = "#94a3b8";
const GRID = "#1e3a5f";
const TEXT = "#cbd5e1";
const MUTED = "#64748b";

const ROOM_STYLE: Record<RoomKind, { fill: string; stroke: string; dash?: string }> = {
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
  out.push(
    `<defs><pattern id="fp-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#111c30" stroke-width="1"/></pattern></defs>`,
    `<rect width="${W}" height="${H}" fill="url(#fp-grid)"/>`,
  );

  // Místnosti a zóny
  for (const room of rooms) {
    const style = ROOM_STYLE[room.kind ?? "room"];
    out.push(
      `<rect x="${n(room.x)}" y="${n(room.y)}" width="${n(room.w)}" height="${n(room.h)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${room.kind === "zone" ? 1.5 : 2}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ""}/>`,
    );
    if (room.kind === "stairs") out.push(stairs(room));
    const small = room.w < 140 || room.h < 60;
    out.push(
      `<text x="${n(room.x + 10)}" y="${n(room.y + 20)}" font-size="${small ? 11 : 13}" fill="${TEXT}" font-weight="600">${esc(room.label)}</text>`,
    );
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

  // Vrata
  for (const g of gates) {
    const horizontal = g.orient === "h";
    out.push(
      horizontal
        ? `<line x1="${g.x}" y1="${g.y}" x2="${g.x + g.length}" y2="${g.y}" stroke="#0b1220" stroke-width="8"/><line x1="${g.x}" y1="${g.y}" x2="${g.x + g.length}" y2="${g.y}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="10 4"/>`
        : `<line x1="${g.x}" y1="${g.y}" x2="${g.x}" y2="${g.y + g.length}" stroke="#0b1220" stroke-width="8"/><line x1="${g.x}" y1="${g.y}" x2="${g.x}" y2="${g.y + g.length}" stroke="#e2e8f0" stroke-width="2" stroke-dasharray="10 4"/>`,
    );
    if (g.label) {
      out.push(
        `<text x="${horizontal ? g.x + g.length / 2 : g.x > W / 2 ? g.x - 12 : g.x + 12}" y="${horizontal ? g.y - 10 : g.y + g.length / 2}" font-size="10" fill="${MUTED}" text-anchor="${horizontal ? "middle" : g.x > W / 2 ? "end" : "start"}">${esc(g.label)}</text>`,
      );
    }
  }

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
