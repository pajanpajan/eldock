// Charakteristiky rozhraní rozváděče (ČSN EN 61439-1, příloha C) odvozené ze štítkových
// údajů zařízení. Sdílí je záložka Pasport & Shoda i generované prohlášení o shodě.

export interface InterfaceSource {
  tag: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  yearInstalled: number | null;
  ratedVoltage: string | null;
  ratedCurrent: string | null;
  ipRating: string | null;
  externalInfluences: string | null;
  fedFrom?: { tag: string } | null;
  fedFromCircuit?: string | null;
}

export interface InterfaceRow {
  label: string;
  value: string;
  /** Odkaz na článek normy. */
  clause?: string;
}

/** „1 600 A“ / „1600 A“ → 1600; bez čísla `null`. */
export function parseAmps(value: string | null | undefined): number | null {
  const match = value?.replace(/\s/g, "").match(/(\d+(?:[.,]\d+)?)A/i);
  return match ? Number(match[1].replace(",", ".")) : null;
}

/** Zkratová odolnost podle velikosti rozváděče (typická provedení výrobců). */
export function shortCircuitRating(amps: number | null): { icw: string; ipk: string } {
  if (amps === null) return { icw: "neuvedeno", ipk: "neuvedeno" };
  if (amps >= 1000) return { icw: "50 kA / 1 s", ipk: "105 kA" };
  if (amps >= 250) return { icw: "25 kA / 1 s", ipk: "52,5 kA" };
  return { icw: "Icc 10 kA (podmíněný, jištěno předřazeným jističem)", ipk: "–" };
}

export function separationForm(amps: number | null): string {
  if (amps === null) return "neuvedeno";
  if (amps >= 1000) return "Forma 4b";
  if (amps >= 250) return "Forma 2b";
  return "Forma 1";
}

export function buildInterfaceRows(source: InterfaceSource): InterfaceRow[] {
  const amps = parseAmps(source.ratedCurrent);
  const { icw, ipk } = shortCircuitRating(amps);
  const large = amps !== null && amps >= 1000;
  const ip = source.ipRating ?? "neuvedeno";
  const ipNumber = Number(ip.replace(/\D/g, "").slice(0, 1));
  return [
    { label: "Výrobce / systém", value: [source.manufacturer, source.model].filter(Boolean).join(" ") || "neuvedeno" },
    { label: "Rok výroby", value: source.yearInstalled ? String(source.yearInstalled) : "neuvedeno" },
    { label: "Jmenovité napětí Un / Ue", value: source.ratedVoltage ?? "neuvedeno", clause: "5.2.1" },
    { label: "Jmenovitý proud rozváděče InA", value: source.ratedCurrent ?? "neuvedeno", clause: "5.3.1" },
    { label: "Krátkodobá výdržná proudová zatížitelnost Icw", value: icw, clause: "5.3.4" },
    { label: "Jmenovitý vrcholový výdržný proud Ipk", value: ipk, clause: "5.3.3" },
    { label: "Soustava uzemnění", value: large ? "TN-C (rozdělení PEN v RM1) → TN-S" : "TN-S" },
    { label: "Kategorie přepětí / Uimp", value: large ? "IV / 8 kV" : "III / 6 kV", clause: "5.2.4" },
    { label: "Stupeň krytí", value: ip, clause: "8.2.2" },
    { label: "Odolnost proti nárazu", value: ipNumber >= 5 ? "IK10" : "IK08", clause: "8.2.1" },
    { label: "Vnitřní rozdělení", value: separationForm(amps), clause: "8.101" },
    { label: "Stupeň znečištění / prostředí EMC", value: "3 / prostředí A", clause: "7.1.2, 9.4" },
    { label: "Instalace", value: large ? "Vnitřní, stacionární, volně stojící" : "Vnitřní, stacionární" },
    { label: "Vnější vlivy", value: source.externalInfluences ?? "neurčeno – chybí protokol" },
    {
      label: "Napájeno z",
      value: source.fedFrom ? `${source.fedFrom.tag}${source.fedFromCircuit ? ` (${source.fedFromCircuit})` : ""}` : "Přímo z transformátoru / neuvedeno",
    },
  ];
}
