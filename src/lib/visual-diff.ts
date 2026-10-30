// Barevný diff dvou výkresů (RGBA pixely stejného rozměru): čára jen ve staré verzi = odebráno
// (červeně), jen v nové = přidáno (zeleně), v obou = beze změny (tlumeně šedě), pozadí bílé.

export const DIFF_COLORS = {
  removed: [220, 38, 38],
  added: [22, 163, 74],
  same: [161, 161, 170],
} as const;

/** Tmavost pixelu 0–255 (0 = bílá / průhledná, 255 = černá). */
function ink(data: Uint8ClampedArray, offset: number): number {
  const alpha = data[offset + 3] / 255;
  const luminance = 0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2];
  return (255 - luminance) * alpha;
}

export interface DiffResult {
  data: Uint8ClampedArray;
  removed: number;
  added: number;
  /** Podíl změněných „inkoustových“ pixelů vůči všem kresleným (0–1). */
  changeRatio: number;
}

/**
 * Porovná dva obrázky po pixelech. `threshold` = od jaké tmavosti je pixel „kresba“ (výchozí 60
 * odfiltruje antialiasing a jemný rastr). Pole musí mít stejnou délku (stejný rozměr).
 */
export function diffPixels(before: Uint8ClampedArray, after: Uint8ClampedArray, threshold = 60): DiffResult {
  if (before.length !== after.length) throw new Error("Obrázky musí mít stejný rozměr.");
  const data = new Uint8ClampedArray(before.length);
  let removed = 0;
  let added = 0;
  let drawn = 0;
  for (let offset = 0; offset < before.length; offset += 4) {
    const old = ink(before, offset) >= threshold;
    const now = ink(after, offset) >= threshold;
    const color = old && now ? DIFF_COLORS.same : old ? DIFF_COLORS.removed : now ? DIFF_COLORS.added : null;
    if (old || now) drawn++;
    if (old && !now) removed++;
    if (now && !old) added++;
    data[offset] = color?.[0] ?? 255;
    data[offset + 1] = color?.[1] ?? 255;
    data[offset + 2] = color?.[2] ?? 255;
    data[offset + 3] = 255;
  }
  return { data, removed, added, changeRatio: drawn ? (removed + added) / drawn : 0 };
}

/** Rozměr společného plátna: šířka `width`, výška podle poměru staré verze (novou do něj vepíšeme). */
export function diffCanvasSize(aspect: number, width = 1600) {
  return { width, height: Math.max(1, Math.round(width / aspect)) };
}
