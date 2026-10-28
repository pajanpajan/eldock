"use client";

import { useState } from "react";

import { MarkupOverlay } from "@/components/canvas/MarkupOverlay";
import type { MarkupData } from "@/lib/markup";
import { SCHEMATIC_HEIGHT, SCHEMATIC_WIDTH } from "@/lib/mock-graphics/schematic";
import { cn } from "@/lib/utils";

/** Schéma (přes `<img>`) s vrstvou zákresu technika. Poměr stran se upřesní po načtení obrázku. */
export function MarkupPreview({
  src,
  markup,
  alt,
  className,
}: {
  src: string;
  markup: MarkupData | null;
  alt: string;
  className?: string;
}) {
  const [aspect, setAspect] = useState(SCHEMATIC_WIDTH / SCHEMATIC_HEIGHT);
  return (
    <div className={cn("relative overflow-hidden rounded-lg bg-white", className)} style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- schéma z /api/files; SVG přes <img> nespouští skripty */}
      <img
        src={src}
        alt={alt}
        className="absolute inset-0 size-full object-contain"
        onLoad={(event) => {
          const { naturalWidth, naturalHeight } = event.currentTarget;
          if (naturalWidth && naturalHeight) setAspect(naturalWidth / naturalHeight);
        }}
      />
      {markup ? <MarkupOverlay markup={markup} aspect={aspect} /> : null}
    </div>
  );
}
