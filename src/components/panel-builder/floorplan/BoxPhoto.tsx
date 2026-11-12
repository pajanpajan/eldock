"use client";

import { FallbackImg } from "@/components/common/FallbackImg";
import { boxImage } from "@/lib/panel-builder/catalog-images";
import { CATALOG_IMAGES } from "@/lib/panel-builder/catalog-images.generated";
import { cn } from "@/lib/utils";

/**
 * Fáze 97: reálná fotka instalační krabice podle objednacího kódu výrobce (KOPOS – stránka výrobku e-shopu kopos.cz,
 * `kopos/boxes/<kód>.webp`). Bez fotky nic. Zdroj a podmínky užití v titulku.
 */
export function BoxPhoto({ code, label, className }: { code: string | null | undefined; label?: string; className?: string }) {
  const image = boxImage(code, CATALOG_IMAGES);
  if (!image) return null;
  return (
    // Fáze 99: nenačtená fotka se jen vynechá (žádný rozbitý obrázek)
    <FallbackImg src={image.src} alt={`Fotka krabice ${label ?? code}`} title={`${image.source} · ${image.license}`} className={cn("size-12 shrink-0 rounded-md bg-white object-contain p-0.5", className)} loading="lazy" decoding="async" data-testid="box-photo" data-src={image.src} />
  );
}
