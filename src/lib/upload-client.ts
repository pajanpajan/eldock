// Klientské pomocníky pro nahrávání: zmenšení fotky a upload s průběhem (XHR – fetch průběh neumí).

export interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Fotky rozváděče pro AI rozpoznávání (fáze 56): delší strana až 4096 px a JPEG 0,92. Při 2400 px měl
 * jeden modul na celkové fotce velké skříně jen ~80 px a potisk B16 / C16 nebyl čitelný ani pro „lupu“.
 */
export const PANEL_PHOTO_MAX_PX = 4096;
export const PANEL_PHOTO_QUALITY = 0.92;

/** Zmenší fotku na max. `maxSize` px delší strany a převede na JPEG (kvalita 0,85). */
export async function resizeImage(file: File, maxSize = 2000, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "fotka";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}

export type UploadKindName = "photo" | "revision" | "markup" | "voice" | "document" | "attachment" | "software";

/**
 * POST /api/uploads s průběhem 0–100. Fáze 68: soubor patří účtu, pod kterým se nahrál – `scope: "panel"` = firma
 * přihlášená do AI Panel Builderu (stránky Panel Builderu), jinak účet Správy závodů.
 */
export function uploadFile(kind: UploadKindName, file: File, onProgress?: (percent: number) => void, options: { scope?: "panel" } = {}): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("kind", kind);
    if (options.scope) body.append("scope", options.scope);
    body.append("file", file);
    xhr.open("POST", "/api/uploads");
    xhr.responseType = "json";
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response as UploadedFile);
      else reject(new Error((xhr.response as { error?: string } | null)?.error ?? "Nahrání se nepodařilo."));
    };
    xhr.onerror = () => reject(new Error("Nahrání se nepodařilo – zkontrolujte připojení."));
    xhr.send(body);
  });
}

/** Nahrání ze stránek AI Panel Builderu – soubor patří přihlášené firmě Panel Builderu (fáze 68). */
export const uploadPanelFile = (kind: UploadKindName, file: File, onProgress?: (percent: number) => void) => uploadFile(kind, file, onProgress, { scope: "panel" });
