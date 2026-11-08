import { prisma } from "@/lib/prisma";
import { deviceSession, revokeDevice } from "@/server/services/sync";
import { syncJson, withDevice } from "@/server/sync/http";

/** Fáze 70: relace aplikace – uživatel, oprávnění, výřez, závod, moduly a pravidla synchronizace (na začátku každé synchronizace). */
export async function GET(request: Request) {
  return withDevice(request, async (ctx) => syncJson(await deviceSession(prisma, ctx)));
}

/** Odpojení zařízení z aplikace („Odhlásit“) – token přestane platit. */
export async function DELETE(request: Request) {
  return withDevice(request, async (ctx) => {
    await revokeDevice(prisma, { deviceId: ctx.device.id, actorId: ctx.user.id, companyId: ctx.company.id, admin: false, reason: "odpojeno v aplikaci" });
    return syncJson({ ok: true });
  });
}
