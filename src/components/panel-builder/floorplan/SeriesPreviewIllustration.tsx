"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";

import type { PhotoPart } from "@/lib/panel-builder/catalog-photos";
import type { SeriesPhoto } from "@/lib/panel-builder/series-photos";
import { cn } from "@/lib/utils";

/** Slot galerie, do kterého jde fotka (díl + barva řady; bez barvy fotka celé řady). */
export interface PhotoSlot {
  part: PhotoPart;
  color: string | null;
}

export const sameSlot = (a: PhotoSlot | null, b: PhotoSlot) => Boolean(a && a.part === b.part && a.color === b.color);

/**
 * Fáze 92: nahrané reálné fotky řad z trvalého úložiště (`GET /api/catalog-images/manifest`) – načtou se při otevření
 * galerie; `canUpload` = přihlášený velín. Nová fotka se přidá hned (bez nového načtení).
 */
export function useCatalogPhotos(active: boolean) {
  const [state, setState] = useState<{ photos: SeriesPhoto[]; canUpload: boolean }>({ photos: [], canUpload: false });
  useEffect(() => {
    if (!active) return;
    let alive = true;
    fetch("/api/catalog-images/manifest", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { photos?: SeriesPhoto[]; canUpload?: boolean } | null) => {
        if (alive && data) setState({ photos: Array.isArray(data.photos) ? data.photos : [], canUpload: data.canUpload === true });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [active]);
  const add = useCallback((photo: SeriesPhoto) => setState((current) => ({ ...current, photos: [photo, ...current.photos.filter((entry) => !(entry.series === photo.series && entry.part === photo.part && (entry.color ?? null) === (photo.color ?? null)))] })), []);
  return { ...state, add };
}

/** Nahrání fotky do slotu (velín); vrací fotku galerie nebo text chyby. */
export async function uploadSeriesPhoto(file: Blob, input: { series: string; slot: PhotoSlot; source: string }): Promise<SeriesPhoto | string> {
  const form = new FormData();
  form.set("file", file, file instanceof File ? file.name : "schranka.png");
  form.set("series", input.series);
  form.set("part", input.slot.part);
  if (input.slot.color) form.set("color", input.slot.color);
  form.set("source", input.source);
  try {
    const response = await fetch("/api/catalog-images/upload", { method: "POST", body: form });
    const data = (await response.json().catch(() => null)) as { photo?: SeriesPhoto; error?: string } | null;
    if (!response.ok || !data?.photo) return data?.error ?? "Fotku se nepodařilo nahrát.";
    return data.photo;
  } catch {
    return "Fotku se nepodařilo nahrát – zkontrolujte připojení.";
  }
}

/**
 * Fáze 92: náhled dílu řady v galerii – reálná fotka (nahraná ve velínu, stažená harvesterem nebo schválená ručně) se
 * zdrojem, jinak vektorový render / kresba. V režimu „📷 Nahrát reálné fotky“ je náhled slot: klik ho vybere, Ctrl+V vloží
 * fotku ze schránky (obsluhuje galerie), přetažení obrázku nebo „Soubor“ ji nahraje rovnou.
 */
export function SeriesPreviewIllustration({
  photo,
  mockup,
  caption,
  slot,
  upload,
}: {
  photo: SeriesPhoto | null;
  mockup: ReactNode;
  caption: string;
  slot: PhotoSlot;
  upload?: { selected: boolean; busy: boolean; onSelect: (slot: PhotoSlot) => void; onFile: (slot: PhotoSlot, file: File) => void } | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const body = photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- fotky z public/catalog-images a z úložiště katalogu (/api/catalog-images)
    <img src={photo.src} alt={`${caption} – ${photo.photo ? "fotka" : "náhled"} řady`} className="h-28 w-auto max-w-full rounded-lg object-contain shadow-sm" data-testid="gallery-photo" data-real={photo.photo ? "true" : "false"} />
  ) : (
    mockup
  );
  if (!upload) {
    return (
      <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground" data-photo={photo ? "true" : "false"} data-real={photo?.photo ? "true" : "false"} data-slot={slot.part}>
        {body}
        {caption}
      </figure>
    );
  }
  return (
    <figure
      className={cn("relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-1 text-[11px] text-muted-foreground outline-none", upload.selected ? "border-yellow-400 bg-yellow-400/10" : "border-border hover:border-yellow-400/60", over && "border-primary bg-primary/10")}
      role="button"
      tabIndex={0}
      aria-pressed={upload.selected}
      aria-label={`Slot ${caption} – vyberte a vložte fotku (Ctrl+V), přetáhněte obrázek nebo zvolte soubor`}
      onClick={() => upload.onSelect(slot)}
      onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && upload.onSelect(slot)}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const file = [...event.dataTransfer.files].find((candidate) => candidate.type.startsWith("image/"));
        if (file) upload.onFile(slot, file);
      }}
      data-photo={photo ? "true" : "false"}
      data-real={photo?.photo ? "true" : "false"}
      data-slot={slot.part}
      data-selected={upload.selected ? "true" : "false"}
      data-testid={`photo-slot-${slot.part}`}
    >
      {body}
      {caption}
      <span className="flex items-center gap-1 text-[10px] text-yellow-200">
        {upload.busy && upload.selected ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
        {upload.selected ? "Vybráno – Ctrl+V vloží fotku" : "Klikněte a vložte Ctrl+V"}
        <button
          type="button"
          className="ml-1 inline-flex items-center gap-0.5 rounded border border-border px-1 hover:border-primary"
          onClick={(event) => {
            event.stopPropagation();
            upload.onSelect(slot);
            input.current?.click();
          }}
        >
          <Upload className="size-3" aria-hidden /> Soubor
        </button>
      </span>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.onFile(slot, file);
          event.target.value = "";
        }}
        data-testid={`photo-slot-file-${slot.part}`}
      />
    </figure>
  );
}
