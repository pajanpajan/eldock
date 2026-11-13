// Fáze 112: propojovací hřebeny (1f / 3f) a fáze L1 / L2 / L3 na 2D plátně AI Panel Builderu. Hřeben = měděná
// hřebenová přípojnice pod spodními svorkami proudového chrániče a navazujících jističů na stejné liště (3f pod 4P
// chráničem L1 / L2 / L3 / N, 1f pod 2P chráničem L / N); řada jističochráničů se společným napájením dostane hřeben
// na vstupu. Nastavení lišty „Hřeben: Auto / 3f / 1f / Vyp“ je v uspořádání projektu (`railLayoutJson.combs`).
// Fáze přístroje z přiřazení (`phaseAssignment`), jinak z pozice na 3f hřebenu (L1, L2, L3, L1 …). Čisté funkce.

export type CombSetting = "AUTO" | "1F" | "3F" | "OFF";
export const COMB_SETTINGS: readonly CombSetting[] = ["AUTO", "3F", "1F", "OFF"];
export const isCombSetting = (value: unknown): value is CombSetting => COMB_SETTINGS.includes(value as CombSetting);
/** Další volba tlačítka v záhlaví lišty (Auto → 3f → 1f → Vyp → Auto). */
export const nextCombSetting = (value: CombSetting): CombSetting => COMB_SETTINGS[(COMB_SETTINGS.indexOf(value) + 1) % COMB_SETTINGS.length];

export type PhaseBadge = "L1" | "L2" | "L3" | "L1+L2+L3";

export interface CombDevice {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: string | null;
  poles: string | null;
  phaseAssignment?: string | null;
}

export interface CombNode {
  id: string;
  parentItemId: string | null;
}

export interface CombRun {
  rail: number;
  /** Přístroje na hřebenu zleva (první = chránič, nebo první jističochránič řady). */
  ids: string[];
  kind: "1F" | "3F";
  /** Vodiče hřebenu (popisek přípojnice). */
  conductors: string[];
  /** Hřeben na vstupu (řada jističochráničů) – jinak pod výstupy chrániče. */
  input: boolean;
}

const BREAKERS = new Set(["MCB", "RCBO"]);
const threePole = (poles: string | null | undefined) => /^(3P|4P|3P\+N)/.test(poles ?? "");
const conductorsOf = (kind: "1F" | "3F") => (kind === "3F" ? ["L1", "L2", "L3", "N"] : ["L", "N"]);

/** Nastavení hřebenů lišt z uspořádání projektu (jen platné hodnoty, klíč = číslo lišty). */
export function parseCombSettings(value: unknown): Record<number, CombSetting> {
  const result: Record<number, CombSetting> = {};
  if (!value || typeof value !== "object") return result;
  for (const [key, setting] of Object.entries(value as Record<string, unknown>)) {
    const rail = Number(key);
    if (Number.isInteger(rail) && rail >= 1 && rail <= 64 && isCombSetting(setting) && setting !== "AUTO") result[rail] = setting;
  }
  return result;
}

/**
 * Hřebeny lišt: chránič a za ním souvislá řada jeho jističů na stejné liště (bez mezery), nebo souvislá řada nejméně dvou
 * jističochráničů se stejným napájením. Auto = 3f pod 4P chráničem / 3f napájením, 1f pod 2P; volba lišty přebije druh,
 * „Vyp“ hřeben lišty skryje.
 */
export function combRuns(devices: readonly CombDevice[], nodes: readonly CombNode[], settings: Record<number, CombSetting> = {}, supplyPhases: 1 | 3 = 3): CombRun[] {
  const parentOf = new Map(nodes.map((node) => [node.id, node.parentItemId]));
  const runs: CombRun[] = [];
  const rails = [...new Set(devices.map((device) => device.dinRailIndex))].sort((a, b) => a - b);
  for (const rail of rails) {
    const setting = settings[rail] ?? "AUTO";
    if (setting === "OFF") continue;
    const row = devices.filter((device) => device.dinRailIndex === rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
    let index = 0;
    while (index < row.length) {
      const head = row[index];
      if (head.category === "RCD") {
        const members = [head];
        let next = index + 1;
        while (next < row.length && BREAKERS.has(row[next].category ?? "") && parentOf.get(row[next].id) === head.id) members.push(row[next++]);
        if (members.length > 1) {
          const auto = threePole(head.poles) && supplyPhases === 3 ? "3F" : "1F";
          const kind = setting === "AUTO" ? auto : setting;
          runs.push({ rail, ids: members.map((member) => member.id), kind, conductors: conductorsOf(kind), input: false });
          index = next;
          continue;
        }
      }
      if (head.category === "RCBO") {
        const members = [head];
        let next = index + 1;
        while (next < row.length && row[next].category === "RCBO" && parentOf.get(row[next].id) === parentOf.get(head.id)) members.push(row[next++]);
        if (members.length > 1) {
          const auto = supplyPhases === 3 ? "3F" : "1F";
          const kind = setting === "AUTO" ? auto : setting;
          runs.push({ rail, ids: members.map((member) => member.id), kind, conductors: kind === "3F" ? ["L1", "L2", "L3"] : ["L"], input: true });
          index = next;
          continue;
        }
      }
      index++;
    }
  }
  return runs;
}

/** Fáze z přiřazení přístroje („L2“, „L1,L2,L3,N“, „L1,N“). */
export function phaseFromAssignment(assignment: string | null | undefined): PhaseBadge | null {
  const phases = (assignment ?? "").split(",").map((part) => part.trim()).filter((part) => part === "L1" || part === "L2" || part === "L3");
  if (phases.length >= 3) return "L1+L2+L3";
  return (phases[0] as PhaseBadge | undefined) ?? null;
}

/**
 * Odznaky fází jističů a jističochráničů: přiřazená fáze, 3P / 4P přístroj = L1+L2+L3, jinak pozice na 3f hřebenu
 * (L1, L2, L3, L1 …); jednofázová soustava = L1.
 */
export function phaseBadges(devices: readonly CombDevice[], runs: readonly CombRun[], supplyPhases: 1 | 3 = 3): Map<string, PhaseBadge> {
  const result = new Map<string, PhaseBadge>();
  const byId = new Map(devices.map((device) => [device.id, device]));
  for (const run of runs) {
    if (run.kind !== "3F") continue;
    let cursor = 0;
    for (const id of run.ids) {
      const device = byId.get(id);
      if (!device || !BREAKERS.has(device.category ?? "") || threePole(device.poles)) continue;
      result.set(id, (["L1", "L2", "L3"] as const)[cursor++ % 3]);
    }
  }
  for (const device of devices) {
    if (!BREAKERS.has(device.category ?? "")) continue;
    const assigned = phaseFromAssignment(device.phaseAssignment);
    if (threePole(device.poles)) result.set(device.id, "L1+L2+L3");
    else if (assigned && assigned !== "L1+L2+L3") result.set(device.id, assigned);
    else if (!result.has(device.id) && supplyPhases === 1) result.set(device.id, "L1");
  }
  return result;
}

/** Barvy fází podle ČSN 33 0165 (L1 hnědá, L2 černá, L3 šedá) – kontrastní text a obrys pro tmavé i světlé plátno. */
export const PHASE_STYLE: Record<"L1" | "L2" | "L3", { fill: string; text: string; stroke: string; color: string }> = {
  L1: { fill: "#8b4513", text: "#ffffff", stroke: "#d6a77a", color: "hnědá" },
  L2: { fill: "#111111", text: "#ffffff", stroke: "#a1a1aa", color: "černá" },
  L3: { fill: "#9ca3af", text: "#111111", stroke: "#e5e7eb", color: "šedá" },
};

/** Popisek hřebenu („Hřeben 3f · L1 L2 L3 N“). */
export const combLabel = (run: Pick<CombRun, "kind" | "conductors">) => `Hřeben ${run.kind === "3F" ? "3f" : "1f"} · ${run.conductors.join(" ")}`;
