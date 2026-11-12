// Registr ARES (Ministerstvo financí): veřejné REST API ekonomických subjektů (fáze 102 i obory CZ-NACE). Čisté funkce –
// volání dělá Route Handler `GET /api/ares?ico=…`.

export const ARES_URL = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export interface AresCompany {
  companyName: string;
  ico: string;
  dic: string | null;
  street: string;
  city: string;
  zip: string;
  /** Fáze 102: obory činnosti CZ-NACE z ARES (`czNace`, např. „43210“). */
  nace: string[];
  /** Fáze 102: zaměření firmy podle CZ-NACE (elektromontáže, projekce, výroba, zdravotnictví, správa budov). */
  segment: NaceSegment;
}

/** Fáze 102: zaměření firmy podle oborů CZ-NACE. */
export type NaceSegment = "electro" | "design" | "manufacturing" | "healthcare" | "facility" | "other";

export const NACE_SEGMENT_LABEL: Record<NaceSegment, string> = {
  electro: "Elektromontážní firma (CZ-NACE 43.21)",
  design: "Projekční kancelář (CZ-NACE 71.12)",
  manufacturing: "Výrobní podnik (CZ-NACE 10–33)",
  healthcare: "Zdravotnické zařízení (CZ-NACE 86)",
  facility: "Správa a údržba budov (CZ-NACE 68.32 / 81.10)",
  other: "Jiný obor",
};

/**
 * Zaměření podle kódů CZ-NACE (pořadí přednosti: elektroinstalace 4321, projekce 7112, zdravotnictví 86, výroba
 * oddíly 10–33, správa budov 6832 / 8110); bez kódu nebo jiný obor → `other`.
 */
export function classifyNace(codes: readonly string[]): NaceSegment {
  const digits = codes.map((code) => code.replace(/\D/g, "")).filter(Boolean);
  if (digits.some((code) => code.startsWith("4321"))) return "electro";
  if (digits.some((code) => code.startsWith("7112"))) return "design";
  if (digits.some((code) => code.startsWith("86"))) return "healthcare";
  if (digits.some((code) => code.length >= 2 && Number(code.slice(0, 2)) >= 10 && Number(code.slice(0, 2)) <= 33)) return "manufacturing";
  if (digits.some((code) => code.startsWith("6832") || code.startsWith("811"))) return "facility";
  return "other";
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
  const subject = json as { ico?: string; obchodniJmeno?: string; dic?: string; sidlo?: AresAddress; czNace?: unknown };
  if (!subject.ico || !subject.obchodniJmeno) return null;
  const sidlo = subject.sidlo ?? {};
  const number = [sidlo.cisloDomovni, sidlo.cisloOrientacni ? `${sidlo.cisloOrientacni}${sidlo.cisloOrientacniPismeno ?? ""}` : null].filter(Boolean).join("/");
  const streetName = sidlo.nazevUlice || sidlo.nazevCastiObce || sidlo.nazevObce || "";
  const street = [streetName, number].filter(Boolean).join(" ") || (sidlo.textovaAdresa?.split(",")[0]?.trim() ?? "");
  // Fáze 102: obory činnosti CZ-NACE (pole řetězců v odpovědi ARES), nejvýš 40 kódů
  const nace = Array.isArray(subject.czNace) ? [...new Set(subject.czNace.filter((code): code is string => typeof code === "string" && /^\d{2,6}$/.test(code.trim())).map((code) => code.trim()))].slice(0, 40) : [];
  return {
    companyName: subject.obchodniJmeno.trim(),
    ico: normalizeIco(subject.ico),
    dic: subject.dic?.trim() || null,
    street,
    city: sidlo.nazevObce?.trim() ?? "",
    zip: formatZip(sidlo.psc),
    nace,
    segment: classifyNace(nace),
  };
}
