"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ENVIRONMENTS, environmentOf, ipLabel } from "@/lib/panel-builder/environments";
import { formatDate } from "@/lib/format";
import { setEnvironmentAction } from "@/server/actions/panel-design";

/**
 * Fáze 57: výslovná volba prostředí dle ČSN 33 2000-5-51 ed. 3 před finální dokumentací. Prostředí určuje protokol
 * o určení vnějších vlivů (List 5), požadované krytí IP / IK skříně a teplotu okolí pro výpočet oteplení.
 */
export function EnvironmentConfirm({ projectId, environment, confirmedAt }: { projectId: string; environment: string; confirmedAt: Date | null }) {
  const router = useRouter();
  const [value, setValue] = useState(environment);
  const [pending, startTransition] = useTransition();
  const selected = environmentOf(value);

  function confirm() {
    startTransition(async () => {
      const result = await setEnvironmentAction(projectId, value);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`Prostředí potvrzeno: ${selected.label} (${selected.codes}).`);
      router.refresh();
    });
  }

  return (
    <section className={confirmedAt ? "rounded-xl border border-border bg-card p-4" : "rounded-xl border-2 border-amber-400/70 bg-amber-400/10 p-4"} aria-label="Prostředí dle ČSN 33 2000-5-51 ed. 3" data-testid="environment-confirm">
      <h3 className="flex items-center gap-2 font-semibold">
        {confirmedAt ? <CheckCircle2 className="size-4 text-emerald-400" aria-hidden /> : <ShieldAlert className="size-4 text-amber-300" aria-hidden />}
        Prostředí dle ČSN 33 2000-5-51 ed. 3
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {confirmedAt ? `Potvrzeno ${formatDate(confirmedAt)} – propisuje se do protokolu o určení vnějších vlivů (List 5).` : "Před tiskem a propuštěním dokumentace zvolte prostředí instalace rozváděče. Určuje protokol o vnějších vlivech, krytí skříně a teplotu okolí."}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <select value={value} onChange={(event) => setValue(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30" aria-label="Prostředí instalace">
          {ENVIRONMENTS.map((env) => (
            <option key={env.id} value={env.id}>
              {env.label} – {env.codes}
            </option>
          ))}
        </select>
        <Button type="button" onClick={confirm} disabled={pending || (Boolean(confirmedAt) && value === environment)} className="gap-2" data-testid="environment-confirm-button">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {confirmedAt ? "Změnit prostředí" : "Potvrdit prostředí"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Min. krytí skříně {ipLabel(selected.minIp)}
        {selected.minIk ? ` · IK ${String(selected.minIk).padStart(2, "0")}` : ""} · teplota okolí {selected.ambientTempC} °C
      </p>
    </section>
  );
}
