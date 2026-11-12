import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { purposeLabel, serialCode } from "@/lib/qr-label-registry";
import { labelBatches } from "@/server/services/qr-labels";

import { QrBatchForm } from "./QrBatchForm";

const th = "px-2 py-1.5 text-left font-medium";
const td = "px-2 py-1.5 align-top";

/**
 * Fáze 103: velín „🏷️ Generátor QR štítků ELDOCK“ – registr globálně unikátních štítků EL-xxxxxx (atomické počítadlo,
 * UNIQUE v databázi), nová série pro firmu, tisk 1:1 na kotouč Zebra ZD421t / arch A4 / ZPL a historie sérií
 * s počtem štítků aktivovaných v terénu a dotiskem.
 */
export async function QrLabelsTab() {
  const [counter, batches, companies, items] = await Promise.all([
    prisma.qrLabelCounter.findUnique({ where: { id: 1 } }),
    labelBatches(prisma, 200),
    prisma.registeredCompany.findMany({ where: { closedAt: null }, orderBy: { companyName: "asc" }, take: 500, select: { id: true, companyName: true, ico: true, email: true } }),
    prisma.qrLabelItem.count(),
  ]);
  const last = counter?.lastSequenceNumber ?? 0;
  return (
    <section className="flex flex-col gap-4" data-testid="qr-labels-tab">
      <div>
        <h2 className="text-lg font-semibold">🏷️ Generátor QR štítků ELDOCK</h2>
        <p className="text-sm text-muted-foreground" data-testid="qr-registry-state">
          Registr: posledně vydané číslo <span className="font-mono">{last ? serialCode(last) : "—"}</span> · vydáno {items} štítků · QR kód s korekcí chyb H (30 %) a logem EL uprostřed vede na https://eldock.cz/q/EL-xxxxxx. Žádné číslo se nikdy
          nevydá dvakrát (počítadlo jen roste, sériové číslo je v databázi UNIQUE). API: <span className="font-mono">GET / POST /api/qr-labels</span>.
        </p>
      </div>
      <QrBatchForm companies={companies} nextSequence={last + 1} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm" data-testid="qr-batch-history">
          <caption className="px-2 py-2 text-left font-semibold">Historie vydaných sérií</caption>
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className={th}>Rozsah</th>
              <th className={th}>Firma</th>
              <th className={th}>Účel a rozměr</th>
              <th className={th}>Ks</th>
              <th className={th}>Aktivováno v terénu</th>
              <th className={th}>Vydáno / vytištěno</th>
              <th className={th}>Tisk a dotisk</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr key={batch.id} className="border-t border-border" data-testid="qr-batch-row" data-from={batch.from} data-to={batch.to}>
                <td className={`${td} font-mono`}>
                  {batch.from}
                  {batch.count > 1 ? ` – ${batch.to}` : ""}
                </td>
                <td className={td}>
                  <div className="font-medium">{batch.companyName}</div>
                  <div className="text-xs text-muted-foreground">
                    {batch.ico ? `IČO ${batch.ico}` : "bez IČO"}
                    {batch.email ? ` · ${batch.email}` : ""}
                    {batch.registeredCompanyId ? " · ✓ registrovaná firma" : ""}
                  </div>
                  {batch.note ? <div className="text-xs text-muted-foreground">{batch.note}</div> : null}
                </td>
                <td className={`${td} text-xs`}>{purposeLabel(batch.purpose)}</td>
                <td className={`${td} font-mono`}>{batch.count}</td>
                <td className={`${td} font-mono`} data-testid="qr-batch-activated">
                  {batch.activated} / {batch.count}
                </td>
                <td className={`${td} text-xs`}>
                  {formatDate(batch.createdAt)}
                  <div className="text-muted-foreground">{batch.printedAt ? `vytištěno ${formatDate(batch.printedAt)}` : "zatím netištěno"}</div>
                </td>
                <td className={td}>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <a href={`/superadmin/qr-stitky/${batch.id}/tisk?format=roll`} target="_blank" rel="noreferrer" className="underline">
                      🖨️ Kotouč 1:1
                    </a>
                    <a href={`/superadmin/qr-stitky/${batch.id}/tisk?format=a4`} target="_blank" rel="noreferrer" className="underline">
                      📄 Arch A4
                    </a>
                    <a href={`/superadmin/qr-stitky/${batch.id}/zpl`} className="underline">
                      ⬇️ ZPL
                    </a>
                  </div>
                  <form action={`/superadmin/qr-stitky/${batch.id}/tisk`} target="_blank" className="mt-1 flex gap-1">
                    <input name="kod" placeholder={batch.from} aria-label={`Dotisk štítku ze série ${batch.from}`} className="h-8 w-28 rounded-md border border-input bg-transparent px-1.5 font-mono text-xs" />
                    <button type="submit" className="h-8 rounded-md border border-border px-2 text-xs">
                      Dotisknout
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {batches.length ? null : (
              <tr>
                <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                  Zatím žádná série – vygenerujte první štítky výše.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
