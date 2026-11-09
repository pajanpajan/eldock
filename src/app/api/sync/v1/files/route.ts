import { UPLOAD_RULES, contentTypeFor, validateUpload } from "@/lib/files";
import { prisma } from "@/lib/prisma";
import { storeUpload } from "@/server/file-access";
import { sha256Hex } from "@/server/services/file-registry";
import { findCompanyFileBySha } from "@/server/services/sync";
import { syncError, syncJson, syncPreflight, withDevice } from "@/server/sync/http";

const decodeName = (value: string | null) => {
  try {
    return value ? decodeURIComponent(value) : "";
  } catch {
    return value ?? "";
  }
};

/**
 * Fáze 70: nahrání souboru z aplikace – tělo = obsah souboru, `?kind=photo|markup|voice|document|attachment|software|revision`
 * a `&name=<název souboru>`, hlavička `X-Content-SHA256` (hex). Server otisk ověří; soubor firmy se stejným obsahem
 * vrátí místo nového (opakované nahrání po výpadku spojení = žádný duplikát). Adresu pak úprava použije v `payload`.
 */
export async function POST(request: Request) {
  return withDevice(request, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind") ?? "";
    const name = (params.get("name") ?? decodeName(request.headers.get("x-file-name"))).slice(0, 200);
    const expected = (request.headers.get("x-content-sha256") ?? "").trim().toLowerCase();
    const declared = Number(request.headers.get("content-length") ?? 0);
    const precheck = validateUpload(kind, name, declared > 0 ? declared : 1);
    if (!precheck.ok) return syncError("BAD_REQUEST", precheck.error, precheck.error.startsWith("Soubor je příliš velký") ? 413 : 400);
    if (!/^[a-f0-9]{64}$/.test(expected)) return syncError("BAD_REQUEST", "Chybí hlavička X-Content-SHA256 (SHA-256 obsahu souboru, hex).", 400);

    const data = Buffer.from(await request.arrayBuffer());
    const check = validateUpload(kind, name, data.byteLength);
    if (!check.ok) return syncError("BAD_REQUEST", check.error, check.error.startsWith("Soubor je příliš velký") ? 413 : 400);
    const sha256 = sha256Hex(data);
    if (sha256 !== expected) return syncError("CHECKSUM_MISMATCH", "Otisk SHA-256 nesouhlasí – soubor se cestou poškodil, nahrajte ho znovu.", 422);

    const dir = UPLOAD_RULES[check.kind].dir;
    const existing = await findCompanyFileBySha(prisma, { companyId: ctx.company.id, sha256, kind: dir });
    if (existing) return syncJson({ url: existing.url, sha256, sizeBytes: existing.sizeBytes, mimeType: existing.mimeType, fileName: name, deduplicated: true });
    const { url, storedName } = await storeUpload({ dir, extension: check.extension, data, owner: ctx.owner, uploadedById: ctx.user.id, originalName: name });
    return syncJson({ url, sha256, sizeBytes: data.byteLength, mimeType: contentTypeFor(storedName), fileName: name, deduplicated: false }, 201);
  });
}

/** Fáze 71: předběžný dotaz CORS z rozhraní aplikací. */
export function OPTIONS() {
  return syncPreflight("POST");
}
