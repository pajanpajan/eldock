import { readCatalogPhotoFile } from "@/server/services/catalog-photo-store";

/** Fáze 92: nahraná fotka designové řady (WebP z trvalého úložiště); adresa nese `?v=` času nahrání. */
export async function GET(_request: Request, { params }: RouteContext<"/api/catalog-images/file/[...path]">) {
  const data = await readCatalogPhotoFile((await params).path.join("/"));
  if (!data) return new Response("Nenalezeno", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
