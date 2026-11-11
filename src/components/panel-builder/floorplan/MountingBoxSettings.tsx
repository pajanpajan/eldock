"use client";

import { BOX_MAKERS, WALL_TYPES, type BoxMaker, type WallType } from "@/lib/panel-builder/box-options";

/**
 * Fáze 91: výrobce instalačních krabic a výchozí konstrukce stěn / prostředí nákresu (místnost ji přepíše v detailu
 * místnosti) – podle nich kusovník vybere krabice a hlídač hloubky doporučí hlubokou krabici.
 */
export function MountingBoxSettings({ maker, wall, onChange }: { maker: BoxMaker; wall: WallType; onChange: (patch: { boxMaker?: BoxMaker; wallType?: WallType }) => void }) {
  const select = "h-7 min-w-0 rounded-md border border-input bg-transparent px-1 text-xs text-foreground dark:bg-input/30";
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border/70 px-2 py-1.5" role="group" aria-label="Instalační krabičky" data-testid="box-settings">
      <span className="self-center text-[11px] font-semibold text-foreground">📦 Instalační krabičky</span>
      <label className="flex min-w-0 flex-col gap-0.5 text-[11px] text-muted-foreground">
        Výrobce instalačních krabiček
        <select value={maker} onChange={(event) => onChange({ boxMaker: event.target.value as BoxMaker })} className={select} aria-label="Výrobce instalačních krabiček" data-testid="box-maker">
          {BOX_MAKERS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label} – {option.hint}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-col gap-0.5 text-[11px] text-muted-foreground">
        Výchozí konstrukce stěn / prostředí
        <select value={wall} onChange={(event) => onChange({ wallType: event.target.value as WallType })} className={select} aria-label="Výchozí konstrukce stěn" data-testid="box-wall">
          {WALL_TYPES.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <span className="self-center text-[11px] text-muted-foreground">Koupelnu, dřevostavbu nebo fasádu nastavíte v detailu místnosti.</span>
    </div>
  );
}
