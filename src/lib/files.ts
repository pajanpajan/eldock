import path from "node:path";

// Soubory aplikace leží ve storage/uploads a servíruje je GET /api/files/[...path].

export const UPLOAD_KINDS = ["photos", "revisions", "markups", "voice"] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export const CONTENT_TYPES: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".csv": "text/csv; charset=utf-8",
  ".webm": "audio/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

/**
 * Bezpečně převede segmenty URL na cestu uvnitř `root`. Vrací `null` pro cokoli
 * mimo povolené složky, neznámou příponu nebo pokus o path traversal.
 */
export function resolveUploadPath(root: string, segments: string[]): string | null {
  if (segments.length < 2) return null;
  if (!(UPLOAD_KINDS as readonly string[]).includes(segments[0])) return null;
  if (segments.some((segment) => segment === "" || segment === "." || segment === ".." || /[\\/\0:]/.test(segment))) {
    return null;
  }
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (!target.startsWith(resolvedRoot + path.sep)) return null;
  if (!CONTENT_TYPES[path.extname(target).toLowerCase()]) return null;
  return target;
}

export const contentTypeFor = (filePath: string) =>
  CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";

/** Název souboru z URL `/api/files/...` (pro atribut `download`). */
export const fileNameFromUrl = (url: string) => decodeURIComponent(url.split("/").pop() ?? "soubor");
