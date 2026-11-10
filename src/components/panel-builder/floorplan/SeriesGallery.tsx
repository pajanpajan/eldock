"use client";

import { useId, useState, type ReactNode } from "react";
import { ExternalLink, Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SeriesColor, SeriesMaterial, SeriesShape } from "@/lib/panel-builder/abb-catalog-2026";
import { lightness, lookOf, mockStyle, type Look, type MockStyle } from "@/lib/panel-builder/series-look";
import { seriesLink } from "@/lib/panel-builder/series-links";
import { seriesPhoto, type SeriesPhotoPart } from "@/lib/panel-builder/series-photos";
import { DESIGN_BRANDS, designSeriesOf, seriesColors, type DesignSeries } from "@/lib/panel-builder/wiring-designs";

export { lookOf, mockStyle };
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";

/**
 * Fáze 61: věrnější náhled designových řad – rámeček v tvaru řady (tenký, zaoblený, vrstvený, kovový, dřevěný,
 * porcelánový, plochý …), dvoubarevná provedení (barva rámečku × barva krytu / klapky), povrch (lesk, kov, dřevo,
 * sklo, kámen, papír, porcelán, softtouch), jednotlivý spínač, zásuvka i víceramček 3R na světlé stěně.
 */

export type MockupItem = "switch" | "socket" | "double" | "blank";

function MaterialDefs({ id, look }: { id: string; look: Look }) {
  return (
    <defs>
      <linearGradient id={`${id}-gloss`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
        <stop offset="0.45" stopColor="#fff" stopOpacity="0.06" />
        <stop offset="1" stopColor="#000" stopOpacity="0.12" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="0">
        {[0, 0.18, 0.36, 0.55, 0.72, 0.9, 1].map((offset, index) => (
          <stop key={offset} offset={offset} stopColor={index % 2 ? "#fff" : "#000"} stopOpacity={index % 2 ? 0.35 : 0.16} />
        ))}
      </linearGradient>
      <pattern id={`${id}-wood`} width="40" height="14" patternUnits="userSpaceOnUse">
        <path d="M0 4 C10 1 20 7 40 3 M0 10 C12 7 26 13 40 9" fill="none" stroke="#000" strokeOpacity="0.22" strokeWidth="1.2" />
      </pattern>
      <pattern id={`${id}-stone`} width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.9" fill="#000" fillOpacity="0.2" />
        <circle cx="8" cy="7" r="0.7" fill="#fff" fillOpacity="0.35" />
        <circle cx="5" cy="10" r="0.6" fill="#000" fillOpacity="0.15" />
      </pattern>
      <pattern id={`${id}-paper`} width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 2 L6 3 M1 5 L5 6" stroke="#000" strokeOpacity="0.12" strokeWidth="0.5" />
      </pattern>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
        <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
        <stop offset="0.36" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="0.5" stopColor="#fff" stopOpacity="0.04" />
        <stop offset="1" stopColor="#000" stopOpacity="0.2" />
      </linearGradient>
      <radialGradient id={`${id}-porcelain`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
        <stop offset="0.6" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="1" stopColor="#000" stopOpacity="0.15" />
      </radialGradient>
      <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity={lightness(look.frame) > 0.6 ? 0.25 : 0.45} />
      </filter>
    </defs>
  );
}

/** Překryv povrchu přes tvar (lesk, kov, dřevo, sklo, kámen, papír, porcelán). */
function Surface({ id, material, ...shape }: { id: string; material: SeriesMaterial; x: number; y: number; width: number; height: number; rx: number }) {
  const fill = { gloss: "gloss", metal: "metal", wood: "wood", glass: "glass", stone: "stone", paper: "paper", porcelain: "porcelain", matte: null, softtouch: null }[material];
  if (!fill) return null;
  return (
    <>
      <rect {...shape} fill={`url(#${id}-${fill})`} pointerEvents="none" />
      {material === "metal" || material === "wood" || material === "stone" ? <rect {...shape} fill={`url(#${id}-gloss)`} opacity={0.5} pointerEvents="none" /> : null}
    </>
  );
}

/** Jeden přístroj v rámečku (100 × 100 jednotek na pozici). */
function Gang({ id, kind, x, look, style }: { id: string; kind: MockupItem; x: number; look: Look; style: MockStyle }) {
  if (kind === "blank") return null;
  // Fáze 74: klapka podle šířky rámečku řady (tenký rámeček = velká klapka, Busch-axcent = široký rámeček)
  const inset = Math.min(27, Math.max(14, 7 + style.border));
  const dark = lightness(look.insert) < 0.45;
  const ink = dark ? "#d4d4d8" : "#52525b";
  const hole = dark ? "#0a0a0a" : "#3f3f46";
  const cover = { x: x + inset, y: inset, width: 100 - inset * 2, height: 100 - inset * 2, rx: style.rocker === "rounded" ? 14 : style.insetRadius };
  const cx = x + 50;
  const socket = (dy: number, r: number) => (
    <g key={dy} transform={`translate(${cx} ${50 + dy})`}>
      <circle r={r} fill="none" stroke={ink} strokeOpacity={0.45} strokeWidth={1.2} />
      <circle cx={-r * 0.39} cy={0} r={r * 0.13} fill={hole} />
      <circle cx={r * 0.39} cy={0} r={r * 0.13} fill={hole} />
      <rect x={-1.4} y={-r} width={2.8} height={r * 0.33} rx={1} fill={ink} opacity={0.7} />
    </g>
  );
  const sockets = kind === "double" ? [socket(-14, 12), socket(14, 12)] : [socket(0, 18)];
  // Céliane: kruhový výřez v rámečku, uvnitř kruhová klapka / zásuvka
  if (style.circle) {
    return (
      <g data-gang="circle">
        <circle cx={cx} cy={50} r={29} fill="#000" opacity={0.18} />
        <circle cx={cx} cy={50} r={27} fill={look.insert} stroke="#000" strokeOpacity={0.15} strokeWidth={0.8} />
        {kind === "switch" ? (
          <>
            <circle cx={cx} cy={50} r={22} fill="none" stroke={ink} strokeOpacity={0.3} strokeWidth={0.8} />
            <rect x={cx - 5} y={31} width={10} height={2.2} rx={1.1} fill="#f59e0b" opacity={0.85} />
          </>
        ) : (
          sockets
        )}
      </g>
    );
  }
  // Decento: kulatý porcelánový rámeček, úzká páčka a kulatá zásuvka
  if (style.round) {
    return (
      <g data-gang="round">
        <circle cx={cx} cy={50} r={30} fill={look.insert} stroke="#000" strokeOpacity={0.15} strokeWidth={0.8} />
        <Surface id={id} material="porcelain" x={cx - 30} y={20} width={60} height={60} rx={30} />
        {kind === "switch" ? (
          <>
            <circle cx={cx} cy={50} r={9} fill={look.insert} stroke={ink} strokeOpacity={0.4} strokeWidth={1} />
            <rect x={cx - 3} y={28} width={6} height={24} rx={3} fill={ink} opacity={0.75} data-testid="mockup-lever" />
          </>
        ) : (
          sockets
        )}
      </g>
    );
  }
  return (
    <g data-gang={style.rocker}>
      {style.metalLine ? <rect x={cover.x - 3} y={cover.y - 3} width={cover.width + 6} height={cover.height + 6} rx={cover.rx + 1} fill="none" stroke={`url(#${id}-metal)`} strokeWidth={2.6} data-testid="mockup-metal-line" /> : null}
      {style.metalLine ? <rect x={cover.x - 3} y={cover.y - 3} width={cover.width + 6} height={cover.height + 6} rx={cover.rx + 1} fill="none" stroke="#a1a1aa" strokeOpacity={0.8} strokeWidth={1} /> : null}
      <rect {...cover} fill={look.insert} stroke="#000" strokeOpacity={0.12} strokeWidth={0.8} />
      <Surface id={id} material={look.material === "wood" || look.material === "stone" || look.material === "paper" ? "gloss" : look.material} {...cover} />
      {kind === "switch" ? (
        <>
          {style.rocker === "rounded" ? <rect x={cover.x + 4} y={cover.y + 4} width={cover.width - 8} height={cover.height - 8} rx={cover.rx - 2} fill="#fff" opacity={0.12} /> : null}
          {style.lamp ? (
            // Tango: vodorovný průzor doutnavky (modrý / oranžový)
            <rect x={cx - 9} y={cover.y + 8} width={18} height={3.2} rx={1.6} fill={dark ? "#f59e0b" : "#3b82f6"} opacity={0.9} data-testid="mockup-lamp" />
          ) : style.base ? (
            // Levit: vodorovný proužek indikace
            <rect x={cover.x + 10} y={cover.y + cover.height - 9} width={cover.width - 20} height={2} rx={1} fill={ink} opacity={0.55} data-testid="mockup-strip" />
          ) : (
            // Fáze 74: běžný spínač – hladká klapka s jemnou spárou dole (bez kontrolky, ta je jen u řazení s doutnavkou)
            <rect x={cover.x + 6} y={cover.y + cover.height - 5} width={cover.width - 12} height={1.2} rx={0.6} fill={ink} opacity={0.22} />
          )}
        </>
      ) : (
        sockets
      )}
    </g>
  );
}

/** Rámeček s přístroji (víceramček vodorovně) na světlé stěně ve tvaru řady. */
export function DeviceMockup({ shape, color, items, className, label, seriesKey }: { shape: SeriesShape; color: Pick<SeriesColor, "swatch" | "frame" | "insert" | "material"> | null; items: readonly MockupItem[]; className?: string; label?: string; seriesKey?: string | null }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const look = lookOf(color, shape);
  const style = mockStyle(seriesKey, shape);
  const width = items.length * 100;
  const single = items.length === 1;
  const frame = { x: 6, y: 6, width: width - 12, height: 88, rx: style.round ? 44 : style.radius };
  // Levit: podložka v druhé barvě vyčnívá v horní a spodní spáře
  const base = style.base ? { x: frame.x + 3, y: frame.y - 3.5, width: frame.width - 6, height: frame.height + 7, rx: 2 } : null;
  return (
    <svg viewBox={`-10 -10 ${width + 20} 120`} className={className} role="img" aria-label={label ?? "Náhled designové řady"} data-shape={shape} data-material={look.material} data-series={seriesKey ?? undefined}>
      <MaterialDefs id={id} look={look} />
      <defs>
        <radialGradient id={`${id}-convex`} cx="0.5" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.22" />
        </radialGradient>
      </defs>
      <rect x={-10} y={-10} width={width + 20} height={120} fill="#e7e5e4" />
      <g filter={`url(#${id}-shadow)`}>
        {shape === "surface" ? <rect x={frame.x - 2} y={frame.y + 6} width={frame.width + 4} height={frame.height} rx={frame.rx} fill="#000" opacity={0.08} /> : null}
        {base ? <rect {...base} fill={look.insert} data-testid="mockup-base" /> : null}
        {style.round && single ? <circle cx={50} cy={50} r={44} fill={look.frame} stroke="#000" strokeOpacity={0.18} strokeWidth={1} /> : <rect {...frame} fill={look.frame} stroke="#000" strokeOpacity={0.18} strokeWidth={1} />}
        <Surface id={id} material={look.material} {...frame} />
        {style.convex ? <rect {...frame} fill={`url(#${id}-convex)`} pointerEvents="none" /> : null}
        {style.circle ? null : !style.base && (shape === "layered" || shape === "thick") ? <rect x={frame.x + style.border * 0.45} y={frame.y + style.border * 0.45} width={frame.width - style.border * 0.9} height={frame.height - style.border * 0.9} rx={Math.max(2, frame.rx - 3)} fill="none" stroke={look.insert} strokeOpacity={0.6} strokeWidth={2} /> : null}
      </g>
      {items.map((kind, index) => (
        <Gang key={index} id={id} kind={kind} x={index * 100} look={style.base ? { ...look, insert: look.insert === look.frame ? look.frame : look.insert } : look} style={style} />
      ))}
    </svg>
  );
}


type LookColor = Pick<SeriesColor, "swatch" | "frame" | "insert" | "material">;

/**
 * Fáze 74: vzhled z barvy klapky / krytu a (jiné) barvy rámečku – dvoubarevná barva řady dává rámečku svou barvu
 * rámečku a klapce svou barvu krytu. Bez barvy rámečku platí barva klapky pro obojí.
 */
export function combineLook(insert: LookColor | null | undefined, frame?: LookColor | null): LookColor | null {
  if (!insert) return frame ?? null;
  if (!frame) return insert;
  return { swatch: insert.swatch, insert: insert.insert ?? insert.swatch, frame: frame.frame ?? frame.swatch, material: insert.material ?? frame.material };
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
  // Fáze 74: barva rámečku zvlášť (null = stejná jako klapka)
  const frameChosen = pick.frameColor ? ((series.colors ?? []).find((option) => option.id === pick.frameColor) ?? null) : null;
  const frameGeneric = pick.frameColor ? (colors.find((option) => option.id === pick.frameColor) ?? null) : null;
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
              <PhotoOrMockup series={seriesKeyOf} color={chosen?.id ?? pick.color} exact={!pick.frameColor} part="set" caption="Víceramček 3R – vypínač + 2 zásuvky" mockup={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={look} items={["switch", "socket", "socket"]} className="h-28 w-full max-w-80 rounded-lg" label={`Víceramček 3R ${series.name}`} />} />
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
            <p className="-mb-1.5 text-xs font-semibold text-muted-foreground">Barva klapky / krytu</p>
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
            {/* Fáze 74: barva rámečku zvlášť – výchozí stejná jako klapka */}
            <p className="-mb-1.5 text-xs font-semibold text-muted-foreground">Barva rámečku</p>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Barva rámečku" data-testid="gallery-frame-colors">
              <button type="button" role="radio" aria-checked={!pick.frameColor} onClick={() => setPick((value) => ({ ...value, frameColor: null }))} className={cn("rounded-full border px-2.5 py-1 text-[11px]", !pick.frameColor ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="gallery-frame-same">
                stejná jako klapka
              </button>
              {colors.map((option) => {
                const seriesColor = (series.colors ?? []).find((candidate) => candidate.id === option.id) ?? null;
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
                  onChoose({ series: `${brand.manufacturer}|${series.name}`, color: pick.color, frameColor: pick.frameColor });
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
