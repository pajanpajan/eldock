// Fáze 71: soubory v aplikaci – otisk SHA-256 (Web Crypto, stejný v Electronu, WebView i Node) a místní odkazy
// `local:<sha256>` na fotky pořízené offline: úprava ve frontě na fotku odkazuje místním odkazem, jádro ji před
// odesláním fronty nahraje (`POST /api/sync/v1/files`) a odkaz nahradí adresou ze serveru.

export const LOCAL_FILE_PREFIX = "local:";

export type LocalRef = `local:${string}`;

export const isLocalRef = (value: unknown): value is LocalRef => typeof value === "string" && value.startsWith(LOCAL_FILE_PREFIX) && /^local:[a-f0-9]{64}$/.test(value);

export const localRefFor = (sha256: string) => `${LOCAL_FILE_PREFIX}${sha256}`;

/** SHA-256 obsahu jako hex (malá písmena). */
export async function sha256Hex(data: ArrayBuffer | Uint8Array | Blob): Promise<string> {
  const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", buffer as BufferSource);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Všechny místní odkazy v datech úpravy (do hloubky, bez duplicit). */
export function collectLocalRefs(value: unknown, found: Set<string> = new Set()): string[] {
  if (isLocalRef(value)) found.add(value);
  else if (Array.isArray(value)) for (const item of value) collectLocalRefs(item, found);
  else if (value && typeof value === "object") for (const item of Object.values(value)) collectLocalRefs(item, found);
  return [...found];
}

/** Kopie dat s místními odkazy nahrazenými podle mapy (neznámé odkazy zůstanou). */
export function replaceLocalRefs<T>(value: T, map: Record<string, string>): T {
  if (isLocalRef(value)) return (map[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((item) => replaceLocalRefs(item, map)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceLocalRefs(item, map)])) as T;
  return value;
}

/** Zástupná adresa pro ověření schématem, dokud fotka čeká na nahrání. */
export const PENDING_UPLOAD_URL = "/api/files/photos/ceka-na-nahrani.jpg";

/** Data úpravy pro ověření schématem: místní odkazy = zástupná adresa fotky. */
export function withUploadPlaceholders<T>(value: T): T {
  const refs = collectLocalRefs(value);
  return replaceLocalRefs(value, Object.fromEntries(refs.map((ref) => [ref, PENDING_UPLOAD_URL])));
}

/** Přípona podle typu fotky (název souboru pro server – podle něj ověří druh). */
export function photoFileName(mime: string, base = "foto") {
  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return `${base}.${extension}`;
}
