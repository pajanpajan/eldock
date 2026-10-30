// Cache souborů z /api/files: nahrané soubory mají náhodné jméno (UUID) a nikdy se nepřepisují,
// takže je prohlížeč smí držet natrvalo. Seed soubory (pevná jména, přepisuje je reset dema)
// jen den a pak se ověří přes ETag. Vše je za přihlášením → `private` (ne sdílené cache).

const UUID_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export const IMMUTABLE_CACHE = "private, max-age=31536000, immutable";
export const SEED_CACHE = "private, max-age=86400, stale-while-revalidate=604800";

export function fileCacheControl(segments: readonly string[]): string {
  const name = segments.at(-1) ?? "";
  return UUID_NAME.test(name) && !segments.includes("seed") ? IMMUTABLE_CACHE : SEED_CACHE;
}

/** Slabý ETag z velikosti a času změny souboru (levná revalidace bez čtení obsahu). */
export const fileETag = (size: number, mtimeMs: number) => `W/"${size.toString(36)}-${Math.floor(mtimeMs).toString(36)}"`;

/** `If-None-Match` obsahuje náš ETag (i v seznamu nebo `*`). */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((value) => {
    const tag = value.trim();
    return tag === "*" || tag === etag || tag.replace(/^W\//, "") === etag.replace(/^W\//, "");
  });
}
