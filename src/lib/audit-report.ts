import type { EquipmentType } from "@/generated/prisma/enums";

import type { InspectionState } from "./inspection";
import { MAP_LAYERS, layerOf, type LayerKey } from "./map-layers";

// Auditní report (TIČR / ISO): % shody závodu a přehled revizí podle kategorií.
// „Ve shodě“ = zařízení má platnou výchozí / pravidelnou revizi (i když brzy končí).

interface AuditInput {
  type: EquipmentType;
  state: InspectionState;
}

export interface AuditBucket {
  total: number;
  valid: number;
  expiring: number;
  /** Propadlé, vyřazené z provozu nebo bez revize. */
  nonCompliant: number;
  /** % shody (platné + končící) zaokrouhlené na 1 desetinné místo; bez zařízení 100 %. */
  percent: number;
}

const percentOf = (part: number, total: number) => (total ? Math.round((part / total) * 1000) / 10 : 100);

function bucket(items: readonly AuditInput[]): AuditBucket {
  const valid = items.filter((item) => item.state === "VALID").length;
  const expiring = items.filter((item) => item.state === "EXPIRING").length;
  return { total: items.length, valid, expiring, nonCompliant: items.length - valid - expiring, percent: percentOf(valid + expiring, items.length) };
}

export function summarizeAudit(items: readonly AuditInput[]): { overall: AuditBucket; byLayer: (AuditBucket & { key: LayerKey; label: string })[] } {
  return {
    overall: bucket(items),
    byLayer: MAP_LAYERS.map((layer) => ({ key: layer.key, label: layer.label, ...bucket(items.filter((item) => layerOf(item.type) === layer.key)) })).filter(
      (entry) => entry.total > 0,
    ),
  };
}
