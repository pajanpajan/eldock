// Editovatelný kusovník nové revize (CAE). Řádky drží text z formuláře; převod
// na data pro `uploadRevisionAction` a porovnání s kusovníkem platné revize.

export interface BomSource {
  designation: string;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
}

export interface BomDraftRow {
  key: string;
  /** Klíč původní položky (z platné revize); `null` = nově přidaný řádek. */
  originalKey: string | null;
  designation: string;
  description: string;
  manufacturer: string;
  partNumber: string;
  quantity: string;
  unit: string;
  note: string;
}

export type BomField = Exclude<keyof BomDraftRow, "key" | "originalKey">;
export const BOM_FIELDS: readonly BomField[] = ["designation", "description", "manufacturer", "partNumber", "quantity", "unit", "note"];

const quantityText = (quantity: number) => String(quantity).replace(".", ",");

export function bomDraftFrom(items: readonly BomSource[]): BomDraftRow[] {
  return items.map((item, index) => ({
    key: `orig-${index}`,
    originalKey: `orig-${index}`,
    designation: item.designation,
    description: item.description,
    manufacturer: item.manufacturer ?? "",
    partNumber: item.partNumber ?? "",
    quantity: quantityText(item.quantity),
    unit: item.unit,
    note: item.note ?? "",
  }));
}

export const emptyBomRow = (key: string): BomDraftRow => ({
  key,
  originalKey: null,
  designation: "",
  description: "",
  manufacturer: "",
  partNumber: "",
  quantity: "1",
  unit: "ks",
  note: "",
});

export function parseQuantity(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return quantity > 0 ? quantity : null;
}

export type RowChange = "new" | "changed" | "same";

/** Změněná pole řádku proti původní položce. */
export function changedFields(row: BomDraftRow, originals: ReadonlyMap<string, BomDraftRow>): BomField[] {
  const original = row.originalKey ? originals.get(row.originalKey) : undefined;
  if (!original) return [...BOM_FIELDS];
  return BOM_FIELDS.filter((field) =>
    field === "quantity"
      ? parseQuantity(row.quantity) !== parseQuantity(original.quantity)
      : row[field].trim() !== original[field].trim(),
  );
}

export function rowChange(row: BomDraftRow, originals: ReadonlyMap<string, BomDraftRow>): RowChange {
  if (!row.originalKey || !originals.has(row.originalKey)) return "new";
  return changedFields(row, originals).length ? "changed" : "same";
}

/** Původní položky, které v návrhu chybí (odebrané). */
export function removedRows(rows: readonly BomDraftRow[], originals: readonly BomDraftRow[]): BomDraftRow[] {
  const kept = new Set(rows.map((row) => row.originalKey));
  return originals.filter((original) => !kept.has(original.key));
}

/** Česká chyba pro první nevalidní řádek, jinak `null`. */
export function validateBomDraft(rows: readonly BomDraftRow[]): string | null {
  for (const [index, row] of rows.entries()) {
    const label = `Řádek ${index + 1}${row.designation.trim() ? ` (${row.designation.trim()})` : ""}`;
    if (!row.designation.trim()) return `${label}: doplňte označení.`;
    if (!row.description.trim()) return `${label}: doplňte popis.`;
    if (parseQuantity(row.quantity) === null) return `${label}: množství musí být kladné číslo.`;
  }
  return null;
}

/** Data pro `uploadRevisionAction` (předpokládá validní návrh). */
export function toBomInput(rows: readonly BomDraftRow[]) {
  return rows.map((row) => ({
    designation: row.designation.trim(),
    description: row.description.trim(),
    manufacturer: row.manufacturer.trim() || null,
    partNumber: row.partNumber.trim() || null,
    quantity: parseQuantity(row.quantity) ?? 1,
    unit: row.unit.trim() || "ks",
    note: row.note.trim() || null,
  }));
}

/** Označení prvků, které se v návrhu liší od platné revize (nové, změněné, odebrané). */
export function changedDesignations(rows: readonly BomDraftRow[], originals: readonly BomDraftRow[]): string[] {
  const byKey = new Map(originals.map((row) => [row.key, row]));
  const result = new Set<string>();
  for (const row of rows) if (rowChange(row, byKey) !== "same" && row.designation.trim()) result.add(row.designation.trim());
  for (const row of removedRows(rows, originals)) result.add(row.designation);
  return [...result];
}
