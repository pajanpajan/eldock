// Fáze 63: normové (CAD) značení kabelů v půdorysu elektroinstalace podle zvyklostí ČSN EN 60617-11 / ČSN 01 3390:
// vedení plnou čarou se šikmými ryskami počtu žil (/// 3, ///// 5), ovládací a sběrnicové kabely čárkovaně, podél každé
// větve štítek „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. Umístění štítku a rysek na nejdelším úseku trasy, text vždy čitelný
// (nikdy vzhůru nohama). Sdílí plátno editoru, tiskový výkres (PDF) i export DXF. Čisté funkce.

export interface CadPoint {
  x: number;
  y: number;
}

/** Počet žil kabelu z označení („CYKY-J 5×2,5“ → 5, sběrnice 2×2×0,8 → 4, UTP → 8). */
export function coresOf(cable: string): number {
  if (/2\s*[x×]\s*2\s*[x×]\s*0[,.]8/i.test(cable)) return 4;
  if (/UTP|Cat\s*\d/i.test(cable)) return 8;
  const match = /(\d+)\s*[x×]\s*\d/.exec(cable);
  return match ? Number(match[1]) : 3;
}

/** Ovládací / sběrnicový / slaboproudý kabel – v normovém zobrazení čárkovaně. */
export const isLowVoltageCable = (cable: string) => /24\s*V\s*DC|sběrnic|KNX|CAT\s*7|UTP|J-Y\(St\)Y/i.test(cable);

const meters = (value: number) => value.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Štítek větve „Okr. -F4 · CYKY-J 3×2,5 · 14,2 m“. */
export const circuitTag = (designation: string | null | undefined, cable: string, lengthM: number) => `Okr. ${designation ?? "–"} · ${cable} · ${meters(lengthM)} m`;

/** Nejdelší rovný úsek z lomených čar (pro štítek a rysky). */
export function longestStretch(runs: readonly (readonly CadPoint[])[]): { a: CadPoint; b: CadPoint; length: number } | null {
  let best: { a: CadPoint; b: CadPoint; length: number } | null = null;
  for (const run of runs) {
    for (let index = 1; index < run.length; index++) {
      const a = run[index - 1];
      const b = run[index];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!best || length > best.length) best = { a, b, length };
    }
  }
  return best;
}

/** Úhel textu podél úseku [°] v rozsahu (−90, 90] – štítek se čte zleva doprava, svislý zdola nahoru. */
export function readableAngle(a: CadPoint, b: CadPoint): number {
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return Math.round(angle * 10) / 10;
}

/** Poloha štítku: bod úseku v poměru `t` (0,5 = střed) odsunutý o `offset` kolmo od čáry (na stranu „nad“ textem). */
export function labelPlacement(a: CadPoint, b: CadPoint, offset: number, t = 0.5): { x: number; y: number; angle: number } {
  const angle = readableAngle(a, b);
  const rad = (angle * Math.PI) / 180;
  // Normála „nad“ text v souřadnicích výkresu (y dolů)
  const normal = { x: Math.sin(rad), y: -Math.cos(rad) };
  return { x: a.x + (b.x - a.x) * t + normal.x * offset, y: a.y + (b.y - a.y) * t + normal.y * offset, angle };
}

/** Okruhy se společným úsekem (souběh) mají štítek a rysky každý jinde podél úseku – nepřekrývají se. */
export const stretchSlot = (index: number) => [0.5, 0.22, 0.78][index % 3];

/**
 * Šikmé rysky počtu žil uprostřed úseku: `cores` krátkých čar pod 45° k vedení s roztečí `gap`, délka `size`.
 * Vrací úsečky v souřadnicích výkresu.
 */
export function tickMarks(a: CadPoint, b: CadPoint, cores: number, size: number, gap = size * 0.45, t = 0.5): { x1: number; y1: number; x2: number; y2: number }[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 1) return [];
  const dir = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
  const normal = { x: -dir.y, y: dir.x };
  // Rysky pod 45°: směr = (směr + normála) / √2
  const slant = { x: (dir.x + normal.x) / Math.SQRT2, y: (dir.y + normal.y) / Math.SQRT2 };
  const count = Math.max(1, Math.min(8, cores));
  const mid = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return Array.from({ length: count }, (_, index) => {
    const along = (index - (count - 1) / 2) * gap;
    const centre = { x: mid.x + dir.x * along, y: mid.y + dir.y * along };
    return { x1: centre.x - (slant.x * size) / 2, y1: centre.y - (slant.y * size) / 2, x2: centre.x + (slant.x * size) / 2, y2: centre.y + (slant.y * size) / 2 };
  });
}
