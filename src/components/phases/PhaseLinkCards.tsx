import { Fragment } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import { phaseArrowClass, phaseBubbleClass, phaseCardClass, phaseSubtitleClass, phaseTitleClass } from "./phase-style";

export interface PhaseLinkCard {
  id: number;
  /** „2. Strom zapojení, Fáze & Linter“. */
  title: string;
  /** Živý stav fáze („strom zapojení kompletní“). */
  subtitle: string;
  hint?: string;
  href: string;
  done: boolean;
  testId: string;
}

/**
 * Fáze 98: krokové karty fází jako odkazy (AI Panel Builder – stránky projektu, ELDOCK Průmysl – agenda závodu v URL).
 * Stejný vzhled jako průvodce 2D půdorysem (`phase-style.ts`); na telefonu mřížka 2 × 2 bez šipek.
 */
export function PhaseLinkCards({ items, active, label, testId }: { items: readonly PhaseLinkCard[]; active: number; label: string; testId: string }) {
  return (
    <div className="grid min-w-0 grid-cols-2 items-stretch gap-1 lg:flex lg:gap-0.5" role="group" aria-label={label} data-testid={testId}>
      {items.map((item, index) => {
        const isActive = item.id === active;
        const done = item.done && !isActive;
        return (
          <Fragment key={item.id}>
            {index > 0 ? (
              <span className={cn(phaseArrowClass(item.id <= active), "hidden lg:flex")} aria-hidden>
                →
              </span>
            ) : null}
            <Link
              href={item.href}
              aria-current={isActive ? "step" : undefined}
              aria-label={`${item.title} – ${item.subtitle}${done ? " (hotovo)" : ""}`}
              title={item.hint}
              className={cn(phaseCardClass(isActive, done), "min-w-0 lg:min-w-[11rem]")}
              data-testid={item.testId}
              data-phase={item.id}
              data-done={item.done ? "true" : "false"}
            >
              <span className={phaseBubbleClass(isActive, done)} aria-hidden>
                {done ? "✓" : item.id}
              </span>
              <span className="min-w-0 flex-1">
                <b className={phaseTitleClass(isActive)}>{item.title}</b>
                <span className={phaseSubtitleClass(isActive)} data-testid={`${item.testId}-status`}>
                  {item.subtitle}
                </span>
              </span>
            </Link>
          </Fragment>
        );
      })}
    </div>
  );
}
