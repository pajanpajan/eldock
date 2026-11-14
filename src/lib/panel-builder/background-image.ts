// Fáze 64: pomocné funkce nahrání podkladu 2D půdorysu (z FloorplanEditor.tsx) – předběžné načtení obrázku a převod SVG na PNG.
// Fáze 113: podklad se po vykreslení zmenší na 2400 px delší strany a uloží jako WebP (JPEG, když prohlížeč WebP neumí)
// v kvalitě 0,82 – jedno podlaží má 300–600 kB místo jednotek MB, ukládání i načítání více podlaží je rychlé.

/** Delší strana podkladu po nahrání [px] – výkres A3 ≈ 200 dpi, plátno i tisk zůstanou ostré. */
export const BACKGROUND_MAX_SIDE = 2400;
/** Výchozí kvalita WebP / JPEG podkladu. */
export const BACKGROUND_QUALITY = 0.82;
/** Cílová velikost souboru podkladu jednoho podlaží [B]. */
export const BACKGROUND_TARGET_BYTES = 600 * 1024;
/** Nejmenší delší strana při zmenšování kvůli velikosti souboru [px]. */
export const BACKGROUND_MIN_SIDE = 1400;

/** Rozměr po zmenšení na `maxSide` delší strany (nikdy nezvětšuje). */
export function fitSide(width: number, height: number, maxSide = BACKGROUND_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width || 1, height || 1));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale };
}

/**
 * Postup kódování podkladu: nejdřív plné rozlišení a kvalita 0,82, při větším souboru nižší kvalita a teprve potom
 * menší rozlišení (nejméně `BACKGROUND_MIN_SIDE` px delší strany).
 */
export function encodingSteps(longSide: number): { scale: number; quality: number }[] {
  const steps: { scale: number; quality: number }[] = [
    { scale: 1, quality: BACKGROUND_QUALITY },
    { scale: 1, quality: 0.72 },
    { scale: 1, quality: 0.62 },
  ];
  for (const scale of [0.8, 0.64]) if (longSide * scale >= BACKGROUND_MIN_SIDE) steps.push({ scale, quality: 0.68 });
  return steps;
}

/** Přípona souboru podle typu obrázku. */
export const backgroundExtension = (type: string) => (type === "image/webp" ? "webp" : type === "image/png" ? "png" : "jpg");

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

function scaled(canvas: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale >= 1) return canvas;
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(canvas.width * scale));
  out.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/**
 * Plátno s vykresleným podkladem → WebP (jinak JPEG) do `BACKGROUND_TARGET_BYTES`. Vrací soubor a jeho rozměr –
 * při zmenšení kvůli velikosti je menší než plátno.
 */
export async function encodeBackground(canvas: HTMLCanvasElement): Promise<{ file: File; width: number; height: number }> {
  let best: { blob: Blob; width: number; height: number } | null = null;
  let type = "image/webp";
  for (const step of encodingSteps(Math.max(canvas.width, canvas.height))) {
    const source = scaled(canvas, step.scale);
    let blob = await toBlob(source, type, step.quality);
    // Safari a starší prohlížeče WebP nekódují (vrátí PNG) – dál JPEG ve stejné kvalitě
    if (blob && blob.type !== type) {
      type = "image/jpeg";
      blob = await toBlob(source, type, step.quality);
    }
    if (!blob) continue;
    if (!best || blob.size < best.blob.size) best = { blob, width: source.width, height: source.height };
    if (blob.size <= BACKGROUND_TARGET_BYTES) break;
  }
  if (!best) throw new Error("Podklad se nepodařilo převést na obrázek.");
  return { file: new File([best.blob], `pudorys.${backgroundExtension(best.blob.type)}`, { type: best.blob.type || "image/jpeg" }), width: best.width, height: best.height };
}

/** Obrázek (JPG / PNG / WebP / SVG) → plátno s delší stranou nejvýš 2400 px na bílém pozadí. */
export async function imageToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const size = fitSide(image.naturalWidth || 1200, image.naturalHeight || 800);
    // SVG bez rozměru: zvětšit na plnou šířku podkladu
    const target = !image.naturalWidth ? { width: BACKGROUND_MAX_SIDE, height: Math.round(BACKGROUND_MAX_SIDE * 0.7) } : size;
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Plátno není k dispozici.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** SVG výkres: vykreslit v plném rozlišení podkladu (SVG nemá pevný rastr). */
export async function svgToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const width = image.naturalWidth || 1200;
    const height = image.naturalHeight || 800;
    const scale = BACKGROUND_MAX_SIDE / Math.max(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Plátno není k dispozici.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Předběžné načtení nahraného podkladu (dekódování) – při chybě ještě 2 pokusy. */
export async function preloadImage(url: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const image = new Image();
      image.src = attempt ? `${url}?pokus=${attempt}` : url;
      await image.decode();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw new Error("Nahraný podklad se nepodařilo načíst – zkuste to prosím znovu.");
}
