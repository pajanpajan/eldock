import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { etagMatches, fileCacheControl, fileETag } from "@/lib/file-cache";
import { FILES_PREFIX, canReadFile, isRegistrableUpload, isSignedIn } from "@/lib/file-ownership";
import { contentTypeFor, resolveUploadPath } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { fileViewer } from "@/server/file-access";
import { authenticateDevice } from "@/server/services/sync";
import { SYNC_CORS_HEADERS, bearerToken, syncPreflight } from "@/server/sync/http";

const UPLOAD_ROOT = path.join(process.cwd(), "storage", "uploads");

/**
 * Servíruje soubory ze storage/uploads (fotky, revize, zákresy, hlasové poznámky).
 * Nahrané soubory (UUID) se cachují natrvalo, seed soubory den; opakovaný dotaz s ETagem → 304.
 * Fáze 68: soubor vydá jen přihlášení jeho vlastníka (registr `StoredFile`); cizí nebo neznámý soubor = 404.
 * Fáze 70: i aplikacím s tokenem zařízení (`Authorization: Bearer`) a s otiskem `X-Content-SHA256` z registru.
 * Fáze 71: požadavek s tokenem dostane hlavičky CORS (rozhraní aplikace stahuje soubory z jiného původu); s tokenem
 * se cookie relace nečte, odpověď bez tokenu CORS nedostane – cizí stránka soubor přihlášeného uživatele nepřečte.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/files/[...path]">) {
  const token = bearerToken(request);
  const response = await serveFile(request, ctx, token);
  if (token) for (const [name, value] of Object.entries(SYNC_CORS_HEADERS)) response.headers.set(name, value);
  return response;
}

/** Předběžný dotaz CORS aplikace (stažení s hlavičkou `Authorization`). */
export function OPTIONS() {
  return syncPreflight("GET");
}

async function serveFile(request: Request, ctx: RouteContext<"/api/files/[...path]">, token: string | null): Promise<Response> {
  const { path: segments } = await ctx.params;
  const filePath = resolveUploadPath(UPLOAD_ROOT, segments);
  if (!filePath) return new Response("Soubor nenalezen.", { status: 404 });

  const url = FILES_PREFIX + segments.join("/");
  const device = token ? await authenticateDevice(prisma, token) : null;
  if (token && !device) return new Response("Zařízení není spárované nebo bylo odpojeno.", { status: 401 });
  const [viewer, registered] = await Promise.all([
    device ? { demo: false, companyIds: [device.company.id], superadmin: false } : fileViewer(),
    isRegistrableUpload(url) ? prisma.storedFile.findUnique({ where: { url }, select: { ownerKind: true, companyId: true, deletedAt: true, sha256: true } }) : null,
  ]);
  // Fáze 67: zrušená relace uživatele firmy nic nečte; fáze 68: cizí soubor jako neexistující (neprozradí, že je)
  if (!isSignedIn(viewer)) return new Response("Přihlášení vypršelo.", { status: 401 });
  if (!canReadFile(viewer, url, registered)) return new Response("Soubor nenalezen.", { status: 404 });

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
  // Aplikace ověří stažený soubor a podle otisku ho drží v mezipaměti (fáze 70)
  if (registered?.sha256) headers.set("X-Content-SHA256", registered.sha256);
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
