import type { EquipmentType } from "@/generated/prisma/enums";

import { POWER_FACTOR, U_LINE, designCurrents, type PowerCableNode } from "./cable-sizing";

// Fáze 93: zálohování napájení rozváděčů a jejich přívodních tras ve Správě areálů (nemocnice, obchodní centra, datová
// centra): běžná síť, dieselagregát s ATS do 15 s a kritické okruhy UPS (< 0,5 s) / zdravotnická soustava ZIS IT.
// Úroveň se dědí po větvi (podružný rozváděč za rozváděčem na DA je na DA, pokud sám není na UPS), přívodní trasa má
// úroveň napájeného rozváděče. Filtr nad mapou areálu zvýrazní zálohovanou páteř od zdroje po koncové rozváděče a sečte
// výkon proti kapacitě zdroje zálohy. Čisté funkce.

export type PowerBackupTier = "GRID_STANDARD" | "BACKUP_GENERATOR_DA" | "CRITICAL_UPS_ZIS";

export interface PowerBackupTierInfo {
  id: PowerBackupTier;
  label: string;
  /** Odznak na mapě a kartě („⚡ DA 15s“). */
  badge: string;
  /** Filtr nad mapou areálu. */
  filter: string;
  color: string;
  /** Zdroj zálohy do souhrnu („DA“, „UPS“). */
  source: string;
  hint: string;
}

export const POWER_BACKUP_TIERS: readonly PowerBackupTierInfo[] = [
  { id: "GRID_STANDARD", label: "Běžná síť (bez zálohy)", badge: "Síť", filter: "🔵 Jen běžná síť", color: "#3b82f6", source: "síť", hint: "Napájení z distribuční sítě / trafostanice bez záložního zdroje." },
  {
    id: "BACKUP_GENERATOR_DA",
    label: "Zálohováno dieselagregátem (DA, ATS ≤ 15 s)",
    badge: "⚡ DA 15s",
    filter: "🟠 Zálohováno Dieselagregátem (DA <15 s)",
    color: "#f97316",
    source: "DA",
    hint: "Při výpadku sítě přepne automatický přepínač záloh (ATS) na dieselagregát do 15 s.",
  },
  {
    id: "CRITICAL_UPS_ZIS",
    label: "Kritické okruhy UPS (< 0,5 s) / ZIS IT",
    badge: "🔋 UPS <0,5s / IT",
    filter: "🔴 Kritické okruhy UPS (<0,5 s) / ZIS IT",
    color: "#dc2626",
    source: "UPS",
    hint: "Nepřerušitelné napájení z UPS (přepnutí do 0,5 s), zdravotnická izolovaná soustava ZIS IT s hlídačem izolačního stavu.",
  },
];

export const DEFAULT_BACKUP_TIER: PowerBackupTier = "GRID_STANDARD";
export const isPowerBackupTier = (value: unknown): value is PowerBackupTier => POWER_BACKUP_TIERS.some((tier) => tier.id === value);
export const tierOf = (value: unknown): PowerBackupTierInfo => POWER_BACKUP_TIERS.find((tier) => tier.id === value) ?? POWER_BACKUP_TIERS[0];
/** Rozváděče a zdroje, kterým se úroveň zálohy nastavuje (karta, Studio, filtr mapy). */
export const BACKUP_TYPES: readonly EquipmentType[] = ["SWITCHBOARD", "TRANSFORMER"];
export const hasBackupTier = (type: EquipmentType) => BACKUP_TYPES.includes(type);

export type BackupFilter = "ALL" | PowerBackupTier;
export const BACKUP_FILTERS: readonly { id: BackupFilter; label: string }[] = [{ id: "ALL", label: "Všechny rozvody" }, ...POWER_BACKUP_TIERS.map((tier) => ({ id: tier.id, label: tier.filter }))];

/** Rozváděč / zdroj ve stromu napájení závodu. */
export interface BackupNode {
  id: string;
  tag: string;
  name: string;
  type: EquipmentType;
  parentId: string | null;
  buildingId: string;
  tier: PowerBackupTier;
  /** Kapacita zdroje zálohy [kVA] (dieselagregát, UPS) – u kořene zálohované větve. */
  capacityKva: number | null;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
  tenantUnit: string | null;
}

/**
 * Skutečná úroveň zálohy každého uzlu: vlastní, pokud není běžná síť, jinak zděděná od nadřazeného rozváděče (za DA je
 * vše na DA, dokud větev výslovně nepřejde na UPS).
 */
export function effectiveTiers(nodes: readonly BackupNode[]): Map<string, PowerBackupTier> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const memo = new Map<string, PowerBackupTier>();
  const visit = (node: BackupNode, depth: number): PowerBackupTier => {
    if (memo.has(node.id)) return memo.get(node.id)!;
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    const inherited = parent && depth < 50 ? visit(parent, depth + 1) : DEFAULT_BACKUP_TIER;
    const tier = node.tier !== DEFAULT_BACKUP_TIER ? node.tier : inherited;
    memo.set(node.id, tier);
    return tier;
  };
  for (const node of nodes) visit(node, 0);
  return memo;
}

/** Proud 3f 400 V [A] → činný výkon [kW] při cos φ 0,9. */
export const ampsToKw = (amps: number) => Math.round(((Math.sqrt(3) * U_LINE * amps * POWER_FACTOR) / 1000) * 10) / 10;

export interface BackupSummary {
  filter: BackupFilter;
  /** Rozváděče a zdroje ve filtru (seřazené podle tagu). */
  members: (BackupNode & { effective: PowerBackupTier; loadKw: number })[];
  /** Zvýrazněná páteřní trasa: úseky od zdroje (kořene) po koncové rozváděče filtru. */
  trunk: { from: string; to: string }[];
  /** Uzly páteře (předkové členů filtru – trafostanice, ATS, hlavní rozváděč). */
  trunkIds: string[];
  buildingIds: string[];
  /** Součet výkonu vrcholů větví filtru (bez dvojího započtení podřízených) [kW]. */
  loadKw: number;
  /** Zdánlivý výkon při cos φ 0,9 [kVA]. */
  loadKva: number;
  /** Kapacita zdroje zálohy (součet zadaných kVA ve větvi) – null = nezadaná. */
  capacityKva: number | null;
  /** Rezerva zdroje [%] = (kapacita − zatížení) / kapacita; null bez kapacity. */
  reservePct: number | null;
  /** Souhrnná věta („Celkem na DA: 185 kW (206 kVA) / kapacita DA 250 kVA → rezerva 18 %“). */
  headline: string;
}

const round = (value: number) => Math.round(value * 10) / 10;
const czech = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 });

/** Souhrn filtru větví: členové, páteř od zdroje, výkon a rezerva zdroje zálohy. */
export function backupSummary(nodes: readonly BackupNode[], filter: BackupFilter): BackupSummary {
  const tiers = effectiveTiers(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const currents = designCurrents(nodes.map((node): PowerCableNode => ({ id: node.id, tag: node.tag, parentId: node.parentId, type: node.type, nominalCurrentA: node.nominalCurrentA, measuredCurrentA: node.measuredCurrentA, cable: null })));
  const inFilter = (node: BackupNode) => filter === "ALL" || tiers.get(node.id) === filter;
  const members = nodes
    .filter(inFilter)
    .map((node) => ({ ...node, effective: tiers.get(node.id)!, loadKw: ampsToKw(currents.get(node.id) ?? 0) }))
    .sort((a, b) => a.tag.localeCompare(b.tag, "cs"));
  const memberIds = new Set(members.map((node) => node.id));
  // Páteř: od každého člena nahoru ke kořeni (zdroj → ATS → hlavní rozváděč → podružné)
  const trunk = new Map<string, { from: string; to: string }>();
  const trunkIds = new Set<string>();
  for (const member of members) {
    let current: BackupNode | undefined = member;
    for (let depth = 0; current?.parentId && depth < 50; depth++) {
      const parent = byId.get(current.parentId);
      if (!parent) break;
      trunk.set(`${parent.id}>${current.id}`, { from: parent.id, to: current.id });
      if (!memberIds.has(parent.id)) trunkIds.add(parent.id);
      current = parent;
    }
  }
  // Výkon jen vrcholů větví (rozváděč, jehož nadřazený ve filtru není) – podřízené už obsahuje se soudobostí
  const tops = members.filter((node) => !node.parentId || !memberIds.has(node.parentId));
  const loadKw = round(tops.reduce((sum, node) => sum + node.loadKw, 0));
  const loadKva = round(loadKw / POWER_FACTOR);
  const capacities = members.map((node) => node.capacityKva).filter((value): value is number => typeof value === "number" && value > 0);
  const capacityKva = capacities.length ? round(capacities.reduce((sum, value) => sum + value, 0)) : null;
  const reservePct = capacityKva ? Math.round(((capacityKva - loadKva) / capacityKva) * 100) : null;
  const source = filter === "ALL" ? "areálu" : tierOf(filter).source;
  const headline =
    filter === "ALL" || filter === "GRID_STANDARD"
      ? `Celkem ${filter === "ALL" ? "v areálu" : "na běžné síti"}: ${czech(loadKw)} kW (${members.length} rozváděčů a zdrojů)`
      : capacityKva
        ? `Celkem na ${source}: ${czech(loadKw)} kW (${czech(loadKva)} kVA při cos φ 0,9) / kapacita ${source} ${czech(capacityKva)} kVA → rezerva ${reservePct} %`
        : `Celkem na ${source}: ${czech(loadKw)} kW (${czech(loadKva)} kVA při cos φ 0,9) – kapacitu zdroje ${source} doplňte na kartě rozváděče`;
  return {
    filter,
    members,
    trunk: [...trunk.values()],
    trunkIds: [...trunkIds],
    buildingIds: [...new Set([...members.map((node) => node.buildingId), ...[...trunkIds].map((id) => byId.get(id)?.buildingId).filter((id): id is string => Boolean(id))])],
    loadKw,
    loadKva,
    capacityKva,
    reservePct,
    headline,
  };
}

/** Hledání nájemní jednotky / oddělení (bez diakritiky a velikosti písmen). */
export function matchesTenant(node: Pick<BackupNode, "tenantUnit" | "tag" | "name">, query: string): boolean {
  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalize(query.trim());
  return !q || normalize(`${node.tenantUnit ?? ""} ${node.tag} ${node.name}`).includes(q);
}
