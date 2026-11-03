// Vyčištění bílého pozadí naskenovaného razítka / podpisu na průhledné (fáze 43). Pracuje nad RGBA
// daty z HTML5 Canvas (getImageData), takže razítko na čáře podpisu vypadá jako skutečný otisk.

export interface WhitenOptions {
  /** Jas, od kterého je pixel považován za papír (0–255). */
  threshold?: number;
  /** Šířka přechodu pod prahem – měkké okraje tahu místo zubatých. */
  soft?: number;
}

/** Přepíše alfa kanál: bílé a světlé pixely → průhledné, přechod plynule. Vrací počet průhledných pixelů. */
export function whitenToTransparent(data: Uint8ClampedArray, { threshold = 220, soft = 50 }: WhitenOptions = {}): number {
  let cleared = 0;
  for (let i = 0; i < data.length; i += 4) {
    const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (brightness >= threshold) {
      data[i + 3] = 0;
      cleared++;
    } else if (brightness > threshold - soft) {
      data[i + 3] = Math.round(data[i + 3] * ((threshold - brightness) / soft));
    }
  }
  return cleared;
}
