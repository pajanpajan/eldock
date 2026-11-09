import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";

import { fitsEnclosure, enclosureNeed } from "@/lib/panel-builder/enclosures";
import { stepProgress, type StepKey } from "@/lib/panel-builder/project";
import { railCapacities } from "@/lib/panel-builder/rails";
import { cn } from "@/lib/utils";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

export type PanelStep = StepKey;

/** Fáze 75: kroky projektu – nový krok 3 „Skříň rozváděče“ mezi zapojením a oteplením (skříň je vstup oteplení). */
const STEPS: { key: PanelStep; label: string; short: string; href: (id: string) => string }[] = [
  { key: "recognition", label: "1. Analýza fotky", short: "Analýza fotky", href: (id) => `/panel-builder/${id}` },
  { key: "tree", label: "2. Zapojení a hierarchie", short: "Zapojení a hierarchie", href: (id) => `/panel-builder/${id}/tree` },
  { key: "enclosure", label: "3. Skříň rozváděče", short: "Skříň rozváděče", href: (id) => `/panel-builder/${id}/enclosure` },
  { key: "thermal", label: "4. Výpočet oteplení a bilance", short: "Výpočet oteplení a bilance", href: (id) => `/panel-builder/${id}/thermal` },
  { key: "documentation", label: "5. Výstupní dokumentace a PDF export", short: "Dokumentace a PDF", href: (id) => `/panel-builder/${id}/documentation` },
];

const labelOf = (step: (typeof STEPS)[number], design: boolean) => (design && step.key === "recognition" ? "1. Návrh a osazení" : step.label);

/** Stav kroků projektu (✓ Hotovo / Rozpracováno) – vybraná skříň, do které se návrh vejde = krok 3 hotový. */
function progressOf(project: PanelProjectDetail) {
  const { connected, thermal } = documentationState(project);
  const need = enclosureNeed(railCapacities(project), project.items);
  const enclosure = Boolean(project.enclosureId || project.enclosureModel) && (!project.enclosure || fitsEnclosure(project.enclosure, need));
  return stepProgress({ items: project.items, status: project.status, connected, thermalOk: thermal.ok, enclosure });
}

/** Kroky pracovní plochy projektu rozváděče se stavem ✓ Hotovo / Rozpracováno (fáze 48) a tlačítkem Další krok (fáze 75). */
export function PanelSteps({ project, current }: { project: PanelProjectDetail; current: PanelStep }) {
  const done = progressOf(project);
  const design = project.designMode === "DESIGN";
  const index = STEPS.findIndex((step) => step.key === current);
  const next = STEPS[index + 1] ?? null;
  return (
    <nav aria-label="Kroky projektu" className="mb-6 flex flex-wrap items-center gap-2 border-b border-border pb-3">
      {STEPS.map((step) => (
        <Link
          key={step.key}
          href={step.href(project.id)}
          aria-current={step.key === current ? "page" : undefined}
          data-step={step.key}
          data-done={done[step.key] ? "true" : "false"}
          className={cn(
            "touch-target flex items-center gap-2 rounded-md px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            step.key === current ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {labelOf(step, design)}
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
              done[step.key] ? (step.key === current ? "bg-primary-foreground/20" : "bg-emerald-500/15 text-emerald-300") : step.key === current ? "bg-primary-foreground/15" : "bg-muted text-muted-foreground",
            )}
          >
            {done[step.key] ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}
            {done[step.key] ? "✓ Hotovo" : "Rozpracováno"}
          </span>
        </Link>
      ))}
      {/* Fáze 75: jasně viditelný další krok vpravo v liště kroků */}
      {next ? (
        <Link
          href={next.href(project.id)}
          aria-label="Pokračovat na další krok"
          className="touch-target ml-auto flex items-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus-visible:ring-3 focus-visible:ring-emerald-300/60"
          data-testid="next-step"
        >
          Další krok: {next.short}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}

/** Fáze 75: lišta dole na stránce kroku – předchozí krok a výrazný další krok (bez hledání v horní liště). */
export function NextStepBar({ project, current }: { project: PanelProjectDetail; current: PanelStep }) {
  const index = STEPS.findIndex((step) => step.key === current);
  const previous = STEPS[index - 1] ?? null;
  const next = STEPS[index + 1] ?? null;
  const done = progressOf(project);
  const design = project.designMode === "DESIGN";
  if (!previous && !next) return null;
  return (
    <div className="no-print sticky bottom-3 z-30 mt-8 flex print:hidden flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur" role="navigation" aria-label="Přechod mezi kroky" data-testid="next-step-bar">
      {previous ? (
        <Link href={previous.href(project.id)} className="touch-target flex items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Zpět na předchozí krok">
          <ArrowLeft className="size-4" aria-hidden /> {labelOf(previous, design)}
        </Link>
      ) : null}
      <span className={cn("text-xs", done[current] ? "text-emerald-300" : "text-muted-foreground")}>{done[current] ? "✓ Tento krok je hotový" : "Krok je rozpracovaný – pokračovat můžete i tak"}</span>
      {next ? (
        <Link href={next.href(project.id)} aria-label="Pokračovat na další krok (dole)" className="touch-target ml-auto flex items-center gap-2 rounded-md bg-emerald-500 px-5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400" data-testid="next-step-bottom">
          Další krok: {labelOf(next, design)} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
