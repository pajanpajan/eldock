import path from "node:path";

// Soubory aplikace leží ve storage/uploads a servíruje je GET /api/files/[...path].

export const UPLOAD_KINDS = ["photos", "revisions", "markups", "voice", "documents", "attachments", "software"] as const;
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
  // Návody a datasheety (fáze 46)
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain; charset=utf-8",
  // Zálohy PLC / HMI / měničů (fáze 46) – stahují se jako binární soubory
  ".zip": "application/zip",
  ".7z": "application/x-7z-compressed",
  ".rar": "application/vnd.rar",
  ".zap16": "application/octet-stream",
  ".zap17": "application/octet-stream",
  ".zap18": "application/octet-stream",
  ".zap19": "application/octet-stream",
  ".s7p": "application/octet-stream",
  ".acd": "application/octet-stream",
  ".xml": "application/xml",
  ".par": "application/octet-stream",
  ".bin": "application/octet-stream",
  ".hex": "application/octet-stream",
  // Fáze 103: zdrojové CAD výkresy překreslených Červenek z ELDOCK Poolu
  ".dwg": "application/acad",
  ".dxf": "image/vnd.dxf",
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
  attachment: { dir: "attachments", maxBytes: 30 * MB, extensions: [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".docx", ".xlsx", ".csv", ".txt"], label: "PDF, obrázek, DOCX, XLSX, CSV nebo TXT" },
  software: {
    dir: "software",
    maxBytes: 50 * MB,
    extensions: [".zip", ".7z", ".rar", ".zap16", ".zap17", ".zap18", ".zap19", ".s7p", ".acd", ".xml", ".json", ".par", ".bin", ".hex", ".csv", ".pdf"],
    label: "ZIP, 7Z, RAR, TIA (.zap16–19), Step7 (.s7p), Rockwell (.acd), XML, JSON, PAR, BIN, HEX, CSV nebo PDF",
  },
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
