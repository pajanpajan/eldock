// Fáze 116: serializovatelná podoba řádku životnosti pro klienta (kusovník, diagnostika, Návody & Datasheety).

import { KIND_INFO, type ComponentKind, type LifespanRow, type ParamSource } from "./bom-lifespan";
import { partKeyOf } from "./component-datasheets";
import type { LifespanAssessment, LifespanLimit, LifespanStatus, WearCategory } from "./component-lifespan";
import { buildDatasheetView, type CatalogPart, type DatasheetView } from "./datasheet-view";

export interface LifespanRowView {
  key: string;
  designation: string;
  position: number | null;
  description: string;
  manufacturer: string | null;
  partNumber: string | null;
  quantity: number;
  unit: string;
  note: string | null;
  kind: ComponentKind;
  kindLabel: string;
  category: WearCategory | null;
  componentId: string | null;
  inBom: boolean;
  limitSource: ParamSource;
  rateSource: ParamSource;
  basis: string;
  stock: number;
  /** Sklad závodu podle MPN (sdílený všemi stroji). */
  sharedStock: boolean;
  alertLeadDays: number;
  ownLead: boolean;
  cyclesPerHour: number | null;
  usesCycles: boolean;
  usesHours: boolean;
  hoursReading: number | null;
  notes: string | null;
  assessment: {
    status: LifespanStatus;
    wearPercent: number;
    remainingPercent: number;
    overrunPercent: number;
    expired: boolean;
    alert: boolean;
    remainingDays: number | null;
    endDate: string | null;
    operatingHours: number;
    totalCycles: number | null;
    limits: LifespanLimit[];
    thermalDerating: LifespanAssessment["thermalDerating"];
    missingStock: boolean;
  } | null;
  datasheet: DatasheetView | null;
}

const finite = (value: number) => (Number.isFinite(value) ? value : null);

export function toRowView(entry: { row: LifespanRow; assessment: LifespanAssessment | null; stock: number; alertLeadDays: number }, catalog: ReadonlyMap<string, CatalogPart>): LifespanRowView {
  const { row, assessment } = entry;
  const key = partKeyOf(row.partNumber);
  return {
    key: row.key,
    designation: row.designation,
    position: row.position,
    description: row.description,
    manufacturer: row.manufacturer,
    partNumber: row.partNumber,
    quantity: row.quantity,
    unit: row.unit,
    note: row.note,
    kind: row.kind,
    kindLabel: KIND_INFO[row.kind].label,
    category: row.category,
    componentId: row.componentId,
    inBom: row.inBom,
    limitSource: row.limitSource,
    rateSource: row.rateSource,
    basis: row.basis,
    stock: entry.stock,
    sharedStock: Boolean(key),
    alertLeadDays: entry.alertLeadDays,
    ownLead: row.alertLeadDays !== null,
    cyclesPerHour: row.model?.cyclesPerHour ?? null,
    usesCycles: Boolean(row.model?.maxElectricalCycles && row.model.cyclesPerHour !== null),
    usesHours: Boolean(row.model?.maxOperatingHours),
    hoursReading: row.model?.hoursReading ?? null,
    notes: row.notes,
    assessment: assessment
      ? {
          status: assessment.status,
          wearPercent: assessment.wearPercent,
          remainingPercent: assessment.remainingPercent,
          overrunPercent: assessment.overrunPercent,
          expired: assessment.expired,
          alert: assessment.alert,
          remainingDays: assessment.remainingDays,
          endDate: assessment.predictedReplacementDate?.toISOString() ?? null,
          operatingHours: assessment.operatingHours,
          totalCycles: assessment.totalCycles,
          limits: assessment.limits.map((limit) => ({ ...limit, remainingDays: finite(limit.remainingDays) ?? 0 })),
          thermalDerating: assessment.thermalDerating,
          missingStock: assessment.missingStock,
        }
      : null,
    datasheet: buildDatasheetView({ manufacturer: row.manufacturer, partNumber: row.partNumber, description: row.description, kind: row.kind }, key ? (catalog.get(key) ?? null) : null),
  };
}

/** Po životnosti nebo v okně upozornění (předstih / ≤ 15 %) – horní sekce Diagnostiky a odznak v hlavičce. */
export const isCriticalRow = (row: Pick<LifespanRowView, "assessment">) => Boolean(row.assessment && (row.assessment.expired || row.assessment.alert || row.assessment.status === "CRITICAL_EXPIRED"));

/** Jedinečné díly kusovníku s objednacím číslem (první pozice + seznam označení). */
export function bomDatasheetParts<T extends Pick<LifespanRowView, "partNumber" | "datasheet" | "designation">>(rows: readonly T[]) {
  const parts = new Map<string, { row: T; designations: string[] }>();
  for (const row of rows) {
    const key = partKeyOf(row.partNumber);
    if (!key || !row.datasheet) continue;
    const entry = parts.get(key);
    if (entry) entry.designations.push(row.designation);
    else parts.set(key, { row, designations: [row.designation] });
  }
  return [...parts.values()];
}

/** Počet ověřených technických listů součástek kusovníku – do popisku záložky Návody & Datasheety. */
export const verifiedDatasheetCount = (rows: readonly Pick<LifespanRowView, "partNumber" | "datasheet" | "designation">[]) => bomDatasheetParts(rows).filter((part) => part.row.datasheet?.verified).length;
