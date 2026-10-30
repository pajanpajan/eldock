import "server-only";

import type { LabelData } from "@/components/equipment/QrLabelFace";
import { formatDate } from "@/lib/format";
import type { InspectionSummary } from "@/lib/inspection";
import { labelUrl } from "@/lib/qr-label";

import { requestOrigin } from "./request-url";

/** Data QR štítku pro náhled v kartě i tiskovou stránku. */
export async function buildLabelData(
  equipment: { id: string; tag: string; name: string; qrToken: string | null },
  inspection: InspectionSummary,
): Promise<LabelData> {
  return {
    url: labelUrl(await requestOrigin(), equipment.id, equipment.qrToken),
    tag: equipment.tag,
    name: equipment.name,
    equipmentId: equipment.id,
    token: equipment.qrToken,
    validity: inspection.validUntil ? `Revize do ${formatDate(inspection.validUntil)}` : "Bez platné revize",
  };
}
