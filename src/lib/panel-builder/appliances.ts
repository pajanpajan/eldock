// Fáze 63: knihovna samostatných spotřebičů 2D půdorysu – vestavěné spotřebiče s výchozím jištěním podle výpočtu okruhů
// (ČSN 33 2130 ed. 4) a jejich úpravy (název, zkratka na značce, příkon, jistič 1P / 3P, chránič A / F / B / RCBO,
// kabel, montážní výška), vlastní spotřebiče se šablonami. Knihovna se ukládá v prohlížeči i ve firmě
// (`RegisteredCompany.applianceLibraryJson`) a kopie je v nákresu (výpočet okruhů i na serveru). Čisté funkce.

import type { ApplianceOverride, ApplianceTag } from "@/engine/floorplan-bridge";

export type AppliancePoles = 1 | 3;
export type ApplianceRcd = "A" | "F" | "B" | "RCBO";

export interface ApplianceSpec {
  /** Vestavěný = id položky palety („oven“), vlastní = „ap-…“. */
  id: string;
  label: string;
  /** Zkratka na značce (1–4 znaky). */
  symbol: string;
  powerW: number;
  poles: AppliancePoles;
  ratedA: number;
  curve: "B" | "C";
  rcd: ApplianceRcd;
  /** „CYKY-J 3×2,5“. */
  cable: string;
  /** Výchozí montážní výška [mm]; null = podle výškového profilu. */
  heightMm: number | null;
  /** Součinitel soudobosti 0,1–1. */
  simultaneity: number;
  /** Vestavěný spotřebič – štítek pro výpočet (chránič typ B, nevypínaná větev …). */
  tag?: ApplianceTag;
  custom?: boolean;
}

export interface ApplianceLibrary {
  specs: ApplianceSpec[];
  updatedAt: number;
}

export const APPLIANCE_LIBRARY_KEY = "eldock.pb.appliances";
/** Položka palety pro vlastní spotřebič (prvek nese id spotřebiče v `appliance`). */
export const CUSTOM_APPLIANCE_ITEM = "appliance";
export const MAX_APPLIANCES = 60;

export const APPLIANCE_RATINGS = [6, 10, 13, 16, 20, 25, 32] as const;
export const APPLIANCE_CABLES: Record<AppliancePoles, string[]> = {
  1: ["CYKY-J 3×1,5", "CYKY-J 3×2,5", "CYKY-J 3×4", "CYKY-J 3×6"],
  3: ["CYKY-J 5×1,5", "CYKY-J 5×2,5", "CYKY-J 5×4", "CYKY-J 5×6", "CYKY-J 5×10"],
};
export const RCD_OPTIONS: { id: ApplianceRcd; label: string; detail: string }[] = [
  { id: "A", label: "A", detail: "společný chránič 30 mA typ A" },
  { id: "F", label: "F", detail: "vlastní chránič 30 mA typ F (měniče, pračky, TČ)" },
  { id: "B", label: "B", detail: "vlastní chránič 30 mA typ B (DC složka – EV, TČ, FVE)" },
  { id: "RCBO", label: "RCBO", detail: "jistič s chráničem 30 mA typ A (jen 1f)" },
];

/**
 * Vestavěné spotřebiče palety s jištěním, jaké přiřadí výpočet okruhů bez úprav: 1f spotřebiče B16 + 3×2,5 pod společný
 * chránič A, varná deska 3P B16 + 5×2,5, lednice RCBO (nevypínaná větev), EV / TČ / FVE 3P s vlastním chráničem typ B.
 */
export const BUILTIN_APPLIANCES: ApplianceSpec[] = [
  { id: "cooktop", label: "Varná deska 3f (400 V)", symbol: "VD", powerW: 7200, poles: 3, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 5×2,5", heightMm: null, simultaneity: 0.6, tag: "cooktop_3p" },
  { id: "oven", label: "Trouba", symbol: "TR", powerW: 3500, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 0.7, tag: "oven" },
  { id: "dishwasher", label: "Myčka", symbol: "MY", powerW: 2200, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 0.6, tag: "dishwasher" },
  { id: "washer", label: "Pračka", symbol: "PR", powerW: 2200, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 0.6, tag: "washer" },
  { id: "dryer", label: "Sušička", symbol: "SU", powerW: 2500, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 0.6, tag: "dryer" },
  { id: "fridge", label: "Chladnička (RCBO)", symbol: "CH", powerW: 300, poles: 1, ratedA: 16, curve: "B", rcd: "RCBO", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 1, tag: "fridge" },
  { id: "boiler", label: "Bojler", symbol: "BO", powerW: 2000, poles: 1, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 1, tag: "boiler" },
  { id: "heat-pump", label: "Tepelné čerpadlo", symbol: "TČ", powerW: 6000, poles: 3, ratedA: 16, curve: "C", rcd: "B", cable: "CYKY-J 5×2,5", heightMm: null, simultaneity: 1, tag: "heat_pump" },
  { id: "wallbox", label: "Wallbox EV", symbol: "EV", powerW: 11000, poles: 3, ratedA: 16, curve: "B", rcd: "B", cable: "CYKY-J 5×2,5", heightMm: null, simultaneity: 1, tag: "ev_charger" },
  { id: "pv-inverter", label: "Střídač FVE (chránič typ B)", symbol: "FVE", powerW: 10000, poles: 3, ratedA: 16, curve: "B", rcd: "B", cable: "CYKY-J 5×2,5", heightMm: null, simultaneity: 1, tag: "pv_inverter" },
];

/** Rychlé šablony vlastních spotřebičů (orientační hodnoty – upravte podle štítku spotřebiče). */
export const APPLIANCE_TEMPLATES: Omit<ApplianceSpec, "id" | "custom">[] = [
  { label: "Klimatizace", symbol: "KL", powerW: 2500, poles: 1, ratedA: 16, curve: "C", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: 2200, simultaneity: 1 },
  { label: "Rekuperace VZT", symbol: "VZT", powerW: 300, poles: 1, ratedA: 10, curve: "B", rcd: "A", cable: "CYKY-J 3×1,5", heightMm: 2200, simultaneity: 1 },
  { label: "Saunová kamna 3f", symbol: "SA", powerW: 9000, poles: 3, ratedA: 16, curve: "B", rcd: "A", cable: "CYKY-J 5×2,5", heightMm: 300, simultaneity: 1 },
  { label: "Bazénová technologie", symbol: "BZ", powerW: 2000, poles: 1, ratedA: 16, curve: "C", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 1 },
  { label: "Čerpadlo studny / ČOV", symbol: "ČS", powerW: 1100, poles: 1, ratedA: 16, curve: "C", rcd: "A", cable: "CYKY-J 3×2,5", heightMm: null, simultaneity: 1 },
  { label: "Brána / Garážová vrata", symbol: "BR", powerW: 600, poles: 1, ratedA: 10, curve: "B", rcd: "A", cable: "CYKY-J 3×1,5", heightMm: null, simultaneity: 0.5 },
];

export const builtinAppliance = (id: string) => BUILTIN_APPLIANCES.find((spec) => spec.id === id) ?? null;

/** Žíly a průřez kabelu „CYKY-J 5×4“ → { cores: 5, mm2: 4 }. */
export function cableSection(cable: string): { cores: number; mm2: number } {
  const match = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)/.exec(cable);
  if (!match) return { cores: 3, mm2: 2.5 };
  return { cores: Number(match[1]), mm2: Number(match[2].replace(",", ".")) };
}

/** Kabel odpovídající počtu fází (3 žíly 1f, 5 žil 3f) se stejným průřezem. */
export function cableForPoles(cable: string, poles: AppliancePoles): string {
  const options = APPLIANCE_CABLES[poles];
  if (options.includes(cable)) return cable;
  const mm2 = cableSection(cable).mm2;
  return options.find((option) => cableSection(option).mm2 === mm2) ?? options[1];
}

const clean = (text: unknown, max: number) => (typeof text === "string" ? text.replace(/\s+/g, " ").trim().slice(0, max) : "");
const finite = (value: unknown, fallback: number, min: number, max: number) => (typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

/** Kontrola a doplnění spotřebiče z uložených dat (neplatný → null). */
export function parseApplianceSpec(value: unknown): ApplianceSpec | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<ApplianceSpec>;
  const id = clean(raw.id, 40);
  if (!/^[\w-]+$/.test(id)) return null;
  const builtin = builtinAppliance(id);
  const label = clean(raw.label, 60) || builtin?.label || "";
  if (!label) return null;
  const poles: AppliancePoles = raw.poles === 3 ? 3 : raw.poles === 1 ? 1 : (builtin?.poles ?? 1);
  const ratings: readonly number[] = APPLIANCE_RATINGS;
  const ratedA = ratings.includes(raw.ratedA as number) ? (raw.ratedA as number) : (builtin?.ratedA ?? 16);
  let rcd: ApplianceRcd = raw.rcd === "A" || raw.rcd === "F" || raw.rcd === "B" || raw.rcd === "RCBO" ? raw.rcd : (builtin?.rcd ?? "A");
  // RCBO jen jednofázově (3f vývod dostane vlastní chránič typ A)
  if (rcd === "RCBO" && poles === 3) rcd = "A";
  const symbol = clean(raw.symbol, 4).toUpperCase() || builtin?.symbol || label.slice(0, 2).toUpperCase();
  return {
    id,
    label,
    symbol,
    powerW: Math.round(finite(raw.powerW, builtin?.powerW ?? 2000, 1, 100_000)),
    poles,
    ratedA,
    curve: raw.curve === "C" ? "C" : raw.curve === "B" ? "B" : (builtin?.curve ?? "B"),
    rcd,
    cable: cableForPoles(typeof raw.cable === "string" ? raw.cable : (builtin?.cable ?? ""), poles),
    heightMm: typeof raw.heightMm === "number" && Number.isFinite(raw.heightMm) ? Math.round(Math.min(6000, Math.max(0, raw.heightMm))) : null,
    simultaneity: Math.round(finite(raw.simultaneity, builtin?.simultaneity ?? 1, 0.1, 1) * 100) / 100,
    ...(builtin?.tag ? { tag: builtin.tag } : {}),
    ...(builtin ? {} : { custom: true }),
  };
}

export function parseApplianceList(value: unknown): ApplianceSpec[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map(parseApplianceSpec)
    .filter((spec): spec is ApplianceSpec => spec !== null && !seen.has(spec.id) && Boolean(seen.add(spec.id)))
    .slice(0, MAX_APPLIANCES);
}

export function parseApplianceLibrary(json: string | null | undefined): ApplianceLibrary | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<ApplianceLibrary>;
    if (!value || typeof value !== "object" || typeof value.updatedAt !== "number") return null;
    return { specs: parseApplianceList(value.specs), updatedAt: value.updatedAt };
  } catch {
    return null;
  }
}

/** Novější ze dvou knihoven (prohlížeč × firma). */
export const newestLibrary = (a: ApplianceLibrary | null, b: ApplianceLibrary | null): ApplianceLibrary | null => (!a ? b : !b ? a : a.updatedAt >= b.updatedAt ? a : b);

/** Spotřebič se liší od výchozího (pak výpočet okruhů použije jeho zadání). */
export function isCustomized(spec: ApplianceSpec): boolean {
  const builtin = builtinAppliance(spec.id);
  if (!builtin) return true;
  return (["label", "symbol", "powerW", "poles", "ratedA", "curve", "rcd", "cable", "heightMm", "simultaneity"] as const).some((key) => spec[key] !== builtin[key]);
}

/** Úpravy uložené v nákresu / knihovně: jen změněné vestavěné a vlastní spotřebiče. */
export const storedSpecs = (specs: readonly ApplianceSpec[]) => specs.filter(isCustomized);

/** Platný spotřebič prvku: úprava z nákresu, jinak vestavěný; vlastní spotřebič podle `appliance`. */
export function applianceSpecFor(appliances: readonly ApplianceSpec[] | undefined, element: { item: string; appliance?: string | null }): ApplianceSpec | null {
  const id = element.item === CUSTOM_APPLIANCE_ITEM ? (element.appliance ?? "") : element.item;
  return (appliances ?? []).find((spec) => spec.id === id) ?? builtinAppliance(id);
}

/** Všechny spotřebiče palety: vestavěné (s úpravami) a pak vlastní. */
export function applianceCatalog(appliances: readonly ApplianceSpec[] | undefined): ApplianceSpec[] {
  const stored = appliances ?? [];
  return [...BUILTIN_APPLIANCES.map((builtin) => stored.find((spec) => spec.id === builtin.id) ?? builtin), ...stored.filter((spec) => !builtinAppliance(spec.id))];
}

/** Zadání spotřebiče pro výpočet okruhů (jen upravený nebo vlastní spotřebič; vestavěný bez úprav počítá engine sám). */
export function applianceOverride(spec: ApplianceSpec | null): ApplianceOverride | undefined {
  if (!spec || !isCustomized(spec)) return undefined;
  return { label: spec.label, powerW: spec.powerW, poles: spec.poles, ratedA: spec.ratedA, curve: spec.curve, rcd: spec.rcd, mm2: cableSection(spec.cable).mm2, simultaneity: spec.simultaneity };
}

let sequence = 0;
/** Nový vlastní spotřebič ze šablony. */
export function newAppliance(template: Omit<ApplianceSpec, "id" | "custom">): ApplianceSpec {
  return { ...template, id: `ap-${Date.now().toString(36)}${(sequence++).toString(36)}`, custom: true };
}

/** Popis jištění „1P B16 · chránič A · CYKY-J 3×2,5“. */
export const protectionLabel = (spec: Pick<ApplianceSpec, "poles" | "curve" | "ratedA" | "rcd" | "cable">) => `${spec.poles}P ${spec.curve}${spec.ratedA} · ${spec.rcd === "RCBO" ? "RCBO 30 mA" : `chránič ${spec.rcd}`} · ${spec.cable}`;
