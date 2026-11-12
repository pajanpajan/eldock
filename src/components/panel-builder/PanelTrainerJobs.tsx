"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TRAINER_JOBS, type TrainerPresetId } from "@/lib/panel-builder/panel-trainer-presets";
import { cn } from "@/lib/utils";
import { openTrainerProjectAction } from "@/server/actions/panel-trainer";

/**
 * Fáze 92: tři tréninkové zakázky AI Panel Builderu na jeden klik (TRENAŽÉR – 0 kreditů) a trenažér 2D půdorysu.
 * Nová firma bez vlastních projektů je vidí rozbalené, ostatní přes „🎯 Vyzkoušet nanečisto (Trenažér zdarma)“. Už
 * otevřená zakázka se otevře znovu (nevzniká druhá kopie).
 */
export function PanelTrainerJobs({ initiallyOpen, opened }: { initiallyOpen: boolean; opened: Partial<Record<TrainerPresetId, string>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(initiallyOpen);
  const [busy, setBusy] = useState<TrainerPresetId | null>(null);
  const [, startTransition] = useTransition();

  function openJob(id: TrainerPresetId) {
    setBusy(id);
    startTransition(async () => {
      const result = await openTrainerProjectAction(id);
      if (!result.ok) {
        setBusy(null);
        return void toast.error(result.error);
      }
      if (result.data.created) toast.success("Tréninková zakázka je připravená – kredit se neodečetl. Tahák nad projektem vás provede fázemi 1–4.");
      router.push(`/panel-builder/${result.data.id}`);
    });
  }

  if (!open) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-yellow-400/50 px-3 py-2" data-testid="trainer-jobs-closed">
        <Button type="button" variant="outline" className="gap-1.5 border-yellow-400/70 font-semibold text-yellow-200 hover:bg-yellow-400/10" onClick={() => setOpen(true)} data-testid="trainer-jobs-open">
          🎯 Vyzkoušet nanečisto (Trenažér zdarma)
        </Button>
        <span className="text-xs text-muted-foreground">3 hotové tréninkové zakázky a rozdělaný dům ve 2D půdorysu – bez fotek, bez kreditů.</span>
      </div>
    );
  }

  return (
    <section className="mb-6 flex flex-col gap-3 rounded-xl border border-yellow-400/50 bg-card p-4" aria-label="Tréninkové zakázky" data-testid="trainer-jobs">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">🎯 Vyzkoušejte nanečisto – tréninkové zakázky na 1 klik</h2>
        <span className="text-xs text-muted-foreground">Skutečné rozváděče vygenerované stejným generátorem jako vaše zakázky · bez hledání fotek · 0 kreditů</span>
      </div>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TRAINER_JOBS.map((job) => (
          <li key={job.id} className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3" data-testid={`trainer-job-${job.id}`}>
            <span className="w-fit rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-zinc-950">TRENAŽÉR – 0 kreditů</span>
            <b className="leading-tight">
              {job.icon} {job.title}
            </b>
            <p className="flex-1 text-xs text-muted-foreground">{job.pitch}</p>
            {job.defect ? <p className="rounded-md border border-amber-400/40 bg-amber-400/5 px-2 py-1 text-[11px] text-amber-200">🎯 Úkol: najděte normovou chybu dle ČSN 33 2130 ed. 4 v Elektro-linteru a opravte ji jedním klikem.</p> : null}
            <Button type="button" className={cn("mt-1 gap-1.5", opened[job.id] ? "" : "bg-yellow-400 font-bold text-zinc-950 hover:bg-yellow-300")} variant={opened[job.id] ? "outline" : "default"} disabled={busy !== null} onClick={() => openJob(job.id)} data-testid={`trainer-job-open-${job.id}`}>
              {busy === job.id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {opened[job.id] ? "Pokračovat v zakázce" : "Otevřít jedním klikem"}
            </Button>
          </li>
        ))}
        <li className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3" data-testid="trainer-job-pudorys">
          <span className="w-fit rounded-full bg-yellow-400 px-2 py-0.5 text-[10px] font-extrabold tracking-wide text-zinc-950">TRENAŽÉR – 0 kreditů</span>
          <b className="leading-tight">📐 2D půdorys: Dokončit rozdělaný dům 3 kliky (45 s)</b>
          <p className="flex-1 text-xs text-muted-foreground">Bungalov 4+kk z 85 % hotový – doplníte zásuvku u postele, stmívání v koupelně a jedním klikem z něj vygenerujete rozváděč.</p>
          <Button asChild className="mt-1 bg-yellow-400 font-bold text-zinc-950 hover:bg-yellow-300">
            <Link href="/panel-builder/floorplan/trenazer" data-testid="trainer-job-floorplan">
              Otevřít trenažér půdorysu
            </Link>
          </Button>
        </li>
      </ul>
      {!initiallyOpen ? (
        <button type="button" onClick={() => setOpen(false)} className="self-end text-xs text-muted-foreground hover:text-foreground">
          Skrýt tréninkové zakázky
        </button>
      ) : null}
    </section>
  );
}
