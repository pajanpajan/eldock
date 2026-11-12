import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { panelBuilderGuard } from "@/components/panel-builder/access";
import { LabelPrintSheet, labelPrintCss } from "@/components/qr/LabelPrintSheet";
import { LabelPrintToolbar } from "@/components/qr/LabelPrintToolbar";
import { getPanelProject } from "@/server/queries/panel-builder";

export const metadata: Metadata = { title: "Tisk QR štítku rozváděče" };

/** Fáze 103: tisk QR štítku ELDOCK rozváděče 50 × 25 mm – kotouč Zebra ZD421t (PDF 1:1) nebo arch A4. */
export default async function ProjectQrLabelPrintPage({ params, searchParams }: PageProps<"/panel-builder/[id]/labels/qr">) {
  const guard = await panelBuilderGuard();
  if (guard) return guard;
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const project = await getPanelProject(id);
  if (!project?.qrSerial) notFound();
  const format = query.format === "a4" ? "a4" : "roll";
  return (
    <div className="flex flex-col gap-4" data-testid="project-qr-print" data-format={format}>
      <style>{labelPrintCss("SWITCHBOARD", format)}</style>
      <div className="no-print space-y-2">
        <Link href={`/panel-builder/${project.id}/labels`} className="text-sm underline">
          ↩ Popisky a štítky rozváděče {project.code}
        </Link>
        <LabelPrintToolbar
          hint={
            format === "roll"
              ? "🖨️ Kotouč Zebra ZD421t (300 DPI): štítek 50 × 25 mm na vlastní stránce – v dialogu tisku zvolte tiskárnu Zebra, papír 50 × 25 mm, bez okrajů a měřítko 100 % (nebo „Uložit jako PDF“)."
              : "📄 Samolepicí arch A4 – štítek 50 × 25 mm v levém horním rohu, měřítko 100 %."
          }
        />
      </div>
      <LabelPrintSheet codes={[project.qrSerial]} purpose="SWITCHBOARD" companyName={project.company?.companyName ?? null} format={format} />
    </div>
  );
}
