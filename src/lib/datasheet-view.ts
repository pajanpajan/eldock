// Fáze 116: „📄 Datasheet“ součástky z kusovníku – technický list složený z ověřeného listu výrobce
// (component-datasheets.ts) a katalogu AI Panel Builderu (CatalogComponent: Pv, rozměry, odkaz na list výrobce).
// Údaj, který výrobce v ověřených zdrojích neuvádí, se nedoplňuje odhadem. Čisté funkce (dialog, Návody & Datasheety).

import { KIND_INFO, type ComponentKind } from "./bom-lifespan";
import { datasheetFor, type ComponentDatasheet, type TerminalPair } from "./component-datasheets";

/** Záznam katalogu AI Panel Builderu pro stejné objednací číslo (typ nebo objednací kód výrobce). */
export interface CatalogPart {
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  ean: string | null;
  poles: string;
  ratedCurrentA: number;
  trippingCurve: string | null;
  breakingCapacityKa: number | null;
  powerLossWatts: number;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  datasheetUrl: string | null;
  description: string;
  dataSource: string;
}

export interface DatasheetView {
  manufacturer: string | null;
  partNumber: string;
  title: string;
  /** Údaje výrobce ověřené v katalogu ELDOCK (technický list nebo katalog AI Panel Builderu). */
  verified: boolean;
  ratings: { label: string; value: string }[];
  lifespan: { label: string; value: string }[];
  dimensions: string | null;
  weight: string | null;
  lossW: string | null;
  terminals: TerminalPair[];
  /** Svorky z listu výrobce (jinak obecné značení podle druhu přístroje). */
  terminalsVerified: boolean;
  terminalsNote: string;
  datasheetUrl: string | null;
  productUrl: string | null;
  sources: string[];
}

const n = (value: number, digits = 0) => value.toLocaleString("cs-CZ", { maximumFractionDigits: digits });

const poleCount = (text: string | null | undefined): number => {
  const match = /(\d)\s*P/i.exec(text ?? "");
  return match ? Number(match[1]) : 1;
};

/** Obecné značení svorek podle druhu přístroje (když list výrobce v katalogu ELDOCK není). */
export function genericTerminals(kind: ComponentKind, poles: number): TerminalPair[] {
  const main = (count: number): TerminalPair[] =>
    Array.from({ length: Math.min(4, Math.max(1, count)) }, (_, index) => ({ from: String(index * 2 + 1), to: String(index * 2 + 2), kind: "main" as const }));
  switch (kind) {
    case "CONTACTOR":
    case "MOTOR_STARTER":
      return [...main(poles > 1 ? poles : 3), { from: "A1", to: "A2", kind: "coil" }];
    case "RELAY":
    case "SAFETY_RELAY":
      return [{ from: "A1", to: "A2", kind: "coil" }, { from: "11", to: "14", kind: "no" }, { from: "11", to: "12", kind: "nc" }];
    case "BREAKER":
    case "MAIN_SWITCH":
    case "RCD":
      return main(poles);
    case "PSU":
      return [{ from: "L", to: "N", kind: "supply" }, { from: "+", to: "−", kind: "output" }];
    case "PLC":
      return [{ from: "L+", to: "M", kind: "supply" }];
    case "FAN":
      return [{ from: "L", to: "N", kind: "supply" }];
    case "SPD":
      return [{ from: "L", to: "PE", kind: "main" }];
    case "TERMINAL":
      return [{ from: "1", to: "1", kind: "main" }];
    default:
      return [];
  }
}

/** Technický list řádku kusovníku (ověřený list výrobce + katalog AI Panel Builderu), `null` bez objednacího čísla. */
export function buildDatasheetView(input: { manufacturer: string | null; partNumber: string | null; description: string; kind: ComponentKind }, catalog: CatalogPart | null): DatasheetView | null {
  const partNumber = input.partNumber?.trim();
  if (!partNumber) return null;
  const sheet: ComponentDatasheet | null = datasheetFor(partNumber);
  const ratings: DatasheetView["ratings"] = [...(sheet?.ratings ?? [])];
  if (catalog) {
    ratings.push({ label: "Řada / typ", value: `${catalog.series} · ${catalog.typeCode}` });
    ratings.push({ label: "Objednací kód", value: catalog.articleNumber });
    if (catalog.ean) ratings.push({ label: "EAN", value: catalog.ean });
    ratings.push({ label: "Póly · In", value: `${catalog.poles} · ${n(catalog.ratedCurrentA, 1)} A${catalog.trippingCurve ? ` · charakteristika ${catalog.trippingCurve}` : ""}` });
    if (catalog.breakingCapacityKa) ratings.push({ label: "Vypínací schopnost", value: `${n(catalog.breakingCapacityKa, 1)} kA` });
  }
  const lifespan: DatasheetView["lifespan"] = [];
  const life = sheet?.lifespan;
  if (life?.b10dCycles) lifespan.push({ label: "B10d (ČSN EN ISO 13849-1)", value: `${n(life.b10dCycles)} cyklů – ${life.b10dCondition ?? "jmenovité zatížení"}` });
  if (life?.b10dMechanicalCycles) lifespan.push({ label: "B10d mechanické zatížení", value: `${n(life.b10dMechanicalCycles)} cyklů` });
  if (life?.electricalCycles) lifespan.push({ label: "Elektrická životnost", value: `${n(life.electricalCycles)} cyklů (${life.electricalCondition ?? "výrobce"})` });
  if (life?.mechanicalCycles) lifespan.push({ label: "Mechanická životnost", value: `${n(life.mechanicalCycles)} cyklů` });
  if (life?.maxOperatingRatePerHour) lifespan.push({ label: "Max. provozní četnost", value: `${n(life.maxOperatingRatePerHour)} cyklů/h` });
  if (life?.fanL10Hours) lifespan.push({ label: "Životnost ventilátoru L10", value: `${n(life.fanL10Hours)} h při ${life.fanL10TempC ?? 40} °C` });
  if (life?.mtbfHours) lifespan.push({ label: "MTBF", value: `${n(life.mtbfHours)} h (${life.mtbfCondition ?? "výrobce"})` });
  const dims = sheet?.dimensionsMm ?? (catalog?.widthMm && catalog.heightMm && catalog.depthMm ? { w: catalog.widthMm, h: catalog.heightMm, d: catalog.depthMm } : null);
  const loss = sheet?.lossPerPoleW ? `${n(sheet.lossPerPoleW, 2)} W na pól (${n(sheet.lossPerPoleW * (sheet.poles ?? 1), 2)} W celkem, AC-3)` : catalog?.powerLossWatts ? `${n(catalog.powerLossWatts, 2)} W při In` : null;
  const poles = sheet?.poles ?? (catalog ? poleCount(catalog.poles) : poleCount(input.description));
  const sources = [sheet?.source, catalog ? `Katalog AI Panel Builderu ELDOCK (${catalog.manufacturer} ${catalog.typeCode})` : null].filter((value): value is string => Boolean(value));
  return {
    manufacturer: sheet?.manufacturer ?? catalog?.manufacturer ?? input.manufacturer,
    partNumber: sheet?.partNumber ?? partNumber,
    title: sheet?.title ?? catalog?.description ?? input.description,
    verified: Boolean(sheet || catalog),
    ratings,
    lifespan,
    dimensions: dims ? `${n(dims.w, 1)} × ${n(dims.h, 1)} × ${n(dims.d, 1)} mm (Š × V × H)` : null,
    weight: sheet?.weightKg ? `${n(sheet.weightKg, 2)} kg` : null,
    lossW: loss,
    terminals: sheet?.terminals?.length ? sheet.terminals : genericTerminals(input.kind, poles),
    terminalsVerified: Boolean(sheet?.terminals?.length),
    terminalsNote: sheet?.terminalsNote ?? `Obecné značení svorek – ${KIND_INFO[input.kind].label.toLowerCase()} (ověřte v technickém listu výrobce).`,
    datasheetUrl: sheet?.datasheetUrl ?? catalog?.datasheetUrl ?? null,
    productUrl: sheet?.productUrl ?? null,
    sources,
  };
}

/** Ztrátový výkon jednoho kusu [W] pro výpočet oteplení: list výrobce (AC-3 × póly), jinak katalog (Pn při In). */
export function lossOf(partNumber: string | null, catalog: CatalogPart | null): { lossW: number; source: string } | null {
  const sheet = datasheetFor(partNumber);
  if (sheet?.lossPerPoleW) return { lossW: Math.round(sheet.lossPerPoleW * (sheet.poles ?? 1) * 100) / 100, source: `technický list ${sheet.manufacturer} (AC-3)` };
  if (catalog?.powerLossWatts) return { lossW: catalog.powerLossWatts, source: `katalog ${catalog.manufacturer} ${catalog.typeCode}` };
  return null;
}
