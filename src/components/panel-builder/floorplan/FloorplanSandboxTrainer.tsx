"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2, RotateCcw, Target } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SANDBOX_TASKS, type SandboxProgress, type SandboxTaskId } from "@/lib/panel-builder/floorplan-sandbox-preset";
import { cn } from "@/lib/utils";

/**
 * Fáze 92: karta trenažéru 2D půdorysu v pravém dolním rohu – tři úkoly nad rozdělaným bungalovem, které se odškrtávají
 * samy podle skutečných akcí na plátně (stav z `sandboxProgress`). Gratulace jsou pravdivé: trasa kabelu se překreslí
 * hned po položení zásuvky, stmívací akční člen je ten, který výpočet chytré domácnosti opravdu přidal.
 */
export function FloorplanSandboxTrainer({
  progress,
  dimmer,
  pending,
  onPickTool,
  onShowLight,
  onGenerate,
  onRestart,
}: {
  progress: SandboxProgress;
  dimmer: { typeCode: string; label: string } | null;
  pending: boolean;
  onPickTool: () => void;
  onShowLight: () => void;
  onGenerate: () => void;
  onRestart: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [started] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const finished = progress.current === null;
  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finished]);
  const seconds = Math.max(0, Math.floor((now - started) / 1000));
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const success: Record<SandboxTaskId, string> = {
    "bed-socket": "✅ Hotovo! Všimněte si, jak kabel automaticky oběhl stěnu místnosti.",
    "bath-dimmer": dimmer
      ? `✅ Hotovo! Systém automaticky přidal do rozváděče stmívací akční člen ABB-free@home ${dimmer.typeCode} (${dimmer.label.replace(/^Člen akční stmívací /, "").replace(/,.*$/, "")}) – svítidlo v koupelně má vlastní stmívací kanál.`
      : "✅ Hotovo! Svítidlo v koupelně je stmívatelné (odznak DIM).",
    generate: "✅ Rozváděč vygenerován – otevírám AI Panel Builder.",
  };

  return (
    <aside
      className="fixed right-3 bottom-3 z-40 w-[min(23rem,calc(100vw-1.5rem))] rounded-xl border-2 border-yellow-400/80 bg-zinc-950/95 text-sm text-zinc-100 shadow-2xl shadow-black/60 backdrop-blur"
      aria-label="Trenažér 2D půdorysu"
      data-testid="floorplan-trainer"
      data-current={progress.current ?? "done"}
      data-done={progress.count}
    >
      <div className="flex items-center gap-2 border-b border-yellow-400/30 px-3 py-2">
        <Target className="size-4 shrink-0 text-yellow-300" aria-hidden />
        <b className="min-w-0 flex-1 leading-tight text-yellow-100">🎯 Trenažér: Dokončete tuto zakázku 3 kliknutími</b>
        <span className="rounded-full bg-yellow-400/15 px-2 py-0.5 font-mono text-xs text-yellow-200 tabular-nums" title="Čas od otevření trenažéru (cíl 45 s)" data-testid="trainer-clock">
          ⏱ {clock}
        </span>
        <button type="button" onClick={() => setOpen((value) => !value)} className="rounded p-0.5 text-zinc-400 hover:text-zinc-100" aria-label={open ? "Sbalit trenažér" : "Rozbalit trenažér"} aria-expanded={open} data-testid="trainer-toggle">
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
        </button>
      </div>
      {open ? (
        <div className="flex flex-col gap-2 p-3">
          <p className="text-xs leading-snug text-zinc-400">Rozdělaný bungalov 4+kk (ABB-free@home) je z 85 % hotový. Nic se neukládá a rozváděč z trenažéru je zdarma – 0 kreditů.</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800" aria-hidden>
            <div className="h-full rounded-full bg-yellow-400 transition-all" style={{ width: `${(progress.count / SANDBOX_TASKS.length) * 100}%` }} />
          </div>
          <ol className="flex flex-col gap-1.5">
            {SANDBOX_TASKS.map((task) => {
              const done = progress.done[task.id];
              const current = progress.current === task.id;
              return (
                <li key={task.id} className={cn("rounded-lg border p-2", current ? "border-yellow-400/70 bg-yellow-400/10" : done ? "border-emerald-500/40 bg-emerald-500/5" : "border-zinc-800")} data-testid={`trainer-task-${task.step}`} data-state={done ? "done" : current ? "current" : "todo"}>
                  <p className="flex items-center gap-1.5 font-semibold">
                    {done ? <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-label="hotovo" /> : <Circle className={cn("size-4 shrink-0", current ? "text-yellow-300" : "text-zinc-600")} aria-label="čeká" />}
                    Úkol {task.step}/3 – {task.title}
                  </p>
                  {done ? (
                    <p className="mt-1 text-xs leading-snug text-emerald-200" data-testid={`trainer-done-${task.step}`}>
                      {success[task.id]}
                    </p>
                  ) : current ? (
                    <>
                      <p className="mt-1 text-xs leading-snug text-zinc-300">{task.instruction}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {task.id === "bed-socket" ? (
                          <Button type="button" size="sm" variant="outline" className="h-7 border-yellow-400/60 text-xs text-yellow-100" onClick={onPickTool} data-testid="trainer-pick-tool">
                            [Vybrat nástroj] Dvojzásuvka
                          </Button>
                        ) : null}
                        {task.id === "bath-dimmer" ? (
                          <Button type="button" size="sm" variant="outline" className="h-7 border-yellow-400/60 text-xs text-yellow-100" onClick={onShowLight} data-testid="trainer-show-light">
                            Ukázat svítidlo v koupelně
                          </Button>
                        ) : null}
                        {task.id === "generate" ? (
                          <Button type="button" size="sm" className="trainer-pulse h-8 bg-yellow-400 text-xs font-bold text-zinc-950 hover:bg-yellow-300" onClick={onGenerate} disabled={pending} data-testid="trainer-generate">
                            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null} ⚡ Vygenerovat rozváděč z tohoto půdorysu
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
            <button type="button" onClick={onRestart} className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100" data-testid="trainer-restart">
              <RotateCcw className="size-3.5" aria-hidden /> Začít znovu
            </button>
            <Link href="/panel-builder/floorplan/novy" className="text-zinc-400 underline-offset-2 hover:text-zinc-100 hover:underline" data-testid="trainer-exit">
              Ukončit a začít vlastní půdorys →
            </Link>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
