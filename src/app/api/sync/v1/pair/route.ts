import { z } from "zod";

import { SyncPlatform } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { SYNC_PLATFORMS } from "@/lib/sync";
import { ipKeyOf } from "@/server/services/account-security";
import { authenticateDevice, deviceSession, pairDevice } from "@/server/services/sync";
import { readJson, syncError, syncErrorResponse, syncJson } from "@/server/sync/http";

const pairSchema = z.object({
  code: z.string().min(4).max(20),
  platform: z.enum(SyncPlatform),
  name: z.string().max(80).optional().nullable(),
  appVersion: z.string().max(40).optional().nullable(),
});

/**
 * Fáze 70: spárování aplikace kódem z „Můj účet“ (bez přihlášení – kód je jednorázový a platí 10 minut, chybné kódy
 * mají limit na IP). Vrací token zařízení (aplikace ho uloží do zabezpečeného úložiště systému) a rovnou relaci.
 */
export async function POST(request: Request) {
  try {
    const body = pairSchema.safeParse(await readJson(request, 16_384));
    if (!body.success) return syncError("BAD_REQUEST", `Očekávám { "code", "platform" (${SYNC_PLATFORMS.join(" / ")}), "name", "appVersion" }.`, 400);
    const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "").trim() || null;
    const paired = await pairDevice(prisma, { code: body.data.code, platform: body.data.platform, name: body.data.name ?? "", appVersion: body.data.appVersion, ipKey: ipKeyOf(ip) });
    const ctx = await authenticateDevice(prisma, paired.token);
    if (!ctx) return syncError("SERVER_ERROR", "Zařízení se nepodařilo ověřit – spárujte ho znovu.", 500);
    return syncJson({ token: paired.token, device: paired.device, session: await deviceSession(prisma, ctx) }, 201);
  } catch (error) {
    return syncErrorResponse(error);
  }
}
