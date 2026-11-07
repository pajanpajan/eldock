// Fáze 64: pomocné funkce nahrání podkladu 2D půdorysu (z FloorplanEditor.tsx) – předběžné načtení obrázku a převod SVG na PNG.

/** Šířka podkladu po nahrání [px] – ostrý i při přiblížení (A3 ≈ 270 dpi). */
export const BACKGROUND_PX = 3200;

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

/** SVG podklad → PNG (createImageBitmap SVG neumí). */
export async function rasterizeSvg(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = BACKGROUND_PX / Math.max(image.naturalWidth || 1200, image.naturalHeight || 800);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round((image.naturalWidth || 1200) * scale);
    canvas.height = Math.round((image.naturalHeight || 800) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Plátno není k dispozici.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("SVG se nepodařilo převést.");
    return new File([blob], "pudorys.png", { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
