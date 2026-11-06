"use client";

import { useId, useState } from "react";
import { Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SeriesColor, SeriesMaterial, SeriesShape } from "@/lib/panel-builder/abb-catalog-2026";
import { DESIGN_BRANDS, designSeriesOf, seriesColors, type DesignSeries } from "@/lib/panel-builder/wiring-designs";
import { cn } from "@/lib/utils";

import { ManufacturerLogo } from "../ManufacturerLogo";

/**
 * Fáze 61: věrnější náhled designových řad – rámeček v tvaru řady (tenký, zaoblený, vrstvený, kovový, dřevěný,
 * porcelánový, plochý …), dvoubarevná provedení (barva rámečku × barva krytu / klapky), povrch (lesk, kov, dřevo,
 * sklo, kámen, papír, porcelán, softtouch), jednotlivý spínač, zásuvka i víceramček 3R na světlé stěně.
 */

type Look = { frame: string; insert: string; material: SeriesMaterial };
export type MockupItem = "switch" | "socket" | "double" | "blank";

const SHAPE: Record<SeriesShape, { radius: number; border: number; insetRadius: number }> = {
  thin: { radius: 12, border: 9, insetRadius: 6 },
  rounded: { radius: 28, border: 12, insetRadius: 18 },
  layered: { radius: 8, border: 14, insetRadius: 4 },
  metal: { radius: 8, border: 12, insetRadius: 4 },
  wood: { radius: 9, border: 16, insetRadius: 4 },
  square: { radius: 5, border: 12, insetRadius: 3 },
  soft: { radius: 18, border: 13, insetRadius: 10 },
  classic: { radius: 4, border: 16, insetRadius: 3 },
  porcelain: { radius: 46, border: 12, insetRadius: 40 },
  flat: { radius: 3, border: 8, insetRadius: 2 },
  solo: { radius: 34, border: 11, insetRadius: 24 },
  thick: { radius: 7, border: 18, insetRadius: 4 },
  surface: { radius: 16, border: 10, insetRadius: 10 },
};

export function lookOf(color: Pick<SeriesColor, "swatch" | "frame" | "insert" | "material"> | null | undefined, shape: SeriesShape): Look {
  const swatch = color?.swatch ?? "#f8fafc";
  return { frame: color?.frame ?? swatch, insert: color?.insert ?? swatch, material: color?.material ?? (shape === "porcelain" ? "porcelain" : shape === "wood" ? "wood" : shape === "metal" ? "metal" : "gloss") };
}

/** Světlost barvy (0–1) – tmavé provedení dostane světlejší kresbu otvorů a klapky. */
function lightness(hex: string) {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(value)) return 1;
  return (((value >> 16) & 255) * 0.299 + ((value >> 8) & 255) * 0.587 + (value & 255) * 0.114) / 255;
}

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
function Gang({ id, kind, x, look, shape }: { id: string; kind: MockupItem; x: number; look: Look; shape: SeriesShape }) {
  const geometry = SHAPE[shape];
  const inset = 22;
  const dark = lightness(look.insert) < 0.45;
  const ink = dark ? "#d4d4d8" : "#52525b";
  const hole = dark ? "#0a0a0a" : "#3f3f46";
  const cover = { x: x + inset, y: inset, width: 100 - inset * 2, height: 100 - inset * 2, rx: geometry.insetRadius };
  if (kind === "blank") return null;
  return (
    <g>
      <rect {...cover} fill={look.insert} stroke="#000" strokeOpacity={0.12} strokeWidth={0.8} />
      <Surface id={id} material={look.material === "wood" || look.material === "stone" || look.material === "paper" ? "gloss" : look.material} {...cover} />
      {kind === "switch" ? (
        <>
          {/* Klapka: dělicí linka a orientační doutnavka */}
          <line x1={x + 50} y1={inset + 10} x2={x + 50} y2={100 - inset - 10} stroke={ink} strokeOpacity={0.25} strokeWidth={0.8} />
          <rect x={x + 46} y={inset + 8} width={8} height={2.4} rx={1.2} fill="#f59e0b" opacity={0.85} />
        </>
      ) : (
        // Zásuvka 230 V / 16 A s ochranným kolíkem (ČSN): kruhové lůžko, 2 otvory, kolík
        [kind === "double" ? -14 : 0, kind === "double" ? 14 : null].filter((dy): dy is number => dy !== null).map((dy) => (
          <g key={dy} transform={`translate(${x + 50} ${50 + dy * (kind === "double" ? 1 : 0)})`}>
            <circle r={kind === "double" ? 12 : 18} fill="none" stroke={ink} strokeOpacity={0.45} strokeWidth={1.2} />
            <circle cx={kind === "double" ? -5 : -7} cy={0} r={kind === "double" ? 1.8 : 2.4} fill={hole} />
            <circle cx={kind === "double" ? 5 : 7} cy={0} r={kind === "double" ? 1.8 : 2.4} fill={hole} />
            <rect x={-1.4} y={kind === "double" ? -12 : -18} width={2.8} height={kind === "double" ? 4 : 6} rx={1} fill={ink} opacity={0.7} />
          </g>
        ))
      )}
    </g>
  );
}

/** Rámeček s přístroji (víceramček vodorovně) na světlé stěně. */
export function DeviceMockup({ shape, color, items, className, label }: { shape: SeriesShape; color: Pick<SeriesColor, "swatch" | "frame" | "insert" | "material"> | null; items: readonly MockupItem[]; className?: string; label?: string }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const look = lookOf(color, shape);
  const geometry = SHAPE[shape];
  const width = items.length * 100;
  const frame = { x: 6, y: 6, width: width - 12, height: 88, rx: shape === "porcelain" && items.length === 1 ? 44 : geometry.radius };
  return (
    <svg viewBox={`-10 -10 ${width + 20} 120`} className={className} role="img" aria-label={label ?? "Náhled designové řady"} data-shape={shape} data-material={look.material}>
      <MaterialDefs id={id} look={look} />
      <rect x={-10} y={-10} width={width + 20} height={120} fill="#e7e5e4" />
      <g filter={`url(#${id}-shadow)`}>
        {shape === "surface" ? <rect x={frame.x - 2} y={frame.y + 6} width={frame.width + 4} height={frame.height} rx={frame.rx} fill="#000" opacity={0.08} /> : null}
        <rect {...frame} fill={look.frame} stroke="#000" strokeOpacity={0.18} strokeWidth={1} />
        <Surface id={id} material={look.material} {...frame} />
        {shape === "layered" || shape === "thick" ? <rect x={frame.x + geometry.border * 0.45} y={frame.y + geometry.border * 0.45} width={frame.width - geometry.border * 0.9} height={frame.height - geometry.border * 0.9} rx={Math.max(2, frame.rx - 3)} fill="none" stroke={look.insert} strokeOpacity={0.6} strokeWidth={2} /> : null}
        {shape === "metal" ? <rect x={frame.x} y={47} width={frame.width} height={6} fill="#000" opacity={0.08} /> : null}
      </g>
      {items.map((kind, index) => (
        <Gang key={index} id={id} kind={kind} x={index * 100} look={look} shape={shape} />
      ))}
    </svg>
  );
}

/** Galerie designových řad: výrobce → řada (velký náhled, víceramček, materiál) → barvy s kódy a čísly rámečků. */
export function SeriesGallery({ seriesKey, color, available, onChoose }: { seriesKey: string | null; color: string; available: Map<string, number>; onChoose: (patch: { series: string; color: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ series: string; color: string }>({ series: seriesKey ?? "ABB|Zoni", color });
  const current = designSeriesOf(pick.series);
  const brand = current?.brand ?? DESIGN_BRANDS[0];
  const series: DesignSeries = current?.series ?? brand.series[0];
  const colors = seriesColors(`${brand.manufacturer}|${series.name}`);
  const chosen = (series.colors ?? []).find((option) => option.id === pick.color) ?? series.colors?.[0] ?? null;
  const generic = colors.find((option) => option.id === pick.color) ?? colors[0];
  const look = chosen ?? { swatch: generic.swatch };
  const shape = series.shape ?? "square";
  const count = series.dbSeries.reduce((sum, name) => sum + (available.get(`${brand.manufacturer}|${name}`) ?? 0), 0);
  const details = chosen;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPick({ series: seriesKey ?? "ABB|Zoni", color });
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
          <DialogDescription>Náhled rámečku, krytů a víceramečku v barvách řady (ABB podle katalogu 2026). Barvy na obrazovce jsou orientační.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Výrobce">
          {DESIGN_BRANDS.map((option) => (
            <button key={option.manufacturer} type="button" role="radio" aria-checked={brand.manufacturer === option.manufacturer} aria-label={option.label} onClick={() => setPick({ series: `${option.manufacturer}|${option.series[0].name}`, color: seriesColors(`${option.manufacturer}|${option.series[0].name}`)[0].id })} className={cn("flex h-10 w-24 items-center justify-center rounded-md border bg-white p-1", brand.manufacturer === option.manufacturer ? "border-primary ring-2 ring-primary" : "border-border")}>
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
                  <button type="button" role="radio" aria-checked={series.name === option.name} onClick={() => setPick({ series: key, color: seriesColors(key)[0].id })} className={cn("flex w-full items-center gap-2 rounded-lg border p-1.5 text-left text-xs", series.name === option.name ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")} data-testid={`gallery-series-${option.name}`}>
                    <DeviceMockup shape={option.shape ?? "square"} color={first ?? { swatch: "#f8fafc" }} items={["switch"]} className="h-10 w-10 shrink-0 rounded" />
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
              <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                <DeviceMockup shape={shape} color={look} items={["switch"]} className="h-28 w-28 rounded-lg" label={`Spínač ${series.name}`} />
                Spínač 1R
              </figure>
              <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                <DeviceMockup shape={shape} color={look} items={["socket"]} className="h-28 w-28 rounded-lg" label={`Zásuvka ${series.name}`} />
                Zásuvka 1R
              </figure>
              <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
                <DeviceMockup shape={shape} color={look} items={["switch", "socket", "socket"]} className="h-28 w-full max-w-80 rounded-lg" label={`Víceramček 3R ${series.name}`} />
                Víceramček 3R – vypínač + 2 zásuvky
              </figure>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Barva řady">
              {colors.map((option) => {
                const seriesColor = (series.colors ?? []).find((candidate) => candidate.id === option.id) ?? null;
                return (
                  <button key={option.id} type="button" role="radio" aria-checked={pick.color === option.id} onClick={() => setPick((value) => ({ ...value, color: option.id }))} className={cn("flex w-28 flex-col items-center gap-1 rounded-lg border p-1.5 text-center text-[11px] leading-tight", pick.color === option.id ? "border-primary bg-primary/15" : "border-border hover:border-primary/60")} data-testid="gallery-color">
                    <DeviceMockup shape={shape} color={seriesColor ?? { swatch: option.swatch }} items={["switch"]} className="h-12 w-12 rounded" />
                    {option.label}
                  </button>
                );
              })}
            </div>
            {details ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg border border-border p-2 text-xs" data-testid="gallery-details">
                <dt className="text-muted-foreground">Barva</dt>
                <dd>
                  {details.label}
                  {details.frame && details.insert ? " (rámeček / kryt)" : ""}
                </dd>
                <dt className="text-muted-foreground">Povrch</dt>
                <dd>{MATERIAL_LABEL[lookOf(details, shape).material]}</dd>
                {details.code ? (
                  <>
                    <dt className="text-muted-foreground">Kód barvy</dt>
                    <dd className="font-mono">{details.code} (přípona objednacího čísla krytu / rámečku)</dd>
                  </>
                ) : null}
                {details.frameMpn?.some(Boolean) ? (
                  <>
                    <dt className="text-muted-foreground">Rámečky 1R–5R</dt>
                    <dd className="font-mono">{details.frameMpn.map((mpn, index) => `${index + 1}R ${mpn ?? "–"}`).join(" · ")}</dd>
                  </>
                ) : null}
              </dl>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Zavřít
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onChoose({ series: `${brand.manufacturer}|${series.name}`, color: pick.color });
                  setOpen(false);
                }}
                data-testid="gallery-apply"
              >
                Použít {series.name} · {generic.label}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** „1 barva“, „3 barvy“, „8 barev“. */
const colorCount = (count: number) => `${count} ${count === 1 ? "barva" : count >= 2 && count <= 4 ? "barvy" : "barev"}`;

const MATERIAL_LABEL: Record<SeriesMaterial, string> = { matte: "matný", gloss: "lesklý", metal: "kov / metalický", wood: "dřevo", glass: "sklo", stone: "kámen (beton, břidlice)", porcelain: "porcelán", paper: "papír", softtouch: "softtouch (matný, příjemný na dotek)" };
