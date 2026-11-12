"use client";

import { Check } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Druh probíhajícího kroku – barva okraje lišty a tečky u názvu. */
export type ModeTone = "idle" | "edit" | "pair" | "place" | "draw" | "annotate" | "measure";

const BORDER: Record<ModeTone, string> = {
  idle: "border-border",
  edit: "border-amber-400/70",
  pair: "border-emerald-500/70",
  place: "border-primary/70",
  draw: "border-yellow-400/60",
  annotate: "border-sky-500/60",
  measure: "border-yellow-400/60",
};

const DOT: Record<ModeTone, string> = {
  idle: "bg-muted-foreground",
  edit: "bg-amber-400",
  pair: "bg-emerald-400",
  place: "bg-primary",
  draw: "bg-yellow-400",
  annotate: "bg-sky-400",
  measure: "bg-yellow-400",
};

/** Odsazení lepkavé lišty pod lepkavou hlavičkou Panel Builderu (hlavička se na užší obrazovce zalomí a zvýší). */
function useStickyTop(gap = 8): number {
  const [top, setTop] = useState(72);
  useEffect(() => {
    const header = document.querySelector<HTMLElement>('[data-testid="panel-builder-header"]');
    if (!header) return;
    // První měření přijde z ResizeObserveru hned po připojení, další při změně výšky hlavičky
    const observer = new ResizeObserver(() => setTop(Math.round(header.getBoundingClientRect().height) + gap));
    observer.observe(header);
    return () => observer.disconnect();
  }, [gap]);
  return top;
}

/**
 * Fáze 62: lišta probíhajícího kroku nad projektem (půdorys, rozváděč) – co právě dělám, nápověda, ovládání kroku
 * a tlačítko „Hotovo“ vždy na stejném místě nad plátnem, ne v bočním panelu. Při posunu stránky zůstává viditelná
 * pod hlavičkou.
 */
export function ModeBar({
  tone,
  title,
  hint,
  children,
  below = null,
  onDone,
  doneLabel = "Hotovo",
  testId = "mode-bar",
  doneTestId = "mode-done",
}: {
  tone: ModeTone;
  title: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  /**
   * Fáze 100: vlastní řádek pod krokem (rychlý přepínač 🌗 Podklad 2D půdorysu) – nemění zalomení nápovědy, je vždy
   * vidět s lištou a nezakrývá výkres.
   */
  below?: ReactNode;
  onDone?: () => void;
  doneLabel?: string;
  testId?: string;
  doneTestId?: string;
}) {
  const top = useStickyTop();
  return (
    <section
      aria-label="Probíhající krok"
      data-testid={testId}
      data-tone={tone}
      className={cn("sticky z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border-2 bg-card/95 px-3 py-1.5 shadow-lg shadow-black/30 backdrop-blur", BORDER[tone])}
      style={{ top }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[tone])} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold" data-testid={`${testId}-title`}>
            {title}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground" role="status">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      {onDone ? (
        <Button type="button" size="sm" className="gap-1.5" onClick={onDone} data-testid={doneTestId}>
          <Check className="size-4" aria-hidden /> {doneLabel}
        </Button>
      ) : null}
      {below ? <div className="flex basis-full flex-wrap items-center gap-2 border-t border-border/60 pt-1.5">{below}</div> : null}
    </section>
  );
}
