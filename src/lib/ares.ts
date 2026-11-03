// Registr ARES (Ministerstvo financí): veřejné REST API ekonomických subjektů. Čisté funkce –
// volání dělá Route Handler `GET /api/ares?ico=…`.

export const ARES_URL = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export interface AresCompany {
  companyName: string;
  ico: string;
  dic: string | null;
  street: string;
  city: string;
  zip: string;
}

/** IČO jen z číslic, kratší doplněné nulami zleva na 8 míst („12345“ → „00012345“). */
export function normalizeIco(value: string): string {
  const digits = value.replace(/\s+/g, "");
  return /^\d{1,8}$/.test(digits) ? digits.padStart(8, "0") : digits;
}

/** Kontrolní číslice IČO (vážený součet mod 11). */
export function isValidIco(value: string): boolean {
  const ico = normalizeIco(value);
  if (!/^\d{8}$/.test(ico)) return false;
  const sum = [...ico.slice(0, 7)].reduce((total, digit, index) => total + Number(digit) * (8 - index), 0);
  const check = (11 - (sum % 11)) % 10;
  return check === Number(ico[7]);
}

/** PSČ ve tvaru „466 01“. */
export const formatZip = (value: string | number | null | undefined) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
};

interface AresAddress {
  nazevObce?: string;
  nazevCastiObce?: string;
  nazevUlice?: string;
  cisloDomovni?: number;
  cisloOrientacni?: number;
  cisloOrientacniPismeno?: string;
  psc?: number | string;
  textovaAdresa?: string;
}

/** Odpověď ARES (`ekonomicke-subjekty/{ico}`) → údaje firmy pro registraci; bez názvu nebo IČO `null`. */
export function mapAresSubject(json: unknown): AresCompany | null {
  if (!json || typeof json !== "object") return null;
  const subject = json as { ico?: string; obchodniJmeno?: string; dic?: string; sidlo?: AresAddress };
  if (!subject.ico || !subject.obchodniJmeno) return null;
  const sidlo = subject.sidlo ?? {};
  const number = [sidlo.cisloDomovni, sidlo.cisloOrientacni ? `${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno ?? ""}` : null].filter(Boolean).join("/");
  const streetName = sidlo.nazevUlice || sidlo.nazevCastiObce || sidlo.nazevObce || "";
  const street = [streetName, number].filter(Boolean).join(" ") || (sidlo.textovaAdresa?.split(",")[0]?.trim() ?? "");
  return {
    companyName: subject.obchodniJmeno.trim(),
    ico: normalizeIco(subject.ico),
    dic: subject.dic?.trim() || null,
    street,
    city: sidlo.nazevObce?.trim() ?? "",
    zip: formatZip(sidlo.psc),
  };
}
