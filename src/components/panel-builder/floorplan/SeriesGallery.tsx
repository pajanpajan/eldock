"use client";

import { useId, useState, type ReactNode } from "react";
import { ExternalLink, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SeriesMaterial, SeriesShape } from "@/lib/panel-builder/abb-catalog-2026";
import { lookOf, mockStyle, type LookColor } from "@/lib/panel-builder/series-look";
import { renderDeviceSvg, type RenderGang } from "@/lib/panel-builder/series-render";
import { seriesLink } from "@/lib/panel-builder/series-links";
import { seriesPhoto, type SeriesPhotoPart } from "@/lib/panel-builder/series-photos";
import { DESIGN_BRANDS, designSeriesOf, hasFrameChoice, isMonoblockSeries, resolveFrameColor, seriesColors, seriesFrameColors, type DesignSeries } from "@/lib/panel-builder/wiring-designs";

export { lookOf, mockStyle };
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";

/**
 * Fáze 61: věrnější náhled designových řad – rámeček v tvaru řady (tenký, zaoblený, vrstvený, kovový, dřevěný,
 * porcelánový, plochý …), dvoubarevná provedení (barva rámečku × barva krytu / klapky), povrch (lesk, kov, dřevo,
 * sklo, kámen, papír, porcelán, softtouch), jednotlivý spínač, zásuvka i víceramček 3R na světlé stěně.
 * Fáze 90: nástěnné monobloky (Garant, Praktik, Variant+) jako krabicové tělo s horní kabelovou vývodkou a zásuvkou pod
 * odklápěcím víčkem s krytím; Decento jako kulatý porcelán s odleskem glazury, úzkou retro páčkou, zásuvkou se zemnicím
 * kolíkem a dvěma šroubky a víceramečkem ve tvaru spojených kruhů (piškot), u dřevěných variant dřevěný rámeček.
 * Fáze 91: náhled kreslí studiový engine `series-render.ts` (stejný jako produktové rendery) – Decento jako samostatné
 * kulaté přístroje (víceramček řada nemá), Busch-axcent s nosným rámečkem a texturou materiálu, Variant+ se zkosenými hranami.
 */

export type MockupItem = RenderGang;

/**
 * Fáze 91: náhled přístroje / rámečku řady – stejný studiový engine jako produktové rendery v `public/catalog-images/`
 * (`renderDeviceSvg`), id s předponou náhledu (víc náhledů na stránce), libovolná kombinace krytu a rámečku.
 */
export function DeviceMockup({ shape, color, items, className, label, seriesKey }: { shape: SeriesShape; color: LookColor | null; items: readonly MockupItem[]; className?: string; label?: string; seriesKey?: string | null }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}-`;
  const svg = renderDeviceSvg({ seriesKey: seriesKey ?? null, shape, look: lookOf(color, shape), items, id, label, fluid: true });
  // Vlastní SVG z čisté funkce (bez vstupu uživatele kromě barev a popisku, popisek je escapovaný)
  return <span className={cn("block", className)} data-testid="device-mockup" dangerouslySetInnerHTML={{ __html: svg }} />;
}


/**
 * Fáze 74: vzhled z barvy klapky / krytu a (jiné) barvy rámečku – dvoubarevná barva řady dává rámečku svou barvu
 * rámečku a klapce svou barvu krytu. Bez barvy rámečku platí barva klapky pro obojí.
 */
export function combineLook(insert: LookColor | null | undefined, frame?: LookColor | null): LookColor | null {
  if (!insert) return frame ?? null;
  if (!frame) return insert;
  // Fáze 91: rámeček nese vlastní povrch a texturu (Busch-axcent beton, břidlice, sklo …)
  return { swatch: insert.swatch, insert: insert.insert ?? insert.swatch, frame: frame.frame ?? frame.swatch, material: insert.material ?? frame.material, ...(frame.material ? { frameMaterial: frame.material } : {}), ...(frame.texture ? { texture: frame.texture } : {}) };
}

/**
 * Fáze 74: originální fotka dílu (je-li schválená v `series-photos.ts`) se zdrojem, jinak vektorový náhled. Fáze 80:
 * primárně produktový náhled z `public/catalog-images/` (render řady ABB); u rámečku v jiné barvě než klapka kreslený
 * náhled (rendery jsou jen pro barvu řady).
 */
function PhotoOrMockup({ series, color, part, caption, mockup, exact = true }: { series: string; color: string; part: SeriesPhotoPart; caption: string; mockup: ReactNode; exact?: boolean }) {
  const photo = exact ? seriesPhoto(series, color, part) : null;
  return (
    <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground" data-photo={photo ? "true" : "false"}>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- náhledy z public/catalog-images a public/series (statické soubory)
        <img src={photo.src} alt={`${caption} – náhled řady`} className="h-28 w-auto max-w-full rounded-lg object-contain shadow-sm" data-testid="gallery-photo" />
      ) : (
        mockup
      )}
      {caption}
    </figure>
  );
}

/**
 * Fáze 80: malý náhled řady v barvě (seznam řad, vzorky barev, lišta řad) – render z `public/catalog-images/`, jinak
 * kreslený náhled. Obrázek je dekorativní (název má tlačítko), okraj studiového pozadí se ořízne.
 */
export function SeriesThumb({ seriesKey, colorId, fallback, className }: { seriesKey: string; colorId: string | null | undefined; fallback: ReactNode; className?: string }) {
  const photo = colorId ? seriesPhoto(seriesKey, colorId, "switch") : null;
  if (!photo || (photo.color && photo.color !== colorId)) return <>{fallback}</>;
  return (
    <span className={cn("block shrink-0 overflow-hidden", className)} data-testid="series-thumb-photo" data-src={photo.src}>
      {/* eslint-disable-next-line @next/next/no-img-element -- náhled z public/catalog-images (statický soubor) */}
      <img src={photo.src} alt="" className="size-full scale-[1.45] object-cover" loading="lazy" decoding="async" />
    </span>
  );
}

/** Galerie designových řad: výrobce → řada (velký náhled, víceramček, materiál) → barvy klapky a rámečku s kódy a čísly rámečků. */
export function SeriesGallery({ seriesKey, color, frameColor = null, available, onChoose }: { seriesKey: string | null; color: string; frameColor?: string | null; available: Map<string, number>; onChoose: (patch: { series: string; color: string; frameColor: string | null }) => void }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ series: string; color: string; frameColor: string | null }>({ series: seriesKey ?? "ABB|Zoni", color, frameColor });
  const current = designSeriesOf(pick.series);
  const brand = current?.brand ?? DESIGN_BRANDS[0];
  const series: DesignSeries = current?.series ?? brand.series[0];
  const colors = seriesColors(`${brand.manufacturer}|${series.name}`);
  const chosen = (series.colors ?? []).find((option) => option.id === pick.color) ?? series.colors?.[0] ?? null;
  const generic = colors.find((option) => option.id === pick.color) ?? colors[0];
  // Fáze 74: barva rámečku zvlášť (null = stejná jako klapka); fáze 90: ne u monobloků a Decenta
  const seriesKeyOfPick = `${brand.manufacturer}|${series.name}`;
  const frameChoice = hasFrameChoice(seriesKeyOfPick);
  const monoblock = isMonoblockSeries(seriesKeyOfPick);
  // Fáze 91: Busch-axcent / solo carat – rámeček ze samostatné palety, bez volby výchozí rámeček ke krytu
  const separateFrames = Boolean(series.frames?.length);
  const frameColors = seriesFrameColors(seriesKeyOfPick);
  const frameChosen = separateFrames ? resolveFrameColor(seriesKeyOfPick, pick.frameColor, pick.color) : pick.frameColor && frameChoice ? ((series.colors ?? []).find((option) => option.id === pick.frameColor) ?? null) : null;
  const frameGeneric = pick.frameColor && frameChoice ? (frameColors.find((option) => option.id === pick.frameColor) ?? null) : null;
  const look = combineLook(chosen ?? { swatch: generic.swatch }, frameChosen ?? (frameGeneric ? { swatch: frameGeneric.swatch } : null))!;
  const shape = series.shape ?? "square";
  const count = series.dbSeries.reduce((sum, name) => sum + (available.get(`${brand.manufacturer}|${name}`) ?? 0), 0);
  const details = chosen;
  const seriesKeyOf = `${brand.manufacturer}|${series.name}`;
  const link = seriesLink(seriesKeyOf);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPick({ series: seriesKey ?? "ABB|Zoni", color, frameColor });
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-xs" data-testid="series-gallery-open">
          <Palette className="size-3.5" aria-hidden /> Galerie řad a barev
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="series-gallery">
        <DialogHeader>
          <DialogTitle>Designové řady a barvy</DialogTitle>
          <DialogDescription>Náhled rámečku, krytů a víceramečku v barvách řady (ABB podle katalogu 2026) – barvu klapky a rámečku jde zvolit zvlášť. Klíčové řady ABB mají produktový render, ostatní kreslený náhled; barvy na obrazovce jsou orientační – přesný vzhled ověřte odkazem na web výrobce.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Výrobce">
          {DESIGN_BRANDS.map((option) => (
            <button key={option.manufacturer} type="button" role="radio" aria-checked={brand.manufacturer === option.manufacturer} aria-label={option.label} onClick={() => setPick({ series: `${option.manufacturer}|${option.series[0].name}`, color: seriesColors(`${option.manufacturer}|${option.series[0].name}`)[0].id, frameColor: null })} className={cn("flex h-10 w-24 items-center justify-center rounded-md border bg-white p-1", brand.manufacturer === option.manufacturer ? "border-primary ring-2 ring-primary" : "border-border")}>
              <ManufacturerLogo manufacturer={option.manufacturer} className="h-7 w-full" />
            </button>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ul className="flex max-h-[28rem] flex-col gap-1 overflow-y-auto pr-1" role="radiogroup" aria-label="Designová řada">
            {brand.series.map((option) => {
              const key = `${brand.manufacturer}|${option.name}`;
              const first = option.colors?.[0] ?? null;
              return (
                <li key={option.name}>
                  <button type="button" role="radio" aria-checked={series.name === option.name} onClick={() => setPick({ series: key, color: seriesColors(key)[0].id, frameColor: null })} className={cn("flex w-full items-center gap-2 rounded-lg border p-1.5 text-left text-xs", series.name === option.name ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")} data-testid={`gallery-series-${option.name}`}>
                    <SeriesThumb seriesKey={key} colorId={first?.id} className="h-10 w-10 rounded" fallback={<DeviceMockup seriesKey={key} shape={option.shape ?? "square"} color={first ?? { swatch: "#f8fafc" }} items={["switch"]} className="h-10 w-10 shrink-0 rounded" />} />
                    <span className="min-w-0">
                      <b className="block">{option.name}</b>
                      <span className="text-muted-foreground">{colorCount(option.colors?.length || seriesColors(key).length)}{option.ip ? ` · ${option.ip}` : ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-bold" data-testid="gallery-title">
                {brand.label} {series.name}
              </h3>
              <span className="text-xs text-muted-foreground">
                {series.tagline ? `${series.tagline} · ` : ""}
                {series.page ? `katalog ABB 2026, str. ${series.page} · ` : ""}
                {count ? `${count} přístrojů v databázi` : "přístroje doplníte v konfigurátoru"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]" data-testid="gallery-preview">
              {/* Fáze 74: schválená fotka výrobce (zdroj a licence pod fotkou), jinak kreslený náhled */}
              <PhotoOrMockup series={seriesKeyOf} color={chosen?.id ?? pick.color} exact={!pick.frameColor} part="switch" caption="Spínač 1R" mockup={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={look} items={["switch"]} className="h-28 w-28 rounded-lg" label={`Spínač ${series.name}`} />} />
              <PhotoOrMockup series={seriesKeyOf} color={chosen?.id ?? pick.color} exact={!pick.frameColor} part="socket" caption="Zásuvka 1R" mockup={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={look} items={["socket"]} className="h-28 w-28 rounded-lg" label={`Zásuvka ${series.name}`} />} />
              {monoblock ? (
                // Fáze 90: monobloky nemají víceramček – nástěnná dvojzásuvka pod odklápěcími víčky
                <PhotoOrMockup series={seriesKeyOf} color={chosen?.id ?? pick.color} exact part="set" caption={`Dvojzásuvka ${series.ip ?? "IP44"} s odklápěcím víčkem (nástěnná)`} mockup={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={look} items={["socket", "socket"]} className="h-28 w-full max-w-60 rounded-lg" label={`Dvojzásuvka ${series.name} s víčkem`} />} />
              ) : (
                <PhotoOrMockup series={seriesKeyOf} color={chosen?.id ?? pick.color} exact={!pick.frameColor} part="set" caption={series.fixedPairs ? "3 samostatné přístroje · rozteč 91 mm" : "Víceramček 3R – vypínač + 2 zásuvky"} mockup={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={look} items={["switch", "socket", "socket"]} className="h-28 w-full max-w-80 rounded-lg" label={`Víceramček 3R ${series.name}`} />} />
              )}
            </div>
            {/* Fáze 80: zdroj a podmínky užití náhledů jednou pod řádkem náhledů */}
            {(() => {
              const sources = [...new Set(PREVIEW_PARTS.map((part) => (pick.frameColor ? null : seriesPhoto(seriesKeyOf, chosen?.id ?? pick.color, part))).filter((photo) => photo !== null).map((photo) => `${photo.source} · ${photo.license}`))];
              return sources.length ? (
                <p className="-mt-1 text-[10px] text-muted-foreground" data-testid="gallery-photo-source">
                  Zdroj náhledu: {sources.join(" · ")}
                </p>
              ) : null;
            })()}
            <p className="-mb-1.5 text-xs font-semibold text-muted-foreground">{monoblock ? "Barva přístroje" : series.fixedPairs ? "Provedení (porcelánový střed / rámeček)" : separateFrames ? "Barva krytu – klapka a zásuvka (společná kapitola katalogu, str. 170)" : "Barva klapky / krytu"}</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Barva řady">
              {colors.map((option) => {
                const seriesColor = (series.colors ?? []).find((candidate) => candidate.id === option.id) ?? null;
                return (
                  <button key={option.id} type="button" role="radio" aria-checked={pick.color === option.id} onClick={() => setPick((value) => ({ ...value, color: option.id }))} className={cn("flex w-28 flex-col items-center gap-1 rounded-lg border p-1.5 text-center text-[11px] leading-tight", pick.color === option.id ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")} data-testid="gallery-color">
                    <SeriesThumb seriesKey={seriesKeyOf} colorId={seriesColor?.id} className="h-12 w-12 rounded" fallback={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={seriesColor ?? { swatch: option.swatch }} items={["switch"]} className="h-12 w-12 rounded" />} />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {/* Fáze 74: barva rámečku zvlášť – výchozí stejná jako klapka; fáze 90: monobloky a Decento ji nemají */}
            {!frameChoice ? (
              <p className="rounded-lg border border-dashed border-border p-2 text-[11px] text-muted-foreground" data-testid="gallery-frame-none">
                {monoblock
                  ? `Nástěnný monoblokový přístroj ${series.ip ?? "IP44"} – kompletní přístroj v jedné barvě nebo kombinaci, bez samostatného podomítkového rámečku (do víceramečku se nedává); zásuvka má odklápěcí ochranné víčko.`
                  : "Každé provedení řady je pevná dvojice porcelánového středu a porcelánového / dřevěného rámečku – barva rámečku se nevolí zvlášť."}
              </p>
            ) : null}
            {frameChoice ? <p className="-mb-1.5 text-xs font-semibold text-muted-foreground">{separateFrames ? "Rámeček – skutečný materiál (kryt zůstává stejný)" : "Barva rámečku"}</p> : null}
            <div className={cn("flex flex-wrap gap-1", !frameChoice && "hidden")} role="radiogroup" aria-label="Barva rámečku" data-testid="gallery-frame-colors">
              <button type="button" role="radio" aria-checked={!pick.frameColor} onClick={() => setPick((value) => ({ ...value, frameColor: null }))} className={cn("rounded-full border px-2.5 py-1 text-[11px]", !pick.frameColor ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="gallery-frame-same">
                {separateFrames ? "doporučený ke krytu" : "stejná jako klapka"}
              </button>
              {frameColors.map((option) => {
                const seriesColor = [...(series.frames ?? []), ...(series.colors ?? [])].find((candidate) => candidate.id === option.id) ?? null;
                return (
                  <button key={option.id} type="button" role="radio" aria-checked={pick.frameColor === option.id} onClick={() => setPick((value) => ({ ...value, frameColor: option.id === value.color ? null : option.id }))} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", pick.frameColor === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="gallery-frame-color">
                    <span className="size-3.5 rounded-[3px] border-[3px]" style={{ borderColor: seriesColor?.frame ?? option.swatch }} aria-hidden />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {details ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg border border-border p-2 text-xs" data-testid="gallery-details">
                <dt className="text-muted-foreground">Klapka / kryt</dt>
                <dd>
                  {details.label}
                  {details.frame && details.insert && !frameChosen ? " (rámeček / kryt)" : ""}
                </dd>
                {frameChosen || frameGeneric ? (
                  <>
                    <dt className="text-muted-foreground">Rámeček</dt>
                    <dd data-testid="gallery-frame-label">
                      {(frameChosen ?? frameGeneric)!.label}
                      {frameChosen?.code ? <span className="font-mono"> · kód {frameChosen.code.split("/")[0]}</span> : null}
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Povrch</dt>
                <dd>{MATERIAL_LABEL[lookOf(details, shape).material]}</dd>
                {details.code ? (
                  <>
                    <dt className="text-muted-foreground">Kód barvy</dt>
                    <dd className="font-mono">{details.code} (přípona objednacího čísla krytu{frameChosen ? "" : " / rámečku"})</dd>
                  </>
                ) : null}
                {(frameChosen ?? details).frameMpn?.some(Boolean) ? (
                  <>
                    <dt className="text-muted-foreground">Rámečky 1R–5R</dt>
                    <dd className="font-mono">{(frameChosen ?? details).frameMpn!.map((mpn, index) => `${index + 1}R ${mpn ?? "–"}`).join(" · ")}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              {/* Fáze 63: oficiální stránka / katalog řady u výrobce v novém okně */}
              {link ? (
                <a href={link.url} target="_blank" rel="noopener noreferrer" title={link.label} className="mr-auto inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:border-primary/60" data-testid="gallery-web">
                  🌐 Prohlédnout řadu na webu výrobce <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Zavřít
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onChoose({ series: `${brand.manufacturer}|${series.name}`, color: pick.color, frameColor: frameChoice ? pick.frameColor : null });
                  setOpen(false);
                }}
                data-testid="gallery-apply"
              >
                Použít {series.name} · {generic.label}
                {frameGeneric ? ` · rámeček ${frameGeneric.label}` : ""}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PREVIEW_PARTS: readonly SeriesPhotoPart[] = ["switch", "socket", "set"];

/** „1 barva“, „3 barvy“, „8 barev“. */
const colorCount = (count: number) => `${count} ${count === 1 ? "barva" : count >= 2 && count <= 4 ? "barvy" : "barev"}`;

const MATERIAL_LABEL: Record<SeriesMaterial, string> = { matte: "matný", gloss: "lesklý", metal: "kov / metalický", wood: "dřevo", glass: "sklo", stone: "kámen (beton, břidlice)", porcelain: "porcelán", paper: "papír", softtouch: "softtouch (matný, příjemný na dotek)" };
