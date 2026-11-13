"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileDown, FileSpreadsheet, Loader2, Mail, ShieldAlert, Siren } from "lucide-react";
import { toast } from "sonner";

import { KpiTile } from "@/components/common/KpiTile";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MISUSE_BANNER, sealTimestamp, shortHash } from "@/lib/revision-signature";
import { INSPECTION_RESULT } from "@/lib/status";
import { cn } from "@/lib/utils";
import { flagMisuseAction, sendMonthlyReportAction, setMonthlyEmailAction } from "@/server/actions/revision-signing";
import type { TicrProfile } from "@/server/queries/ticr-report";
import type { MonthlyReport, MonthlyRow } from "@/server/services/revision-signing";

/** Fáze 108: měsíční kontrolní report revizního technika pod číslem osvědčení TIČR. */
export function TicrReportView({ profiles, profileId, month, report }: { profiles: TicrProfile[]; profileId: string; month: string; report: MonthlyReport }) {
  const router = useRouter();
  const profile = profiles.find((entry) => entry.id === profileId) ?? profiles[0];
  const [monthly, setMonthly] = useState(profile.monthlyEmail);
  const [flagging, setFlagging] = useState<MonthlyRow | null>(null);
  const [pending, startTransition] = useTransition();
  const query = `profile=${encodeURIComponent(profile.id)}&month=${month}`;

  const navigate = (next: { profile?: string; month?: string }) => router.push(`?profile=${encodeURIComponent(next.profile ?? profile.id)}&month=${next.month ?? month}`);

  function toggleMonthly(enabled: boolean) {
    startTransition(async () => {
      const response = await setMonthlyEmailAction({ inspectorProfileId: profile.id, enabled });
      if (!response.ok) return void toast.error(response.error);
      setMonthly(enabled);
      toast.success(enabled ? "Souhrnný výpis přijde vždy 1. den v měsíci." : "Měsíční e-mail vypnut.");
    });
  }

  function sendNow() {
    startTransition(async () => {
      const response = await sendMonthlyReportAction({ inspectorProfileId: profile.id, month });
      if (!response.ok) return void toast.error(response.error);
      if (response.data.delivery === "SENT") toast.success(`Kontrolní report odeslán na ${response.data.to}.`);
      else if (response.data.delivery === "LOGGED") toast.info("Report je zaznamenaný – odesílání e-mailů (SMTP) zatím není nastavené.");
      else toast.error("Odeslání selhalo – zkuste to prosím později.");
    });
  }

  return (
    <div className="space-y-5" data-testid="ticr-report">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="ticr-profile">Revizní technik a číslo osvědčení TIČR</Label>
          <select id="ticr-profile" value={profile.id} onChange={(event) => navigate({ profile: event.target.value })} className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm" data-testid="ticr-profile">
            {profiles.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name} · TIČR {entry.certificateNo} · {entry.plantName}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ticr-month">Měsíc</Label>
          <Input id="ticr-month" type="month" value={month} onChange={(event) => event.target.value && navigate({ month: event.target.value })} className="h-11" data-testid="ticr-month" />
        </div>
      </div>

      <section aria-label={`Souhrn ${report.label}`} className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="ticr-totals">
        <KpiTile label={`Celkem – ${report.label}`} value={report.totals.count} icon={ShieldAlert} />
        <KpiTile label="Revize" value={report.totals.revisions} icon={ShieldAlert} />
        <KpiTile label="Kontroly spotřebičů / kusové zkoušky" value={report.totals.pieceTests} icon={ShieldAlert} />
        <KpiTile label="Podepsané (pečeť SHA-256)" value={report.totals.signed} icon={ShieldAlert} />
        <KpiTile label="Zneplatněné" value={report.totals.flagged} icon={Siren} accent={report.totals.flagged ? "text-red-400" : undefined} />
      </section>

      {report.foreignCount ? (
        <p className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" data-testid="ticr-foreign">
          ⚠️ Pod číslem {report.certificateNo} je v tomto měsíci dalších {report.foreignCount} záznamů mimo vaše závody. Pokud o nich nevíte, kontaktujte podporu Eldock – prověříme je.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
          <input type="checkbox" checked={monthly} disabled={pending} onChange={(event) => toggleMonthly(event.target.checked)} className="mt-0.5 size-4 accent-primary" data-testid="ticr-monthly" />
          <span>
            Zasílat vždy 1. den v měsíci souhrnný bezpečnostní výpis všech mých revizí na e-mail revizního technika
            <span className="block text-xs text-muted-foreground">{profile.email ? `E-mail: ${profile.email}` : "Profil nemá e-mail – doplňte ho ve formuláři revize."}</span>
          </span>
        </label>
        <Button type="button" variant="outline" className="touch-target gap-2" onClick={sendNow} disabled={pending || !profile.email} data-testid="ticr-send-now">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Mail className="size-4" aria-hidden />} 📧 Odeslat kontrolní report na můj e-mail ihned
        </Button>
        <Button asChild variant="outline" className="touch-target gap-2">
          <Link href={`/inspections/ticr/print?${query}`} target="_blank" data-testid="ticr-pdf">
            <FileDown className="size-4" aria-hidden /> 📄 Stáhnout podepsaný měsíční výkaz (PDF)
          </Link>
        </Button>
        <Button asChild variant="outline" className="touch-target gap-2">
          <a href={`/api/inspections/ticr?${query}`} data-testid="ticr-csv">
            <FileSpreadsheet className="size-4" aria-hidden /> CSV
          </a>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[960px] text-sm" data-testid="ticr-table">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Datum a přesný čas podpisu</th>
              <th className="px-3 py-2 font-medium">Závod / Budova</th>
              <th className="px-3 py-2 font-medium">Zařízení a QR štítek</th>
              <th className="px-3 py-2 font-medium">Výsledek</th>
              <th className="px-3 py-2 font-medium">IP / zařízení při podpisu</th>
              <th className="px-3 py-2 font-medium">SHA-256</th>
              <th className="px-3 py-2 font-medium" aria-label="Akce" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  V měsíci {report.label} pod číslem {report.certificateNo} žádné revize nejsou.
                </td>
              </tr>
            ) : (
              report.rows.map((row) => {
                const time = sealTimestamp(new Date(row.at));
                const result = INSPECTION_RESULT[row.result];
                return (
                  <tr key={row.id} className={cn(row.flaggedAt && "bg-red-500/10")} data-testid="ticr-row" data-flagged={row.flaggedAt ? "true" : "false"}>
                    <td className="px-3 py-2 align-top">
                      <span className="block font-medium">{time.local}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground">{row.signed ? time.utc : "nepodepsáno – den revize"}</span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className="block">{row.plantName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.buildingName} · {row.floorName}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link href={`/equipment/${row.equipmentId}`} className="font-mono font-semibold hover:underline">
                        {row.tag}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {row.name} · QR štítek {row.hasQr ? "✓" : "–"} · {row.reportNumber}
                      </span>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-medium", result.badge)}>{result.label}</span>
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <span className="block font-mono">{row.ip ?? "–"}</span>
                      <span className="block text-muted-foreground">{row.device ?? "–"}</span>
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs" title={row.sealHash ?? undefined}>
                      {shortHash(row.sealHash)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      {row.flaggedAt ? (
                        <span className="text-xs font-bold text-red-300" data-testid="ticr-flagged">
                          ⛔ Zneplatněno
                        </span>
                      ) : (
                        <Button type="button" size="sm" variant="outline" className="h-auto gap-1 whitespace-normal border-red-500/60 py-1 text-left text-xs text-red-200 hover:bg-red-500/15" onClick={() => setFlagging(row)} data-testid="ticr-flag">
                          🚨 Nahlásit zneužití / Tato revize není moje!
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {flagging ? <FlagDialog row={flagging} profile={profile} onClose={() => setFlagging(null)} onDone={() => (setFlagging(null), router.refresh())} /> : null}
    </div>
  );
}

function FlagDialog({ row, profile, onClose, onDone }: { row: MonthlyRow; profile: TicrProfile; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await flagMisuseAction({ inspectionId: row.id, inspectorProfileId: profile.id, pin, note });
      if (!response.ok) return setError(response.error);
      toast.success(`Revize ${row.reportNumber} (${row.tag}) je zneplatněná a zapsaná do bezpečnostního auditu.`);
      onDone();
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="ticr-flag-dialog">
        <DialogHeader>
          <DialogTitle>🚨 Tato revize není moje!</DialogTitle>
          <DialogDescription>
            {row.tag} · {row.reportNumber} · {row.plantName}. Záznam se okamžitě zablokuje v cloudu i pod QR štítkem s varováním „{MISUSE_BANNER}“ a událost se zapíše do bezpečnostního auditu. Revize přestane platit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ticr-flag-pin">Váš osobní PIN (profil {profile.name})</Label>
            <Input id="ticr-flag-pin" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))} className="h-11 font-mono tracking-[0.4em]" data-testid="ticr-flag-pin" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ticr-flag-note">Poznámka (nepovinné)</Label>
            <Textarea id="ticr-flag-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="např. v tento den jsem byl na jiné zakázce" />
          </div>
          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="button" variant="destructive" onClick={submit} disabled={pending || !/^\d{4,8}$/.test(pin)} className="gap-1.5" data-testid="ticr-flag-submit">
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Siren className="size-4" aria-hidden />} Zneplatnit záznam
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
