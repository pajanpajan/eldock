import path from "node:path";

// Soubory aplikace leží ve storage/uploads a servíruje je GET /api/files/[...path].

export const UPLOAD_KINDS = ["photos", "revisions", "markups", "voice", "documents"] as const;
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

// ---------------------------------------------------------------------------
//  Nahrávání (POST /api/uploads)
// ---------------------------------------------------------------------------

const MB = 1024 * 1024;

export const UPLOAD_RULES = {
  photo: { dir: "photos", maxBytes: 15 * MB, extensions: [".jpg", ".jpeg", ".png", ".webp"], label: "JPG, PNG nebo WebP" },
  revision: { dir: "revisions", maxBytes: 25 * MB, extensions: [".pdf", ".svg", ".png", ".jpg", ".jpeg"], label: "PDF, SVG, PNG nebo JPG" },
  markup: { dir: "markups", maxBytes: 10 * MB, extensions: [".png", ".json"], label: "PNG nebo JSON" },
  voice: { dir: "voice", maxBytes: 15 * MB, extensions: [".webm", ".ogg", ".mp3", ".m4a"], label: "WebM, OGG, MP3 nebo M4A" },
  document: { dir: "documents", maxBytes: 25 * MB, extensions: [".pdf", ".svg", ".png", ".jpg", ".jpeg"], label: "PDF, SVG, PNG nebo JPG" },
} as const satisfies Record<string, { dir: UploadKind; maxBytes: number; extensions: readonly string[]; label: string }>;

export type UploadRequestKind = keyof typeof UPLOAD_RULES;

/** Ověří druh, příponu a velikost nahrávaného souboru. Vrací českou chybu, nebo normalizovanou příponu. */
export function validateUpload(
  kind: string,
  fileName: string,
  sizeBytes: number,
): { ok: true; kind: UploadRequestKind; extension: string } | { ok: false; error: string } {
  if (!(kind in UPLOAD_RULES)) return { ok: false, error: "Neznámý druh souboru." };
  const rule = UPLOAD_RULES[kind as UploadRequestKind];
  const extension = path.extname(fileName).toLowerCase();
  if (!(rule.extensions as readonly string[]).includes(extension)) {
    return { ok: false, error: `Nepodporovaný formát souboru. Povolené: ${rule.label}.` };
  }
  if (sizeBytes <= 0) return { ok: false, error: "Soubor je prázdný." };
  if (sizeBytes > rule.maxBytes) {
    return { ok: false, error: `Soubor je příliš velký (max. ${Math.round(rule.maxBytes / MB)} MB).` };
  }
  return { ok: true, kind: kind as UploadRequestKind, extension: extension === ".jpeg" ? ".jpg" : extension };
}
