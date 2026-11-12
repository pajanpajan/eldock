"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Loader2, Upload } from "lucide-react";

import { FallbackImg } from "@/components/common/FallbackImg";

import type { PhotoPart } from "@/lib/panel-builder/catalog-photos";
import { withUploadedPhotos, type SeriesPhoto } from "@/lib/panel-builder/series-photos";
import { cn } from "@/lib/utils";

/** Slot galerie, do kterého jde fotka (díl + barva řady; bez barvy fotka celé řady). */
export interface PhotoSlot {
  part: PhotoPart;
  color: string | null;
}

export const sameSlot = (a: PhotoSlot | null, b: PhotoSlot) => Boolean(a && a.part === b.part && a.color === b.color);

/**
 * Fáze 92: nahrané reálné fotky řad z trvalého úložiště (`GET /api/catalog-images/manifest`) – načtou se při otevření
 * galerie; `canUpload` = přihlášený velín. Nová fotka se přidá hned (bez nového načtení). Fáze 104: manifest vrací
 * přihlášeným i fotky dílů řad z indexu katalogu (index do klientského bundlu nesmí) – jeden sdílený stav pro galerii
 * i náhledy řad v detailu, načte se jednou za otevření stránky.
 */
type CatalogPhotosState = { uploaded: readonly SeriesPhoto[]; catalog: readonly SeriesPhoto[]; canUpload: boolean };
const EMPTY_PHOTOS: CatalogPhotosState = { uploaded: [], catalog: [], canUpload: false };
let photosState: CatalogPhotosState = EMPTY_PHOTOS;
let photosRequested = false;
const photoListeners = new Set<() => void>();
const setPhotosState = (next: CatalogPhotosState) => {
  photosState = next;
  for (const listener of photoListeners) listener();
};
const subscribePhotos = (listener: () => void) => {
  photoListeners.add(listener);
  return () => void photoListeners.delete(listener);
};

function loadCatalogPhotos() {
  if (photosRequested) return;
  photosRequested = true;
  fetch("/api/catalog-images/manifest", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { photos?: SeriesPhoto[]; catalog?: SeriesPhoto[]; canUpload?: boolean } | null) => {
      if (data) setPhotosState({ uploaded: Array.isArray(data.photos) ? data.photos : [], catalog: Array.isArray(data.catalog) ? data.catalog : [], canUpload: data.canUpload === true });
      else photosRequested = false;
    })
    .catch(() => {
      photosRequested = false;
    });
}

/** Nově nahraná fotka (velín) hned v galerii i v náhledech. */
function addCatalogPhoto(photo: SeriesPhoto) {
  setPhotosState({ ...photosState, uploaded: [photo, ...photosState.uploaded.filter((entry) => !(entry.series === photo.series && entry.part === photo.part && (entry.color ?? null) === (photo.color ?? null)))] });
}

export function useCatalogPhotos(active: boolean) {
  useEffect(() => {
    if (active) loadCatalogPhotos();
  }, [active]);
  const state = useSyncExternalStore(subscribePhotos, () => photosState, () => EMPTY_PHOTOS);
  // Nahrané fotky (velín) mají přednost před fotkami z indexu a rendery
  const photos = useMemo(() => withUploadedPhotos(state.uploaded, state.catalog), [state]);
  return { photos, canUpload: state.canUpload, add: addCatalogPhoto };
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
  // Fáze 94: objednací číslo vyfoceného výrobku (fotka z dat ABB ETIM 9.0)
  const mpn = photo?.mpn ? (
    <span className="font-mono text-[10px] text-muted-foreground/80" data-testid="gallery-photo-mpn">
      č. {photo.mpn}
    </span>
  ) : null;
  // Fáze 99: fotka, která se nenačte, se hned nahradí vektorovým studiovým náhledem dílu
  // Fáze 100: místo oslňující bílé plochy jemné studio (slate-100 → slate-200) s vnitřním rámečkem a stínem pod přístrojem –
  // bílé řady (Zoni, Levit, Decento, Garant) mají jasné kontury a hloubku; bílé pozadí fotky se do studia vpije (multiply)
  const body = (
    <span className="flex h-32 w-full items-center justify-center rounded-xl bg-gradient-to-b from-slate-100 to-slate-200/90 p-2 shadow-inner ring-1 ring-slate-900/10 ring-inset" data-testid="gallery-studio">
      {photo ? (
        <FallbackImg src={photo.src} fallback={<span className="block drop-shadow-md">{mockup}</span>} alt={`${caption} – ${photo.photo ? "fotka" : "náhled"} řady`} className="h-28 w-auto max-w-full object-contain mix-blend-multiply" data-testid="gallery-photo" data-real={photo.photo ? "true" : "false"} />
      ) : (
        <span className="block drop-shadow-md" data-testid="gallery-mockup">
          {mockup}
        </span>
      )}
    </span>
  );
  if (!upload) {
    return (
      <figure className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground" data-photo={photo ? "true" : "false"} data-real={photo?.photo ? "true" : "false"} data-slot={slot.part}>
        {body}
        {caption}
        {mpn}
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
      {mpn}
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
