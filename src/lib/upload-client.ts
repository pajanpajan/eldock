// Klientské pomocníky pro nahrávání: zmenšení fotky a upload s průběhem (XHR – fetch průběh neumí).

export interface UploadedFile {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

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

/** POST /api/uploads s průběhem 0–100. */
export function uploadFile(
  kind: "photo" | "revision" | "markup" | "voice" | "document",
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("kind", kind);
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
