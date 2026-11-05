// Fáze 55: soustava a počet fází přívodu rozváděče (1f / 3f, TN-C-S / TN-S / TT). Jediný zdroj voleb pro hlavičku projektu,
// dialog Nový projekt, 2D půdorys, generátor rozváděče, sběrnice PE / N a dokumentaci. Čisté funkce bez I/O.

export interface SupplySystem {
  id: "3F_TNCS" | "3F_TNS" | "3F_TT" | "1F_TNS" | "1F_TNCS";
  phases: 1 | 3;
  system: "TN-C-S" | "TN-S" | "TT";
  label: string;
  detail: string;
  /** Vodiče přívodu (jednopólové schéma, výrobní štítek). */
  conductors: string;
  /** Rozdělení PEN na PE + N v tomto rozváděči (propojka PE ↔ N0). */
  penSplit: boolean;
  /** Text „Síť a jmenovité napětí“ (sloupec `PanelBoardProject.networkSystem`). */
  networkSystem: string;
}

export const SUPPLY_SYSTEMS: readonly SupplySystem[] = [
  { id: "3F_TNCS", phases: 3, system: "TN-C-S", label: "3f TN-C-S", detail: "přívod 4-vodič L1, L2, L3, PEN → rozdělení PEN na PE a N v tomto rozváděči", conductors: "L1,L2,L3,PEN", penSplit: true, networkSystem: "3 x 230/400 V, 50Hz, TN-C-S" },
  { id: "3F_TNS", phases: 3, system: "TN-S", label: "3f TN-S", detail: "přívod 5-vodič L1, L2, L3, N, PE → PE a N už rozděleny před rozváděčem", conductors: "L1,L2,L3,N,PE", penSplit: false, networkSystem: "3 x 230/400 V, 50Hz, TN-S" },
  { id: "3F_TT", phases: 3, system: "TT", label: "3f TT", detail: "L1, L2, L3, N + vlastní uzemnění PE", conductors: "L1,L2,L3,N", penSplit: false, networkSystem: "3 x 230/400 V, 50Hz, TT" },
  { id: "1F_TNS", phases: 1, system: "TN-S", label: "1f TN-S", detail: "přívod 3-vodič L, N, PE – 230 V", conductors: "L,N,PE", penSplit: false, networkSystem: "1 x 230 V, 50Hz, TN-S" },
  { id: "1F_TNCS", phases: 1, system: "TN-C-S", label: "1f TN-C-S", detail: "přívod 2-vodič L, PEN → rozdělení PEN na PE a N v rozváděči", conductors: "L,PEN", penSplit: true, networkSystem: "1 x 230 V, 50Hz, TN-C-S" },
];

export const DEFAULT_SUPPLY: SupplySystem = SUPPLY_SYSTEMS[1];

export const supplyById = (id: string | null | undefined): SupplySystem => SUPPLY_SYSTEMS.find((supply) => supply.id === id) ?? DEFAULT_SUPPLY;

/**
 * Soustava projektu z uložených sloupců: počet fází (`supplyPhases`, jinak „1 x“ v textu) a typ sítě z textu
 * `networkSystem` (TN-C-S / TN-C → TN-C-S, TT, jinak TN-S). 1f TT se nenabízí → 1f TN-S.
 */
export function supplyOf(project: { networkSystem: string; supplyPhases?: number | null }): SupplySystem {
  const phases = project.supplyPhases === 1 || (!project.supplyPhases && /^\s*1\s*x/i.test(project.networkSystem)) ? 1 : 3;
  const text = project.networkSystem.toUpperCase();
  const system = /TN-C(-S)?\b/.test(text) ? "TN-C-S" : /\bTT\b/.test(text) ? "TT" : "TN-S";
  return SUPPLY_SYSTEMS.find((supply) => supply.phases === phases && supply.system === system) ?? (phases === 1 ? SUPPLY_SYSTEMS[3] : DEFAULT_SUPPLY);
}

/** Hodnoty sloupců projektu pro zvolenou soustavu. */
export const supplyColumns = (supply: SupplySystem) => ({ supplyPhases: supply.phases, networkSystem: supply.networkSystem });
