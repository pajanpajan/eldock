// 45° izometrie (dimetrie 2:1): osa x vede vpravo dolů, osa y vlevo dolů, z nahoru.

export type IsoPoint = [x: number, y: number];

const COS45 = Math.SQRT1_2;

/** Promítne bod (x, y, z) do roviny obrazovky. */
export function isoProject(x: number, y: number, z: number): IsoPoint {
  return [(x - y) * COS45, (x + y) * COS45 * 0.5 - z];
}

/** Obdélník (x, y, w, h) v rovině z → čtyři promítnuté rohy. */
export function isoRect(x: number, y: number, w: number, h: number, z: number): IsoPoint[] {
  return [isoProject(x, y, z), isoProject(x + w, y, z), isoProject(x + w, y + h, z), isoProject(x, y + h, z)];
}

export const isoPoints = (points: IsoPoint[]) =>
  points.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(" ");

/**
 * Deska patra o rozměrech `w × d` a tloušťce `t` se spodní hranou v `z`:
 * horní plocha + dvě viditelné stěny (pravá podél x = w, přední podél y = d).
 */
export function isoSlab(w: number, d: number, z: number, t: number) {
  const top = isoRect(0, 0, w, d, z + t);
  const right = [isoProject(w, 0, z + t), isoProject(w, d, z + t), isoProject(w, d, z), isoProject(w, 0, z)];
  const front = [isoProject(0, d, z + t), isoProject(w, d, z + t), isoProject(w, d, z), isoProject(0, d, z)];
  return { top, right, front };
}
