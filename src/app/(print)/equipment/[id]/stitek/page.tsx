import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { EquipmentIdLabel } from "@/components/equipment/EquipmentIdLabel";
import { idLabelData, idLabelSize } from "@/lib/equipment-id-label";
import { summarizeInspections } from "@/lib/inspection";
import { prisma } from "@/lib/prisma";
import { ensureEquipmentLabel } from "@/server/services/qr-labels";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

export const metadata: Metadata = { title: "Identifikační štítek zařízení" };

/**
 * Fáze 111: tisk přehledného identifikačního štítku zařízení na kotouč Zebra ZD421t (`?rozmer=50x25` / `30x15`) –
 * stránka = štítek (PDF 1:1), unikátní QR kód EL-xxxxxx z registru štítků (přidělí se při prvním tisku).
 */
export default async function EquipmentIdLabelPage({ params, searchParams }: PageProps<"/equipment/[id]/stitek">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const size = idLabelSize(query.rozmer);
  const account = await getCurrentAccount();
  try {
    await assertTenantAccess({ equipmentId: id });
  } catch {
    notFound();
  }
  const equipment = await prisma.equipment.findUnique({
    where: { id },
    select: {
      id: true,
      tag: true,
      name: true,
      type: true,
      manufacturer: true,
      model: true,
      serialNumber: true,
      protectionClass: true,
      usageGroup: true,
      assignedZone: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
      inspections: { where: { misuseFlaggedAt: null }, select: { type: true, inspectionDate: true, validUntil: true, result: true } },
    },
  });
  if (!equipment || !account.canSee(equipment.type)) notFound();
  const serial = await ensureEquipmentLabel(prisma, equipment.id);
  const label = idLabelData(equipment, { serial, building: equipment.floor.building.name, floor: equipment.floor.name, validUntil: summarizeInspections(equipment.inspections).validUntil });

  return (
    <div className="label-print flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <style>{`
        @page { size: ${size.widthMm}mm ${size.heightMm}mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; min-height: 0 !important; }
          body { margin: 0; }
          .label-print { padding: 0 !important; gap: 0 !important; display: block !important; }
          .label-print .no-print { display: none !important; }
          .label-print .id-label { width: ${size.widthMm}mm !important; height: ${size.heightMm}mm !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <PrintToolbar
        className="max-w-[34rem]"
        hint={
          <>
            Štítek <span className="font-mono text-foreground">{serial}</span> · {equipment.tag} · {size.title}. Kotouč Zebra ZD421t (300 DPI): měřítko 100 %, bez záhlaví a zápatí.
          </>
        }
      />
      <EquipmentIdLabel label={label} size={size.id} className="w-full max-w-[34rem] shadow-xl shadow-black/50" />
    </div>
  );
}
