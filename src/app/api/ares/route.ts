import { ARES_URL, isValidIco, mapAresSubject, normalizeIco } from "@/lib/ares";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": status === 200 ? "public, max-age=86400" : "no-store" } });

/**
 * Údaje firmy z registru ARES pro registrační formuláře: `GET /api/ares?ico=12345678` →
 * `{ companyName, ico, dic, street, city, zip }`. Veřejné (registrace); při výpadku ARES 503 a ruční vyplnění.
 */
export async function GET(request: Request) {
  const ico = normalizeIco(new URL(request.url).searchParams.get("ico") ?? "");
  if (!isValidIco(ico)) return json({ error: "Neplatné IČO – zadejte 8 číslic." }, 400);
  let response: Response;
  try {
    response = await fetch(`${ARES_URL}/${ico}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
  } catch {
    return json({ error: "Registr ARES je nedostupný – vyplňte údaje ručně." }, 503);
  }
  if (response.status === 404) return json({ error: `Firma s IČO ${ico} v ARES neexistuje.` }, 404);
  if (!response.ok) return json({ error: "Registr ARES je nedostupný – vyplňte údaje ručně." }, 503);
  const company = mapAresSubject(await response.json().catch(() => null));
  return company ? json(company) : json({ error: "ARES vrátil neúplné údaje – vyplňte je ručně." }, 502);
}
