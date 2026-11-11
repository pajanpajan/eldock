"use client";

import { enclosureImage } from "@/lib/panel-builder/catalog-images";
import { CATALOG_IMAGES } from "@/lib/panel-builder/catalog-images.generated";
import { cn } from "@/lib/utils";

/**
 * Fáze 94: oficiální fotka rozvodnice podle objednacího čísla výrobce (data ABB ETIM 9.0, `abb/enclosures/<mpn>.webp`);
 * fáze 97 i Hager (ETIM 10), OEZ a Schneider Electric (stránky výrobků) – `<výrobce>/enclosures/<objednací číslo>.webp`.
 * Bez fotky nic – zůstane kresba čela s DIN lištami. Malá varianta (`sm`) je jen `span` + `img` (smí být v tlačítku).
 */
export function EnclosurePhoto({ articleNumber, label, className, size = "md" }: { articleNumber: string | null | undefined; label?: string; className?: string; size?: "sm" | "md" }) {
  const image = enclosureImage(articleNumber, CATALOG_IMAGES);
  if (!image) return null;
  const alt = `Fotka rozvodnice ${label ?? articleNumber}`;
  if (size === "sm") {
    return (
      <span className={cn("block shrink-0", className)} data-testid="enclosure-photo" data-src={image.src}>
        {/* eslint-disable-next-line @next/next/no-img-element -- statická fotka z public/catalog-images */}
        <img src={image.src} alt={alt} className="h-14 w-14 rounded-md bg-white object-contain p-0.5" loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <figure className={cn("flex shrink-0 flex-col items-center gap-0.5", className)} data-testid="enclosure-photo" data-src={image.src}>
      {/* eslint-disable-next-line @next/next/no-img-element -- statická fotka z public/catalog-images */}
      <img src={image.src} alt={alt} className="h-28 w-auto rounded-md bg-white object-contain p-1" loading="lazy" decoding="async" />
      {/* Fáze 97: zdroj fotky podle výrobce (ABB ETIM 9.0, Hager ETIM 10, stránky výrobků OEZ / Schneider Electric) */}
      <figcaption className="max-w-40 text-center text-[10px] leading-tight text-muted-foreground" title={`${image.source} · ${image.license}`}>
        foto výrobce · {image.source.replace(/\s*\(.*\)$/, "")}
      </figcaption>
    </figure>
  );
}
