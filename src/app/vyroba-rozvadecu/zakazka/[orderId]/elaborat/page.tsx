import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentationSheets } from "@/components/panel-builder/documentation/DocumentationSheets";
import { PrintButton } from "@/components/panel-builder/manufacturing/PrintButton";
import { prisma } from "@/lib/prisma";
import { getManufacturer } from "@/server/manufacturer-session";
import { buildDocumentationData } from "@/server/panel-documentation";
import { getPanelProjectById } from "@/server/queries/panel-builder";
import { requestOrigin } from "@/server/request-url";

export const metadata: Metadata = { title: "Elaborát rozváděče – portál výrobců ELDOCK", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Fáze 106: 6listový elaborát a jednopólové schéma rozváděče zakázky k tisku / PDF – jen pro výrobce, který ji přijal. */
export default async function ManufacturerElaboratePage({ params }: PageProps<"/vyroba-rozvadecu/zakazka/[orderId]/elaborat">) {
  const manufacturer = await getManufacturer();
  if (!manufacturer) redirect("/vyroba-rozvadecu");
  const { orderId } = await params;
  const order = await prisma.manufacturingOrder.findFirst({ where: { id: orderId, manufacturerId: manufacturer.id }, select: { projectId: true, number: true } });
  if (!order) notFound();
  const project = await getPanelProjectById(order.projectId);
  if (!project) notFound();
  const { data } = await buildDocumentationData(project, await requestOrigin());
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6" data-testid="manufacturer-elaborate">
      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: #fff !important; }
          main { padding: 0 !important; max-width: none !important; display: block !important; }
          .no-print { display: none !important; }
          .doc-sheets { display: block !important; gap: 0 !important; }
          .doc-sheet { max-width: none !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; break-after: page; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .doc-sheet:last-child { break-after: auto; }
        }
      `}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Zakázka {order.number} – 6listový elaborát a schéma rozváděče {project.code}
        </h1>
        <PrintButton label="Tisk / PDF elaborátu" />
      </div>
      <DocumentationSheets data={data} />
    </main>
  );
}
