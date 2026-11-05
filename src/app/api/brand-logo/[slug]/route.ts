import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { BRAND_LOGO_EXTENSIONS, LOGO_CONTENT_TYPE, isBrandSlug, wordmarkSvg } from "@/lib/panel-builder/brand-logos";

const BRANDS_DIR = path.join(process.cwd(), "public", "brands");

/**
 * Logo výrobce (fáze 51): první existující soubor `public/brands/<slug>.webp|png|svg` (vlastní logo
 * nahrané uživatelem má přednost), jinak vektorový wordmark generovaný kódem. Krátká cache, takže se
 * nově vložené logo propíše do celé aplikace bez nového buildu.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/brand-logo/[slug]">) {
  const { slug: raw } = await ctx.params;
  const slug = raw.replace(/\.(svg|png|webp)$/, "").toLowerCase();
  if (!isBrandSlug(slug)) return new Response("Logo nenalezeno.", { status: 404 });
  const name = new URL(request.url).searchParams.get("name")?.slice(0, 40) ?? slug;
  const headers = { "Cache-Control": "public, max-age=300, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox" };

  for (const ext of BRAND_LOGO_EXTENSIONS) {
    const file = path.join(BRANDS_DIR, `${slug}.${ext}`);
    try {
      if (!(await stat(file)).isFile()) continue;
      const bytes = await readFile(file);
      return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": LOGO_CONTENT_TYPE[ext] } });
    } catch {
      // soubor neexistuje → další přípona
    }
  }
  return new Response(wordmarkSvg(slug, name), { headers: { ...headers, "Content-Type": "image/svg+xml" } });
}
