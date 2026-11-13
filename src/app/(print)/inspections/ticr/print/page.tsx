import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PrintToolbar } from "@/components/common/PrintToolbar";
import { InspectorStamp } from "@/components/inspections/InspectorStamp";
import { BRAND } from "@/lib/brand";
import { MONTH_PATTERN, sealTimestamp, shortHash } from "@/lib/revision-signature";
import { INSPECTION_RESULT } from "@/lib/status";
import { getTicrProfiles, getTicrReport } from "@/server/queries/ticr-report";
import { getCurrentAccount } from "@/server/session";
import { monthlyDigest } from "@/server/services/revision-signing";

export const metadata: Metadata = { title: "Měsíční výkaz revizí TIČR" };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Fáze 108: podepsaný měsíční výkaz revizí technika (A4 na šířku) – podklad pro fakturaci a evidenci pro TIČR.
// „Podepsaný“ = otisk SHA-256 nad obsahem výkazu (CSV), uložený podpis a razítko technika.
export default async function TicrPrintPage({ searchParams }: PageProps<"/inspections/ticr/print">) {
  const [account, query] = await Promise.all([getCurrentAccount(), searchParams]);
  if (!account.can("recordInspection")) notFound();
  const month = first(query.month) ?? "";
  if (!MONTH_PATTERN.test(month)) notFound();
  const profile = (await getTicrProfiles()).find((entry) => entry.id === first(query.profile));
  if (!profile) notFound();
  const report = await getTicrReport(profile, month);
  const digest = monthlyDigest(report);
  const issued = sealTimestamp(new Date());

  return (
    <div className="protocol-print flex flex-1 flex-col items-center gap-4 p-4 sm:p-6">
      <style>{`
        @page { size: A4 landscape; margin: 10mm 10mm; }
        @media print {
          html, body { background: #fff !important; height: auto !important; min-height: 0 !important; display: block !important; }
          main { display: block !important; }
          .protocol-print { display: block !important; padding: 0 !important; }
          .protocol-print .no-print { display: none !important; }
          .protocol-print .sheet { width: auto !important; min-height: 0 !important; box-shadow: none !important; padding: 0 !important; border: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
      <PrintToolbar className="max-w-[297mm]" hint={`Měsíční výkaz revizí ${report.label} · A4 na šířku. Pro PDF zvolte v dialogu tisku „Uložit jako PDF“.`} />
      <article className="sheet flex w-full max-w-[297mm] flex-col gap-3 bg-white p-[10mm] text-[8.5pt] leading-snug text-black shadow-2xl shadow-black/50" data-testid="ticr-print">
        <header className="flex items-start justify-between gap-6 border-b-2 border-black pb-2">
          <div>
            <p className="text-[7.5pt] font-semibold tracking-[0.12em] text-zinc-600 uppercase">Měsíční výkaz revizí · ochrana osvědčení TIČR</p>
            <h1 className="text-[15pt] font-bold">
              {profile.name} · osvědčení TIČR č. {profile.certificateNo}
            </h1>
            <p>
              {report.label} · {report.totals.count} záznamů (revize {report.totals.revisions}, kontroly spotřebičů / kusové zkoušky {report.totals.pieceTests}) · podepsáno {report.totals.signed} · zneplatněno {report.totals.flagged}
            </p>
            <p className="text-zinc-600">
              {[profile.company, profile.ico ? `IČO ${profile.ico}` : null, profile.authorizationNo ? `oprávnění TIČR ${profile.authorizationNo}` : null, profile.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="text-right text-[7.5pt] text-zinc-600">
            {BRAND.name} ({BRAND.domain})
            <br />
            Vystaveno {issued.local}
          </p>
        </header>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-black text-[7.5pt] uppercase text-zinc-600">
              <th className="py-1 pr-2">Datum a čas podpisu</th>
              <th className="py-1 pr-2">Závod / budova</th>
              <th className="py-1 pr-2">Zařízení · QR</th>
              <th className="py-1 pr-2">Zpráva</th>
              <th className="py-1 pr-2">Výsledek</th>
              <th className="py-1 pr-2">IP / zařízení</th>
              <th className="py-1 pr-2">SHA-256</th>
              <th className="py-1">Stav</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-300 align-top">
                <td className="py-1 pr-2">{sealTimestamp(row.at).local}</td>
                <td className="py-1 pr-2">
                  {row.plantName} / {row.buildingName}
                </td>
                <td className="py-1 pr-2">
                  {row.tag} – {row.name} · QR {row.hasQr ? "✓" : "–"}
                </td>
                <td className="py-1 pr-2 font-mono">{row.reportNumber}</td>
                <td className="py-1 pr-2">{INSPECTION_RESULT[row.result].label}</td>
                <td className="py-1 pr-2">
                  {row.ip ?? "–"} · {row.device ?? "–"}
                </td>
                <td className="py-1 pr-2 font-mono">{shortHash(row.sealHash)}</td>
                <td className="py-1 font-semibold">{row.flaggedAt ? "⛔ ZNEPLATNĚNO" : row.signed ? "podepsáno" : "nepodepsáno"}</td>
              </tr>
            ))}
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-3 text-center text-zinc-600">
                  V měsíci {report.label} žádné záznamy.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <footer className="mt-auto flex items-end justify-between gap-6 border-t border-zinc-400 pt-2">
          <div className="space-y-0.5 text-[7.5pt] text-zinc-700">
            <p className="font-mono break-all" data-testid="ticr-digest">
              Otisk výkazu SHA-256: {digest}
            </p>
            <p>Otisk se počítá z obsahu výkazu (stejná data jako export CSV) – jakákoli změna řádku změní otisk.</p>
            {report.foreignCount ? <p className="font-semibold">Pozor: {report.foreignCount} dalších záznamů pod tímto číslem osvědčení mimo závody účtu.</p> : null}
          </div>
          <div className="flex items-end gap-3">
            {profile.signatureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- uložený podpis technika
              <img src={profile.signatureUrl} alt={`Podpis – ${profile.name}`} className="h-16 max-w-[60mm] object-contain" />
            ) : null}
            <InspectorStamp profile={profile} size={84} />
          </div>
        </footer>
      </article>
    </div>
  );
}
