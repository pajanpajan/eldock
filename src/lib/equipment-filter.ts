import type { EquipmentStatus, EquipmentType } from "@/generated/prisma/enums";

export interface EquipmentFilter {
  /** Prázdná množina = všechny stavy. */
  statuses: ReadonlySet<EquipmentStatus>;
  /** Prázdná množina = všechny typy. */
  types: ReadonlySet<EquipmentType>;
}

interface Filterable {
  tag: string;
  name: string;
  status: EquipmentStatus;
  type: EquipmentType;
}

export function matchesFilter(item: Filterable, filter: EquipmentFilter): boolean {
  return (
    (filter.statuses.size === 0 || filter.statuses.has(item.status)) &&
    (filter.types.size === 0 || filter.types.has(item.type))
  );
}

/** Normalizace pro hledání bez ohledu na velikost písmen, diakritiku a pomlčky. */
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[\s-]+/g, "")
    .toLowerCase();

/** Hledání podle tagu nebo názvu; tagy začínající dotazem mají přednost. */
export function searchEquipment<T extends Filterable>(items: T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return [];
  const score = (item: T) => {
    const tag = normalizeSearch(item.tag);
    if (tag === q) return 0;
    if (tag.startsWith(q)) return 1;
    if (tag.includes(q)) return 2;
    if (normalizeSearch(item.name).includes(q)) return 3;
    return -1;
  };
  return items
    .map((item) => ({ item, rank: score(item) }))
    .filter(({ rank }) => rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.item.tag.localeCompare(b.item.tag))
    .map(({ item }) => item);
}
