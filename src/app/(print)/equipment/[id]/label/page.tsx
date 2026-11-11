import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { QrLabelFace, QrSquareLabel } from "@/components/equipment/QrLabelFace";
import { summarizeInspections } from "@/lib/inspection";
import { LABEL_SIZE_MM, squareLabelOf } from "@/lib/qr-label";
import { buildLabelData } from "@/server/equipment-label";
import { getEquipmentLabel } from "@/server/queries/equipment";
import { getCurrentAccount } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/equipment/[id]/label">): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipmentLabel(id);
  return { title: equipment ? `Štítek ${equipment.tag}` : "Štítek" };
}

// Ořezaný tisk štítku pro štítkovače (62 × 29 mm): stránka = štítek, bez okrajů, záhlaví a zápatí prohlížeče.
// Fáze 92: `?format=20` / `?format=40` = čtvercový štítek na stroj 20 × 20 / 40 × 40 mm.
export default async function LabelPrintPage({ params, searchParams }: PageProps<"/equipment/[id]/label">) {
  const [{ id }, { format }] = await Promise.all([params, searchParams]);
  const square = squareLabelOf(format);
  const [equipment, account] = await Promise.all([getEquipmentLabel(id), getCurrentAccount()]);
  if (!equipment || !account.canSee(equipment.type)) notFound();
  const label = await buildLabelData(equipment, summarizeInspections(equipment.inspections));
  const { width, height } = square ? { width: square, height: square } : LABEL_SIZE_MM;

  return (
    <div className="label-print flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <style>{`
        @page { size: ${width}mm ${height}mm; margin: 0; }
        @media print {
          html, body { background: #fff !important; min-height: 0 !important; }
          body { margin: 0; }
          .label-print { padding: 0 !important; gap: 0 !important; display: block !important; }
          .label-print .no-print { display: none !important; }
          .label-print .qr-label { width: ${width}mm !important; height: ${height}mm !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <PrintToolbar
        className="max-w-[34rem]"
        hint={
          <>
            Štítek <span className="font-mono text-foreground">{equipment.tag}</span> · {width} × {height} mm. V dialogu tisku zvolte štítkovač, měřítko 100 % a vypněte záhlaví a zápatí.
          </>
        }
      />
      {square ? <QrSquareLabel label={label} size={square} className="w-full max-w-[18rem] shadow-xl shadow-black/50" /> : <QrLabelFace label={label} className="w-full max-w-[34rem] shadow-xl shadow-black/50" />}
    </div>
  );
}
