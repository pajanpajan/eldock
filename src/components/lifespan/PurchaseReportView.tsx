"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Loader2, Mail, Printer, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { daysWord } from "@/lib/component-lifespan";
import {
  PURCHASE_FREQUENCIES,
  PURCHASE_HORIZONS,
  deserializeReport,
  purchaseCsv,
  purchaseTable,
  wholesaleCsv,
  type PurchaseFrequency,
  type SerializedPurchaseReport,
} from "@/lib/lifespan-purchase";
import { cn } from "@/lib/utils";
import { buildXlsx } from "@/lib/xlsx";
import { savePurchaseSettingsAction, sendPurchaseReportNowAction } from "@/server/actions/purchase";

const czDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" }) : "–");

function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Fáze 116: „📦 Nákupní report prediktivní údržby (Konsolidovaná objednávka náhradních dílů)“ – součástky celého závodu
 * před koncem životnosti sečtené podle objednacího čísla, sklad, nutno doobjednat, exporty a e-mail oddělení nákupu.
 */
export function PurchaseReportView({
  plant,
  report: serialized,
  base,
  settings,
  printHref,
}: {
  plant: { id: string; name: string };
  report: SerializedPurchaseReport;
  base: string;
  settings: { email: string | null; frequency: PurchaseFrequency; horizonDays: number; lastSentAt: string | null };
  printHref: string;
}) {
  const router = useRouter();
  const report = deserializeReport(serialized);
  const [email, setEmail] = useState(settings.email ?? "");
  const [frequency, setFrequency] = useState<PurchaseFrequency>(settings.frequency);
  const [savedHorizon, setSavedHorizon] = useState(settings.horizonDays);
  const [pending, startTransition] = useTransition();
  const stamp = new Date().toISOString().slice(0, 10);
  const fileBase = `nakupni-report-${plant.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").toLowerCase()}-${stamp}`;

  function saveSettings() {
    startTransition(async () => {
      const result = await savePurchaseSettingsAction({ plantId: plant.id, email: email.trim() || null, frequency, horizonDays: savedHorizon });
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.data.email ? `Report bude chodit na ${result.data.email} (${PURCHASE_FREQUENCIES.find((item) => item.id === frequency)?.label}).` : "Automatické zasílání vypnuto (bez e-mailu).");
      router.refresh();
    });
  }

  function sendNow() {
    startTransition(async () => {
      const result = await sendPurchaseReportNowAction({ plantId: plant.id, horizonDays: report.horizonDays });
      if (!result.ok) return void toast.error(result.error);
      if (result.data.delivery === "SENT") toast.success(`Report odeslán na ${result.data.to}.`);
      else if (result.data.delivery === "LOGGED") toast.info("E-mail je zaznamenaný v logu – odesílání (SMTP) není nastavené.");
      else toast.error("Odeslání selhalo – zkuste to znovu nebo report stáhněte.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" data-testid="purchase-report" data-triggered={report.triggered ? "true" : "false"} data-horizon={report.horizonDays}>
      {/* Spouštěč (Smart Batch Trigger) */}
      {report.triggered && report.trigger ? (
        <section className="rounded-xl border-2 border-amber-400/60 bg-amber-400/10 p-4 text-sm" data-testid="purchase-trigger">
          <p className="font-semibold">
            🔔 Spuštěno prvním varováním: <span className="font-mono">{report.trigger.tag}</span> {report.trigger.designation} – {report.trigger.description}
            {report.trigger.partNumber ? <span className="font-mono"> ({report.trigger.partNumber})</span> : null}
          </p>
          <p className="text-muted-foreground">
            {report.trigger.expired ? "Součástka je po konci životnosti" : `Zbývá ${daysWord(report.trigger.remainingDays ?? 0)} (předstih ${daysWord(report.trigger.alertLeadDays)})`} · v předstihu upozornění je {report.alertCount} součástek – report proto sečetl všechny součástky závodu, kterým životnost končí do {daysWord(report.horizonDays)}, do jedné objednávky.
          </p>
        </section>
      ) : (
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm" data-testid="purchase-idle">
          ✅ Žádná součástka v závodě zatím nedosáhla předstihu upozornění – nákup zatím nic neobjednává. Report se spustí s prvním varováním.
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">Výhled nákupu:</span>
        <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Výhled nákupu">
          {PURCHASE_HORIZONS.map((days) => (
            <Link key={days} href={`${base}${base.includes("?") ? "&" : "?"}vyhled=${days}`} role="radio" aria-checked={report.horizonDays === days} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", report.horizonDays === days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")} data-testid={`purchase-horizon-${days}`}>
              +{days} dní
            </Link>
          ))}
        </div>
        <span className="text-sm text-muted-foreground" data-testid="purchase-totals">
          {report.totals.lines} objednacích čísel · {report.totals.needed} ks k výměně · <b className="text-foreground">{report.totals.toOrder} ks nutno doobjednat</b> · {report.totals.machines} strojů
        </span>
      </div>

      <div className="flex flex-wrap gap-2" data-testid="purchase-exports">
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => download(`${fileBase}.xlsx`, buildXlsx("Nákupní report", purchaseTable(report)) as BlobPart, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")} data-testid="purchase-xlsx">
          <FileSpreadsheet className="size-4" aria-hidden /> XLSX
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => download(`${fileBase}.csv`, purchaseCsv(report), "text/csv;charset=utf-8")} data-testid="purchase-csv">
          <Download className="size-4" aria-hidden /> CSV
        </Button>
        <Button asChild variant="outline" className="gap-1.5">
          <a href={printHref} target="_blank" rel="noopener" data-testid="purchase-pdf">
            <Printer className="size-4" aria-hidden /> PDF
          </a>
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={() => download(`${fileBase}-kosik-velkoobchod.csv`, wholesaleCsv(report), "text/csv;charset=utf-8")} disabled={!report.lines.some((line) => line.toOrder > 0)} title="Objednací číslo výrobce;Množství – rychlá objednávka / import košíku v e-shopu velkoobchodu" data-testid="purchase-wholesale">
          <ShoppingCart className="size-4" aria-hidden /> Košík pro velkoobchod (Sonepar · Elkov · K&V Elektro)
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[960px] text-sm" data-testid="purchase-table">
          <thead className="text-left text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-3 py-2">Výrobce</th>
              <th className="px-3 py-2">Objednací číslo MPN</th>
              <th className="px-3 py-2">Popis</th>
              <th className="px-3 py-2 text-right">Potřebný počet ks k výměně</th>
              <th className="px-3 py-2 text-right">Aktuálně skladem</th>
              <th className="px-3 py-2 text-right">Nutno doobjednat na sklad</th>
              <th className="px-3 py-2">Stroje a nejbližší datum výměny</th>
            </tr>
          </thead>
          <tbody>
            {report.lines.length ? (
              report.lines.map((line) => (
                <tr key={line.partKey} className="border-b border-border align-top last:border-0" data-testid="purchase-line" data-part={line.partNumber} data-needed={line.needed} data-stock={line.inStock} data-order={line.toOrder}>
                  <td className="px-3 py-2">{line.manufacturer ?? "–"}</td>
                  <td className="px-3 py-2 font-mono font-semibold">{line.partNumber}</td>
                  <td className="max-w-64 px-3 py-2">
                    {line.description}
                    {line.estimatedCount ? <p className="text-xs text-amber-300">{line.estimatedCount}× odhad životnosti (doplňte četnost / údaj výrobce)</p> : null}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{line.needed} ks</td>
                  <td className="px-3 py-2 text-right font-mono">{line.inStock} ks</td>
                  <td className={cn("px-3 py-2 text-right font-mono font-bold", line.toOrder > 0 ? "text-amber-300" : "text-emerald-300")}>{line.toOrder} ks</td>
                  <td className="px-3 py-2 text-xs">
                    <p className={cn("font-semibold", line.nearestDays !== null && line.nearestDays <= 0 ? "text-red-300" : "")}>Nejbližší: {line.nearestDays !== null && line.nearestDays <= 0 ? "ihned (po životnosti)" : czDate(line.nearestDate ? line.nearestDate.toISOString() : null)}</p>
                    <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
                      {line.machines.map((machine) => (
                        <li key={`${machine.equipmentId}-${machine.designation}`}>
                          <Link href={`/equipment/${machine.equipmentId}?tab=bom`} className="font-mono text-primary hover:underline">
                            {machine.tag} {machine.designation}
                          </Link>{" "}
                          · {machine.buildingName} · {machine.expired ? "po životnosti" : `do ${czDate(machine.endDate ? machine.endDate.toISOString() : null)}`}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {report.triggered ? `V nákupním výhledu +${report.horizonDays} dní nekončí žádná součástka s objednacím číslem.` : "Report zatím není spuštěný."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {report.withoutPartNumber.length ? (
        <section className="rounded-xl border border-dashed border-border p-3 text-sm" data-testid="purchase-without-mpn">
          <p className="font-semibold">Součástky bez objednacího čísla ({report.withoutPartNumber.length}) – doplňte MPN v kusovníku:</p>
          <ul className="mt-1 text-muted-foreground">
            {report.withoutPartNumber.map((row) => (
              <li key={`${row.equipmentId}-${row.designation}`}>
                <span className="font-mono">{row.tag} {row.designation}</span> · {row.description} · {row.expired ? "po životnosti" : `do ${czDate(row.endDate ? row.endDate.toISOString() : null)}`}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Automatické zasílání oddělení nákupu */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-sm" aria-label="Automatické zasílání e-mailem pro nákup" data-testid="purchase-settings">
        <h2 className="text-base font-semibold">📧 Automatické zasílání e-mailem pro nákup</h2>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            E-mail oddělení nákupu
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nakup@firma.cz" type="email" data-testid="purchase-email" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Frekvence souhrnného reportu
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as PurchaseFrequency)} className="h-9 rounded-md border border-input bg-background px-2 text-sm" data-testid="purchase-frequency">
              {PURCHASE_FREQUENCIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Výhled v e-mailu
            <select value={savedHorizon} onChange={(event) => setSavedHorizon(Number(event.target.value))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              {PURCHASE_HORIZONS.map((days) => (
                <option key={days} value={days}>
                  +{days} dní
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={saveSettings} disabled={pending} className="gap-1.5" data-testid="purchase-save">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null} Uložit nastavení
          </Button>
          <Button type="button" variant="outline" onClick={sendNow} disabled={pending || !settings.email} className="gap-1.5" title={settings.email ? undefined : "Nejdřív uložte e-mail oddělení nákupu."} data-testid="purchase-send">
            <Mail className="size-4" aria-hidden /> Odeslat report nákupu teď
          </Button>
          <span className="text-xs text-muted-foreground">{settings.lastSentAt ? `Naposledy odesláno ${new Date(settings.lastSentAt).toLocaleString("cs-CZ")}.` : "Zatím neodesláno."} Denní kontrola odešle report podle frekvence (při prvním varování jen při nové součástce mimo minulý souhrn).</span>
        </div>
      </section>
    </div>
  );
}
