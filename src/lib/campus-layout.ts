// Umístění budovy na mapě areálu ve Studiu: obdélník v procentech mapy (0–100), posun
// a změna velikosti tažením, hlídání hranic areálu, překryv se stávajícími budovami
// a návrh volného místa. Čisté funkce.

export interface CampusRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const MIN_SIZE = 4;
/** Přibližný rozměr areálu v metrech pro převod rozměru budovy (šablony) na procenta mapy. */
export const CAMPUS_METERS = { width: 400, height: 280 } as const;

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

/** Rozměr budovy v metrech → procenta mapy areálu. */
export const metersToRect = (widthM: number, depthM: number) => ({
  w: round(Math.max(MIN_SIZE, (widthM / CAMPUS_METERS.width) * 100)),
  h: round(Math.max(MIN_SIZE, (depthM / CAMPUS_METERS.height) * 100)),
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
