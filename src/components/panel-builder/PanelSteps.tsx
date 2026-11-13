import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";

import { PhaseLinkCards } from "@/components/phases/PhaseLinkCards";
import { fitsEnclosure, enclosureNeed } from "@/lib/panel-builder/enclosures";
import {
  PANEL_PHASES,
  nextPanelPage,
  panelPageCode,
  panelPageDone,
  panelPageHref,
  panelPageLabel,
  panelPhase,
  panelPhaseOf,
  panelPhaseStatus,
  panelStepLabel,
  prevPanelPage,
  type PanelPage,
} from "@/lib/panel-builder/panel-phases";
import { stepProgress } from "@/lib/panel-builder/project";
import { railCapacities } from "@/lib/panel-builder/rails";
import { parseRailLayout } from "@/lib/panel-builder/rail-layout";
import { cn } from "@/lib/utils";
import type { PanelProjectDetail } from "@/server/queries/panel-builder";
import { documentationState } from "@/server/services/panel-builder";

export type PanelStep = PanelPage;

/** Stav kroků projektu (✓ Hotovo / Rozpracováno) – vybraná skříň, do které se návrh vejde = skříň hotová. */
function progressOf(project: PanelProjectDetail) {
  const { connected, thermal } = documentationState(project);
  const need = enclosureNeed(railCapacities(project), project.items, parseRailLayout(project.railLayoutJson, railCapacities(project).length));
  const enclosure = Boolean(project.enclosureId || project.enclosureModel) && (!project.enclosure || fitsEnclosure(project.enclosure, need));
  return stepProgress({ items: project.items, status: project.status, connected, thermalOk: thermal.ok, enclosure });
}

/**
 * Fáze 48 / 75 / 98: fázový průvodce projektu rozváděče – 4 krokové karty ve stejném stylu jako 2D půdorys (žlutá
 * aktivní fáze, zelená ✓ hotová), u fází se dvěma částmi přepínač 1a / 1b (4a / 4b), nápověda fáze a Předchozí / Další.
 * Na stránce je vždy jen agenda aktivní části – volný přechod tam i zpět.
 */
export function PanelSteps({ project, current }: { project: PanelProjectDetail; current: PanelStep }) {
  const progress = progressOf(project);
  const design = project.designMode === "DESIGN";
  const phase = panelPhaseOf(current);
  const info = panelPhase(phase);
  const status = panelPhaseStatus(progress);
  const previous = prevPanelPage(current);
  const next = nextPanelPage(current);
  return (
    <nav aria-label="Kroky projektu" className="no-print mb-6 flex flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5 print:hidden" data-testid="panel-phase-stepper" data-phase={phase} data-page={current}>
      <PhaseLinkCards
        label="Fáze projektu rozváděče"
        testId="panel-phase-cards"
        active={phase}
        items={PANEL_PHASES.map((item) => {
          const state = status[item.id - 1];
          return { id: item.id, title: item.label, subtitle: state.subtitle, hint: item.hint, href: panelPageHref(item.pages[0], project.id), done: state.done, testId: `panel-phase-${item.id}` };
        })}
      />
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        {info.pages.length > 1 ? (
          <span className="flex flex-wrap items-center gap-1" role="group" aria-label={`Části fáze ${info.label}`} data-testid="panel-subpages">
            {info.pages.map((page) => {
              const active = page === current;
              const done = panelPageDone(page, progress);
              return (
                <Link
                  key={page}
                  href={panelPageHref(page, project.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "touch-target flex items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                    active ? "border-yellow-400 bg-yellow-400/15 font-semibold text-foreground" : "border-border text-muted-foreground hover:border-primary/60 hover:text-foreground",
                  )}
                  data-step={page}
                  data-done={done === null ? undefined : done ? "true" : "false"}
                  data-testid={`panel-page-${page}`}
                >
                  <span className="font-mono text-xs font-bold">{panelPageCode(page)}</span> {panelPageLabel(page, design)}
                  {done === null ? null : (
                    <span className={cn("flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", done ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground")}>
                      {done ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}
                      {done ? "✓ Hotovo" : "Rozpracováno"}
                    </span>
                  )}
                </Link>
              );
            })}
          </span>
        ) : null}
        <span className="min-w-[14rem] flex-1 text-[11px] leading-tight text-muted-foreground" data-testid="panel-phase-hint">
          💡 {info.hint}
        </span>
        {previous ? (
          <Link href={panelPageHref(previous, project.id)} className="touch-target flex items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Zpět na předchozí krok (nahoře)" data-testid="prev-step">
            <ArrowLeft className="size-4" aria-hidden /> {panelStepLabel(current, previous, design)}
          </Link>
        ) : null}
        {next ? (
          <Link
            href={panelPageHref(next, project.id)}
            aria-label="Pokračovat na další krok"
            className="touch-target flex items-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 focus-visible:ring-3 focus-visible:ring-emerald-300/60"
            data-testid="next-step"
          >
            Další: {panelStepLabel(current, next, design)}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Fáze 75 / 98: lišta dole na stránce – předchozí a výrazný další krok průvodce (bez hledání v horní liště). */
export function NextStepBar({ project, current }: { project: PanelProjectDetail; current: PanelStep }) {
  const previous = prevPanelPage(current);
  const next = nextPanelPage(current);
  const progress = progressOf(project);
  const done = panelPageDone(current, progress);
  const design = project.designMode === "DESIGN";
  if (!previous && !next) return null;
  return (
    <div className="no-print sticky bottom-3 z-30 mt-8 flex print:hidden flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-2xl backdrop-blur" role="navigation" aria-label="Přechod mezi kroky" data-testid="next-step-bar" data-page={current}>
      {previous ? (
        <Link href={panelPageHref(previous, project.id)} className="touch-target flex items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Zpět na předchozí krok">
          <ArrowLeft className="size-4" aria-hidden /> {panelStepLabel(current, previous, design)}
        </Link>
      ) : null}
      <span className={cn("text-xs", done ? "text-emerald-300" : "text-muted-foreground")}>
        Fáze {panelPhaseOf(current)} ze 4 · {done === null ? "štítky vytisknete kdykoli" : done ? "✓ Tento krok je hotový" : "Krok je rozpracovaný – pokračovat můžete i tak"}
      </span>
      {next ? (
        <Link href={panelPageHref(next, project.id)} aria-label="Pokračovat na další krok (dole)" className="touch-target ml-auto flex items-center gap-2 rounded-md bg-emerald-500 px-5 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400" data-testid="next-step-bottom">
          Další: {panelStepLabel(current, next, design)} <ArrowRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}
