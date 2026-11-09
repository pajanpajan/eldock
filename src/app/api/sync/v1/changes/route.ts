import { prisma } from "@/lib/prisma";
import { pullChanges } from "@/server/services/sync";
import { syncError, syncJson, syncPreflight, withDevice } from "@/server/sync/http";

/**
 * Fáze 70: změny od kurzoru (`?cursor=0` = první stažení celého závodu; `scope` z relace / předchozí stránky,
 * `limit` 1–2000). Odpověď `reset: true` = smazat místní data a stáhnout vše od nuly.
 */
export async function GET(request: Request) {
  return withDevice(request, async (ctx) => {
    const params = new URL(request.url).searchParams;
    const cursor = Number(params.get("cursor") ?? 0);
    const limit = params.has("limit") ? Number(params.get("limit")) : undefined;
    if (!Number.isSafeInteger(cursor) || cursor < 0 || (limit !== undefined && !Number.isSafeInteger(limit))) return syncError("BAD_REQUEST", "Neplatný kurzor nebo limit.", 400);
    return syncJson(await pullChanges(prisma, ctx, { cursor, limit, scope: params.get("scope") }));
  });
}

/** Fáze 71: předběžný dotaz CORS z rozhraní aplikací. */
export function OPTIONS() {
  return syncPreflight("GET");
}
