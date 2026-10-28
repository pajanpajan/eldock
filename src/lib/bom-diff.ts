// Porovnání kusovníků dvou revizí (schvalování údržbou). Položky se párují podle označení
// (při duplicitách podle pořadí výskytu). Čisté funkce.

export interface BomDiffItem {
  designation: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
}

export type BomDiffField = "description" | "manufacturer" | "partNumber" | "quantity" | "unit" | "note";
const FIELDS: readonly BomDiffField[] = ["description", "manufacturer", "partNumber", "quantity", "unit", "note"];

export type BomDiffKind = "added" | "removed" | "changed" | "same";

export interface BomDiffRow {
  key: string;
  designation: string;
  kind: BomDiffKind;
  before: BomDiffItem | null;
  after: BomDiffItem | null;
  fields: BomDiffField[];
}

const keyed = (items: readonly BomDiffItem[]) => {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const n = seen.get(item.designation) ?? 0;
    seen.set(item.designation, n + 1);
    return [`${item.designation}#${n}`, item] as const;
  });
};

const norm = (value: string | number | null) => (typeof value === "string" ? value.trim() : value) ?? null;

/** Řádky v pořadí nové revize; odebrané položky se vloží za svého předchůdce ze staré revize. */
export function diffBom(before: readonly BomDiffItem[], after: readonly BomDiffItem[]): BomDiffRow[] {
  const oldEntries = keyed(before);
  const oldMap = new Map(oldEntries);
  const newEntries = keyed(after);
  const newKeys = new Set(newEntries.map(([key]) => key));

  const rows: BomDiffRow[] = newEntries.map(([key, item]) => {
    const previous = oldMap.get(key) ?? null;
    if (!previous) return { key, designation: item.designation, kind: "added", before: null, after: item, fields: [] };
    const fields = FIELDS.filter((field) => norm(previous[field]) !== norm(item[field]));
    return { key, designation: item.designation, kind: fields.length ? "changed" : "same", before: previous, after: item, fields };
  });

  oldEntries.forEach(([key, item], index) => {
    if (newKeys.has(key)) return;
    const removed: BomDiffRow = { key, designation: item.designation, kind: "removed", before: item, after: null, fields: [] };
    // Za poslední předchozí položku staré revize, která v novém seznamu je.
    let position = 0;
    for (let i = index - 1; i >= 0; i--) {
      const at = rows.findIndex((row) => row.key === oldEntries[i][0]);
      if (at !== -1) {
        position = at + 1;
        break;
      }
    }
    rows.splice(position, 0, removed);
  });
  return rows;
}

export function summarizeBomDiff(rows: readonly BomDiffRow[]) {
  return {
    added: rows.filter((row) => row.kind === "added").length,
    removed: rows.filter((row) => row.kind === "removed").length,
    changed: rows.filter((row) => row.kind === "changed").length,
  };
}
