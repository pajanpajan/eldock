import { readFile } from "node:fs/promises";
import path from "node:path";

import { contentTypeFor, resolveUploadPath } from "@/lib/files";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/** Servíruje soubory ze storage/uploads (fotky, revize, zákresy, hlasové poznámky). */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: segments } = await ctx.params;
  const filePath = resolveUploadPath(UPLOAD_ROOT, segments);
  if (!filePath) return new Response("Soubor nenalezen.", { status: 404 });

  let body: Buffer;
  try {
    body = await readFile(filePath);
  } catch {
    return new Response("Soubor nenalezen.", { status: 404 });
  }

  const contentType = contentTypeFor(filePath);
  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(body.byteLength),
    // Seed soubory se při resetu přepisují – krátká cache, revalidace u prohlížeče.
    "Cache-Control": "private, max-age=60, must-revalidate",
    "X-Content-Type-Options": "nosniff",
  });
  // SVG otevřené přímo v okně nesmí spouštět skripty.
  if (contentType === "image/svg+xml") headers.set("Content-Security-Policy", "sandbox");
  if (new URL(request.url).searchParams.has("download")) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
  }

  return new Response(new Uint8Array(body), { headers });
}
