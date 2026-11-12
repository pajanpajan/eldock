import { prisma } from "@/lib/prisma";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { isBotAgent, telemetrySchema } from "@/lib/telemetry";
import { getPanelCompany } from "@/server/panel-session";
import { allowTelemetry, recordTelemetry } from "@/server/services/telemetry";

const MAX_BODY = 4000;

/**
 * Fáze 102: produktová telemetrie prvních stran – `page_view`, `sandbox_started`, `series_selected`,
 * `switchboard_generated`, `export_clicked`, `lead_captured`. Veřejné (bez přihlášení). Neukládá IP adresu ani
 * user-agent (IP jen pro omezení četnosti v paměti); přihlášená registrovaná firma se k události připojí,
 * ukázková firma ne (sdílí ji všichni návštěvníci).
 */
export async function POST(request: Request) {
  if (isBotAgent(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
  if (!allowTelemetry(ip)) return Response.json({ error: "Příliš mnoho událostí – zkuste to za chvíli." }, { status: 429 });
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return Response.json({ error: "Neplatná událost." }, { status: 400 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Neplatná událost." }, { status: 400 });
  }
  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Neplatná událost." }, { status: 400 });
  const company = await getPanelCompany().catch(() => null);
  await recordTelemetry(prisma, { ...parsed.data, companyId: company && company.id !== TESTER_COMPANY.id ? company.id : null });
  return new Response(null, { status: 204 });
}
