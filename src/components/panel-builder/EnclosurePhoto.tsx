"use client";

import { FallbackImg } from "@/components/common/FallbackImg";
import { useCatalogImage } from "@/components/panel-builder/catalog-lookup";
import { cn } from "@/lib/utils";

/**
 * Fáze 94: oficiální fotka rozvodnice podle objednacího čísla výrobce (data ABB ETIM 9.0, `abb/enclosures/<mpn>.webp`);
 * fáze 97 i Hager (ETIM 10), OEZ a Schneider Electric (stránky výrobků) – `<výrobce>/enclosures/<objednací číslo>.webp`.
 * Bez fotky nic – zůstane kresba čela s DIN lištami. Malá varianta (`sm`) je jen `span` + `img` (smí být v tlačítku).
 */
// Fáze 104: index fotek je jen na serveru – serverová stránka fotku předá (`image`), jinak se dohledá podle objednacího čísla
export function EnclosurePhoto({ articleNumber, label, className, size = "md", image: given }: { articleNumber: string | null | undefined; label?: string; className?: string; size?: "sm" | "md"; image?: { src: string; source: string; license: string } | null }) {
  const found = useCatalogImage("enclosure", given === undefined ? articleNumber : null);
  const image = given === undefined ? found : given;
  if (!image) return null;
  const alt = `Fotka rozvodnice ${label ?? articleNumber}`;
  if (size === "sm") {
    return (
      <span className={cn("block shrink-0", className)} data-testid="enclosure-photo" data-src={image.src}>
        {/* Fáze 99: nenačtená fotka nezobrazí rozbitý obrázek – zůstane kresba čela skříně */}
        <FallbackImg src={image.src} alt={alt} className="h-14 w-14 rounded-md bg-white object-contain p-0.5" loading="lazy" decoding="async" />
      </span>
    );
  }
  return (
    <figure className={cn("flex shrink-0 flex-col items-center gap-0.5", className)} data-testid="enclosure-photo" data-src={image.src}>
      <FallbackImg src={image.src} alt={alt} className="h-28 w-auto rounded-md bg-white object-contain p-1" loading="lazy" decoding="async" />
      {/* Fáze 97: zdroj fotky podle výrobce (ABB ETIM 9.0, Hager ETIM 10, stránky výrobků OEZ / Schneider Electric) */}
      <figcaption className="max-w-40 text-center text-[10px] leading-tight text-muted-foreground" title={`${image.source} · ${image.license}`}>
        foto výrobce · {image.source.replace(/\s*\(.*\)$/, "")}
      </figcaption>
    </figure>
  );
}
