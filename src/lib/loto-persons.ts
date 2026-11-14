// Fáze 116: odpovědné osoby dle ČSN EN 50110-1 ed. 4 na kartě LOTO – osoba odpovědná za elektrické zařízení (OOEZ)
// a osoba pověřená řízením pracovní činnosti (OPŘPČ). Uloženo v `Equipment.lotoResponsibleJson`.

export interface LotoPerson {
  name: string;
  phone: string | null;
}

export interface LotoPersons {
  ooez: LotoPerson | null;
  oprpc: LotoPerson | null;
}

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "");

function person(raw: unknown): LotoPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const name = clean(record.name, 80);
  if (!name) return null;
  const phone = clean(record.phone, 30);
  return { name, phone: phone || null };
}

export function parseLotoPersons(json: string | null | undefined): LotoPersons {
  if (!json) return { ooez: null, oprpc: null };
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    return { ooez: person(raw.ooez), oprpc: person(raw.oprpc) };
  } catch {
    return { ooez: null, oprpc: null };
  }
}

/** JSON pro uložení; bez obou osob `null`. */
export function serializeLotoPersons(persons: LotoPersons): string | null {
  const ooez = person(persons.ooez);
  const oprpc = person(persons.oprpc);
  return ooez || oprpc ? JSON.stringify({ ooez, oprpc }) : null;
}
