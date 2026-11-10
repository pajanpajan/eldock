// Štítky funkce obvodu (fáze 45): editovatelné rychlé štítky se Smart Presety (výchozí kategorie,
// póly, charakteristika, proud) a automatickým číslováním („Chránič 1“ → „Chránič 2“). Uložení
// v localStorage i u firmy v DB – vyhrává novější `updatedAt`. Čisté funkce.

import { defaultConfig, type ConfigCategory, type ItemConfig } from "./configurator";

export interface ChipPreset {
  category: ConfigCategory;
  poles?: string;
  curve?: string;
  ratedCurrentA?: number;
}

export interface CircuitChip {
  id: string;
  label: string;
  /** Číslovaný štítek: první použití „Světla 1“, další „Světla 2“ … */
  numbered?: boolean;
  preset?: ChipPreset | null;
}

export interface ChipSet {
  chips: CircuitChip[];
  updatedAt: number;
}

export const CHIPS_STORAGE_KEY = "eldock.pb.circuit-chips";
export const MAX_CHIPS = 40;

export const DEFAULT_CHIPS: readonly CircuitChip[] = [
  { id: "main", label: "Hlavní vypínač", preset: { category: "MAIN_SWITCH", poles: "3P", ratedCurrentA: 40 } },
  { id: "rcd", label: "Chránič", numbered: true, preset: { category: "RCD", poles: "4P", ratedCurrentA: 40 } },
  { id: "lights", label: "Světla", numbered: true, preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 10 } },
  // Fáze 82: světelný okruh se zásuvkami – jistič 10 A (13 A ručně v kaskádě), nikdy 16 A
  { id: "lights-sockets", label: "Světla + zásuvky", numbered: true, preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 10 } },
  { id: "sockets", label: "Zásuvky", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "kitchen", label: "Kuchyně", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "bath", label: "Koupelna", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "cooktop", label: "Varná deska", preset: { category: "MCB", poles: "3P", curve: "B", ratedCurrentA: 16 } },
  { id: "oven", label: "Trouba", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "washer", label: "Myčka / Pračka", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "boiler", label: "Bojler / TČ", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "heating", label: "Topení", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
  { id: "outdoor", label: "Venek / Garáž", preset: { category: "MCB", poles: "1P", curve: "B", ratedCurrentA: 16 } },
];

const POLE_MODULES: Record<string, number> = { "1P": 1, "1P+N": 2, "2P": 2, "3P": 3, "3P+N": 4, "4P": 4 };

/** Preset štítku → úplná konfigurace (výrobce zůstane zvolený). */
export function presetConfig(preset: ChipPreset, manufacturer: string | null): ItemConfig {
  const base = defaultConfig(preset.category, { manufacturer, modules: preset.poles ? (POLE_MODULES[preset.poles] ?? 1) : 1, ratedCurrentA: preset.ratedCurrentA ?? null, curve: preset.curve ?? null });
  return {
    ...base,
    ...(preset.poles ? { poles: preset.poles, modules: POLE_MODULES[preset.poles] ?? base.modules } : {}),
    ...(preset.curve && "curve" in base ? { curve: preset.curve } : {}),
    ...(preset.ratedCurrentA ? { ratedCurrentA: preset.ratedCurrentA } : {}),
  };
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Popis po kliknutí na štítek: číslovaný štítek dostane další volné číslo podle popisů v rozváděči
 * („Chránič 1“ existuje → „Chránič 2“); nečíslovaný se při opakování také očísluje („Zásuvky 2“).
 */
export function nextChipLabel(chip: Pick<CircuitChip, "label" | "numbered">, existing: readonly string[]): string {
  const pattern = new RegExp(`^${escape(chip.label)}(?:\\s+(\\d+))?$`, "i");
  const numbers = existing.map((label) => pattern.exec(label.trim())).filter((match): match is RegExpExecArray => match !== null).map((match) => (match[1] ? Number(match[1]) : 1));
  if (!numbers.length) return chip.numbered ? `${chip.label} 1` : chip.label;
  return `${chip.label} ${Math.max(...numbers) + 1}`;
}

const isChip = (value: unknown): value is CircuitChip =>
  !!value && typeof value === "object" && typeof (value as CircuitChip).id === "string" && typeof (value as CircuitChip).label === "string" && (value as CircuitChip).label.trim().length > 0;

/** Bezpečné čtení uložené sady (localStorage / DB); neplatná data = null. */
export function parseChipSet(json: string | null | undefined): ChipSet | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as Partial<ChipSet>;
    if (!Array.isArray(value.chips) || typeof value.updatedAt !== "number") return null;
    return { chips: value.chips.filter(isChip).slice(0, MAX_CHIPS).map((chip) => ({ ...chip, label: chip.label.trim().slice(0, 40) })), updatedAt: value.updatedAt };
  } catch {
    return null;
  }
}

/** Novější sada vyhrává (prohlížeč vs. firma v DB); bez obou výchozí štítky. */
export function newestChipSet(...sets: (ChipSet | null)[]): ChipSet {
  return sets.filter((set): set is ChipSet => set !== null).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? { chips: [...DEFAULT_CHIPS], updatedAt: 0 };
}

export function moveChip(chips: readonly CircuitChip[], index: number, direction: -1 | 1): CircuitChip[] {
  const target = index + direction;
  if (target < 0 || target >= chips.length) return [...chips];
  const next = [...chips];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
