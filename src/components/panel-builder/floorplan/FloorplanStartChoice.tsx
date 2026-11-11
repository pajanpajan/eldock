"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Fáze 92: přívětivá volba pro nového uživatele 2D půdorysu – „🎯 Vyzkoušet nanečisto“ (rozdělaný bungalov, 3 kliky,
 * rozváděč bez kreditu) nebo „➕ Začít prázdný půdorys“. Jako karta v prázdném seznamu půdorysů i nad editorem nového
 * půdorysu, dokud firma nemá žádný uložený půdorys (nemodální – nic neblokuje).
 */
export function StartChoiceButtons({ onBlank, blankHref, className, stacked = false }: { onBlank?: () => void; blankHref?: string; className?: string; /** Pod sebou (úzký sloupec editoru). */ stacked?: boolean }) {
  const blank = "flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left hover:border-primary/60";
  return (
    <div className={cn("grid gap-3", stacked ? "grid-cols-1 gap-2" : "sm:grid-cols-2", className)} data-testid="floorplan-start-choice">
      <Link href="/panel-builder/floorplan/trenazer" className="trainer-pulse flex flex-col gap-1 rounded-xl border-2 border-yellow-400/80 bg-yellow-400/10 p-4 text-left hover:bg-yellow-400/15" data-testid="start-trainer">
        <b className="text-base text-yellow-100">🎯 Vyzkoušet nanečisto: Dokončit rozdělaný dům 3 kliky (45 s)</b>
        <span className="text-xs text-muted-foreground">Bungalov 4+kk je z 85 % hotový – doplníte zásuvku, stmívání a jedním klikem vygenerujete rozváděč. Nic se neukládá, 0 kreditů.</span>
      </Link>
      {onBlank ? (
        <button type="button" onClick={onBlank} className={blank} data-testid="start-blank">
          <b className="text-base">➕ Začít prázdný půdorys</b>
          <span className="text-xs text-muted-foreground">Nahrajte výkres (obrázek / PDF / DXF) nebo nakreslete místnosti zadáním rozměrů.</span>
        </button>
      ) : (
        <Link href={blankHref ?? "/panel-builder/floorplan/novy"} className={blank} data-testid="start-blank">
          <b className="text-base">➕ Začít prázdný půdorys</b>
          <span className="text-xs text-muted-foreground">Nahrajte výkres (obrázek / PDF / DXF) nebo nakreslete místnosti zadáním rozměrů.</span>
        </Link>
      )}
    </div>
  );
}

/**
 * Karta nahoře v pravém sloupci editoru nového půdorysu (firma zatím nemá žádný půdorys) – nic neblokuje ani neposouvá
 * plátno; „Začít prázdný půdorys“ ji zavře a kreslí se hned.
 */
export function FloorplanStartChoice() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-yellow-400/50 bg-card p-2.5" aria-label="Jak chcete začít" data-testid="floorplan-start-card">
      <h2 className="text-sm font-semibold">Jak chcete začít?</h2>
      <p className="text-[11px] leading-snug text-muted-foreground">Poprvé ve 2D půdorysu? Na rozdělané zakázce uvidíte za 45 s trasy kabelů, kusovník i hotový rozváděč.</p>
      <StartChoiceButtons onBlank={() => setOpen(false)} stacked />
    </section>
  );
}
