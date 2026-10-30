import { brandEnv } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { smtpTransportFromEnv } from "@/server/mailer";
import { sendAllInspectionDigests } from "@/server/services/notifications";

/**
 * Cron: souhrnné avízo lhůt revizí pro všechny závody.
 * `POST /api/cron/inspection-alerts` s hlavičkou `Authorization: Bearer <ELDOCK_CRON_SECRET>`.
 * Přihlašovací brána tuto cestu propouští – ověřuje ji tajný token (bez něj je endpoint vypnutý).
 */
export async function POST(request: Request) {
  const secret = brandEnv("CRON_SECRET");
  if (!secret) return Response.json({ error: "Cron není nastaven (ELDOCK_CRON_SECRET)." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Neplatný token." }, { status: 401 });

  const origin = brandEnv("PUBLIC_URL") ?? new URL(request.url).origin;
  const logs = await sendAllInspectionDigests(prisma, { origin, transport: smtpTransportFromEnv() });
  return Response.json({
    sent: logs.map((log) => ({ id: log.id, plantId: log.plantId, delivery: log.delivery, itemCount: log.itemCount, recipients: log.recipients, error: log.error })),
  });
}
