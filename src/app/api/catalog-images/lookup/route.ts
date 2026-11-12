import { hasCatalogSession } from "@/server/catalog-access";
import { lookupCatalogImage, type CatalogImageKind } from "@/server/catalog-data";

const KINDS: readonly CatalogImageKind[] = ["enclosure", "box", "product"];

/**
 * Fáze 104: fotky konkrétních výrobků z indexu katalogových fotek (rozvodnice podle objednacího čísla, krabice podle
 * kódu, výrobky chytré domácnosti podle id) – `POST { items: [{ kind, key }] }` → `{ results: [{ src, source, license } |
 * null] }`. Jen pro přihlášené, nejvýš 200 položek; celý index s objednacími čísly zůstává na serveru.
 */
export async function POST(request: Request) {
  if (!(await hasCatalogSession())) return Response.json({ error: "Jen pro přihlášené." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  const items = Array.isArray(body?.items) ? body.items.slice(0, 200) : [];
  const results = items.map((item) => {
    const kind = (item as { kind?: unknown })?.kind;
    const key = (item as { key?: unknown })?.key;
    return typeof kind === "string" && KINDS.includes(kind as CatalogImageKind) && typeof key === "string" && key.length <= 120 ? lookupCatalogImage(kind as CatalogImageKind, key) : null;
  });
  return Response.json({ results }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
