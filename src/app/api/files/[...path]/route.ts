import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { etagMatches, fileCacheControl, fileETag } from "@/lib/file-cache";
import { contentTypeFor, resolveUploadPath } from "@/lib/files";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/**
 * Servíruje soubory ze storage/uploads (fotky, revize, zákresy, hlasové poznámky).
 * Nahrané soubory (UUID) se cachují natrvalo, seed soubory den; opakovaný dotaz s ETagem → 304.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const { path: segments } = await ctx.params;
  const filePath = resolveUploadPath(UPLOAD_ROOT, segments);
  if (!filePath) return new Response("Soubor nenalezen.", { status: 404 });

  let info: Awaited<ReturnType<typeof stat>>;
  try {
    info = await stat(filePath);
  } catch {
    return new Response("Soubor nenalezen.", { status: 404 });
  }
  if (!info.isFile()) return new Response("Soubor nenalezen.", { status: 404 });

  const etag = fileETag(info.size, info.mtimeMs);
  const contentType = contentTypeFor(filePath);
  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": fileCacheControl(segments),
    ETag: etag,
    "Last-Modified": info.mtime.toUTCString(),
    "X-Content-Type-Options": "nosniff",
  });
  // SVG otevřené přímo v okně nesmí spouštět skripty.
  if (contentType === "image/svg+xml") headers.set("Content-Security-Policy", "sandbox");
  if (new URL(request.url).searchParams.has("download")) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`);
  }
  // Prohlížeč má platnou kopii → bez těla (soubor se ani nečte z disku).
  if (etagMatches(request.headers.get("if-none-match"), etag)) return new Response(null, { status: 304, headers });

  const body = await readFile(filePath);
  headers.set("Content-Length", String(body.byteLength));
  return new Response(new Uint8Array(body), { headers });
}
