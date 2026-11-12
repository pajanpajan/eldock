"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Camera, ExternalLink, Palette } from "lucide-react";
import { toast } from "sonner";

import { FallbackImg } from "@/components/common/FallbackImg";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SeriesMaterial, SeriesShape } from "@/lib/panel-builder/abb-catalog-2026";
import { useEtimFrames } from "@/components/panel-builder/catalog-lookup";
import { lookOf, mockStyle, type LookColor } from "@/lib/panel-builder/series-look";
import { renderDeviceSvg, type RenderGang } from "@/lib/panel-builder/series-render";
import { seriesLink } from "@/lib/panel-builder/series-links";
import { seriesPhoto, type SeriesPhoto, type SeriesPhotoPart } from "@/lib/panel-builder/series-photos";
import { DESIGN_BRANDS, designSeriesOf, hasFrameChoice, isMonoblockSeries, resolveFrameColor, seriesColors, seriesFrameColors, type DesignSeries } from "@/lib/panel-builder/wiring-designs";

export { lookOf, mockStyle };
import { cn } from "@/lib/utils";

import { ManufacturerLogo, brandCardClass } from "../ManufacturerLogo";
import { SeriesPreviewIllustration, sameSlot, uploadSeriesPhoto, useCatalogPhotos, type PhotoSlot } from "./SeriesPreviewIllustration";

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
export function DeviceMockup({ shape, color, items, className, label, seriesKey, studio = true }: { shape: SeriesShape; color: LookColor | null; items: readonly MockupItem[]; className?: string; label?: string; seriesKey?: string | null; /** Fáze 100: bez vlastního studiového pozadí (náhledy v galerii). */ studio?: boolean }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}-`;
  const svg = renderDeviceSvg({ seriesKey: seriesKey ?? null, shape, look: lookOf(color, shape), items, id, label, fluid: true, studio });
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
 * Fáze 80: malý náhled řady v barvě (seznam řad, vzorky barev, lišta řad) – render z `public/catalog-images/`, jinak
 * kreslený náhled. Obrázek je dekorativní (název má tlačítko), okraj studiového pozadí se ořízne.
 */
export function SeriesThumb({ seriesKey, colorId, fallback, className, photos }: { seriesKey: string; colorId: string | null | undefined; fallback: ReactNode; className?: string; /** Fáze 92: i nahrané fotky. */ photos?: readonly SeriesPhoto[] }) {
  // Fáze 104: bez předaných fotek sdílené fotky řad ze serveru (manifest pro přihlášené)
  const shared = useCatalogPhotos(!photos).photos;
  const photo = colorId ? seriesPhoto(seriesKey, colorId, "switch", photos ?? shared) : null;
  if (!photo || (photo.color && photo.color !== colorId)) return <>{fallback}</>;
  return (
    <span className={cn("block shrink-0 overflow-hidden", className)} data-testid="series-thumb-photo" data-src={photo.src}>
      <FallbackImg src={photo.src} fallback={fallback} alt="" className="size-full scale-[1.45] object-cover" loading="lazy" decoding="async" />
    </span>
  );
}

/** Galerie designových řad: výrobce → řada (velký náhled, víceramček, materiál) → barvy klapky a rámečku s kódy a čísly rámečků. */
export function SeriesGallery({ seriesKey, color, frameColor = null, available, onChoose }: { seriesKey: string | null; color: string; frameColor?: string | null; available: Map<string, number>; onChoose: (patch: { series: string; color: string; frameColor: string | null }) => void }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<{ series: string; color: string; frameColor: string | null }>({ series: seriesKey ?? "ABB|Zoni", color, frameColor });
  // Fáze 92: reálné fotky – nahrané ve velínu (úložiště) mají přednost před staženými a před rendery
  const catalog = useCatalogPhotos(open);
  const photos = catalog.photos;
  const [uploadMode, setUploadMode] = useState(false);
  const [slot, setSlot] = useState<PhotoSlot | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoSource, setPhotoSource] = useState("");
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
  const colorId = chosen?.id ?? pick.color;
  const sourceText = photoSource.trim() || `${brand.label} – web / katalog výrobce`;
  // Fáze 94: rámečky 1R–5R barvy (rámečku) podle oficiálních dat ABB ETIM 9.0 – objednací číslo, EAN, v datech výrobce
  // Fáze 104: celý import ETIM je jen na serveru – rámečky zvolené barvy se načtou serverovou akcí
  const etimFrames = useEtimFrames(open ? `${seriesKeyOf}|${pick.frameColor ?? colorId}` : null);
  const setPhoto = !pick.frameColor ? seriesPhoto(seriesKeyOf, colorId, "set", photos) : null;

  /** Fáze 92: fotka do slotu (velín) – hned v galerii a pro všechny uživatele. */
  async function sendPhoto(target: PhotoSlot, file: Blob) {
    setSlot(target);
    setBusy(true);
    const result = await uploadSeriesPhoto(file, { series: seriesKeyOf, slot: target, source: sourceText });
    setBusy(false);
    if (typeof result === "string") return void toast.error(result);
    catalog.add(result);
    toast.success(`📷 Fotka uložena (${target.part === "switch" ? "spínač" : target.part === "socket" ? "zásuvka" : "víceramček"}${target.color ? ` · ${colors.find((option) => option.id === target.color)?.label ?? target.color}` : ""}) – vidí ji všichni uživatelé.`);
  }

  // Ctrl+V v režimu nahrávání: první obrázek ze schránky do vybraného slotu
  useEffect(() => {
    if (!open || !uploadMode) return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const file = [...(event.clipboardData?.items ?? [])].find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (!file) return void toast.error("Ve schránce není obrázek – zkopírujte fotku (pravé tlačítko → Kopírovat obrázek) a vložte znovu.");
      event.preventDefault();
      if (!slot) return void toast.error("Nejdřív klikněte na slot (Spínač 1R, Zásuvka 1R, Vícerámeček nebo dlaždici barvy).");
      void sendPhoto(slot, file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendPhoto čte aktuální řadu a slot z vykreslení
  }, [open, uploadMode, slot, seriesKeyOf, sourceText]);

  const uploadFor = (part: PhotoSlot["part"]) => (uploadMode ? { selected: sameSlot(slot, { part, color: colorId }), busy, onSelect: setSlot, onFile: (target: PhotoSlot, file: File) => void sendPhoto(target, file) } : null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setPick({ series: seriesKey ?? "ABB|Zoni", color, frameColor });
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="h-9 w-full gap-1.5 text-sm font-semibold" data-testid="series-gallery-open">
          <Palette className="size-4" aria-hidden /> 🎨 Otevřít velkou galerii řad a barev
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl" data-testid="series-gallery">
        <DialogHeader>
          <DialogTitle>Designové řady a barvy</DialogTitle>
          <DialogDescription>Náhled rámečku, krytů a víceramečku v barvách řady (ABB podle katalogu 2026) – barvu klapky a rámečku jde zvolit zvlášť. Klíčové řady ABB mají produktový render, ostatní kreslený náhled; barvy na obrazovce jsou orientační – přesný vzhled ověřte odkazem na web výrobce.</DialogDescription>
        </DialogHeader>
        {catalog.canUpload ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/5 px-2 py-1.5 text-xs" data-testid="gallery-upload-bar">
            <Button
              type="button"
              size="sm"
              variant={uploadMode ? "default" : "outline"}
              className={cn("h-8 gap-1.5", uploadMode && "bg-yellow-400 text-zinc-950 hover:bg-yellow-300")}
              aria-pressed={uploadMode}
              onClick={() => {
                setUploadMode((value) => !value);
                setSlot((current) => current ?? { part: "switch", color: colorId });
              }}
              data-testid="gallery-upload-toggle"
            >
              <Camera className="size-3.5" aria-hidden /> [ 📷 Nahrát reálné fotky (Ctrl+V / Soubor) ]
            </Button>
            {uploadMode ? (
              <>
                <span className="text-muted-foreground">Zkopírujte fotku z webu výrobce nebo z PDF katalogu, klikněte na slot a stiskněte Ctrl+V (nebo obrázek přetáhněte). Uvidí ji všichni uživatelé.</span>
                <label className="flex items-center gap-1">
                  Zdroj
                  <input value={photoSource} onChange={(event) => setPhotoSource(event.target.value)} placeholder={`${brand.label} – web / katalog výrobce`} maxLength={160} className="h-7 w-56 rounded border border-input bg-transparent px-1.5" data-testid="gallery-upload-source" />
                </label>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Výrobce">
          {DESIGN_BRANDS.map((option) => (
            <button key={option.manufacturer} type="button" role="radio" aria-checked={brand.manufacturer === option.manufacturer} aria-label={option.label} onClick={() => setPick({ series: `${option.manufacturer}|${option.series[0].name}`, color: seriesColors(`${option.manufacturer}|${option.series[0].name}`)[0].id, frameColor: null })} className={brandCardClass(brand.manufacturer === option.manufacturer)}>
              <ManufacturerLogo manufacturer={option.manufacturer} className="h-7 w-full" bare />
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
                    <SeriesThumb seriesKey={key} colorId={first?.id} photos={photos} className="h-10 w-10 rounded" fallback={<DeviceMockup seriesKey={key} shape={option.shape ?? "square"} color={first ?? { swatch: "#f8fafc" }} items={["switch"]} className="h-10 w-10 shrink-0 rounded" />} />
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
              {/* Fáze 92: reálná fotka (nahraná / stažená) před renderem; v režimu nahrávání sloty pro Ctrl+V */}
              <SeriesPreviewIllustration photo={!pick.frameColor ? seriesPhoto(seriesKeyOf, colorId, "switch", photos) : null} slot={{ part: "switch", color: colorId }} upload={uploadFor("switch")} caption="Spínač 1R" mockup={<DeviceMockup studio={false} seriesKey={seriesKeyOf} shape={shape} color={look} items={["switch"]} className="h-28 w-28 rounded-lg" label={`Spínač ${series.name}`} />} />
              <SeriesPreviewIllustration photo={!pick.frameColor ? seriesPhoto(seriesKeyOf, colorId, "socket", photos) : null} slot={{ part: "socket", color: colorId }} upload={uploadFor("socket")} caption="Zásuvka 1R" mockup={<DeviceMockup studio={false} seriesKey={seriesKeyOf} shape={shape} color={look} items={["socket"]} className="h-28 w-28 rounded-lg" label={`Zásuvka ${series.name}`} />} />
              {monoblock ? (
                // Fáze 90: monobloky nemají víceramček – nástěnná dvojzásuvka pod odklápěcími víčky
                <SeriesPreviewIllustration photo={seriesPhoto(seriesKeyOf, colorId, "set", photos)} slot={{ part: "set", color: colorId }} upload={uploadFor("set")} caption={`Dvojzásuvka ${series.ip ?? "IP44"} s odklápěcím víčkem (nástěnná)`} mockup={<DeviceMockup studio={false} seriesKey={seriesKeyOf} shape={shape} color={look} items={["socket", "socket"]} className="h-28 w-full max-w-60 rounded-lg" label={`Dvojzásuvka ${series.name} s víčkem`} />} />
              ) : (
                // Fáze 94: fotka z dat ETIM = prázdný rámeček 2R (víceramček), render = sestava 3R
                <SeriesPreviewIllustration photo={setPhoto} slot={{ part: "set", color: colorId }} upload={uploadFor("set")} caption={series.fixedPairs ? "3 samostatné přístroje · rozteč 91 mm" : setPhoto?.mpn ? "Víceramček – rámeček 2R" : "Víceramček 3R – vypínač + 2 zásuvky"} mockup={<DeviceMockup studio={false} seriesKey={seriesKeyOf} shape={shape} color={look} items={["switch", "socket", "socket"]} className="h-28 w-full max-w-80 rounded-lg" label={`Víceramček 3R ${series.name}`} />} />
              )}
            </div>
            {/* Fáze 80: zdroj a podmínky užití náhledů jednou pod řádkem náhledů */}
            {(() => {
              const sources = [...new Set(PREVIEW_PARTS.map((part) => (pick.frameColor ? null : seriesPhoto(seriesKeyOf, colorId, part, photos))).filter((photo) => photo !== null).map((photo) => `${photo.source} · ${photo.license}`))];
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
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={pick.color === option.id}
                    onClick={() => {
                      setPick((value) => ({ ...value, color: option.id }));
                      if (uploadMode) setSlot({ part: "switch", color: option.id });
                    }}
                    onDragOver={uploadMode ? (event) => event.preventDefault() : undefined}
                    onDrop={
                      uploadMode
                        ? (event) => {
                            event.preventDefault();
                            const file = [...event.dataTransfer.files].find((candidate) => candidate.type.startsWith("image/"));
                            if (file) void sendPhoto({ part: "switch", color: option.id }, file);
                          }
                        : undefined
                    }
                    className={cn("flex w-28 flex-col items-center gap-1 rounded-lg border p-1.5 text-center text-[11px] leading-tight", pick.color === option.id ? "border-primary bg-primary/15" : "border-border hover:border-primary/60", uploadMode && sameSlot(slot, { part: "switch", color: option.id }) && "ring-2 ring-yellow-400")}
                    data-testid="gallery-color"
                  >
                    <SeriesThumb seriesKey={seriesKeyOf} colorId={seriesColor?.id} photos={photos} className="h-12 w-12 rounded" fallback={<DeviceMockup seriesKey={seriesKeyOf} shape={shape} color={seriesColor ?? { swatch: option.swatch }} items={["switch"]} className="h-12 w-12 rounded" />} />
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
                // Fáze 94: skutečná fotka rámečku 1R v barvě (data ABB ETIM 9.0), jinak barevný čtvereček
                const framePhoto = seriesPhoto(seriesKeyOf, option.id, "frame", photos);
                const ownPhoto = framePhoto && framePhoto.color === option.id ? framePhoto : null;
                return (
                  <button key={option.id} type="button" role="radio" aria-checked={pick.frameColor === option.id} onClick={() => setPick((value) => ({ ...value, frameColor: option.id === value.color ? null : option.id }))} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]", ownPhoto && "py-0.5 pl-1", pick.frameColor === option.id ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")} data-testid="gallery-frame-color" data-photo={ownPhoto ? "true" : "false"}>
                    {ownPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element -- fotka rámečku z public/catalog-images
                      <img src={ownPhoto.src} alt="" className="size-7 rounded-full bg-white object-contain" loading="lazy" decoding="async" data-testid="gallery-frame-photo" />
                    ) : (
                      <span className="size-3.5 rounded-[3px] border-[3px]" style={{ borderColor: seriesColor?.frame ?? option.swatch }} aria-hidden />
                    )}
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
                {etimFrames?.length ? (
                  // Fáze 94: rámečky z kusovníku ověřené v oficiálních datech ABB ETIM 9.0 (objednací číslo + EAN)
                  <>
                    <dt className="text-muted-foreground">Rámečky 1R–5R</dt>
                    <dd className="flex flex-col gap-0.5" data-testid="gallery-etim-frames">
                      <span className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                        {etimFrames.map((frame) => (
                          <span key={frame.gangs} className={cn(!frame.inEtim && "text-amber-300")} title={frame.inEtim ? `v datech ABB ETIM 9.0${frame.gtin ? ` · EAN ${frame.gtin}` : ""}` : "objednací číslo v datech ABB ETIM 9.0 není – ověřte u výrobce"} data-testid="gallery-etim-frame" data-in-etim={frame.inEtim ? "true" : "false"}>
                            {frame.gangs}R {frame.mpn} {frame.inEtim ? "✓" : "⚠"}
                          </span>
                        ))}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {etimFrames.every((frame) => frame.inEtim)
                          ? "✓ všechna čísla jsou v oficiálních datech výrobce ABB ETIM 9.0 (EAN v kusovníku)"
                          : `⚠ ${etimFrames.filter((frame) => !frame.inEtim).length} z ${etimFrames.length} čísel data ABB ETIM 9.0 neuvádějí – ověřte u výrobce`}
                      </span>
                    </dd>
                  </>
                ) : (frameChosen ?? details).frameMpn?.some(Boolean) ? (
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
