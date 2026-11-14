import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { PhaseLinkCards } from "@/components/phases/PhaseLinkCards";
import { cn } from "@/lib/utils";
import { PLANT_PHASES, plantPhase, plantPhaseHref, plantPhaseStatus, type PlantPhaseCounts, type PlantPhaseId } from "@/lib/plant-phases";

/**
 * Fáze 98: přepínač agend ELDOCK Průmysl nad pracovní plochou závodu – 4 krokové karty ve stejném stylu jako průvodce
 * 2D půdorysem a AI Panel Builder (žlutá aktivní agenda, zelená ✓ bez nevyřízených úkolů), nápověda a Předchozí / Další.
 * Agenda je v adrese, přepnutí vyčistí plochu na jedinou agendu.
 */
export function PlantPhaseSwitcher({ plantId, phase, counts }: { plantId: string; phase: PlantPhaseId; counts: PlantPhaseCounts }) {
  const status = plantPhaseStatus(counts);
  const info = plantPhase(phase);
  const previous = phase > 1 ? ((phase - 1) as PlantPhaseId) : null;
  const next = phase < 4 ? ((phase + 1) as PlantPhaseId) : null;
  return (
    <nav aria-label="Agendy závodu" className="mb-3 flex flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5 print:hidden" data-testid="plant-phase-switcher" data-phase={phase}>
      <PhaseLinkCards
        label="Fáze správy závodu"
        testId="plant-phase-cards"
        active={phase}
        items={PLANT_PHASES.map((item) => ({ id: item.id, title: item.label, subtitle: status[item.id - 1].subtitle, hint: item.hint, href: plantPhaseHref(plantId, item.id), done: status[item.id - 1].done, testId: `plant-phase-${item.id}` }))}
      />
      {/* Fáze 115: na mapě závodu bez řádku nápovědy – mapa areálu začíná hned pod přepínačem */}
      <div className={cn("flex flex-wrap items-center gap-2 px-0.5", phase === 1 && "hidden")}>
        <span className="min-w-[14rem] flex-1 text-[11px] leading-tight text-muted-foreground" data-testid="plant-phase-hint">
          💡 {info.hint}
        </span>
        {previous ? (
          <Link href={plantPhaseHref(plantId, previous)} className="touch-target flex items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" data-testid="plant-phase-prev">
            <ArrowLeft className="size-4" aria-hidden /> {plantPhase(previous).label}
          </Link>
        ) : null}
        {next ? (
          <Link href={plantPhaseHref(plantId, next)} className="touch-target flex items-center gap-2 rounded-md bg-emerald-500 px-4 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400" data-testid="plant-phase-next">
            Další: {plantPhase(next).label} <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
