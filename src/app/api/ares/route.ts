import { NACE_SEGMENT_LABEL } from "@/lib/ares";
import { lookupAres } from "@/server/services/ares";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": status === 200 ? "public, max-age=86400" : "no-store" } });

/**
 * Údaje firmy z registru ARES pro registrační formuláře, firemní razítko a zachycení kontaktu: `GET /api/ares?ico=12345678`
 * → `{ companyName, ico, dic, street, city, zip, nace, segment, segmentLabel }` (fáze 102: obory CZ-NACE a zaměření).
 * Veřejné (registrace); při výpadku ARES 503 a ruční vyplnění.
 */
export async function GET(request: Request) {
  const result = await lookupAres(new URL(request.url).searchParams.get("ico") ?? "");
  if (!result.ok) return json({ error: result.error }, result.status);
  return json({ ...result.company, segmentLabel: NACE_SEGMENT_LABEL[result.company.segment] });
}
