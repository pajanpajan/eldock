"use client";

import { FallbackImg } from "@/components/common/FallbackImg";
import { useCatalogEan, useCatalogImage } from "@/components/panel-builder/catalog-lookup";
import { cn } from "@/lib/utils";

/**
 * Fáze 97: reálná fotka instalační krabice podle objednacího kódu výrobce (KOPOS – stránka výrobku e-shopu kopos.cz,
 * `kopos/boxes/<kód>.webp`). Bez fotky nic. Zdroj a podmínky užití v titulku.
 */
export function BoxPhoto({ code, label, className }: { code: string | null | undefined; label?: string; className?: string }) {
  // Fáze 104: fotka krabice ze serveru (index fotek do klientského bundlu nesmí)
  const image = useCatalogImage("box", code);
  if (!image) return null;
  return (
    // Fáze 99: nenačtená fotka se jen vynechá (žádný rozbitý obrázek)
    <FallbackImg src={image.src} alt={`Fotka krabice ${label ?? code}`} title={`${image.source} · ${image.license}`} className={cn("size-12 shrink-0 rounded-md bg-white object-contain p-0.5", className)} loading="lazy" decoding="async" data-testid="box-photo" data-src={image.src} />
  );
}

/** Fáze 104: EAN krabice ze stránky výrobku (KOPOS) – ze serveru, data KOPOS do klientského bundlu nesmí. */
export function BoxEan({ code }: { code: string | null | undefined }) {
  const ean = useCatalogEan(code, true);
  return ean ? <span className="block text-[10px] text-muted-foreground" data-testid="element-box-ean">EAN {ean}</span> : null;
}
