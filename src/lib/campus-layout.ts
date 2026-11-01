// Umístění budovy na mapě areálu ve Studiu: obdélník v procentech mapy (0–100), posun
// a změna velikosti tažením, hlídání hranic areálu, překryv se stávajícími budovami
// a návrh volného místa. Čisté funkce.

export interface CampusRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Nejmenší budova v procentech mapy (u velkých areálů jinak vycházely desítky metrů). */
export const MIN_SIZE = 1;
/** Výchozí rozměr areálu v metrech (závody ze seedu) pro převod rozměru budovy na procenta mapy. */
export const CAMPUS_METERS = { width: 400, height: 280 } as const;

export interface CampusSize {
  width: number;
  height: number;
}

/** Povolený rozměr pozemku v metrech (osa X i osa Y). */
export const CAMPUS_LIMITS = { min: 50, max: 2000 } as const;

/** Rychlé předvolby rozměru areálu (osa X × osa Y). */
export const CAMPUS_PRESETS: readonly CampusSize[] = [
  { width: 150, height: 100 },
  { width: 300, height: 200 },
  { width: 500, height: 350 },
  { width: 1000, height: 600 },
];

export const campusSizeValid = (campus: CampusSize) =>
  [campus.width, campus.height].every((value) => Number.isFinite(value) && value >= CAMPUS_LIMITS.min && value <= CAMPUS_LIMITS.max);

/** ViewBox mapy areálu: šířka 1000 jednotek, výška v poměru stran pozemku (budovy se nedeformují). */
export const campusViewBox = (campus: CampusSize) => ({ width: 1000, height: Math.round((1000 * campus.height) / campus.width) });

/** Obdélník v procentech mapy → metry areálu. */
export const rectToMeters = (rect: CampusRect, campus: CampusSize) => ({
  x: (rect.x / 100) * campus.width,
  y: (rect.y / 100) * campus.height,
  w: (rect.w / 100) * campus.width,
  h: (rect.h / 100) * campus.height,
});

/** Stejná poloha a velikost v metrech po změně rozměru areálu (procenta se přepočítají). */
export function rescaleRect(rect: CampusRect, from: CampusSize, to: CampusSize): CampusRect {
  const fx = from.width / to.width;
  const fy = from.height / to.height;
  return { x: round(rect.x * fx), y: round(rect.y * fy), w: round(rect.w * fx), h: round(rect.h * fy) };
}

/** Polygon budovy „x,y x,y …“ po změně rozměru areálu (zachová metry). */
export function rescalePolygon(points: string, from: CampusSize, to: CampusSize): string {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return `${round((x * from.width) / to.width)},${round((y * from.height) / to.height)}`;
    })
    .join(" ");
}

/** Leží obdélník celý v areálu (tolerance zaokrouhlení 0,2 %)? */
export const rectInsideCampus = (rect: CampusRect) => rect.x >= -0.2 && rect.y >= -0.2 && rect.x + rect.w <= 100.2 && rect.y + rect.h <= 100.2;

const round = (value: number) => Math.round(value * 10) / 10;

/** Udrží obdélník celý uvnitř areálu (a s minimální velikostí). */
export function clampRect(rect: CampusRect): CampusRect {
  const w = Math.min(100, Math.max(MIN_SIZE, rect.w));
  const h = Math.min(100, Math.max(MIN_SIZE, rect.h));
  return { x: round(Math.min(100 - w, Math.max(0, rect.x))), y: round(Math.min(100 - h, Math.max(0, rect.y))), w: round(w), h: round(h) };
}

/** Posun o delta (procenta) – hrana areálu zastaví budovu. */
export const moveRect = (rect: CampusRect, dx: number, dy: number) => clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy });

/** Změna velikosti tažením pravého dolního úchytu; budova nevyjede za areál. */
export function resizeRect(rect: CampusRect, dw: number, dh: number): CampusRect {
  return clampRect({ ...rect, w: Math.min(100 - rect.x, rect.w + dw), h: Math.min(100 - rect.y, rect.h + dh) });
}

/** Přesun středu budovy na bod (klik do mapy). */
export const centerAt = (rect: CampusRect, x: number, y: number) => clampRect({ ...rect, x: x - rect.w / 2, y: y - rect.h / 2 });

/** Obálka polygonu „x,y x,y …“ (stávající budovy). */
export function polygonBounds(points: string): CampusRect {
  const pairs = points
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!pairs.length) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = pairs.map(([x]) => x);
  const ys = pairs.map(([, y]) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

/** Překryv obdélníků (dotyk hranou není překryv). */
export const rectsOverlap = (a: CampusRect, b: CampusRect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Rozměr budovy v metrech → procenta mapy areálu daného rozměru (budova větší než areál = celý areál). */
export const metersToRect = (widthM: number, depthM: number, campus: CampusSize = CAMPUS_METERS) => ({
  w: round(Math.min(100, Math.max(MIN_SIZE, (widthM / campus.width) * 100))),
  h: round(Math.min(100, Math.max(MIN_SIZE, (depthM / campus.height) * 100))),
});

/** První volné místo pro budovu dané velikosti (prohledává areál po řádcích s okrajem 2 %). */
export function findFreeSpot(size: { w: number; h: number }, obstacles: readonly CampusRect[], margin = 2): CampusRect {
  const padded = obstacles.map((rect) => ({ x: rect.x - margin, y: rect.y - margin, w: rect.w + 2 * margin, h: rect.h + 2 * margin }));
  for (let y = margin; y + size.h <= 100 - margin; y += 2) {
    for (let x = margin; x + size.w <= 100 - margin; x += 2) {
      const candidate = { x, y, w: size.w, h: size.h };
      if (!padded.some((rect) => rectsOverlap(candidate, rect))) return clampRect(candidate);
    }
  }
  return clampRect({ x: margin, y: margin, ...size });
}
