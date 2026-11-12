"use client";

import { IMAGE_MAX_WIDTH, IMAGE_QUALITY, MAX_ATTACHMENT_BYTES } from "@/lib/contact";

// Fáze 107: printscreen / fotka se před odesláním zmenší v prohlížeči přes HTML5 canvas (max. šířka 1600 px, WebP,
// kde ho prohlížeč neumí zakódovat JPEG, kvalita 0,82) – i 4K snímek obrazovky má pak pár set kB.

export interface CompressedImage {
  blob: Blob;
  /** Náhled (object URL) – po odebrání / odeslání uvolnit přes `URL.revokeObjectURL`. */
  previewUrl: string;
  name: string;
  width: number;
  height: number;
}

const toBlob = (canvas: HTMLCanvasElement, type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, IMAGE_QUALITY));

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Safari s HEIC apod. – zkusí se <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Zmenší obrázek na max. 1600 px šířky a zakóduje do WebP (jinak JPEG) s kvalitou 0,82. */
export async function compressImage(file: Blob, name = "printscreen"): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) throw new Error("Vložte prosím obrázek (printscreen nebo fotku).");
  const decoded = await decode(file).catch(() => {
    throw new Error("Obrázek se nepodařilo načíst – zkuste PNG nebo JPG.");
  });
  try {
    const scale = Math.min(1, IMAGE_MAX_WIDTH / Math.max(1, decoded.width));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Prohlížeč neumí obrázek zmenšit.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);
    let blob = await toBlob(canvas, "image/webp");
    if (!blob || blob.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg");
    if (!blob) throw new Error("Obrázek se nepodařilo zmenšit.");
    if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error("Obrázek je i po zmenšení příliš velký.");
    const extension = blob.type === "image/webp" ? "webp" : "jpg";
    return { blob, previewUrl: URL.createObjectURL(blob), name: `${name.replace(/\.[a-z0-9]+$/i, "") || "printscreen"}.${extension}`, width, height };
  } finally {
    decoded.close();
  }
}

/** Obrázky ze schránky (Ctrl + V – výstřižek Win + Shift + S, PrintScreen) nebo z přetažení. */
export function imagesFromTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []).filter((file) => file.type.startsWith("image/"));
  if (files.length) return files;
  return Array.from(data.items ?? [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
}
