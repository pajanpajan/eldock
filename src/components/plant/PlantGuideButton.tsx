"use client";

import Link from "next/link";

/** Událost, na kterou průvodce na stránce závodu otevře volbu režimu (bez nového načtení stránky). */
export const PLANT_GUIDE_EVENT = "eldock:plant-guide";

/**
 * Fáze 92: „🧭 Průvodce závodem“ v horní liště – na stránce závodu otevře průvodce rovnou (i opakovaně), jinde přejde
 * na naposledy otevřený závod s `?pruvodce=1`.
 */
export function PlantGuideButton({ href }: { href: string }) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        const handled = !window.dispatchEvent(new CustomEvent(PLANT_GUIDE_EVENT, { cancelable: true }));
        if (handled) event.preventDefault();
      }}
      className="touch-target flex items-center gap-1.5 rounded-lg border border-primary/50 px-2.5 text-sm font-medium text-foreground outline-none hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50"
      aria-label="Průvodce závodem – založení haly a stroje, mise noční poruchy"
      data-testid="plant-guide-open"
    >
      🧭 <span className="hidden md:inline">Průvodce závodem</span>
    </Link>
  );
}
