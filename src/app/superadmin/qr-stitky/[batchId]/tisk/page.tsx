import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LabelPrintSheet, PRINT_PAGE_LIMIT, labelPrintCss } from "@/components/qr/LabelPrintSheet";
import { LabelPrintToolbar } from "@/components/qr/LabelPrintToolbar";
import { prisma } from "@/lib/prisma";
import { labelPurpose, purposeLabel, sequenceOf, serialCode } from "@/lib/qr-label-registry";
import { isSuperadmin } from "@/server/superadmin-session";

export const metadata: Metadata = { title: "Tisk QR štítků" };

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");

/**
 * Fáze 103: tisk série QR štítků ELDOCK – kotouč Zebra ZD421t (PDF 1:1, stránka = rozměr štítku) nebo arch A4;
 * `?kod=EL-000123` dotiskne jeden štítek ze série, `?od=…&do=…` rozsah (velká série po 500 kusech).
 */
export default async function LabelBatchPrintPage({ params, searchParams }: PageProps<"/superadmin/qr-stitky/[batchId]/tisk">) {
  if (!(await isSuperadmin())) notFound();
  const [{ batchId }, query] = await Promise.all([params, searchParams]);
  const batch = await prisma.qrLabelBatch.findUnique({ where: { id: batchId } });
  if (!batch) notFound();
  const format = query.format === "a4" ? "a4" : "roll";
  const single = sequenceOf(text(query.kod));
  if (text(query.kod) && (single === null || single < batch.firstSequence || single > batch.lastSequence)) notFound();
  const from = single ?? Math.max(batch.firstSequence, sequenceOf(text(query.od)) ?? batch.firstSequence);
  const to = single ?? Math.min(batch.lastSequence, sequenceOf(text(query.do)) ?? batch.lastSequence);
  const pageTo = Math.min(to, from + PRINT_PAGE_LIMIT - 1);
  const codes = Array.from({ length: Math.max(0, pageTo - from + 1) }, (_, index) => serialCode(from + index));
  const spec = labelPurpose(batch.purpose);
  const base = `/superadmin/qr-stitky/${batch.id}/tisk`;
  const keep = single !== null ? `kod=${serialCode(single)}` : `od=${serialCode(from)}&do=${serialCode(to)}`;
  return (
    <div className="flex flex-col gap-4" data-testid="label-print-page" data-format={format}>
      <style>{labelPrintCss(batch.purpose, format)}</style>
      <div className="no-print space-y-2">
        <Link href="/superadmin?tab=qr" className="text-sm underline">
          ↩ Generátor QR štítků ELDOCK
        </Link>
        <h1 className="text-xl font-semibold">
          {single !== null ? `Dotisk štítku ${serialCode(single)}` : `Série ${serialCode(batch.firstSequence)} – ${serialCode(batch.lastSequence)}`} · {batch.companyName}
        </h1>
        <p className="text-sm text-muted-foreground">{purposeLabel(batch.purpose)}</p>
        <LabelPrintToolbar
          batchId={single === null ? batch.id : undefined}
          hint={
            format === "roll"
              ? `🖨️ Kotouč Zebra ZD421t (termotransfer 300 DPI): PDF 1:1 – každý štítek na vlastní stránce ${spec.widthMm} × ${spec.heightMm} mm. V dialogu tisku zvolte tiskárnu Zebra, papír ${spec.widthMm} × ${spec.heightMm} mm, bez okrajů a měřítko 100 % (nebo „Uložit jako PDF“).`
              : `📄 Samolepicí arch A4: štítky ${spec.widthMm} × ${spec.heightMm} mm v mřížce s rozestupem 2 mm a ořezovou čarou, měřítko 100 %.`
          }
        />
        <div className="flex flex-wrap gap-3 text-sm">
          <a href={`${base}?format=roll&${keep}`} className="underline" data-testid="label-format-roll">
            🖨️ Kotouč Zebra 1:1
          </a>
          <a href={`${base}?format=a4&${keep}`} className="underline" data-testid="label-format-a4">
            📄 Arch A4
          </a>
          <a href={`/superadmin/qr-stitky/${batch.id}/zpl`} className="underline" data-testid="label-zpl">
            ⬇️ ZPL kód pro Zebra ZD421t
          </a>
        </div>
        {to > pageTo ? (
          <p className="text-sm text-amber-200">
            Série má {to - from + 1} štítků – tato stránka tiskne {serialCode(from)} až {serialCode(pageTo)}.{" "}
            <a href={`${base}?format=${format}&od=${serialCode(pageTo + 1)}&do=${serialCode(to)}`} className="underline">
              Další rozsah od {serialCode(pageTo + 1)}
            </a>
          </p>
        ) : null}
      </div>
      <LabelPrintSheet codes={codes} purpose={batch.purpose} companyName={batch.companyName} format={format} />
    </div>
  );
}
