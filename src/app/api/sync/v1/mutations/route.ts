import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { pushMutations } from "@/server/sync/mutations";
import { readJson, syncJson, withDevice } from "@/server/sync/http";

const MAX_BODY = 8 * 1024 * 1024;

/**
 * Fáze 70: odeslání fronty úprav z aplikace (`{ mutations: [{ id, type, payload, performedAt?, baseUpdatedAt? }] }`).
 * Každá úprava proběhne přesně jednou; výsledek `applied` / `rejected` (znovu neposílat) / `error` (poslat znovu).
 */
export async function POST(request: Request) {
  return withDevice(request, async (ctx) => {
    const result = await pushMutations(prisma, ctx, await readJson(request, MAX_BODY));
    // Mění se piny, počty v areálu, detail zařízení i CAE – jako po serverových akcích
    if (result.results.some((item) => item.status === "applied" && !item.duplicate)) revalidatePath("/", "layout");
    return syncJson(result);
  });
}
