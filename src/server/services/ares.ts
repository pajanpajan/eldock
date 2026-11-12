import { ARES_URL, isValidIco, mapAresSubject, normalizeIco, type AresCompany } from "@/lib/ares";

// Fáze 102: vyhledání firmy v registru ARES (Ministerstvo financí) – sdílí `GET /api/ares` a zachycení kontaktu
// v trenažéru. Výsledek drží proces 24 hodin (veřejná data, šetří registr při opakovaném IČO).

export type AresLookup = { ok: true; company: AresCompany } | { ok: false; status: 400 | 404 | 502 | 503; error: string };

const CACHE = new Map<string, { at: number; result: AresLookup }>();
const TTL_MS = 24 * 3600 * 1000;
const MAX_ENTRIES = 500;

export async function lookupAres(value: string, fetcher: typeof fetch = fetch, now = Date.now()): Promise<AresLookup> {
  const ico = normalizeIco(value);
  if (!isValidIco(ico)) return { ok: false, status: 400, error: "Neplatné IČO – zadejte 8 číslic." };
  const cached = CACHE.get(ico);
  if (cached && now - cached.at < TTL_MS) return cached.result;
  let response: Response;
  try {
    response = await fetcher(`${ARES_URL}/${ico}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000), cache: "no-store" });
  } catch {
    return { ok: false, status: 503, error: "Registr ARES je nedostupný – vyplňte údaje ručně." };
  }
  let result: AresLookup;
  if (response.status === 404) result = { ok: false, status: 404, error: `Firma s IČO ${ico} v ARES neexistuje.` };
  else if (!response.ok) return { ok: false, status: 503, error: "Registr ARES je nedostupný – vyplňte údaje ručně." };
  else {
    const company = mapAresSubject(await response.json().catch(() => null));
    result = company ? { ok: true, company } : { ok: false, status: 502, error: "ARES vrátil neúplné údaje – vyplňte je ručně." };
  }
  if (CACHE.size >= MAX_ENTRIES) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(ico, { at: now, result });
  return result;
}

/** Jen pro testy – vyprázdní mezipaměť ARES. */
export const clearAresCache = () => CACHE.clear();
