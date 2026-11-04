"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Fan, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { effectiveAirflow, fanVerdict, recommendFan, requiredAirflow, FAN_TARGET_C, type FanSpec } from "@/lib/panel-builder/fans";
import { cn } from "@/lib/utils";
import { setProjectFanAction } from "@/server/actions/panel-design";

/** Fáze 47: ventilátor skříně v kroku oteplení – potřebný průtok, doporučení a výběr z katalogu. */
export function FanPanel({ projectId, fans, fanId, fanCount, lossW, ambientTempC, surfaceM2 }: { projectId: string; fans: readonly FanSpec[]; fanId: string | null; fanCount: number; lossW: number; ambientTempC: number; surfaceM2: number }) {
  const router = useRouter();
  const [selected, setSelected] = useState(fanId);
  const [count, setCount] = useState(fanCount);
  const [pending, startTransition] = useTransition();
  const need = requiredAirflow({ lossW, ambientTempC, surfaceM2 });
  const fan = fans.find((candidate) => candidate.id === selected) ?? null;
  const verdict = fanVerdict(fan, count, need);
  const recommended = recommendFan(fans, need.requiredM3h);

  function save(nextId: string | null, nextCount = count) {
    setSelected(nextId);
    setCount(nextCount);
    startTransition(async () => {
      const result = await setProjectFanAction(projectId, nextId, nextCount);
      if (!result.ok) return void toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <section aria-label="Ventilátor skříně" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" data-testid="fan-panel">
      <h2 className="flex items-center gap-2 font-semibold">
        <Fan className="size-4 text-sky-300" aria-hidden /> Ventilátor skříně
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Ukládám" /> : null}
      </h2>
      <p className="text-xs text-muted-foreground" data-testid="fan-need">
        Potřebný průtok pro vnitřní teplotu {FAN_TARGET_C} °C:{" "}
        <b className="font-mono text-foreground">{need.requiredM3h === null ? "– (nutná klimatizace)" : `${need.requiredM3h} m³/h`}</b> · V = 3,1 · Q / ΔT, Q = {need.heatW.toLocaleString("cs-CZ")} W, ΔT = {need.deltaK} K
      </p>
      <p className={cn("flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-xs", verdict.ok ? "border-emerald-500/50 text-emerald-200" : "border-amber-500/60 text-amber-200")} data-testid="fan-verdict" role="status">
        {verdict.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />} {verdict.text}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-56 flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Ventilátor s filtrem
          <select className="h-10 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" value={selected ?? ""} disabled={pending} onChange={(event) => save(event.target.value || null)} aria-label="Ventilátor skříně">
            <option value="">Bez ventilátoru</option>
            {fans.map((option) => (
              <option key={option.id} value={option.id}>
                {option.manufacturer} {option.typeCode} – {effectiveAirflow(option)} m³/h, {option.ratedVoltage}, {option.ipRating}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-20 flex-col gap-1 text-xs text-muted-foreground">
          Počet
          <select className="h-10 rounded-md border border-input bg-transparent px-2 text-sm text-foreground dark:bg-input/30" value={count} disabled={pending || !selected} onChange={(event) => save(selected, Number(event.target.value))} aria-label="Počet ventilátorů">
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        {recommended && recommended.id !== selected ? (
          <Button variant="outline" size="sm" className="touch-target" disabled={pending} onClick={() => save(recommended.id, 1)}>
            Použít doporučený {recommended.manufacturer} {recommended.typeCode}
          </Button>
        ) : null}
      </div>
      {fan ? (
        <p className="text-xs text-muted-foreground" data-testid="fan-detail">
          {fan.articleNumber} · volně {fan.airflowFreeM3h} m³/h{fan.airflowFilterM3h ? ` / s filtrem ${fan.airflowFilterM3h} m³/h` : ""}
          {fan.powerW ? ` · ${fan.powerW} W` : ""}
          {fan.cutoutMm ? ` · výřez ${fan.cutoutMm} mm` : ""}
          {fan.noiseDbA ? ` · ${fan.noiseDbA} dB(A)` : ""}
          {fan.datasheetUrl ? (
            <>
              {" · "}
              <a href={fan.datasheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 hover:underline">
                Datasheet <ExternalLink className="size-3" aria-hidden />
              </a>
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
