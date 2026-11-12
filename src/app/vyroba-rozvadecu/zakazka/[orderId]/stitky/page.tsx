import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { LabelSheet } from "@/components/panel-builder/LabelSheet";
import { PrintButton } from "@/components/panel-builder/manufacturing/PrintButton";
import { LabelPrintSheet } from "@/components/qr/LabelPrintSheet";
import { railCapacities } from "@/lib/panel-builder/rails";
import { vectorDeviceFrom } from "@/lib/panel-builder/vector-symbols";
import { prisma } from "@/lib/prisma";
import { getManufacturer } from "@/server/manufacturer-session";
import { getPanelProjectById } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "Štítky rozváděče – portál výrobců ELDOCK", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Fáze 106: samolepicí štítky přístrojů (popisky jističů) a stříbrný QR štítek ELDOCK zakázky (50 × 25 mm, vektorově –
 * tisk 1 : 1 v libovolném rozlišení, PDF z prohlížeče) – jen pro výrobce, který zakázku přijal.
 */
export default async function ManufacturerLabelsPage({ params }: PageProps<"/vyroba-rozvadecu/zakazka/[orderId]/stitky">) {
  const manufacturer = await getManufacturer();
  if (!manufacturer) redirect("/vyroba-rozvadecu");
  const { orderId } = await params;
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: orderId, manufacturerId: manufacturer.id }, select: { projectId: true, number: true, qrSerial: true } });
  if (!order) notFound();
  const project = await getPanelProjectById(order.projectId);
  if (!project) notFound();
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6" data-testid="manufacturer-labels">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { background: #fff !important; }
          header, nav, footer, .no-print { display: none !important; }
          main { padding: 0 !important; max-width: none !important; display: block !important; }
          .label-sheet { box-shadow: none !important; margin: 0 0 6mm !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Zakázka {order.number} – štítky přístrojů a QR štítek <span className="font-mono">{order.qrSerial}</span>
        </h1>
        <PrintButton label="Tisk / PDF štítků" />
      </div>
      <LabelPrintSheet codes={[order.qrSerial]} purpose="SWITCHBOARD" companyName={project.company?.companyName ?? null} format="a4" />
      <LabelSheet code={project.code} name={project.name} capacities={railCapacities(project)} devices={project.items.map((item) => ({ ...vectorDeviceFrom(item), phaseAssignment: item.phaseAssignment, parentItemId: item.parentItemId }))} />
    </main>
  );
}
