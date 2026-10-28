// Geometrie map. Polygony v DB jsou v procentech viewBoxu ("x,y x,y …").

export type Point = [x: number, y: number];

/** "10,20 30,40" (procenta) → body ve viewBoxu `width × height`. */
export function parsePercentPolygon(points: string, width: number, height: number): Point[] {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [(x / 100) * width, (y / 100) * height] as Point;
    })
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
}

export const toSvgPoints = (points: Point[]) => points.map(([x, y]) => `${round(x)},${round(y)}`).join(" ");

export const offsetPoints = (points: Point[], dx: number, dy: number): Point[] =>
  points.map(([x, y]) => [x + dx, y + dy]);

/** Ohraničující obdélník bodů. */
export function bounds(points: Point[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY };
}

const round = (value: number) => Math.round(value * 10) / 10;
