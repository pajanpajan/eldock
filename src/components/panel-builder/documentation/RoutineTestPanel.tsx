"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { ROUTINE_TEST_POINTS, STANDARD_EDITIONS, minInsulationMOhm, routineTestVerdict, type RoutineResult, type RoutineTest, type StandardEditionId } from "@/lib/legislation-2027";
import { cn } from "@/lib/utils";
import { saveRoutineTestAction, setStandardEditionAction } from "@/server/actions/panel-design";

/** Výběr edice normy rozváděče (krok 1 a 4). */
export function StandardEditionSelect({ projectId, value, compact = false }: { projectId: string; value: StandardEditionId; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", !compact && "flex-col items-start gap-1 text-sm")}>
      Norma rozváděče
      <select
        aria-label="Norma rozváděče"
        className={cn("rounded-md border border-input bg-transparent px-2 text-foreground dark:bg-input/30", compact ? "h-9 max-w-80 text-xs" : "h-10 w-full text-sm")}
        value={value}
        disabled={pending}
        onChange={(event) =>
          startTransition(async () => {
            const result = await setStandardEditionAction(projectId, event.target.value);
            if (!result.ok) return void toast.error(result.error);
            toast.success("Norma rozváděče změněna – propíše se do Listu 5 a 6.");
            router.refresh();
          })
        }
      >
        {STANDARD_EDITIONS.map((edition) => (
          <option key={edition.id} value={edition.id}>
            {edition.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const VERDICT = {
  PASS: { label: "VYHOVUJE", className: "border-emerald-500/60 bg-emerald-500/10 text-emerald-200" },
  FAIL: { label: "NEVYHOVUJE", className: "border-red-500/60 bg-red-500/10 text-red-200" },
  INCOMPLETE: { label: "NEÚPLNÝ", className: "border-amber-500/60 bg-amber-500/10 text-amber-200" },
} as const;

/**
 * Interaktivní protokol o kusové zkoušce rozváděče (čl. 11 ČSN EN IEC 61439-1 ed. 3): 8 bodů
 * vyhovuje / nevyhovuje, izolační odpor R_iso, zkoušející a datum. Ukládá se průběžně a tiskne do Listu 6.
 */
export function RoutineTestPanel({ projectId, initial, readOnly = false }: { projectId: string; initial: RoutineTest; readOnly?: boolean }) {
  const [test, setTest] = useState(initial);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evaluation = routineTestVerdict(test);

  function update(next: RoutineTest) {
    // Fáze 103: uzamčená vydaná verze – protokol jen pro čtení (změna = odemknout a nová revize)
    if (readOnly) return;
    setTest(next);
    setSaving("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const result = await saveRoutineTestAction(projectId, next);
      if (!result.ok) {
        setSaving("idle");
        return void toast.error(result.error);
      }
      setSaving("saved");
    }, 500);
  }
  const setPoint = (id: (typeof ROUTINE_TEST_POINTS)[number]["id"], value: RoutineResult) => update({ ...test, points: { ...test.points, [id]: value } });

  return (
    <section aria-label="Protokol o kusové zkoušce" className={cn("no-print space-y-3 rounded-xl border border-border bg-card p-4", readOnly && "opacity-80")} data-testid="routine-test" data-readonly={readOnly || undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Protokol o kusové zkoušce rozváděče (čl. 11 ČSN EN IEC 61439-1 ed. 3)</h2>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold", VERDICT[evaluation.verdict].className)} data-testid="routine-verdict">
          {VERDICT[evaluation.verdict].label}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {saving === "saving" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : saving === "saved" ? <Check className="size-3.5 text-emerald-400" aria-hidden /> : null}
          {saving === "saving" ? "Ukládám…" : saving === "saved" ? "Uloženo" : ""}
        </span>
      </div>
      <ol className="grid gap-1.5">
        {ROUTINE_TEST_POINTS.map((point, index) => (
          <li key={point.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-sm">
            <span className="w-6 font-mono text-muted-foreground">{index + 1}.</span>
            <span className="min-w-0 flex-1">
              {point.label} <span className="text-xs text-muted-foreground">(čl. {point.clause})</span>
            </span>
            <div className="flex gap-1" role="group" aria-label={`Bod ${index + 1}: ${point.label}`}>
              {(
                [
                  ["PASS", "✓ Vyhovuje", "border-emerald-500 bg-emerald-500 text-emerald-950"],
                  ["FAIL", "✗ Nevyhovuje", "border-red-500 bg-red-500 text-white"],
                ] as const
              ).map(([value, label, active]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={test.points[point.id] === value}
                  disabled={readOnly}
                  onClick={() => setPoint(point.id, test.points[point.id] === value ? null : value)}
                  className={cn("min-h-8 rounded-md border px-2 text-xs font-semibold", test.points[point.id] === value ? active : "border-border text-muted-foreground hover:text-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Izolační odpor R_iso [MΩ] (min. {String(minInsulationMOhm()).replace(".", ",")} MΩ)
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={test.insulationMOhm ?? ""}
            aria-label="Izolační odpor R_iso"
            disabled={readOnly}
            onChange={(event) => update({ ...test, insulationMOhm: event.target.value === "" ? null : Number(event.target.value.replace(",", ".")) })}
            className={cn("h-10 font-mono", evaluation.insulationOk === false && "border-red-500")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Zkoušku provedl
          <Input value={test.testedBy} maxLength={120} aria-label="Zkoušku provedl" disabled={readOnly} onChange={(event) => update({ ...test, testedBy: event.target.value })} className="h-10" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Datum zkoušky
          <Input type="date" value={test.testedAt ?? ""} aria-label="Datum zkoušky" disabled={readOnly} onChange={(event) => update({ ...test, testedAt: event.target.value || null })} className="h-10" />
        </label>
      </div>
      {evaluation.missing.length ? <p className="text-xs text-amber-200">Chybí: {evaluation.missing.join(", ")}.</p> : null}
    </section>
  );
}
