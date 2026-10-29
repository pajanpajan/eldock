import { xref, type Phase, type PanelModel, type PlcIo, type Wire } from "./panel-model";

// Nástroje údržby nad modelem rozváděče: propípávač spojů (IEC 62491), hledač PLC adres
// a kalkulačka zatížení fází s tepelnou rezervou. Čisté funkce.

export interface TraceHit {
  wire: Wire;
  /** Konec spoje, který odpovídá dotazu (u čísla vodiče / kabelu `null`). */
  matched: "from" | "to" | null;
  xref: string;
}

/** Normalizace „x1:u“ / „-X1 : U“ / „Q1:13“ → „-X1:U“; bez dvojtečky jen přístroj. */
function normalizeEnd(query: string): { device: string; pin: string | null } | null {
  const compact = query.trim().toUpperCase().replace(/\s+/g, "");
  const match = /^(-?[A-Z]+\d+[A-Z]?)(?::([A-Z0-9+'/.-]+))?$/.exec(compact);
  if (!match) return null;
  const device = match[1].startsWith("-") ? match[1] : `-${match[1]}`;
  return { device, pin: match[2] ?? null };
}

const endMatches = (end: Wire["from"], device: string, pin: string | null) => end.device.toUpperCase() === device && (pin === null || end.pin.toUpperCase() === pin);

/**
 * Propípávač: „X1:U“, „X2:5“, „-Q1:13“ (svorka přístroje), „-S1“ (všechny spoje přístroje),
 * „18“ (číslo vodiče) nebo „W1“ (všechny žíly kabelu).
 */
export function traceConnection(model: PanelModel, query: string): TraceHit[] {
  const q = query.trim();
  if (!q) return [];
  if (/^\d+$/.test(q)) {
    return model.wires.filter((wire) => wire.number === q).map((wire) => ({ wire, matched: null, xref: xref(wire.sheet, wire.column) }));
  }
  const end = normalizeEnd(q);
  if (!end) return [];
  const cableHits = model.wires.filter((wire) => wire.cable?.tag.toUpperCase() === end.device && end.pin === null);
  if (cableHits.length) return cableHits.map((wire) => ({ wire, matched: null, xref: xref(wire.sheet, wire.column) }));
  return model.wires.flatMap((wire): TraceHit[] => {
    if (endMatches(wire.from, end.device, end.pin)) return [{ wire, matched: "from", xref: xref(wire.sheet, wire.column) }];
    if (endMatches(wire.to, end.device, end.pin)) return [{ wire, matched: "to", xref: xref(wire.sheet, wire.column) }];
    return [];
  });
}

/** Text spoje: „-Q3:2 → -X1:U“. */
export const wireLabel = (wire: Wire) => `${wire.from.device}:${wire.from.pin} → ${wire.to.device}:${wire.to.pin}`;

/** Hledač PLC: adresa „1.00“, kanál „DI0“ / „DO2“, slot „001.001.001.001“, signál „ALARM_ON_1“ nebo text „Endstop UP“. */
export function findPlcSignal(model: PanelModel, query: string): PlcIo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const exact = model.plc.filter((io) => [io.address, io.channel, io.signal, io.terminal, `${io.card}:${io.terminal}`].some((value) => value.toLowerCase() === q));
  if (exact.length) return exact;
  return model.plc.filter((io) => [io.slot, io.signal, io.description, io.endDevice].some((value) => value.toLowerCase().includes(q)));
}

export interface PhaseRow {
  phase: Phase | "N";
  amps: number;
  /** Procento vůči jmenovitému proudu -Q1. */
  percent: number;
  reserveA: number;
}

export interface PhaseReport {
  rows: PhaseRow[];
  lightest: Phase;
  heaviest: Phase;
  /** Nesymetrie (max − min) / průměr [%]. */
  imbalancePercent: number;
  recommendation: string;
  thermal: { internalC: number; ambientC: number; maxC: number; reserveC: number; totalLossW: number; advice: string };
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const formatA = (value: number) => `${round1(value).toLocaleString("cs-CZ")} A`;

/**
 * Zatížení fází L1/L2/L3 (+ N) vůči -Q1 a doporučení, kam připojit nový jednofázový okruh.
 * `extra` = proud nového okruhu [A], který se do výsledku přičte na nejméně zatíženou fázi.
 */
export function phaseReport(model: PanelModel, extra = 0): PhaseReport {
  const phases: Phase[] = ["L1", "L2", "L3"];
  const load = { ...model.phaseLoad };
  const lightest = phases.reduce((best, phase) => (load[phase] < load[best] ? phase : best), "L1" as Phase);
  if (extra > 0) {
    load[lightest] = round1(load[lightest] + extra);
    const { L1, L2, L3 } = load;
    load.N = round1(Math.sqrt(Math.max(0, L1 * L1 + L2 * L2 + L3 * L3 - L1 * L2 - L2 * L3 - L3 * L1)));
  }
  const heaviest = phases.reduce((worst, phase) => (load[phase] > load[worst] ? phase : worst), "L1" as Phase);
  const rated = model.mainRatedA;
  const rows: PhaseRow[] = (["L1", "L2", "L3", "N"] as const).map((phase) => ({
    phase,
    amps: load[phase],
    percent: round1((load[phase] / rated) * 100),
    reserveA: round1(rated - load[phase]),
  }));
  const values = phases.map((phase) => load[phase]);
  const average = values.reduce((sum, value) => sum + value, 0) / 3;
  const imbalancePercent = average ? round1(((Math.max(...values) - Math.min(...values)) / average) * 100) : 0;
  const reserve = round1(rated - model.phaseLoad[lightest]);
  const recommendation =
    extra > 0
      ? `💡 Nový okruh ${formatA(extra)} připojte na ${lightest} – po připojení ${formatA(load[lightest])} (${round1((load[lightest] / rated) * 100).toLocaleString("cs-CZ")} % z -Q1 ${rated} A).`
      : `💡 Nejmenší zatížení je na fázi ${lightest} (rezerva ${formatA(reserve)}). Nový jednofázový okruh připojte na ${lightest}.`;

  // Tepelná rezerva: nový okruh přidá ztráty úměrně proudu (≈ 2,2 W na 16 A jistič).
  const extraLoss = extra > 0 ? round1(2.2 * Math.min(1, extra / 16) ** 2 * 16 * model.thermal.simultaneity) : 0;
  const totalLossW = round1(model.thermal.totalLossW + extraLoss);
  const internalC = round1(model.thermal.ambientC + totalLossW / (5.5 * model.thermal.surfaceM2));
  const reserveC = round1(model.thermal.maxC - internalC);
  const advice =
    reserveC < 0
      ? "🔥 Vnitřní teplota překračuje limit – doplňte ventilátor s filtrem nebo chlazení, odlehčete vývody."
      : reserveC < 5
        ? "⚠️ Malá tepelná rezerva – další přístroje jen s ventilací (EN 61439-1, ověření oteplení)."
        : "✅ Tepelná rezerva v pořádku – rozváděč zvládne další přístroje bez nuceného chlazení.";

  return { rows, lightest, heaviest, imbalancePercent, recommendation, thermal: { internalC, ambientC: model.thermal.ambientC, maxC: model.thermal.maxC, reserveC, totalLossW, advice } };
}
