"use client";

import { useState } from "react";
import { Building2, ExternalLink, House, RefreshCw, ToggleRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { seriesLink } from "@/lib/panel-builder/series-links";
import { deviceToneOf } from "@/lib/panel-builder/smart-datasheet";
import { PRODUCT_FAMILIES, SMART_MANUFACTURERS, familiesOf, type CatalogProduct } from "@/lib/panel-builder/smart-catalog";
import { SUPPLY_SYSTEMS, type SupplySystem } from "@/lib/panel-builder/supply";
import { DESIGN_BRANDS, designBrand, designSeriesOf, seriesColors } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";
import { DeviceMockup, SeriesGallery } from "./SeriesGallery";
import { SmartHomeDeviceCatalog, type SmartCatalogProps } from "../SmartHomeDeviceCatalog";

/**
 * Fáze 55: horní lišta 2D půdorysu nad rastrem – 1. výrobce s logem → 2. designová řada s náhledem tvaru → 3. barvy dané řady
 * (ABB podle Katalogu 2026 s kódy barev). Po přepnutí řady nabídne jen její barvy (volbu barvy řeší `colorForSeries`).
 * Vlevo zůstává jen paleta osazovaných prvků. Součástí lišty je i soustava přívodu rozváděče (1f / 3f).
 * Fáze 61: náhled řady = rámeček s klapkou v barvě řady (`DeviceMockup`), dvoubarevné vzorky (rámeček / kryt)
 * a velká galerie řad a barev (`SeriesGallery`) s víceramečkem, povrchem a objednacími čísly rámečků.
 * Fáze 63: u ABB přepínač produktových rodin (domovní spínače a zásuvky / ABB-free@home / ABB i-bus KNX
 * & ABB-flexTronics), výrobci chytré automatizace Loxone a TapHome a odkaz „🌐 Prohlédnout řadu na webu výrobce ↗“.
 */
/** Ikony segmentového přepínače rodin ABB (fáze 65). */
const FAMILY_ICON: Record<string, LucideIcon> = { "abb-design": ToggleRight, "abb-fah": House, "abb-knx": Building2 };

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
  installation = "classic",
  smartSystem = "abb_freeathome",
  activeProduct = null,
  onSmartSystem,
  onBusLevel,
  onPlaceProduct,
  placed = () => 0,
  planned = () => 0,
  extras = {},
  onExtra,
  onDatasheet,
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
  installation?: InstallLevel;
  smartSystem?: string;
  activeProduct?: string | null;
  onSmartSystem?: (system: string) => void;
  onBusLevel?: () => void;
  onPlaceProduct?: (product: CatalogProduct) => void;
  /** Fáze 65: osazené kusy výrobku, kusy modulu podle výpočtu, ručně přidané moduly, technický list. */
  placed?: SmartCatalogProps["placed"];
  planned?: SmartCatalogProps["planned"];
  extras?: SmartCatalogProps["extras"];
  onExtra?: SmartCatalogProps["onExtra"];
  onDatasheet?: SmartCatalogProps["onDatasheet"];
}) {
  const current = designSeriesOf(seriesKey);
  const brand = current?.brand ?? designBrand(seriesKey?.split("|")[0]) ?? DESIGN_BRANDS[0];
  const colors = seriesColors(seriesKey);
  const swatch = colors.find((option) => option.id === color)?.swatch ?? colors[0].swatch;
  /** Zobrazený výrobce chytré automatizace (Loxone / TapHome) – řada domovních přístrojů se tím nemění. */
  const [smartBrand, setSmartBrand] = useState<string | null>(null);
  const [abbFamily, setAbbFamily] = useState("abb-design");
  const family = smartBrand ? familiesOf(smartBrand)[0] : brand.manufacturer === "ABB" && abbFamily !== "abb-design" ? PRODUCT_FAMILIES.find((option) => option.id === abbFamily) : null;
  const link = seriesLink(seriesKey);
  // Fáze 65: barva náhledů přístrojů – dvoubarevná řada (rámeček / klapka), u Loxone bílá / antracit
  const tone = deviceToneOf(seriesKey, color, family?.colors);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2" aria-label="Domovní přístroje – výrobce, řada a barva" data-testid="device-appearance">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="1. Výrobce">
          {DESIGN_BRANDS.map((option) => (
            <button
              key={option.manufacturer}
              type="button"
              role="radio"
              aria-checked={!smartBrand && brand.manufacturer === option.manufacturer}
              aria-label={option.label}
              onClick={() => {
                setSmartBrand(null);
                if (option.manufacturer !== brand.manufacturer) onChange({ series: `${option.manufacturer}|${option.series[0].name}` });
              }}
              className={cn("flex h-10 w-24 items-center justify-center overflow-hidden rounded-md border p-1", !smartBrand && brand.manufacturer === option.manufacturer ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/60")}
            >
              <ManufacturerLogo manufacturer={option.manufacturer} className="h-7 w-full" />
            </button>
          ))}
          {/* Fáze 63: výrobci chytré automatizace */}
          {SMART_MANUFACTURERS.map((name) => (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={smartBrand === name}
              aria-label={name}
              onClick={() => setSmartBrand(name)}
              className={cn("flex h-10 w-24 items-center justify-center overflow-hidden rounded-md border p-1", smartBrand === name ? "border-emerald-500 ring-2 ring-emerald-500" : "border-border hover:border-emerald-500/60")}
              data-testid={`smart-brand-${name}`}
            >
              <ManufacturerLogo manufacturer={name} className="h-7 w-full" />
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
      {/* Fáze 65: segmentový přepínač rodin ABB s ikonami a podtitulky */}
      {!smartBrand && brand.manufacturer === "ABB" ? (
        <div className="grid gap-1 rounded-xl border border-border bg-background/60 p-1 sm:grid-cols-3" role="radiogroup" aria-label="Produktová rodina ABB" data-testid="abb-families">
          {familiesOf("ABB").map((option) => {
            const Icon: LucideIcon = FAMILY_ICON[option.id] ?? ToggleRight;
            const active = abbFamily === option.id;
            return (
              <button key={option.id} type="button" role="radio" aria-checked={active} onClick={() => setAbbFamily(option.id)} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted")} data-family={option.id}>
                <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{option.label}</span>
                  <span className={cn("block text-[11px] leading-tight", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{option.id === "abb-design" ? `${brand.series.length} ${option.subtitle}` : option.subtitle}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      {family ? (
        <SmartHomeDeviceCatalog
          family={family}
          installation={installation}
          smartSystem={smartSystem}
          activeProduct={activeProduct}
          color={color}
          tone={tone}
          placed={placed}
          planned={planned}
          extras={extras}
          onSystem={(system) => onSmartSystem?.(system)}
          onBusLevel={() => onBusLevel?.()}
          onPlace={(product) => onPlaceProduct?.(product)}
          onColor={(next) => onChange({ color: next })}
          onExtra={(moduleId, delta) => onExtra?.(moduleId, delta)}
          onDatasheet={(product) => onDatasheet?.(product)}
        />
      ) : (
        <>
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
                  <DeviceMockup seriesKey={key} shape={series.shape ?? "square"} color={(active ? series.colors?.find((option) => option.id === color) : null) ?? series.colors?.[0] ?? { swatch: active ? swatch : "#f8fafc" }} items={["switch"]} className="size-9 rounded" label={`Náhled řady ${series.name}`} />
                  <span className="line-clamp-2 text-center">{series.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="3. Barva přístrojů">
            {colors.map((option) => {
              const look = current?.series.colors?.find((candidate) => candidate.id === option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={color === option.id}
                  onClick={() => onChange({ color: option.id })}
                  className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", color === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
                >
                  <span className="size-3.5 shrink-0 rounded-full border border-zinc-500" style={{ background: look?.frame && look.insert ? `linear-gradient(135deg, ${look.frame} 50%, ${look.insert} 50%)` : option.swatch }} aria-hidden />
                  {option.label}
                </button>
              );
            })}
            <div className="ml-auto flex flex-wrap gap-1">
              <SeriesGallery seriesKey={seriesKey} color={color} available={available} onChoose={(patch) => onChange(patch)} />
              {link ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium hover:border-primary/60" data-testid="series-web">
                  🌐 Prohlédnout řadu na webu výrobce <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onApplyAll}>
                <RefreshCw className="size-3.5" aria-hidden /> Použít na celý půdorys
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={onApplyRoom} disabled={!selectedRoom} title={selectedRoom ? undefined : "Nejdřív vyberte místnost na plátně"}>
                Na místnost{selectedRoom ? ` (${selectedRoom})` : ""}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
