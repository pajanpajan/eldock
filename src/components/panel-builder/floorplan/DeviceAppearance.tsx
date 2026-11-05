"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DESIGN_BRANDS, DESIGN_COLORS, designBrand, designSeriesOf } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";

/**
 * Kaskáda domovních přístrojů (fáze 51): 1. výrobce s logem → 2. designová řada → 3. barva.
 * Volba platí pro nově vkládané prvky; tlačítka ji přenesou na celý půdorys nebo vybranou místnost.
 */
export function DeviceAppearance({
  seriesKey,
  color,
  available,
  selectedRoom,
  onChange,
  onApplyAll,
  onApplyRoom,
}: {
  seriesKey: string | null;
  color: string;
  /** Počty přístrojů řad v katalogu („ABB|Levit“ → 258). */
  available: Map<string, number>;
  selectedRoom: string | null;
  onChange: (patch: { series?: string; color?: string }) => void;
  onApplyAll: () => void;
  onApplyRoom: () => void;
}) {
  const current = designSeriesOf(seriesKey);
  const brand = current?.brand ?? designBrand(seriesKey?.split("|")[0]) ?? DESIGN_BRANDS[0];
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-2" aria-label="Domovní přístroje – výrobce, řada a barva" data-testid="device-appearance">
      <h3 className="text-xs font-bold text-muted-foreground">🎨 Domovní přístroje</h3>
      <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="1. Výrobce">
        {DESIGN_BRANDS.map((option) => (
          <button
            key={option.manufacturer}
            type="button"
            role="radio"
            aria-checked={brand.manufacturer === option.manufacturer}
            aria-label={option.label}
            onClick={() => onChange({ series: `${option.manufacturer}|${option.series[0].name}` })}
            className={cn("flex h-11 min-w-0 items-center justify-center overflow-hidden rounded-md border p-1", brand.manufacturer === option.manufacturer ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/60")}
          >
            <ManufacturerLogo manufacturer={option.manufacturer} className="h-8 w-full" />
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="2. Designová řada">
        {brand.series.map((series) => {
          const key = `${brand.manufacturer}|${series.name}`;
          const count = series.dbSeries.reduce((sum, name) => sum + (available.get(`${brand.manufacturer}|${name}`) ?? 0), 0);
          const active = current?.series.name === series.name;
          return (
            <button
              key={series.name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange({ series: key })}
              title={count ? `${count} přístrojů v katalogu` : "Řada zatím není v katalogu – přístroje doplníte v konfigurátoru"}
              className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", active ? "border-primary bg-primary text-primary-foreground" : count ? "border-border text-foreground hover:border-primary/60" : "border-dashed border-border text-muted-foreground")}
            >
              {series.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-0.5" role="radiogroup" aria-label="3. Barva přístrojů">
        {DESIGN_COLORS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={color === option.id}
            onClick={() => onChange({ color: option.id })}
            className={cn("flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-left text-[11px]", color === option.id ? "border-primary bg-primary/15 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            <span className="size-3.5 shrink-0 rounded-full border border-zinc-500" style={{ background: option.swatch }} aria-hidden />
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onApplyAll}>
          <RefreshCw className="size-3.5" aria-hidden /> 🔄 Použít na celý půdorys
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onApplyRoom} disabled={!selectedRoom} title={selectedRoom ? undefined : "Nejdřív vyberte místnost na plátně"}>
          Použít na vybranou místnost{selectedRoom ? ` (${selectedRoom})` : ""}
        </Button>
      </div>
    </section>
  );
}
