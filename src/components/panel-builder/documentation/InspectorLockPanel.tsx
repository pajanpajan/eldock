"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { routineTestVerdict, type RoutineTest } from "@/lib/legislation-2027";
import { DOC_STATE_LABEL, VERDICTS, czDate, inspectionIssues, inspectionSchema, mergeRoutineTest, versionBadge, type DocState } from "@/lib/switchboard-versions";
import { cn } from "@/lib/utils";
import { publishSwitchboardVersionAction, returnToDraftAction, submitForInspectionAction, unlockSwitchboardAction } from "@/server/actions/switchboard-versions";

export interface VersionRow {
  version: string;
  status: string;
  publishedAt: string;
  inspectorName: string;
  inspectorCert: string;
  measuredAt: string;
  supersededByVersion: string | null;
  hasFloorplan: boolean;
}

interface Props {
  projectId: string;
  docState: DocState;
  nextVersion: string;
  serial: string | null;
  versions: VersionRow[];
  /** Uložený protokol o kusové zkoušce (8 bodů čl. 11) – body 11.4, 11.8 a 11.9 doplní měření níže. */
  routineTest: RoutineTest;
  blockers: string[];
  prefill: { inspectorName: string; measuredAt: string };
  /** Příchod z karty QR štítku „Založit novou revizi“. */
  highlight?: boolean;
}

type Form = {
  inspectorName: string;
  inspectorCert: string;
  measuredAt: string;
  insulationMOhm: string;
  insulationTestVoltage: string;
  peContinuityOhm: string;
  loopImpedanceOhm: string;
  shortCircuitKa: string;
  rcdTripCurrentMa: string;
  rcdTripTimeMs: string;
  mechanicalOk: boolean;
  verdict: "SAFE" | "UNSAFE";
  note: string;
};

const decimal = (value: string) => (value.trim() === "" ? undefined : Number(value.trim().replace(",", ".")));

/**
 * Fáze 103: „👨‍🔧 Část pro revizního technika / Výstupní kusovou zkoušku (Uzamčení do cloudu)“ – po fyzické kontrole
 * rozváděče technik doplní měření a jedním tlačítkem uzamkne dokumentaci jako novou verzi pod QR štítkem.
 */
export function InspectorLockPanel({ projectId, docState, nextVersion, serial, versions, routineTest, blockers, prefill, highlight = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Form>({
    inspectorName: prefill.inspectorName,
    inspectorCert: "",
    measuredAt: prefill.measuredAt,
    insulationMOhm: routineTest.insulationMOhm === null ? "" : String(routineTest.insulationMOhm).replace(".", ","),
    insulationTestVoltage: "500",
    peContinuityOhm: "",
    loopImpedanceOhm: "",
    shortCircuitKa: "",
    rcdTripCurrentMa: "",
    rcdTripTimeMs: "",
    mechanicalOk: false,
    verdict: "SAFE",
    note: "",
  });
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((previous) => ({ ...previous, [key]: value }));

  const current = versions.find((row) => row.status === "LOCKED_PUBLISHED") ?? null;
  const input = {
    inspectorName: form.inspectorName,
    inspectorCert: form.inspectorCert,
    measuredAt: form.measuredAt,
    insulationMOhm: decimal(form.insulationMOhm),
    insulationTestVoltage: Number(form.insulationTestVoltage),
    peContinuityOhm: decimal(form.peContinuityOhm),
    loopImpedanceOhm: decimal(form.loopImpedanceOhm),
    shortCircuitKa: decimal(form.shortCircuitKa),
    rcdTripCurrentMa: decimal(form.rcdTripCurrentMa),
    rcdTripTimeMs: decimal(form.rcdTripTimeMs),
    mechanicalOk: form.mechanicalOk,
    verdict: form.verdict,
    note: form.note.trim() || undefined,
  };
  const parsed = inspectionSchema.safeParse(input);
  const missing = [
    !form.inspectorName.trim() && "Zadejte jméno a příjmení revizního technika.",
    !form.inspectorCert.trim() && "Zadejte číslo osvědčení / oprávnění TIČR.",
    !form.insulationMOhm.trim() && "Zadejte naměřený izolační odpor R_iso.",
    !form.peContinuityOhm.trim() && "Zadejte spojitost ochranného obvodu PE.",
  ].filter((item): item is string => Boolean(item));
  const issues = missing.length ? missing : parsed.success ? inspectionIssues(parsed.data) : [parsed.error.issues[0]?.message ?? "Zkontrolujte naměřené hodnoty."];
  const routine = parsed.success ? routineTestVerdict(mergeRoutineTest(routineTest, parsed.data)) : null;
  const routineMissing = routine && routine.verdict !== "PASS" ? routine.missing : [];
  const canLock = parsed.success && !issues.length && routine?.verdict === "PASS" && !blockers.length;

  const run = (action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(success);
      router.refresh();
    });

  function lock() {
    startTransition(async () => {
      const result = await publishSwitchboardVersionAction(projectId, input);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`🔒 Vydána Verze ${result.data.version} pod štítkem ${result.data.serial}`, { description: "Dokumentace je uzamčená v cloudu, předchozí verze je v historii jako NEAKTUÁLNÍ." });
      router.refresh();
    });
  }

  const field = "flex flex-col gap-1 text-xs text-muted-foreground";
  return (
    <section
      id="revizni-technik"
      aria-label="Část pro revizního technika"
      className={cn("no-print scroll-mt-24 space-y-4 rounded-xl border-2 bg-card p-4", docState === "LOCKED_PUBLISHED" ? "border-emerald-500/60" : "border-sky-500/50", highlight && "ring-2 ring-amber-400")}
      data-testid="inspector-panel"
      data-doc-state={docState}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">👨‍🔧 Část pro revizního technika / Výstupní kusovou zkoušku (Uzamčení do cloudu)</h2>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", docState === "LOCKED_PUBLISHED" ? "border-emerald-500/60 text-emerald-200" : docState === "PENDING_INSPECTION" ? "border-amber-400/60 text-amber-200" : "border-border text-muted-foreground")} data-testid="doc-state">
          {docState === "DRAFT" && current ? `Verze ${nextVersion} (Rozpracovaná změna)` : DOC_STATE_LABEL[docState]}
        </span>
      </div>

      {docState === "LOCKED_PUBLISHED" && current ? (
        <div className="space-y-3" data-testid="inspector-locked">
          <p className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3 text-sm text-emerald-100" data-testid="inspector-current">
            🔒 <strong>Schválená platná dokumentace – Verze {current.version}</strong> (Ověřeno revizním technikem {current.inspectorName}, {current.inspectorCert}, dne {czDate(current.measuredAt)}). Dokumentace je uzamčená proti úpravám a po naskenování QR štítku
            {serial ? (
              <>
                {" "}
                <Link href={`/q/${serial}`} className="font-mono font-semibold underline" data-testid="inspector-card-link">
                  {serial}
                </Link>
              </>
            ) : null}{" "}
            ji uvidí každý technik u rozváděče.
          </p>
          {serial ? (
            <div className="flex flex-wrap gap-2">
              <Link href={`/q/${serial}/v/${current.version}`} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" target="_blank">
                📄 Kompletní PDF dokumentace rozváděče + Kusová zkouška (Verze {current.version} – AKTUÁLNÍ)
              </Link>
              {current.hasFloorplan ? (
                <Link href={`/q/${serial}/v/${current.version}/pudorys`} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" target="_blank">
                  📐 Prováděcí 2D půdorys a kabelové trasy (Verze {current.version} – AKTUÁLNÍ)
                </Link>
              ) : null}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="touch-target gap-2 border-amber-400/70 text-amber-100"
            disabled={pending}
            data-testid="inspector-unlock"
            onClick={() => {
              if (!window.confirm(`Odemknout rozváděč k úpravě? Vznikne rozpracovaná Verze ${nextVersion}; platná zůstává Verze ${current.version}, dokud technik neschválí novou kusovou zkoušku.`)) return;
              run(() => unlockSwitchboardAction(projectId), `🔓 Odemčeno – Verze ${nextVersion} (Rozpracovaná změna). Po úpravách znovu vyplňte kusovou zkoušku.`);
            }}
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}🔓 Odemknout rozváděč k úpravě / Založit novou revizi
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {current ? (
            <p className="rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-amber-100" data-testid="inspector-revision-note">
              🛠️ Rozpracovaná změna – <strong>Verze {nextVersion}</strong>. Na kartě štítku {serial} platí Verze {current.version}, dokud technik neschválí novou kusovou zkoušku.
            </p>
          ) : null}
          {docState === "DRAFT" ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              Konstrukce je hotová?
              <Button type="button" variant="outline" size="sm" disabled={pending} data-testid="inspector-submit" onClick={() => run(() => submitForInspectionAction(projectId), "Předáno ke kusové zkoušce – úpravy osazení a zapojení jsou zamčené.")}>
                📋 Předat ke kusové zkoušce (zamknout úpravy)
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/50 bg-amber-400/10 p-3 text-sm text-amber-100">
              ⏳ Rozváděč čeká na kusovou zkoušku a potvrzení revizního technika – osazení a zapojení jsou zamčené.
              <Button type="button" variant="outline" size="sm" disabled={pending} data-testid="inspector-return" onClick={() => run(() => returnToDraftAction(projectId), "Vráceno do úprav.")}>
                ↩️ Vrátit do úprav
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className={field}>
              Jméno a příjmení revizního technika / zkoušejícího
              <Input value={form.inspectorName} maxLength={80} onChange={(event) => set("inspectorName", event.target.value)} className="h-10" data-testid="inspector-name" />
            </label>
            <label className={field}>
              Číslo osvědčení / oprávnění TIČR
              <Input value={form.inspectorCert} maxLength={60} placeholder="např. E2A / E2B – č. osvědčení" onChange={(event) => set("inspectorCert", event.target.value)} className="h-10" data-testid="inspector-cert" />
            </label>
            <label className={field}>
              Datum měření
              <Input type="date" value={form.measuredAt} onChange={(event) => set("measuredAt", event.target.value)} className="h-10" data-testid="inspector-date" />
            </label>
          </div>

          <fieldset className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2 lg:grid-cols-4">
            <legend className="px-1 text-sm font-medium">Naměřené hodnoty kusové zkoušky a revize</legend>
            <label className={field}>
              Izolační odpor R_iso [MΩ]
              <div className="flex gap-1">
                <Input inputMode="decimal" value={form.insulationMOhm} placeholder="> 500" onChange={(event) => set("insulationMOhm", event.target.value)} className="h-10 font-mono" data-testid="inspector-riso" />
                <select aria-label="Zkušební napětí" value={form.insulationTestVoltage} onChange={(event) => set("insulationTestVoltage", event.target.value)} className="h-10 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30" data-testid="inspector-voltage">
                  <option value="250">250 V DC</option>
                  <option value="500">500 V DC</option>
                  <option value="1000">1000 V DC</option>
                </select>
              </div>
            </label>
            <label className={field}>
              Spojitost ochranného obvodu PE [Ω]
              <Input inputMode="decimal" value={form.peContinuityOhm} placeholder="0,04" onChange={(event) => set("peContinuityOhm", event.target.value)} className="h-10 font-mono" data-testid="inspector-pe" />
            </label>
            <label className={field}>
              Impedance smyčky Z_s [Ω]
              <Input inputMode="decimal" value={form.loopImpedanceOhm} placeholder="0,35" onChange={(event) => set("loopImpedanceOhm", event.target.value)} className="h-10 font-mono" data-testid="inspector-zs" />
            </label>
            <label className={field}>
              Zkratový proud I_k [kA]
              <Input inputMode="decimal" value={form.shortCircuitKa} placeholder="0,66" onChange={(event) => set("shortCircuitKa", event.target.value)} className="h-10 font-mono" data-testid="inspector-ik" />
            </label>
            <label className={field}>
              RCD – vybavovací proud I_Δ [mA]
              <Input inputMode="decimal" value={form.rcdTripCurrentMa} placeholder="22" onChange={(event) => set("rcdTripCurrentMa", event.target.value)} className="h-10 font-mono" data-testid="inspector-rcd-ma" />
            </label>
            <label className={field}>
              RCD – vybavovací čas t_A [ms]
              <Input inputMode="decimal" value={form.rcdTripTimeMs} placeholder="18" onChange={(event) => set("rcdTripTimeMs", event.target.value)} className="h-10 font-mono" data-testid="inspector-rcd-ms" />
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.mechanicalOk} onChange={(event) => set("mechanicalOk", event.target.checked)} className="size-5 accent-emerald-500" data-testid="inspector-mechanical" />
              Mechanická funkční zkouška a kontrola utahovacích momentů – ANO / VYHOVUJE
            </label>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <label className={field}>
              Celkový verdikt
              <select value={form.verdict} onChange={(event) => set("verdict", event.target.value as Form["verdict"])} className="h-10 rounded-md border border-input bg-transparent px-2 text-sm font-semibold text-foreground dark:bg-input/30" data-testid="inspector-verdict">
                {VERDICTS.map((verdict) => (
                  <option key={verdict.id} value={verdict.id}>
                    {verdict.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={field}>
              Poznámka revizního technika
              <Textarea value={form.note} maxLength={500} rows={2} onChange={(event) => set("note", event.target.value)} data-testid="inspector-note" />
            </label>
          </div>

          {issues.length || routineMissing.length || blockers.length ? (
            <ul className="space-y-1 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-100" data-testid="inspector-issues">
              {issues.map((issue) => (
                <li key={issue}>• {issue}</li>
              ))}
              {routineMissing.length ? <li>• V protokolu o kusové zkoušce (panel Kusová zkouška) chybí: {routineMissing.join(", ")}.</li> : null}
              {blockers.map((blocker) => (
                <li key={blocker}>• {blocker}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-emerald-300" data-testid="inspector-ready">
              ✓ Měření vyhovují, protokol o kusové zkoušce je úplný – dokumentaci lze uzamknout. Body 11.4, 11.8 a 11.9 protokolu doplní tato měření.
            </p>
          )}

          <Button type="button" className="touch-target h-auto w-full gap-2 whitespace-normal py-3 text-base font-semibold" disabled={pending || !canLock} onClick={lock} data-testid="inspector-lock">
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}🔒 Potvrdit kusovou zkoušku, uzamknout PDF v cloudu a vydat Verzi {nextVersion}
          </Button>
          <p className="text-xs text-muted-foreground">
            Uloží se neměnný snímek 6listového elaborátu s naměřenými hodnotami a potvrzením technika i navázaný 2D půdorys s kusovníkem. Rozváděč dostane globálně unikátní QR štítek ELDOCK (EL-…), štítek CE na Listu 6 vede na jeho kartu.
            PDF vznikne tiskem snímku z prohlížeče („Uložit jako PDF“).
          </p>
        </div>
      )}

      {versions.length ? (
        <details className="rounded-lg border border-border p-3" open={versions.length > 1} data-testid="version-history">
          <summary className="cursor-pointer text-sm font-medium">Historie verzí rozváděče ({versions.length})</summary>
          <ul className="mt-2 space-y-1.5 text-sm">
            {versions.map((row) => (
              <li key={row.version} className="flex flex-wrap items-center gap-2" data-testid="version-row" data-version={row.version} data-status={row.status}>
                <span className={cn("rounded px-1.5 py-0.5 text-xs font-bold", row.status === "LOCKED_PUBLISHED" ? "bg-emerald-500/15 text-emerald-200" : "bg-red-600 text-white")}>{versionBadge(row.version, row.status, row.supersededByVersion)}</span>
                <span className="text-muted-foreground">
                  ze dne {czDate(row.publishedAt)} · {row.inspectorName}
                </span>
                {serial ? (
                  <Link href={`/q/${serial}/v/${row.version}`} target="_blank" className="text-xs underline">
                    📄 PDF dokumentace
                  </Link>
                ) : null}
                {serial && row.hasFloorplan ? (
                  <Link href={`/q/${serial}/v/${row.version}/pudorys`} target="_blank" className="text-xs underline">
                    📐 půdorys
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
