// Fáze 63: polygonální místnosti se šikmými stěnami. Místnost je obdélník (x, y, w, h) nebo mnohoúhelník (`points`,
// obdélník = jeho obálka). Test bodu v místnosti, stěny, nejbližší stěna s natočením značky „nožičkou“ ke stěně
// (i pod obecným úhlem), přichytávání úhlu 0° / 45° / 90° při kreslení rohů a kóty stěn. Čisté funkce.

export interface Pt {
  x: number;
  y: number;
}

export interface RoomShape {
  x: number;
  y: number;
  w: number;
  h: number;
  points?: readonly Pt[] | null;
}

export const MIN_POLYGON_POINTS = 3;
export const MAX_POLYGON_POINTS = 40;

const r1 = (value: number) => Math.round(value);

export const isPolygonRoom = (room: Pick<RoomShape, "points">) => Boolean(room.points && room.points.length >= MIN_POLYGON_POINTS);

/** Obrys místnosti (u obdélníku 4 rohy po směru hodin od levého horního). */
export function roomPolygon(room: RoomShape): Pt[] {
  if (room.points && room.points.length >= MIN_POLYGON_POINTS) return room.points.map((point) => ({ x: point.x, y: point.y }));
  return [
    { x: room.x, y: room.y },
    { x: room.x + room.w, y: room.y },
    { x: room.x + room.w, y: room.y + room.h },
    { x: room.x, y: room.y + room.h },
  ];
}

/** Obálka mnohoúhelníku. */
export function polygonBounds(points: readonly Pt[]): { x: number; y: number; w: number; h: number } {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Plocha mnohoúhelníku [mm²] (Gaussův vzorec). */
export function polygonArea(points: readonly Pt[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter(points: readonly Pt[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

/** Kolmý průmět bodu na úsečku a → b. */
export function projectOnSegment(point: Pt, a: Pt, b: Pt): { t: number; at: Pt; distance: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length2 = dx * dx + dy * dy || 1;
  const t = Math.min(1, Math.max(0, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2));
  const at = { x: a.x + dx * t, y: a.y + dy * t };
  return { t, at, distance: Math.hypot(point.x - at.x, point.y - at.y) };
}

/** Bod v mnohoúhelníku (paprsek); bod na hraně (do 1 mm) patří dovnitř. */
export function pointInPolygon(points: readonly Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if (projectOnSegment({ x, y }, a, b).distance <= 1) return true;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function pointInRoom(room: RoomShape, x: number, y: number): boolean {
  if (!isPolygonRoom(room)) return x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h;
  return pointInPolygon(room.points!, x, y);
}

/** Plocha místnosti [mm²]. */
export const roomArea = (room: RoomShape) => (isPolygonRoom(room) ? polygonArea(room.points!) : room.w * room.h);

/** Stěny místnosti jako úsečky s jednotkovou normálou do místnosti. */
export function roomWalls(room: RoomShape): { a: Pt; b: Pt; inward: Pt }[] {
  const polygon = roomPolygon(room);
  return polygon
    .map((a, index) => {
      const b = polygon[(index + 1) % polygon.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 1) return null;
      const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const probe = Math.min(20, length / 4);
      const inward = pointInPolygon(polygon, mid.x + normal.x * probe, mid.y + normal.y * probe) && !pointInPolygon(polygon, mid.x - normal.x * probe, mid.y - normal.y * probe) ? normal : { x: -normal.x, y: -normal.y };
      return { a, b, inward };
    })
    .filter((wall): wall is { a: Pt; b: Pt; inward: Pt } => wall !== null);
}

/** Natočení značky tak, aby „nožička“ (místní −y) mířila ke stěně: 0 = stěna nahoře, 90 = vpravo, 180 = dole, 270 = vlevo. */
export function rotationTowards(outward: Pt): number {
  const degrees = (Math.atan2(outward.x, -outward.y) * 180) / Math.PI;
  const normalized = ((Math.round(degrees * 10) / 10) % 360 + 360) % 360;
  return normalized === 360 ? 0 : normalized;
}

export interface WallHit {
  a: Pt;
  b: Pt;
  /** Kolmý průmět bodu na stěnu. */
  at: Pt;
  distance: number;
  /** Směr stěny [°] (0 = vodorovně). */
  angle: number;
  /** Natočení značky k této stěně. */
  rotation: number;
  /** Jednotková normála do místnosti. */
  inward: Pt;
}

/** Nejbližší stěna místnosti k bodu. */
export function nearestWall(room: RoomShape, x: number, y: number): WallHit | null {
  let best: WallHit | null = null;
  for (const wall of roomWalls(room)) {
    const projected = projectOnSegment({ x, y }, wall.a, wall.b);
    if (best && projected.distance >= best.distance - 1e-9) continue;
    const angle = ((Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x) * 180) / Math.PI + 360) % 360;
    best = { a: wall.a, b: wall.b, at: projected.at, distance: projected.distance, angle, rotation: rotationTowards({ x: -wall.inward.x, y: -wall.inward.y }), inward: wall.inward };
  }
  return best;
}

/** Úhel úseku [°] v rozsahu 0–360. */
export const segmentAngle = (a: Pt, b: Pt) => (((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 360 + 360) % 360;

/**
 * Přichycení dalšího rohu při kreslení: úhel od předchozího rohu na násobek `stepDeg` (0° / 45° / 90° …), délka
 * se zachová; Shift = volný úhel (jen zaokrouhlení na mm).
 */
export function snapAngle(from: Pt, to: Pt, stepDeg = 45): Pt {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (length < 1) return { x: r1(to.x), y: r1(to.y) };
  const step = (stepDeg * Math.PI) / 180;
  const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / step) * step;
  const cos = Math.abs(Math.cos(angle)) < 1e-9 ? 0 : Math.cos(angle);
  const sin = Math.abs(Math.sin(angle)) < 1e-9 ? 0 : Math.sin(angle);
  // Délka podél přichyceného směru = průmět kurzoru (roh sedí pod kurzorem)
  const along = (to.x - from.x) * cos + (to.y - from.y) * sin;
  return { x: r1(from.x + cos * along), y: r1(from.y + sin * along) };
}

/** Posun mnohoúhelníku. */
export const translatePolygon = (points: readonly Pt[], dx: number, dy: number): Pt[] => points.map((point) => ({ x: point.x + dx, y: point.y + dy }));

/** Mnohoúhelník je použitelný jako místnost: 3–40 rohů, plocha ≥ 0,25 m². */
export function validPolygon(points: readonly Pt[]): boolean {
  return points.length >= MIN_POLYGON_POINTS && points.length <= MAX_POLYGON_POINTS && polygonArea(points) >= 250_000;
}

/** Délka stěny „2,45 m“. */
export const wallLabel = (a: Pt, b: Pt) => `${(Math.hypot(b.x - a.x, b.y - a.y) / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} m`;
