"use client";

import { useState } from "react";

import { MarkupOverlay } from "@/components/canvas/MarkupOverlay";
import type { MarkupData } from "@/lib/markup";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH } from "@/lib/mock-graphics/schematic";
import { useDrawingImage } from "@/lib/use-drawing-image";
import { cn } from "@/lib/utils";

/**
 * Schéma (přes `<img>`) s vrstvou zákresu technika. Poměr stran se upřesní po načtení obrázku.
 * U PDF revize (`pdfPage`) se stránka vykreslí přes pdf.js.
 */
export function MarkupPreview({
  src,
  markup,
  alt,
  className,
  pdfPage = null,
}: {
  src: string;
  /** Číslo stránky, je-li `src` PDF. */
  pdfPage?: number | null;
  markup: MarkupData | null;
  alt: string;
  className?: string;
}) {
  const [aspect, setAspect] = useState(SCHEMATIC_WIDTH / SCHEMATIC_HEIGHT);
  const image = useDrawingImage(src, pdfPage);
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-white", className)} style={{ aspectRatio: aspect }}>
      {image.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- schéma z /api/files nebo vykreslené PDF (blob:); SVG přes <img> nespouští skripty
        <img
        src={image.src}
        alt={alt}
        className="absolute inset-0 size-full object-contain"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) setAspect(naturalWidth / naturalHeight);
        }}
      />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">{image.error ? "Výkres se nepodařilo vykreslit." : "Vykresluji výkres…"}</span>
      )}
      {markup ? <MarkupOverlay markup={markup} aspect={aspect} /> : null}
    </div>
  );
}
