// Fáze 90: okna, dveře a nábytek ve 2D půdorysu – orientační architektonické prvky (nevytváří okruhy v rozváděči), které
// pomáhají osadit zásuvky, vypínače a světla (zásuvky u čela postele, vypínač u dveří). Kresba je čistý 2D CAD půdorys
// v místních souřadnicích prvku (u = šířka X, v = hloubka Y, zadní hrana −v u stěny) – sdílí ji plátno, tisk do PDF i DXF
// (vrstva ARCHITEKTURA_NABYTEK). Stavební otvory se přichytí ke stěně místnosti (okno středem na stěně, dveře zárubní
// na stěně a křídlem do místnosti). Čisté funkce.

import type { ArchType, FixturePoint, FixtureSpec } from "./fixtures";
import { nearestWall, pointInPolygon, pointInRoom, type Pt, type RoomShape, type WallHit } from "./room-geometry";

/** Hladina DXF (a skupina v tisku) pro okna, dveře a nábytek. */
export const ARCH_LAYER = "ARCHITEKTURA_NABYTEK";

/** Jedna čára kresby (lomená, uzavřená, čárkovaná) v místních souřadnicích prvku [mm]. */
export interface ArchPrimitive {
  points: FixturePoint[];
  closed?: boolean;
  dashed?: boolean;
  /** Tloušťka čáry jako násobek běžné (0,6 = tenká vnitřní kresba, 1,5 = obrys). */
  weight?: number;
  /** Jemná výplň uzavřeného obrysu (tělo nábytku, rám okna). */
  fill?: boolean;
}

type Extra = Pick<ArchPrimitive, "dashed" | "weight" | "fill">;

const pt = (x: number, y: number): FixturePoint => ({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
const rect = (x1: number, y1: number, x2: number, y2: number, extra: Extra = {}): ArchPrimitive => ({ points: [pt(x1, y1), pt(x2, y1), pt(x2, y2), pt(x1, y2)], closed: true, ...extra });
const line = (x1: number, y1: number, x2: number, y2: number, extra: Extra = {}): ArchPrimitive => ({ points: [pt(x1, y1), pt(x2, y2)], ...extra });
const poly = (points: [number, number][], closed: boolean, extra: Extra = {}): ArchPrimitive => ({ points: points.map(([x, y]) => pt(x, y)), closed, ...extra });

/** Oblouk elipsy se středem (cx, cy) z úhlu `from` do `to` [°] (osa y dolů jako ve výkresu). */
function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, extra: Extra = {}, segments = 18): ArchPrimitive {
  return {
    points: Array.from({ length: segments + 1 }, (_, index) => {
      const angle = ((from + ((to - from) * index) / segments) * Math.PI) / 180;
      return pt(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
    }),
    ...extra,
  };
}

const ellipse = (cx: number, cy: number, rx: number, ry: number, extra: Extra = {}): ArchPrimitive => ({ ...arc(cx, cy, rx, ry, 0, 360, {}, 32), points: arc(cx, cy, rx, ry, 0, 360, {}, 32).points.slice(0, -1), closed: true, ...extra });

/** Obdélník se zaoblenými rohy (polštář, dřez). */
function roundRect(x1: number, y1: number, x2: number, y2: number, radius: number, extra: Extra = {}): ArchPrimitive {
  const r = Math.max(0, Math.min(radius, (x2 - x1) / 2, (y2 - y1) / 2));
  const corner = (cx: number, cy: number, from: number) => arc(cx, cy, r, r, from, from + 90, {}, 4).points;
  return { points: [...corner(x1 + r, y1 + r, 180), ...corner(x2 - r, y1 + r, 270), ...corner(x2 - r, y2 - r, 0), ...corner(x1 + r, y2 - r, 90)], closed: true, ...extra };
}

/** Šipka podél osy u (posuv okna / dveří). */
function arrow(x1: number, x2: number, y: number, head: number, extra: Extra = {}): ArchPrimitive[] {
  const dir = Math.sign(x2 - x1) || 1;
  return [line(x1, y, x2, y, extra), poly([[x2 - dir * head, y - head * 0.6], [x2, y], [x2 - dir * head, y + head * 0.6]], false, extra)];
}

/** Židle (sedák s opěradlem na vnější straně). */
function chair(cx: number, cy: number, size: number, back: "n" | "s" | "w" | "e"): ArchPrimitive[] {
  const h = size / 2;
  const b = Math.min(70, size * 0.16);
  const rest = { n: line(cx - h, cy - h + b, cx + h, cy - h + b, { weight: 0.9 }), s: line(cx - h, cy + h - b, cx + h, cy + h - b, { weight: 0.9 }), w: line(cx - h + b, cy - h, cx - h + b, cy + h, { weight: 0.9 }), e: line(cx + h - b, cy - h, cx + h - b, cy + h, { weight: 0.9 }) }[back];
  return [roundRect(cx - h, cy - h, cx + h, cy + h, size * 0.12, { weight: 0.8, fill: true }), rest];
}

/** Kresba prvku bez zrcadlení (W, D = poloviny rozměru). */
function draw(type: ArchType, w: number, d: number): ArchPrimitive[] {
  const W = w / 2;
  const D = d / 2;
  switch (type) {
    case "window_1":
    case "window_2": {
      // Rám okna ve stěně a dvojitá čára skla; dvoukřídlé navíc se středovým sloupkem
      const t = Math.min(60, w * 0.06);
      return [
        rect(-W, -D, W, D, { weight: 1.4, fill: true }),
        line(-W + t, -D * 0.28, W - t, -D * 0.28, { weight: 0.7 }),
        line(-W + t, D * 0.28, W - t, D * 0.28, { weight: 0.7 }),
        ...(type === "window_2" ? [line(0, -D, 0, D, { weight: 1.1 })] : []),
      ];
    }
    case "window_hs": {
      // HS portál: pevné a posuvné křídlo s přesahem uprostřed a šipka posuvu
      const t = Math.min(60, w * 0.04);
      const head = Math.min(120, w * 0.05, D * 0.6);
      return [
        rect(-W, -D, W, D, { weight: 1.4, fill: true }),
        rect(-W + t, -D * 0.62, w * 0.06, -D * 0.06, { weight: 0.8 }),
        rect(-w * 0.06, D * 0.06, W - t, D * 0.62, { weight: 0.8 }),
        ...arrow(-W * 0.15, W * 0.55, D * 0.34, head, { weight: 0.7 }),
      ];
    }
    case "door_1": {
      // Zárubeň na stěně, otevřené křídlo kolmo ke stěně a čtvrtkruhová čárkovaná výseč otevírání (závěs vlevo)
      const jamb = Math.min(60, d * 0.1);
      const leaf = Math.min(45, w * 0.06);
      return [
        line(-W, -D - jamb, -W, -D + jamb, { weight: 1.6 }),
        line(W, -D - jamb, W, -D + jamb, { weight: 1.6 }),
        rect(-W, -D, -W + leaf, D, { weight: 1.2, fill: true }),
        arc(-W, -D, w, d, 0, 90, { dashed: true, weight: 0.8 }),
      ];
    }
    case "door_2": {
      const jamb = Math.min(60, d * 0.1);
      const leaf = Math.min(45, w * 0.04);
      return [
        line(-W, -D - jamb, -W, -D + jamb, { weight: 1.6 }),
        line(W, -D - jamb, W, -D + jamb, { weight: 1.6 }),
        rect(-W, -D, -W + leaf, D, { weight: 1.2, fill: true }),
        rect(W - leaf, -D, W, D, { weight: 1.2, fill: true }),
        arc(-W, -D, W, d, 0, 90, { dashed: true, weight: 0.8 }),
        arc(W, -D, W, d, 90, 180, { dashed: true, weight: 0.8 }),
      ];
    }
    case "door_sliding": {
      // Posuvné křídlo ve stěně, kolejnice a šipka směru posuvu
      const jamb = Math.min(60, w * 0.07);
      const head = Math.min(80, w * 0.08, D * 0.5);
      return [
        line(-W, -D, -W, D, { weight: 1.6 }),
        line(W, -D, W, D, { weight: 1.6 }),
        rect(-W + jamb * 0.5, -D * 0.4, W - jamb * 0.5, D * 0.1, { weight: 1.1, fill: true }),
        line(-W, D * 0.55, W, D * 0.55, { weight: 0.6, dashed: true }),
        ...arrow(-W * 0.4, W * 0.4, D * 0.8, head, { weight: 0.7 }),
      ];
    }
    case "bed_double":
    case "bed_single": {
      // Rám, čelo u stěny, matrace, polštáře, přehyb přikrývky a přeložený roh
      const head = Math.min(70, d * 0.04);
      const inset = Math.min(40, w * 0.03);
      const pillowH = Math.min(450, d * 0.2);
      const top = -D + head + Math.min(80, d * 0.04);
      const fold = -D + d * 0.34;
      const corner = Math.min(400, w * 0.22, d * 0.2);
      const pillows =
        type === "bed_double"
          ? (() => {
              const pw = (w - inset * 4) * 0.46;
              return [roundRect(-W + inset * 2, top, -W + inset * 2 + pw, top + pillowH, 70, { weight: 0.8 }), roundRect(W - inset * 2 - pw, top, W - inset * 2, top + pillowH, 70, { weight: 0.8 })];
            })()
          : [roundRect(-(w - inset * 4) * 0.36, top, (w - inset * 4) * 0.36, top + pillowH, 70, { weight: 0.8 })];
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        rect(-W, -D, W, -D + head, { weight: 1.1 }),
        rect(-W + inset, -D + head, W - inset, D - inset, { weight: 0.6 }),
        ...pillows,
        line(-W + inset, fold, W - inset, fold, { weight: 0.9 }),
        line(W - inset - corner, D - inset, W - inset, D - inset - corner, { weight: 0.6 }),
      ];
    }
    case "sofa_l": {
      // Sedák podél zadní stěny a lehátko podél levé strany, opěradlo, područka a dělení sedáků
      const seat = Math.min(900, d * 0.55, w * 0.45);
      const back = Math.min(200, seat * 0.25);
      const arm = Math.min(180, w * 0.08);
      const from = -W + seat;
      const to = W - arm;
      return [
        poly([[-W, -D], [W, -D], [W, -D + seat], [-W + seat, -D + seat], [-W + seat, D], [-W, D]], true, { weight: 1.5, fill: true }),
        poly([[to, -D + back], [-W + back, -D + back], [-W + back, D]], false, { weight: 0.9 }),
        line(to, -D + back, to, -D + seat, { weight: 0.9 }),
        line(-W + back, -D + seat, -W + seat, -D + seat, { weight: 0.6 }),
        ...[1, 2].map((k) => line(from + ((to - from) * k) / 3, -D + back, from + ((to - from) * k) / 3, -D + seat, { weight: 0.6 })),
      ];
    }
    case "sofa": {
      const back = Math.min(220, d * 0.25);
      const arm = Math.min(200, w * 0.09);
      const span = w - arm * 2;
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        line(-W + arm, -D + back, W - arm, -D + back, { weight: 0.9 }),
        line(-W + arm, -D, -W + arm, D, { weight: 0.9 }),
        line(W - arm, -D, W - arm, D, { weight: 0.9 }),
        ...[1, 2].map((k) => line(-W + arm + (span * k) / 3, -D + back, -W + arm + (span * k) / 3, D, { weight: 0.6 })),
      ];
    }
    case "table_dining": {
      // Deska stolu (rozměr X × Y) a 6 židlí okolo – 2 na každé dlouhé straně, 1 v čele
      const size = Math.min(450, w / 4.2, d * 0.55);
      const gap = Math.min(80, d * 0.1);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        ...[-w / 4, w / 4].flatMap((cx) => [...chair(cx, -D - gap - size / 2, size, "n"), ...chair(cx, D + gap + size / 2, size, "s")]),
        ...chair(-W - gap - size / 2, 0, size, "w"),
        ...chair(W + gap + size / 2, 0, size, "e"),
      ];
    }
    case "desk": {
      const size = Math.min(480, w * 0.35);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        rect(-w * 0.2, -D + d * 0.1, w * 0.2, -D + d * 0.17, { weight: 1.1 }),
        rect(-w * 0.17, -D + d * 0.42, w * 0.17, -D + d * 0.58, { weight: 0.6 }),
        ...chair(0, D + 60 + size / 2, size, "s"),
      ];
    }
    case "kitchen": {
      // Pracovní deska s přední hranou, dřez s odtokem a baterií vlevo, varná deska se 4 plotýnkami vpravo
      const edge = Math.min(40, d * 0.07);
      const sinkW = Math.min(800, w * 0.32);
      const sinkD = d * 0.6;
      const sink = -W + Math.max(sinkW / 2 + 100, w * 0.26);
      const hob = Math.min(600, w * 0.25, d * 0.85);
      const plate = W - Math.max(hob / 2 + 100, w * 0.26);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        line(-W, D - edge, W, D - edge, { weight: 0.6 }),
        roundRect(sink - sinkW / 2, -sinkD / 2, sink + sinkW / 2, sinkD / 2, 60, { weight: 0.9 }),
        ellipse(sink, 0, Math.min(30, sinkD * 0.1), Math.min(30, sinkD * 0.1), { weight: 0.8 }),
        ellipse(sink, -D + d * 0.1, Math.min(22, d * 0.05), Math.min(22, d * 0.05), { weight: 0.8 }),
        rect(plate - hob / 2, -hob * 0.42, plate + hob / 2, hob * 0.42, { weight: 0.9 }),
        ...[-1, 1].flatMap((sx) => [-1, 1].map((sy) => ellipse(plate + sx * hob * 0.24, sy * hob * 0.2, hob * 0.14, hob * 0.14, { weight: 0.7 }))),
      ];
    }
    case "island": {
      const inset = Math.min(40, d * 0.05);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        rect(-W + inset, -D + inset, W - inset, D - inset, { weight: 0.6 }),
        line(-W + inset, D - d * 0.28, W - inset, D - d * 0.28, { weight: 0.6, dashed: true }),
      ];
    }
    case "wardrobe": {
      // Tyč s ramínky (šrafování) a dvě posuvné dveře na přední straně
      const step = 150;
      const count = Math.max(1, Math.min(40, Math.floor((w - 240) / step) + 1));
      const start = -((count - 1) * step) / 2;
      const lean = Math.min(45, D * 0.3);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        line(-W + 60, -D * 0.08, W - 60, -D * 0.08, { weight: 0.8 }),
        ...Array.from({ length: count }, (_, index) => line(start + index * step - lean, -D * 0.62, start + index * step + lean, D * 0.46, { weight: 0.5 })),
        line(-W, D - Math.min(25, d * 0.05), w * 0.04, D - Math.min(25, d * 0.05), { weight: 0.7 }),
        line(-w * 0.04, D - Math.min(55, d * 0.11), W, D - Math.min(55, d * 0.11), { weight: 0.7 }),
      ];
    }
    case "tv":
      return [rect(-W, -D, W, D, { weight: 1.5, fill: true }), rect(-w * 0.36, -D + d * 0.08, w * 0.36, -D + d * 0.2, { weight: 1.4 }), rect(-w * 0.07, -D + d * 0.2, w * 0.07, -D + d * 0.34, { weight: 0.7 })];
    case "wc": {
      // Nádržka / instalační modul u stěny, mísa a sedátko
      const tank = d * 0.24;
      const cy = -D + tank + (d - tank) / 2;
      return [rect(-W, -D, W, -D + tank, { weight: 1.3, fill: true }), ellipse(0, cy, W * 0.92, (d - tank) / 2, { weight: 1.3, fill: true }), ellipse(0, cy + (d - tank) * 0.04, W * 0.6, (d - tank) * 0.34, { weight: 0.7 })];
    }
    case "exam_bed": {
      // Fáze 93: vyšetřovací lehátko / lůžko – rám, polohovatelná hlavová část (dělicí čára), čalounění a role papíru u nohou
      const inset = Math.min(45, d * 0.05);
      const headEnd = -W + w * 0.3;
      const roll = Math.min(90, w * 0.05);
      return [
        rect(-W, -D, W, D, { weight: 1.5, fill: true }),
        roundRect(-W + inset, -D + inset, W - inset - roll, D - inset, 60, { weight: 0.8 }),
        line(headEnd, -D + inset, headEnd, D - inset, { weight: 0.9 }),
        roundRect(-W + inset * 2, -D + d * 0.25, -W + inset * 2 + w * 0.12, D - d * 0.25, 50, { weight: 0.7 }),
        rect(W - roll, -D + inset, W - inset * 0.4, D - inset, { weight: 1.1 }),
        line(W - roll * 0.5, -D + inset, W - roll * 0.5, D - inset, { weight: 0.5, dashed: true }),
      ];
    }
  }
}

/** Kresba okna, dveří nebo nábytku v místních souřadnicích; `flip` = zrcadlení v ose šířky (pravé otevírání dveří). */
export function archDrawing(type: ArchType, w: number, d: number, flip = false): ArchPrimitive[] {
  const primitives = draw(type, w, d);
  return flip ? primitives.map((primitive) => ({ ...primitive, points: primitive.points.map((point) => ({ x: -point.x, y: point.y })) })) : primitives;
}

/** Cesta SVG z čáry kresby. */
export const primitivePath = (primitive: ArchPrimitive) => `M${primitive.points.map((point) => `${point.x} ${point.y}`).join(" L")}${primitive.closed ? " Z" : ""}`;

/** Tolerance přichycení otvoru ke stěně místnosti [mm]. */
export const OPENING_SNAP_MM = 600;

/**
 * Přichycení okna / dveří ke stěně: nejbližší stěna místností podlaží do `tolerance` (při stejné vzdálenosti místnost,
 * ve které bod leží – společná stěna dvou místností). Natočení: místní +v míří do místnosti; okno a posuvné dveře sedí
 * středem na stěně, dveře zadní hranou (zárubní) na stěně a křídlem v místnosti. Null = žádná stěna v dosahu.
 */
export function snapOpening(rooms: readonly RoomShape[], point: Pt, spec: Pick<FixtureSpec, "wall">, depth: number, tolerance = OPENING_SNAP_MM): { x: number; y: number; rotation: number } | null {
  let best: { hit: WallHit; score: number } | null = null;
  for (const room of rooms) {
    const hit = nearestWall(room, point.x, point.y);
    if (!hit) continue;
    const score = hit.distance - (pointInRoom(room, point.x, point.y) ? 1 : 0);
    if (!best || score < best.score) best = { hit, score };
  }
  if (!best || best.hit.distance > tolerance) return null;
  const { inward, at } = best.hit;
  const degrees = (Math.atan2(-inward.x, inward.y) * 180) / Math.PI;
  const normalized = ((Math.round(degrees * 10) / 10) % 360 + 360) % 360;
  const offset = spec.wall === "inside" ? depth / 2 : 0;
  return { x: Math.round(at.x + inward.x * offset), y: Math.round(at.y + inward.y * offset), rotation: normalized === 360 ? 0 : normalized };
}

/** Parametr t na úsečce ab v průsečíku s úsečkou cd (0–1), jinak null. */
function crossing(a: Pt, b: Pt, c: Pt, d: Pt): number | null {
  const r = { x: b.x - a.x, y: b.y - a.y };
  const s = { x: d.x - c.x, y: d.y - c.y };
  const denominator = r.x * s.y - r.y * s.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denominator;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denominator;
  return t > 1e-9 && t < 1 - 1e-9 && u >= 0 && u <= 1 ? t : null;
}

/**
 * Ořez lomené čáry mnohoúhelníkem (zóna 2 koupelny jen uvnitř místnosti, nepřesahuje na fasádu) – vrací úseky, které
 * leží uvnitř. Bez mnohoúhelníku (předmět mimo místnost) beze změny.
 */
export function clipToPolygon(points: readonly Pt[], polygon: readonly Pt[] | null | undefined): Pt[][] {
  if (!polygon || polygon.length < 3 || points.length < 2) return points.length > 1 ? [points.slice()] : [];
  const pieces: Pt[][] = [];
  let current: Pt[] = [];
  const at = (a: Pt, b: Pt, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const cuts = [0, 1];
    for (let edge = 0; edge < polygon.length; edge++) {
      const t = crossing(a, b, polygon[edge], polygon[(edge + 1) % polygon.length]);
      if (t !== null) cuts.push(t);
    }
    cuts.sort((x, y) => x - y);
    for (let part = 1; part < cuts.length; part++) {
      const t0 = cuts[part - 1];
      const t1 = cuts[part];
      if (t1 - t0 < 1e-9) continue;
      const middle = at(a, b, (t0 + t1) / 2);
      if (!pointInPolygon(polygon, middle.x, middle.y)) {
        if (current.length > 1) pieces.push(current);
        current = [];
        continue;
      }
      const start = at(a, b, t0);
      const last = current[current.length - 1];
      if (!last || Math.hypot(last.x - start.x, last.y - start.y) > 0.5) {
        if (current.length > 1) pieces.push(current);
        current = [start];
      }
      current.push(at(a, b, t1));
    }
  }
  if (current.length > 1) pieces.push(current);
  return pieces;
}
