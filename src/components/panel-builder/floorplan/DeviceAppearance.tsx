"use client";

import { useState } from "react";
import { Building2, ExternalLink, House, RefreshCw, ToggleRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { InstallLevel } from "@/engine/floorplan-bridge";
import { seriesLink } from "@/lib/panel-builder/series-links";
import { deviceToneOf } from "@/lib/panel-builder/smart-datasheet";
import { PRODUCT_FAMILIES, SMART_MANUFACTURERS, familiesOf, type CatalogProduct } from "@/lib/panel-builder/smart-catalog";
import { SUPPLY_SYSTEMS, type SupplySystem } from "@/lib/panel-builder/supply";
import { DESIGN_BRANDS, colorForSeries, designBrand, designSeriesOf, hasFrameChoice, hasSeparateFrames, isMonoblockSeries, seriesColors, seriesFrameColors } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { ManufacturerLogo, brandCardClass } from "../ManufacturerLogo";
import { DeviceMockup, SeriesGallery, SeriesThumb, combineLook } from "./SeriesGallery";
import { SmartHomeDeviceCatalog, type SmartCatalogProps, type ProductChoice } from "../SmartHomeDeviceCatalog";

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
  frameColor = null,
  available,
  selectedRoom,
  supply,
  showSupply = true,
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
  /** Fáze 74: barva rámečku (null = stejná jako klapka). */
  frameColor?: string | null;
  /** Počty přístrojů řad v katalogu („ABB|Levit“ → 258). */
  available: Map<string, number>;
  selectedRoom: string | null;
  supply: SupplySystem["id"];
  /** Fáze 98: výběr přívodu (fáze 2 ho ukazuje samostatně). */
  showSupply?: boolean;
  onChange: (patch: { series?: string; color?: string; frameColor?: string | null }) => void;
  onSupply: (supply: SupplySystem["id"]) => void;
  onApplyAll: () => void;
  onApplyRoom: () => void;
  installation?: InstallLevel;
  smartSystem?: string;
  activeProduct?: string | null;
  onSmartSystem?: (system: string) => void;
  onBusLevel?: () => void;
  onPlaceProduct?: (product: CatalogProduct, choice?: ProductChoice) => void;
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
              className={brandCardClass(!smartBrand && brand.manufacturer === option.manufacturer)}
              data-testid={`brand-card-${option.manufacturer}`}
            >
              <ManufacturerLogo manufacturer={option.manufacturer} className="h-7 w-full" bare />
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
              className={brandCardClass(smartBrand === name)}
              data-testid={`smart-brand-${name}`}
            >
              <ManufacturerLogo manufacturer={name} className="h-7 w-full" bare />
            </button>
          ))}
        </div>
        {/* Fáze 98: přívod rozváděče patří do fáze 2 průvodce (karta rozváděče a typu prostoru) */}
        {showSupply ? <SupplySelect supply={supply} onSupply={onSupply} className="ml-auto" /> : null}
      </div>
      {/* Fáze 65: přepínač rodin ABB s ikonami a podtitulky; fáze 101: v úzkém pravém panelu pod sebou přes celou šířku
          (ve 3 sloupcích se text lámal po slovech a překrýval ikony) */}
      {!smartBrand && brand.manufacturer === "ABB" ? (
        <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-background/60 p-1" role="radiogroup" aria-label="Produktová rodina ABB" data-testid="abb-families">
          {familiesOf("ABB").map((option) => {
            const Icon: LucideIcon = FAMILY_ICON[option.id] ?? ToggleRight;
            const active = abbFamily === option.id;
            return (
              <button key={option.id} type="button" role="radio" aria-checked={active} onClick={() => setAbbFamily(option.id)} className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors", active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted")} data-family={option.id}>
                <Icon className="size-5 shrink-0" strokeWidth={1.6} aria-hidden />
                <span className="min-w-0 flex-1">
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
          onPlace={(product, choice) => onPlaceProduct?.(product, choice)}
          onColor={(next) => onChange({ color: next })}
          onExtra={(moduleId, delta) => onExtra?.(moduleId, delta)}
          onDatasheet={(product) => onDatasheet?.(product)}
        />
      ) : (
        <>
          {/* Fáze 101: řady v čisté 3sloupcové mřížce s čitelnými popisky (dřív vodorovný pás s posuvníkem) */}
          <p className="text-[11px] font-semibold text-muted-foreground">Designová řada {brand.label}</p>
          <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="2. Designová řada" data-testid="series-grid">
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
                  className={cn("flex w-full min-w-0 flex-col items-center gap-1 rounded-md border px-1 py-1.5 text-[11px] leading-tight", active ? "border-primary bg-primary/20 text-foreground" : count ? "border-border text-foreground hover:border-primary/60" : "border-dashed border-border text-muted-foreground")}
                >
                  {/* Fáze 80: produktový náhled řady v barvě (render z public/catalog-images), u jiné barvy rámečku kreslený */}
                  <SeriesThumb
                    seriesKey={key}
                    colorId={active ? (frameColor && frameColor !== color ? null : colorForSeries(key, color)) : series.colors?.[0]?.id}
                    className="size-9 rounded"
                    fallback={<DeviceMockup seriesKey={key} shape={series.shape ?? "square"} color={(active ? combineLook(series.colors?.find((option) => option.id === color), frameColor ? series.colors?.find((option) => option.id === frameColor) : null) : null) ?? series.colors?.[0] ?? { swatch: active ? swatch : "#f8fafc" }} items={["switch"]} className="size-9 rounded" label={`Náhled řady ${series.name}`} />}
                  />
                  <span className="line-clamp-2 text-center">{series.name}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-2" role="radiogroup" aria-label="3. Barva klapky / krytu" data-testid="insert-colors">
            <span className="basis-full text-[11px] font-semibold text-muted-foreground">Barva klapky / krytu</span>
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
          </div>
          {/* Fáze 74: barva rámečku zvlášť (výchozí stejná jako klapka); fáze 90: monobloky a Decento ji nemají */}
          <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label="4. Barva rámečku" data-testid="frame-colors">
            <span className="basis-full text-[11px] font-semibold text-muted-foreground">Barva rámečku</span>
            {!hasFrameChoice(seriesKey) ? (
              <span className="text-[11px] text-muted-foreground" data-testid="frame-color-none">
                {isMonoblockSeries(seriesKey) ? "nástěnný monoblok – bez samostatného rámečku" : "pevná dvojice středu a rámečku (provedení řady)"}
              </span>
            ) : null}
            {hasFrameChoice(seriesKey) ? (
            <button type="button" role="radio" aria-checked={!frameColor} onClick={() => onChange({ frameColor: null })} className={cn("rounded-full border px-2 py-0.5 text-[11px]", !frameColor ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="frame-color-same">
              {/* Fáze 91: Busch-axcent / solo carat – výchozí rámeček ke krytu podle kombinací v katalogu */}
              {hasSeparateFrames(seriesKey) ? "doporučený ke krytu" : "stejná jako klapka"}
            </button>
            ) : null}
            {(hasFrameChoice(seriesKey) ? seriesFrameColors(seriesKey) : []).map((option) => (
              <button key={option.id} type="button" role="radio" aria-checked={frameColor === option.id} onClick={() => onChange({ frameColor: option.id === color ? null : option.id })} title={`Rámeček ${option.label}`} className={cn("flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]", frameColor === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="frame-color">
                <span className="size-3.5 shrink-0 rounded-[3px] border-2" style={{ borderColor: [...(current?.series.frames ?? []), ...(current?.series.colors ?? [])].find((candidate) => candidate.id === option.id)?.frame ?? option.swatch, background: "transparent" }} aria-hidden />
                {option.label}
              </button>
            ))}
          </div>
          {/* Fáze 101: výrazná velká galerie přes celou šířku panelu, pod ní vedlejší akce */}
          <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
            <SeriesGallery seriesKey={seriesKey} color={color} frameColor={frameColor} available={available} onChoose={(patch) => onChange(patch)} />
            <div className="flex flex-wrap gap-1">
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

/** Fáze 98: přívod rozváděče – soustava a počet fází (3× 230/400 V TN-S / TN-C-S, 1× 230 V …). */
export function SupplySelect({ supply, onSupply, className }: { supply: SupplySystem["id"]; onSupply: (supply: SupplySystem["id"]) => void; className?: string }) {
  return (
    <label className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      Přívod rozváděče:
      <select value={supply} onChange={(event) => onSupply(event.target.value as SupplySystem["id"])} className="h-8 rounded-md border border-input bg-transparent px-1.5 text-sm text-foreground dark:bg-input/30" aria-label="Soustava a počet fází přívodu" data-testid="floorplan-supply">
        {SUPPLY_SYSTEMS.map((option) => (
          <option key={option.id} value={option.id} title={option.detail}>
            {option.phases === 3 ? "3× 230/400 V" : "1× 230 V"} · {option.system}
          </option>
        ))}
      </select>
    </label>
  );
}
