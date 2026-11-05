"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { SeriesShape } from "@/lib/panel-builder/abb-catalog-2026";
import { SUPPLY_SYSTEMS, type SupplySystem } from "@/lib/panel-builder/supply";
import { DESIGN_BRANDS, designBrand, designSeriesOf, seriesColors } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";

/**
 * Fáze 55: horní lišta 2D půdorysu nad rastrem – 1. výrobce s logem → 2. designová řada s náhledem tvaru → 3. barvy dané řady
 * (ABB podle Katalogu 2026 s kódy barev). Po přepnutí řady nabídne jen její barvy (volbu barvy řeší `colorForSeries`).
 * Vlevo zůstává jen paleta osazovaných prvků. Součástí lišty je i soustava přívodu rozváděče (1f / 3f).
 */
export function DeviceAppearance({
  seriesKey,
  color,
  available,
  selectedRoom,
  supply,
  onChange,
  onSupply,
  onApplyAll,
  onApplyRoom,
}: {
  seriesKey: string | null;
  color: string;
  /** Počty přístrojů řad v katalogu („ABB|Levit“ → 258). */
  available: Map<string, number>;
  selectedRoom: string | null;
  supply: SupplySystem["id"];
  onChange: (patch: { series?: string; color?: string }) => void;
  onSupply: (supply: SupplySystem["id"]) => void;
  onApplyAll: () => void;
  onApplyRoom: () => void;
}) {
  const current = designSeriesOf(seriesKey);
  const brand = current?.brand ?? designBrand(seriesKey?.split("|")[0]) ?? DESIGN_BRANDS[0];
  const colors = seriesColors(seriesKey);
  const swatch = colors.find((option) => option.id === color)?.swatch ?? colors[0].swatch;
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2" aria-label="Domovní přístroje – výrobce, řada a barva" data-testid="device-appearance">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="radiogroup" aria-label="1. Výrobce">
          {DESIGN_BRANDS.map((option) => (
            <button
              key={option.manufacturer}
              type="button"
              role="radio"
              aria-checked={brand.manufacturer === option.manufacturer}
              aria-label={option.label}
              onClick={() => onChange({ series: `${option.manufacturer}|${option.series[0].name}` })}
              className={cn("flex h-10 w-24 items-center justify-center overflow-hidden rounded-md border p-1", brand.manufacturer === option.manufacturer ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/60")}
            >
              <ManufacturerLogo manufacturer={option.manufacturer} className="h-7 w-full" />
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          Přívod rozváděče:
          <select value={supply} onChange={(event) => onSupply(event.target.value as SupplySystem["id"])} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30" aria-label="Soustava a počet fází přívodu" data-testid="floorplan-supply">
            {SUPPLY_SYSTEMS.map((option) => (
              <option key={option.id} value={option.id} title={option.detail}>
                {option.phases === 3 ? "3× 230/400 V" : "1× 230 V"} · {option.system}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1" role="radiogroup" aria-label="2. Designová řada">
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
              aria-label={series.name}
              onClick={() => onChange({ series: key })}
              title={count ? `${count} přístrojů v katalogu` : "Řada zatím není v katalogu – přístroje doplníte v konfigurátoru"}
              className={cn("flex w-20 shrink-0 flex-col items-center gap-0.5 rounded-md border p-1 text-[10px] leading-tight", active ? "border-primary bg-primary/20 text-foreground" : count ? "border-border text-foreground hover:border-primary/60" : "border-dashed border-border text-muted-foreground")}
            >
              <SeriesPreview shape={series.shape ?? "square"} color={active ? swatch : "#f8fafc"} />
              <span className="line-clamp-2 text-center">{series.name}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="3. Barva přístrojů">
        {colors.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={color === option.id}
            onClick={() => onChange({ color: option.id })}
            className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", color === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
          >
            <span className="size-3.5 shrink-0 rounded-full border border-zinc-500" style={{ background: option.swatch }} aria-hidden />
            {option.label}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onApplyAll}>
            <RefreshCw className="size-3.5" aria-hidden /> Použít na celý půdorys
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onApplyRoom} disabled={!selectedRoom} title={selectedRoom ? undefined : "Nejdřív vyberte místnost na plátně"}>
            Na místnost{selectedRoom ? ` (${selectedRoom})` : ""}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** 2D náhled typického tvaru rámečku a klapky řady (fáze 55). */
export function SeriesPreview({ shape, color }: { shape: SeriesShape; color: string }) {
  const stroke = "#52525b";
  const frame = (() => {
    switch (shape) {
      case "rounded":
        return <rect x="4" y="4" width="32" height="32" rx="9" fill={color} stroke={stroke} />;
      case "layered":
        return (
          <>
            <rect x="4" y="4" width="32" height="32" rx="2" fill={color} stroke={stroke} />
            <rect x="7" y="7" width="26" height="26" rx="1" fill="none" stroke="#a1a1aa" strokeDasharray="1 1" />
          </>
        );
      case "thin":
        return <rect x="5" y="5" width="30" height="30" rx="4" fill={color} stroke={stroke} strokeWidth="0.6" />;
      case "metal":
        return (
          <>
            <rect x="4" y="4" width="32" height="32" rx="3" fill={color} stroke={stroke} />
            <rect x="4" y="17" width="32" height="2.5" fill="#a1a1aa" />
          </>
        );
      case "wood":
        return (
          <>
            <rect x="4" y="4" width="32" height="32" rx="3" fill="#a16207" stroke={stroke} />
            <rect x="9" y="9" width="22" height="22" rx="2" fill={color} />
          </>
        );
      case "soft":
        return <rect x="4" y="4" width="32" height="32" rx="6" fill={color} stroke={stroke} />;
      case "classic":
        return <rect x="5" y="5" width="30" height="30" rx="1" fill={color} stroke={stroke} strokeWidth="1.5" />;
      case "porcelain":
        return <circle cx="20" cy="20" r="16" fill={color} stroke={stroke} />;
      case "flat":
        return <rect x="4" y="6" width="32" height="28" rx="1" fill={color} stroke={stroke} strokeWidth="0.6" />;
      case "solo":
        return <rect x="4" y="4" width="32" height="32" rx="12" fill={color} stroke={stroke} />;
      case "thick":
        return <rect x="3" y="3" width="34" height="34" rx="3" fill={color} stroke={stroke} strokeWidth="3" />;
      case "surface":
        return (
          <>
            <rect x="4" y="4" width="32" height="32" rx="5" fill={color} stroke={stroke} />
            <path d="M8 12h24" stroke="#a1a1aa" />
          </>
        );
      default:
        return <rect x="4" y="4" width="32" height="32" rx="2" fill={color} stroke={stroke} />;
    }
  })();
  const rocker = shape === "porcelain" ? <rect x="18" y="12" width="4" height="16" rx="2" fill="#71717a" /> : <rect x="12" y="12" width="16" height="16" rx={shape === "rounded" || shape === "solo" ? 5 : 1.5} fill="none" stroke="#71717a" />;
  return (
    <svg viewBox="0 0 40 40" className="size-9" aria-hidden>
      {frame}
      {rocker}
    </svg>
  );
}
