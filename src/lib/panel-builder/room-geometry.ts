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

// ---------------------------------------------------------------------------
//  Fáze 114: spojení místností do tvaru L / T / U (sjednocení pravoúhlých mnohoúhelníků)
// ---------------------------------------------------------------------------

/** Tolerance zarovnání stěn při spojování [mm] – stěny 2 místností do 2 cm od sebe se spojí. */
export const MERGE_TOLERANCE_MM = 20;
/** Nejkratší společná stěna sousedních místností, aby šlo o „sousední“ místnost [mm]. */
export const MIN_SHARED_WALL_MM = 300;
/** Nejmenší překryv, který se počítá jako překrývající se místnosti [mm²] (1 dm²). */
export const MIN_OVERLAP_MM2 = 10_000;

/** Obrys má jen vodorovné a svislé stěny (obdélník, L, T, U …). */
export function isRectilinear(points: readonly Pt[], tolerance = 0.5): boolean {
  return (
    points.length >= 4 &&
    points.every((a, index) => {
      const b = points[(index + 1) % points.length];
      return Math.abs(a.x - b.x) <= tolerance || Math.abs(a.y - b.y) <= tolerance;
    })
  );
}

/** Souřadnice do `tolerance` mm od sebe → jedna hodnota (nejmenší ze shluku). */
function snapScale(values: readonly number[], tolerance: number): (value: number) => number {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const map = new Map<number, number>();
  let start = sorted[0];
  for (const value of sorted) {
    if (value - start > tolerance) start = value;
    map.set(value, start);
  }
  return (value) => map.get(value) ?? value;
}

interface CellGrid {
  xs: number[];
  ys: number[];
  /** Buňka uvnitř A (bit 1), uvnitř B (bit 2). */
  cells: Uint8Array;
  nx: number;
  ny: number;
}

/** Mřížka buněk ze všech souřadnic obou obrysů (komprimace souřadnic): každá buňka leží celá v A, v B, v obou, nebo mimo. */
function cellGrid(a: readonly Pt[], b: readonly Pt[], tolerance: number): CellGrid {
  const snapX = snapScale([...a, ...b].map((point) => point.x), tolerance);
  const snapY = snapScale([...a, ...b].map((point) => point.y), tolerance);
  const snapped = (points: readonly Pt[]) => points.map((point) => ({ x: snapX(point.x), y: snapY(point.y) }));
  const sa = snapped(a);
  const sb = snapped(b);
  const xs = [...new Set([...sa, ...sb].map((point) => point.x))].sort((p, q) => p - q);
  const ys = [...new Set([...sa, ...sb].map((point) => point.y))].sort((p, q) => p - q);
  const nx = Math.max(0, xs.length - 1);
  const ny = Math.max(0, ys.length - 1);
  const cells = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      cells[j * nx + i] = (pointInPolygon(sa, cx, cy) ? 1 : 0) | (pointInPolygon(sb, cx, cy) ? 2 : 0);
    }
  }
  return { xs, ys, cells, nx, ny };
}

export type RoomRelation = "overlap" | "touch" | "apart";

/**
 * Vztah dvou pravoúhlých místností: překryv s kladnou plochou (`overlapMm2`), společná stěna (`sharedMm` – součet délek,
 * kde se obrysy dotýkají zvenku) nebo odděleně. Šikmé stěny = „apart“ (spojují se jen pravoúhlé místnosti).
 */
export function roomRelation(a: RoomShape, b: RoomShape, tolerance = MERGE_TOLERANCE_MM): { relation: RoomRelation; overlapMm2: number; sharedMm: number } {
  const pa = roomPolygon(a);
  const pb = roomPolygon(b);
  const apart = { relation: "apart" as const, overlapMm2: 0, sharedMm: 0 };
  if (!isRectilinear(pa) || !isRectilinear(pb)) return apart;
  // Obálky daleko od sebe – bez výpočtu
  const ba = polygonBounds(pa);
  const bb = polygonBounds(pb);
  if (ba.x > bb.x + bb.w + tolerance || bb.x > ba.x + ba.w + tolerance || ba.y > bb.y + bb.h + tolerance || bb.y > ba.y + ba.h + tolerance) return apart;
  const { xs, ys, cells, nx, ny } = cellGrid(pa, pb, tolerance);
  let overlapMm2 = 0;
  let sharedMm = 0;
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < ny ? cells[j * nx + i] : 0);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const cell = at(i, j);
      if (cell === 3) overlapMm2 += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
      // Stěna mezi buňkou jen A a buňkou jen B (vpravo / dole) = společná stěna
      const right = at(i + 1, j);
      const below = at(i, j + 1);
      if ((cell === 1 && right === 2) || (cell === 2 && right === 1)) sharedMm += ys[j + 1] - ys[j];
      if ((cell === 1 && below === 2) || (cell === 2 && below === 1)) sharedMm += xs[i + 1] - xs[i];
    }
  }
  const relation: RoomRelation = overlapMm2 >= MIN_OVERLAP_MM2 ? "overlap" : sharedMm >= MIN_SHARED_WALL_MM ? "touch" : "apart";
  return { relation, overlapMm2, sharedMm };
}

/** Uzavřené obrysy buněk mřížky (vnější po směru hodinových ručiček na obrazovce, díry opačně) – rohy v indexech mřížky. */
function cellLoops(grid: Uint8Array, gw: number, gh: number): Pt[][] {
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
      for (let guard = 0; guard < 100_000; guard++) {
        loop.push(edge.to);
        if (edge.to.x === sx && edge.to.y === sy) break;
        const next = edges.get(`${edge.to.x},${edge.to.y}`);
        if (!next?.length) break;
        // Na křížení přes roh zatočit doprava – místnosti dotýkající se jen rohem zůstanou dva obrysy
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

/** Vynechá rohy ležící na přímce mezi sousedními rohy. */
function withoutCollinear(points: readonly Pt[]): Pt[] {
  return points.filter((cur, index) => {
    const prev = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    return Math.abs((cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x)) > 1e-6;
  });
}

export type RoomUnion = { ok: true; points: Pt[] } | { ok: false; reason: "slanted" | "apart" | "hole" | "complex"; message: string };

/**
 * Sjednocení dvou pravoúhlých místností (Rectilinear Polygon Boolean Union): překrývající se úseky stěn i společná
 * stěna zmizí a vznikne jeden obrys tvaru L, T nebo U (po směru hodin od levého horního rohu, bez rohů na přímce).
 * Stěny do `tolerance` mm od sebe se zarovnají. Šikmé stěny, místnosti bez společné stěny a díra uprostřed = chyba.
 */
export function unionRooms(a: readonly Pt[], b: readonly Pt[], tolerance = MERGE_TOLERANCE_MM): RoomUnion {
  if (!isRectilinear(a) || !isRectilinear(b)) return { ok: false, reason: "slanted", message: "Spojit lze jen místnosti s pravoúhlými stěnami (šikmé stěny upravte ručně)." };
  const { xs, ys, cells, nx, ny } = cellGrid(a, b, tolerance);
  const filled = new Uint8Array(cells.length);
  for (let index = 0; index < cells.length; index++) filled[index] = cells[index] ? 1 : 0;
  const loops = cellLoops(filled, nx, ny);
  const signed = (loop: readonly Pt[]) =>
    loop.reduce((sum, point, index) => {
      const next = loop[(index + 1) % loop.length];
      return sum + point.x * next.y - next.x * point.y;
    }, 0);
  const outer = loops.filter((loop) => signed(loop) > 0);
  if (outer.length !== 1) return { ok: false, reason: "apart", message: "Místnosti se nepřekrývají ani nesdílejí stěnu – přisuňte je k sobě (stačí společná stěna)." };
  if (loops.length > 1) return { ok: false, reason: "hole", message: "Spojením by vznikla místnost s dírou uprostřed (dvorek) – spojte místnosti jinak." };
  const points = withoutCollinear(outer[0].map((corner) => ({ x: xs[corner.x], y: ys[corner.y] })));
  if (points.length > MAX_POLYGON_POINTS) return { ok: false, reason: "complex", message: `Spojená místnost by měla víc než ${MAX_POLYGON_POINTS} rohů.` };
  // Začátek v levém horním rohu (nejmenší y, pak x) – stejné pořadí jako `roomPolygon`
  const start = points.reduce((best, point, index) => (point.y < points[best].y || (point.y === points[best].y && point.x < points[best].x) ? index : best), 0);
  return { ok: true, points: [...points.slice(start), ...points.slice(0, start)] };
}

/** Fáze 114: obrys místnosti spojené ze dvou pravoúhlých místností, nebo null (spojit nejde – viz `unionRooms`). */
export function unionRoomPolygons(a: readonly Pt[], b: readonly Pt[], tolerance = MERGE_TOLERANCE_MM): Pt[] | null {
  const result = unionRooms(a, b, tolerance);
  return result.ok ? result.points : null;
}

/** Popis tvaru místnosti podle počtu rohů („L-tvar“, „T / U-tvar“). */
export function roomShapeLabel(points: readonly Pt[] | null | undefined): string | null {
  if (!points || points.length <= 4) return null;
  if (points.length === 6) return "L-tvar";
  if (points.length === 8) return "T / U-tvar";
  return `${points.length} rohů`;
}
