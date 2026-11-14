import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { BRAND } from "@/lib/brand";
import { DEFAULT_PURCHASE_HORIZON, isPurchaseHorizon, machinesText } from "@/lib/lifespan-purchase";
import { getPurchaseReport } from "@/server/queries/lifespan";
import { getPlants } from "@/server/queries/plant";
import { getCurrentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Nákupní report součástek – tisk" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const czDate = (value: Date | null) => (value ? value.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "–");

/** Fáze 116: nákupní report prediktivní údržby k tisku / do PDF (A4 na šířku). */
export default async function PurchaseReportPrintPage({ searchParams }: PageProps<"/nakupni-report/tisk">) {
  const [query, account, plants] = await Promise.all([searchParams, getCurrentAccount(), getPlants()]);
  if (!account.can("submitChange")) notFound();
  const plant = plants.find((entry) => entry.id === first(query.zavod));
  if (!plant) notFound();
  const requested = Number(first(query.vyhled));
  const horizon = isPurchaseHorizon(requested) ? requested : DEFAULT_PURCHASE_HORIZON;
  const { report } = await getPurchaseReport(plant.id, horizon, account.types);
  return (
    <div className="protocol-print flex flex-1 flex-col items-center gap-4 p-4 sm:p-6">
      <style>{`
        @page { size: A4 landscape; margin: 10mm 10mm; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; display: block !important; }
          main { display: block !important; }
          .protocol-print { display: block !important; padding: 0 !important; }
          .protocol-print .no-print { display: none !important; }
          .protocol-print .sheet { width: auto !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; }
        }
      `}</style>
      <PrintToolbar className="max-w-[297mm]" hint={`Nákupní report ${plant.name} · výhled +${horizon} dní · A4 na šířku. Pro PDF zvolte v dialogu tisku „Uložit jako PDF“.`} />
      <article className="sheet flex w-full max-w-[297mm] flex-col gap-3 bg-white p-[10mm] text-[9pt] leading-snug text-black shadow-2xl shadow-black/50" data-testid="purchase-print">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-2">
          <div>
            <p className="text-[7.5pt] font-semibold tracking-[0.12em] text-zinc-600 uppercase">Prediktivní údržba · konsolidovaná objednávka náhradních dílů</p>
            <h1 className="text-[15pt] font-bold">📦 Nákupní report – {plant.name}</h1>
            <p>
              Výhled nákupu +{report.horizonDays} dní · {report.totals.lines} objednacích čísel · {report.totals.needed} ks k výměně · <b>{report.totals.toOrder} ks nutno doobjednat</b>
            </p>
            {report.trigger ? (
              <p className="text-zinc-600">
                Spuštěno: {report.trigger.tag} {report.trigger.designation} ({report.trigger.partNumber ?? report.trigger.description}) – {report.trigger.expired ? "po konci životnosti" : `zbývá ${report.trigger.remainingDays} dní`}
              </p>
            ) : (
              <p className="text-zinc-600">Žádná součástka zatím nedosáhla předstihu upozornění.</p>
            )}
          </div>
          <p className="text-right text-[7.5pt] text-zinc-600">
            {BRAND.name} ({BRAND.domain})
            <br />
            Vystaveno {czDate(report.generatedAt)}
          </p>
        </header>
        <table className="w-full border-collapse text-[8.5pt]">
          <thead>
            <tr>
              {["Výrobce", "Objednací číslo", "Popis", "Potřeba [ks]", "Skladem [ks]", "Doobjednat [ks]", "Nejbližší výměna", "Stroje a pozice"].map((head) => (
                <th key={head} className="border border-zinc-400 px-1.5 py-1 text-left">
                  {head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.lines.map((line) => (
              <tr key={line.partKey}>
                <td className="border border-zinc-400 px-1.5 py-1">{line.manufacturer ?? "–"}</td>
                <td className="border border-zinc-400 px-1.5 py-1 font-mono font-semibold">{line.partNumber}</td>
                <td className="border border-zinc-400 px-1.5 py-1">{line.description}</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right">{line.needed}</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right">{line.inStock}</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right font-bold">{line.toOrder}</td>
                <td className="border border-zinc-400 px-1.5 py-1">{line.nearestDays !== null && line.nearestDays <= 0 ? "ihned" : czDate(line.nearestDate)}</td>
                <td className="border border-zinc-400 px-1.5 py-1">{machinesText(line)}</td>
              </tr>
            ))}
            {report.withoutPartNumber.map((row) => (
              <tr key={`${row.equipmentId}-${row.designation}`}>
                <td className="border border-zinc-400 px-1.5 py-1">{row.manufacturer ?? "–"}</td>
                <td className="border border-zinc-400 px-1.5 py-1 italic">bez objednacího čísla</td>
                <td className="border border-zinc-400 px-1.5 py-1">{row.description}</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right">{row.quantity}</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right">–</td>
                <td className="border border-zinc-400 px-1.5 py-1 text-right">–</td>
                <td className="border border-zinc-400 px-1.5 py-1">{row.expired ? "ihned" : czDate(row.endDate)}</td>
                <td className="border border-zinc-400 px-1.5 py-1">
                  {row.tag} {row.designation} ({row.buildingName})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
